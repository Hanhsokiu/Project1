import { HttpException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import {
  CommitteeGradeCommandSchema,
  ReviewerPolicySchema,
} from "@doan/shared";
import type {
  CommitteeGradeCommand,
  CommitteeGradeQuery,
  CommitteeGradeView,
  CommitteeGradeProgress,
  EffectiveCommittee,
  EffectiveCommitteeGrade,
} from "@doan/shared";
import {
  CommitteeGradeRepository,
  CommitteeGradeSession,
} from "./committee-grade.repository";
import { CommitteeGradeValidator } from "./committee-grade.validator";
import { committeeGradeContext } from "./committee-grade.context";
import { CommitteeWorkflowService } from "../committees/committee-workflow.service";
import {
  CommitteeRecord,
  committeeJson,
} from "../committees/committee.repository";
import { ScheduleService } from "../scheduling/schedule.service";
import { ReviewerService } from "../reviewers/reviewer.service";
import {
  currentGradeSchedule,
  gradeScheduleHash,
  readGradePdf,
} from "../grading/grade-evidence";
import { gradeSnapshotHash } from "../reviewer-grading/reviewer-grade.context";
import {
  ProposalReviewValidator,
  reviewHash,
} from "../../topic/proposal-reviews/proposal-review.validator";
import type { ReviewPrincipal } from "../../topic/proposal-reviews/proposal-review.repository";
import { GuidanceValidator } from "../../guidance/tasks/guidance.validator";
import { FileStorageService } from "../../common/storage/file-storage.service";
import { operationWindow } from "../../term/service/term-window.service";
import { groupError } from "../../topic/review-groups/review-group.errors";
function missing(): never {
  return groupError(
    404,
    "COMMON_001",
    "Không tìm thấy phiếu trong phạm vi được cấp quyền.",
  );
}
function blocked(code: string, message = code): never {
  return groupError(409, code, message);
}
const codeOf = (e: HttpException) =>
  (e.getResponse() as { error?: { code?: string } }).error?.code ??
  "COMMITTEE_NOT_CURRENT";
@Injectable()
export class CommitteeGradeService {
  constructor(
    private readonly repo: CommitteeGradeRepository,
    private readonly committees: CommitteeWorkflowService,
    private readonly schedules: ScheduleService,
    private readonly reviewers: ReviewerService,
    private readonly review: ProposalReviewValidator,
    private readonly roles: GuidanceValidator,
    private readonly v: CommitteeGradeValidator,
    private readonly storage: FileStorageService,
    private readonly config: ConfigService,
  ) {}
  private has(u: ReviewPrincipal, role: string, action: string) {
    return this.roles.role(u, role, "defense-committee-grade", action);
  }
  private ownReader(u: ReviewPrincipal) {
    return (
      !!u.lecturer?.isActive &&
      this.has(u, "LECTURER", "read") &&
      this.has(u, "LECTURER", "read-own")
    );
  }
  private facultyReader(u: ReviewPrincipal) {
    return (
      this.has(u, "FACULTY", "read") && this.has(u, "FACULTY", "progress-read")
    );
  }
  private async principal(s: CommitteeGradeSession, actor: string) {
    const u = this.review.principal(await s.principal(actor));
    if (!this.ownReader(u) && !this.facultyReader(u))
      groupError(
        403,
        "AUTH_004",
        "Cần quyền chấm phiếu riêng hoặc theo dõi của đúng vai trò.",
      );
    return u;
  }
  private async granted(
    s: CommitteeGradeSession,
    u: ReviewPrincipal,
    termId: string,
    departments: (string | null)[],
  ) {
    if (!this.facultyReader(u)) return false;
    const gs = (await s.grants(u.id, termId)).filter(
      (g) => g.termId === termId,
    );
    return departments.every(
      (d) =>
        !!d &&
        gs.some(
          (g) =>
            g.allDepartments ||
            g.pr2bGrantDepartmentGrantId.some((p) => p.departmentId === d),
        ),
    );
  }
  private async effective(
    s: CommitteeGradeSession,
    row: CommitteeRecord,
  ): Promise<EffectiveCommittee | null> {
    if (!row.finalizedBy || row.state !== "FINALIZED" || !row.revision)
      return null;
    try {
      const w = await this.committees.workspaceInSession(
          s,
          row.finalizedBy,
          row.termId,
        ),
        c = w.committees.find((c) => c.id === row.id);
      if (!c?.downstream) return null;
      return await this.committees.effectiveInSession(
        s,
        row.finalizedBy,
        row.termId,
        row.id,
        c.revision,
        c.downstream.evidenceHash,
      );
    } catch (e) {
      if (
        !(e instanceof HttpException) ||
        ![401, 403, 404, 409].includes(e.getStatus())
      )
        throw e;
      return null;
    }
  }
  private async dualRole(
    s: CommitteeGradeSession,
    termId: string,
    proposalId: string,
    member: string,
    lecturerId: string,
  ) {
    if (!(await s.rwReady()))
      return { hash: null, issue: "UC20_SCHEMA_REQUIRED" };
    const rows = (await s.rwRows(termId)).filter(
      (r) =>
        r.proposalId === proposalId &&
        r.reviewerId === lecturerId &&
        (r.selected || !r.revision),
    );
    if (!rows.length) return { hash: null, issue: null };
    try {
      const p = ReviewerPolicySchema.parse(
          JSON.parse((await s.rwPolicy(termId))?.value ?? "null"),
        ),
        row = rows[0];
      if (
        p.committeeMembership !== "ALLOW" ||
        new Date(p.approvedAt) > new Date() ||
        !row.finalizedBy ||
        row.state !== "FINALIZED" ||
        row.termStudentId !== member
      )
        throw Error("unverified dual role");
      const w = await this.reviewers.workspaceInSession(
          s,
          row.finalizedBy,
          termId,
        ),
        c = w.students.find((c) => c.id === member);
      if (!c?.downstream) throw Error("unverified dual role");
      const ef = (
        await this.reviewers.effectiveInSession(
          s,
          row.finalizedBy,
          termId,
          member,
          c.revision,
          c.evidenceHash,
        )
      ).find((r) => r.assignmentId === row.id && r.lecturerId === lecturerId);
      if (!ef) throw Error("unverified dual role");
      return { hash: reviewHash(ef), issue: null };
    } catch (e) {
      if (
        e instanceof HttpException &&
        ![401, 403, 404, 409].includes(e.getStatus())
      )
        throw e;
      return { hash: null, issue: "DUAL_REVIEWER_ROLE_UNVERIFIED" };
    }
  }
  private async load(
    s: CommitteeGradeSession,
    actor: string,
    termId: string,
    committeeId: string,
    memberId: string,
    requestedLecturer?: string,
  ) {
    const u = await this.principal(s, actor),
      lecturerId = requestedLecturer ?? u.lecturer?.id;
    if (!lecturerId) return missing();
    if (!(await s.ccReady())) blocked("UC19_SCHEMA_REQUIRED");
    const row = (await s.ccList(termId)).find((c) => c.id === committeeId),
      member = await s.member(memberId),
      owner = await s.memberProposal(memberId),
      p = owner.proposals.length === 1 ? owner.proposals[0] : null;
    if (
      !row ||
      row.termId !== termId ||
      !member ||
      member.termId !== termId ||
      !member.student.isActive ||
      !p ||
      p.termId !== termId ||
      p.studentId !== member.studentId
    )
      return missing();
    this.review.ownership(p);
    if (p.topic.pr2bTopicWorkflowTopicId?.termStudentId !== memberId)
      return missing();
    const assigned = row.studentAssignments.find(
        (a) =>
          a.termStudentId === memberId &&
          a.proposalId === p.id &&
          a.state === "ACTIVE",
      ),
      rawMember = row.members.find((m) => m.lecturerId === lecturerId);
    if (
      !assigned ||
      !rawMember ||
      !["CHAIR", "SECRETARY", "MEMBER"].includes(rawMember.role)
    )
      return missing();
    const own = this.ownReader(u) && u.lecturer!.id === lecturerId,
      dept =
        p.topic.researchArea?.pr2bResearchAreaWorkflowResearchAreaId
          ?.departmentId ?? null;
    if (!own && !(await this.granted(s, u, termId, [row.departmentId, dept])))
      return missing();
    const ready = await s.cgReady(),
      scores = ready ? await s.cgScores(p.id, lecturerId) : [],
      score = scores.length === 1 ? scores[0] : null,
      ctx = committeeGradeContext(score?.context),
      events = score ? await s.cgEvents(score.id) : [];
    const detailMap = score
      ? Object.fromEntries(
          score.scoreDetails.map((d) => [
            d.rubricCriteriaId,
            d.score.toString(),
          ]),
        )
      : {};
    const provenance = !!(
      score &&
      score.role === "COMMITTEE_MEMBER" &&
      ctx &&
      ctx.termId === termId &&
      ctx.termStudentId === memberId &&
      ctx.committeeId === committeeId &&
      ctx.lecturerId === lecturerId &&
      score.revision === ctx.command.expectedRevision + 1 &&
      score.reportVersionId === ctx.command.reportVersionId &&
      score.comment === ctx.command.comment &&
      score.totalScore?.toString() ===
        (ctx.evaluation.totalScore === null
          ? undefined
          : new Prisma.Decimal(ctx.evaluation.totalScore).toString()) &&
      reviewHash(detailMap) ===
        reviewHash(
          Object.fromEntries(
            Object.entries(ctx.evaluation.criterionScores).map(([k, v]) => [
              k,
              new Prisma.Decimal(v).toString(),
            ]),
          ),
        ) &&
      score.updatedAt <= new Date() &&
      events.some((e) => {
        const v = e.newValue as {
          revision?: number;
          snapshotHash?: string;
        } | null;
        return (
          e.userId === ctx.updatedBy &&
          v?.revision === score.revision &&
          v.snapshotHash === gradeSnapshotHash(score) &&
          ["COMMITTEE_GRADE_SAVED", "COMMITTEE_GRADE_FINALIZED"].includes(
            e.action,
          )
        );
      }) &&
      (score.isLocked
        ? !!ctx.finalizedBy &&
          ctx.finalizedBy === ctx.updatedBy &&
          !!ctx.finalizedAt &&
          new Date(ctx.finalizedAt) <= new Date()
        : !ctx.finalizedBy && !ctx.finalizedAt)
    );
    const effective = await this.effective(s, row),
      official = effective?.students.find(
        (a) => a.termStudentId === memberId && a.proposalId === p.id,
      ),
      membership = effective?.members.find((m) => m.lecturerId === lecturerId);
    if (own && (!effective || !official || !membership) && !provenance)
      blocked(
        "COMMITTEE_NOT_CURRENT",
        "Hội đồng/phân sinh viên chưa chốt hoặc nguồn không còn hiệu lực.",
      );
    const issues: string[] = [];
    if (!ready) issues.push("UC23_SCHEMA_REQUIRED");
    if (!effective || !official || !membership)
      issues.push("COMMITTEE_NOT_CURRENT");
    const rawPolicy = (await s.cgPolicy(termId))?.value,
      policy = this.v.policy(rawPolicy),
      policyHash = reviewHash(policy),
      rubricHash = reviewHash(policy?.rubric ?? null);
    if (!policy) issues.push(this.v.policyIssue(rawPolicy));
    const memberRole = (membership?.role ??
        rawMember.role) as CommitteeGradeView["memberRole"],
      membershipHash = reviewHash(
        effective?.members ??
          row.members.map((m) => ({ lecturerId: m.lecturerId, role: m.role })),
      );
    if (policy && !policy.gradingRoles.includes(memberRole))
      issues.push("MEMBER_ROLE_NOT_AUTHORIZED");
    if (scores.length && (!score || !provenance))
      issues.push("LEGACY_SCORE_RECONCILIATION_REQUIRED");
    const dual = effective
      ? await this.dualRole(s, termId, p.id, memberId, lecturerId)
      : { hash: null, issue: null };
    if (dual.issue) issues.push(dual.issue);
    let pdf: Awaited<ReturnType<typeof readGradePdf>> | null = null;
    if (effective && official && membership)
      try {
        pdf = await readGradePdf(s, this.storage, p.id);
        if (
          pdf.asset.createdByUserId !== p.student.userId ||
          pdf.version.submittedAt > new Date()
        )
          blocked("FILE_INTEGRITY_FAILED");
      } catch (e) {
        if (!(e instanceof HttpException)) throw e;
        issues.push(codeOf(e));
        pdf = null;
      }
    if (policy) {
      const rs = await s.rgRubric(
        termId,
        policy.rubric.criteria.map((c) => c.id),
      );
      if (
        rs.length !== policy.rubric.criteria.length ||
        policy.rubric.criteria.some(
          (c) =>
            !rs.some(
              (r) =>
                r.id === c.id &&
                r.name === c.name &&
                r.description === c.description &&
                r.maxScore.eq(c.maxScore) &&
                r.weight.eq(c.weight),
            ),
        )
      )
        issues.push("RUBRIC_SOURCE_MISMATCH");
    }
    const schedule =
      effective && official && membership
        ? await currentGradeSchedule(s, this.schedules, {
            termId,
            committeeId,
            termStudentId: memberId,
            proposalId: p.id,
          })
        : null;
    const scheduleHash = schedule
        ? gradeScheduleHash(
            schedule,
            policy?.schedule.requirePublished ?? false,
          )
        : null,
      slot = schedule?.slots.find(
        (x) => x.termStudentId === memberId && x.proposalId === p.id,
      );
    if (!schedule || !slot) issues.push("UC21_CURRENT_SCHEDULE_REQUIRED");
    if (policy?.schedule.requirePublished && !schedule?.publishedAt)
      issues.push("UC21_PUBLISHED_REQUIRED");
    const bindingHash = reviewHash({
      committee: effective,
      membership: membership ?? null,
      official: official ?? null,
      dual: dual.hash,
      report: pdf ? { id: pdf.version.id, checksum: pdf.asset.checksum } : null,
      policyHash,
      rubricHash,
      scheduleHash,
    });
    const sourceCurrent =
      !!effective &&
      !!official &&
      !!membership &&
      !!pdf &&
      !!policy &&
      !!schedule &&
      !issues.length &&
      (!score ||
        (provenance &&
          ctx?.bindingHash === bindingHash &&
          ctx.memberRole === membership.role &&
          reviewHash(ctx.policy) === policyHash &&
          (!score.isLocked ||
            (policy.defenseEvidence === "NOT_REQUIRED" &&
              !!ctx.finalizedAt &&
              this.v.applicable(policy, new Date(ctx.finalizedAt))))));
    const state: CommitteeGradeView["state"] = scores.length
      ? !provenance
        ? "LEGACY_UNVERIFIED"
        : !sourceCurrent
          ? "STALE"
          : score!.isLocked
            ? "FINALIZED"
            : "DRAFT"
      : "NONE";
    const blockers = [...issues];
    if (policy && !this.v.applicable(policy))
      blockers.push("UC23_POLICY_NOT_EFFECTIVE");
    if (score && provenance && !sourceCurrent)
      blockers.push("GRADE_SOURCE_CHANGED");
    if (this.config.get("UC23_WRITES_ENABLED", "false") !== "true")
      blockers.push("UC23_NOT_ENABLED");
    const term = await s.windowTerm(termId),
      window = term ? operationWindow(term, "DEFENSE") : null;
    if (!window?.canWrite)
      blockers.push(window?.reason ?? "DEFENSE_PHASE_REQUIRED");
    if (schedule && slot && policy) {
      const start =
          policy.schedule.anchor === "SLOT" ? slot.startAt : schedule.startAt,
        end = policy.schedule.anchor === "SLOT" ? slot.endAt : schedule.endAt;
      if (Date.now() < Date.parse(start) || Date.now() >= Date.parse(end))
        blockers.push("GRADING_WINDOW_CLOSED");
    }
    if (score?.isLocked) blockers.push("GRADE_FINALIZED_IMMUTABLE");
    const finalizeBlockers =
      policy?.defenseEvidence === "REQUIRED"
        ? ["DEFENSE_PERFORMANCE_PRODUCER_REQUIRED"]
        : [];
    const readScore = own || this.has(u, "FACULTY", "score-read"),
      readComment = own || this.has(u, "FACULTY", "comment-read");
    const view: CommitteeGradeView = {
      termId,
      termStudentId: memberId,
      proposalId: p.id,
      committeeId,
      committeeCode: row.code ?? "",
      lecturerId,
      lecturerName: rawMember.lecturer.fullName,
      memberRole,
      studentCode: p.student.studentCode,
      studentName: p.student.fullName,
      title: p.topic.title,
      revision: score?.revision ?? 0,
      state,
      committeeRevision: effective?.revision ?? row.revision,
      committeeEvidenceHash: effective?.evidenceHash ?? reviewHash(null),
      assignmentRevision: official?.assignmentRevision ?? assigned.revision,
      membershipHash,
      policy,
      policyHash,
      rubricHash,
      report: pdf
        ? {
            id: pdf.version.id,
            sequence: pdf.version.sequence,
            checksum: pdf.asset.checksum,
            name: pdf.asset.originalName,
          }
        : null,
      gradedPolicyVersion: readScore ? (ctx?.policyVersion ?? null) : null,
      gradedRubric: readScore ? (ctx?.policy.rubric ?? null) : null,
      schedule:
        schedule && slot
          ? {
              id: schedule.sessionId,
              revision: schedule.revision,
              date: schedule.date,
              period: schedule.period,
              startAt: slot.startAt,
              endAt: slot.endAt,
              order: slot.order,
              hash: scheduleHash!,
            }
          : null,
      score:
        score && readScore
          ? {
              totalScore: score.totalScore?.toString() ?? null,
              criterionScores: detailMap,
            }
          : null,
      comment: score && readComment ? (score.comment ?? "") : null,
      history:
        provenance && (own || this.has(u, "FACULTY", "history-read"))
          ? events.map((e) => ({
              revision:
                (e.newValue as { revision?: number } | null)?.revision ?? 0,
              action: e.action,
              at: e.createdAt.toISOString(),
              actor: e.userId,
            }))
          : [],
      blockers: [...new Set(blockers)],
      finalizeBlockers,
      permissions: {
        save:
          own && this.has(u, "LECTURER", "save-own") && !!policy?.draftAllowed,
        finalize: own && this.has(u, "LECTURER", "finalize-own"),
        download:
          own &&
          this.has(u, "LECTURER", "download-own") &&
          !!effective &&
          !!official &&
          !!membership &&
          !!pdf,
      },
    };
    return {
      view,
      u,
      own,
      score,
      ctx,
      policy,
      sourceCurrent,
      bindingHash,
      effective,
      official,
      membership,
      pdf,
      schedule,
    };
  }
  options(actor: string) {
    return this.repo.read(async (s) => {
      const u = await this.principal(s, actor),
        ids = new Set<string>(),
        committees: {
          termId: string;
          id: string;
          code: string;
          name: string;
          role: string | null;
        }[] = [];
      if (this.ownReader(u))
        for (const r of await s.cgTermIds(u.lecturer!.id))
          ids.add(r.committee.termId);
      if (this.facultyReader(u))
        for (const g of await s.grants(actor))
          if (g.allDepartments || g.pr2bGrantDepartmentGrantId.length)
            ids.add(g.termId);
      if (await s.ccReady())
        for (const term of ids)
          for (const row of await s.ccList(term)) {
            const m = row.members.find((m) => m.lecturerId === u.lecturer?.id),
              own = this.ownReader(u) && !!m;
            if (!own && !(await this.granted(s, u, term, [row.departmentId])))
              continue;
            const ef = await this.effective(s, row);
            if (!ef) continue;
            committees.push({
              termId: term,
              id: row.id,
              code: row.code ?? "",
              name: row.name,
              role: own ? m!.role : null,
            });
          }
      return { terms: await s.terms({ id: { in: [...ids] } }), committees };
    });
  }
  private async rowsInSession(
    s: CommitteeGradeSession,
    actor: string,
    q: CommitteeGradeQuery,
  ) {
    const u = await this.principal(s, actor),
      items: CommitteeGradeView[] = [],
      blockers: string[] = [];
    if (!(await s.ccReady()))
      return { items, blockers: ["UC19_SCHEMA_REQUIRED"] };
    const faculty = this.facultyReader(u);
    for (const row of await s.ccList(q.termId)) {
      if (q.committeeId && row.id !== q.committeeId) continue;
      if (faculty && !(await this.granted(s, u, q.termId, [row.departmentId])))
        continue;
      for (const a of row.studentAssignments.filter(
        (a) => a.state === "ACTIVE",
      ))
        for (const m of row.members) {
          if (
            faculty
              ? q.lecturerId && m.lecturerId !== q.lecturerId
              : m.lecturerId !== u.lecturer!.id
          )
            continue;
          try {
            items.push(
              (
                await this.load(
                  s,
                  actor,
                  q.termId,
                  row.id,
                  a.termStudentId,
                  m.lecturerId,
                )
              ).view,
            );
          } catch (e) {
            if (
              !(e instanceof HttpException) ||
              ![403, 404, 409].includes(e.getStatus())
            )
              throw e;
            if (e.getStatus() === 409) blockers.push(codeOf(e));
          }
        }
    }
    return { items, blockers: [...new Set(blockers)] };
  }
  list(actor: string, q: CommitteeGradeQuery) {
    return this.repo.read(async (s) => {
      const all = await this.rowsInSession(s, actor, q),
        needle = q.search.normalize("NFC").toLocaleLowerCase("vi"),
        items = all.items.filter(
          (v) =>
            (!q.state || v.state === q.state) &&
            `${v.studentCode} ${v.studentName} ${v.title} ${v.committeeCode}`
              .normalize("NFC")
              .toLocaleLowerCase("vi")
              .includes(needle),
        );
      items.sort(
        (a, b) =>
          (a.schedule?.startAt ?? "").localeCompare(
            b.schedule?.startAt ?? "",
          ) ||
          a.studentCode.localeCompare(b.studentCode) ||
          a.lecturerId.localeCompare(b.lecturerId),
      );
      return {
        items: items.slice((q.page - 1) * q.limit, q.page * q.limit),
        total: items.length,
        page: q.page,
        limit: q.limit,
        blockers: all.blockers,
      };
    });
  }
  detail(
    actor: string,
    member: string,
    term: string,
    committee: string,
    lecturer?: string,
  ) {
    return this.repo.read(
      async (s) =>
        (await this.load(s, actor, term, committee, member, lecturer)).view,
    );
  }
  progress(actor: string, q: CommitteeGradeQuery) {
    return this.repo.read(async (s) => {
      const u = await this.principal(s, actor);
      if (!this.facultyReader(u))
        groupError(
          403,
          "AUTH_004",
          "Chỉ Khoa có quyền theo dõi tiến độ trong grants.",
        );
      const all = await this.rowsInSession(s, actor, {
          ...q,
          lecturerId: undefined,
        }),
        groups = new Map<string, CommitteeGradeView[]>();
      for (const v of all.items) {
        const key = JSON.stringify([v.committeeId, v.termStudentId]);
        groups.set(key, [...(groups.get(key) ?? []), v]);
      }
      const items: CommitteeGradeProgress[] = [];
      for (const values of groups.values()) {
        const v = values[0],
          required =
            v.policy &&
            !values.some((x) => x.blockers.includes("COMMITTEE_NOT_CURRENT"))
              ? values.filter((x) =>
                  v.policy!.gradingRoles.includes(x.memberRole),
                )
              : null,
          targets = required ?? values;
        const count = (state: CommitteeGradeView["state"]) =>
          targets.filter((v) => v.state === state).length;
        const finalized = count("FINALIZED");
        items.push({
          termId: q.termId,
          committeeId: v.committeeId,
          committeeCode: v.committeeCode,
          termStudentId: v.termStudentId,
          studentCode: v.studentCode,
          studentName: v.studentName,
          requiredCount: required?.length ?? null,
          none: count("NONE"),
          draft: count("DRAFT"),
          finalized,
          stale: count("STALE"),
          blocked: targets.filter(
            (v) =>
              v.state !== "FINALIZED" &&
              (v.blockers.some((b) => b !== "GRADE_FINALIZED_IMMUTABLE") ||
                v.finalizeBlockers.length),
          ).length,
          missingRequired: required ? required.length - finalized : null,
          blockers: [
            ...new Set(
              targets.flatMap((v) =>
                v.blockers.filter((b) => b !== "GRADE_FINALIZED_IMMUTABLE"),
              ),
            ),
          ],
        });
      }
      const needle = q.search.normalize("NFC").toLocaleLowerCase("vi"),
        filtered = items.filter((v) =>
          `${v.studentCode} ${v.studentName} ${v.committeeCode}`
            .normalize("NFC")
            .toLocaleLowerCase("vi")
            .includes(needle),
        );
      return {
        items: filtered.slice((q.page - 1) * q.limit, q.page * q.limit),
        total: filtered.length,
        page: q.page,
        limit: q.limit,
        blockers: all.blockers,
      };
    });
  }
  command(
    actor: string,
    member: string,
    input: CommitteeGradeCommand,
    key: string,
    action: "save" | "finalize",
  ) {
    const b = CommitteeGradeCommandSchema.parse(input);
    if (!key || !/^[\w.-]{1,200}$/.test(key))
      groupError(400, "COMMON_003", "Cần Idempotency-Key hợp lệ.");
    return this.repo.write(async (s) => {
      await this.principal(s, actor);
      await s.ccLock(b.termId);
      const d = await this.load(s, actor, b.termId, b.committeeId, member),
        v = d.view;
      if (!d.own || !this.has(d.u, "LECTURER", action + "-own"))
        groupError(
          403,
          "AUTH_004",
          "Chỉ thành viên chính thức được chấm phiếu riêng của mình.",
        );
      const gates = v.blockers.filter(
        (x) =>
          !["GRADE_FINALIZED_IMMUTABLE", "GRADE_SOURCE_CHANGED"].includes(x),
      );
      if (
        gates.length ||
        !d.policy ||
        !d.effective ||
        !d.official ||
        !d.membership ||
        !d.pdf ||
        !d.schedule
      )
        blocked("COMMITTEE_GRADE_BLOCKED", gates.join("; "));
      if (action === "save" && !d.policy.draftAllowed)
        blocked("DRAFT_NOT_ALLOWED");
      if (action === "finalize" && v.finalizeBlockers.length)
        blocked(
          "DEFENSE_PERFORMANCE_PRODUCER_REQUIRED",
          "Chưa có producer chính thức xác minh sinh viên đã bảo vệ; không tạo bằng chứng giả.",
        );
      const route = `/defense-committee-grades/${member}/${action}`,
        hash = reviewHash(b),
        replay = await s.replay(actor, route, key);
      if (replay) {
        if (replay.payloadHash !== hash) blocked("IDEMPOTENCY_CONFLICT");
        if (!d.sourceCurrent) blocked("GRADE_SOURCE_CHANGED");
        return replay.result;
      }
      if (v.blockers.length)
        blocked("COMMITTEE_GRADE_BLOCKED", v.blockers.join("; "));
      this.review.revision(v.revision, b.expectedRevision);
      if (
        b.committeeRevision !== d.effective.revision ||
        b.committeeEvidenceHash !== d.effective.evidenceHash ||
        b.assignmentRevision !== d.official.assignmentRevision ||
        b.membershipHash !== v.membershipHash
      )
        blocked("MEMBERSHIP_ASSIGNMENT_CHANGED");
      if (
        b.reportVersionId !== d.pdf.version.id ||
        b.reportChecksum !== d.pdf.asset.checksum
      )
        blocked("PDF_VERSION_CHANGED");
      if (
        b.policyHash !== v.policyHash ||
        b.rubricHash !== v.rubricHash ||
        b.scheduleHash !== v.schedule?.hash
      )
        blocked("POLICY_RUBRIC_SCHEDULE_CHANGED");
      const evaluation = this.v.score(b, d.policy, action === "finalize"),
        now = new Date(),
        id = d.score?.id ?? randomUUID();
      const context = {
        kind: "UC23",
        termId: b.termId,
        termStudentId: member,
        committeeId: b.committeeId,
        lecturerId: d.u.lecturer!.id,
        memberRole: d.membership.role,
        bindingHash: d.bindingHash,
        policyVersion: d.policy.version,
        rubricVersion: d.policy.rubric.version,
        policy: d.policy,
        command: b,
        evaluation,
        updatedBy: actor,
        finalizedBy: action === "finalize" ? actor : null,
        finalizedAt: action === "finalize" ? now.toISOString() : null,
        schedule: {
          sessionId: d.schedule.sessionId,
          revision: d.schedule.revision,
          evidenceHash: d.schedule.evidenceHash,
          hash: v.schedule!.hash,
          startAt: v.schedule!.startAt,
          endAt: v.schedule!.endAt,
        },
      };
      const saved = await s.cgSave(
        v.proposalId,
        v.lecturerId,
        b.expectedRevision,
        {
          id,
          proposalId: v.proposalId,
          scorerId: v.lecturerId,
          role: "COMMITTEE_MEMBER",
          totalScore: evaluation.totalScore,
          reportVersionId: b.reportVersionId,
          comment: b.comment,
          context: committeeJson(context),
          isLocked: action === "finalize",
        },
        evaluation.criterionScores,
      );
      await s.cgEvent(
        actor,
        id,
        action === "finalize"
          ? "COMMITTEE_GRADE_FINALIZED"
          : "COMMITTEE_GRADE_SAVED",
        d.score,
        {
          revision: saved.revision,
          snapshotHash: gradeSnapshotHash(saved),
          snapshot: saved,
        },
      );
      const result = {
        scoreEntryId: id,
        revision: saved.revision,
        state: action === "finalize" ? "FINALIZED" : "DRAFT",
      };
      await s.remember(actor, route, key, hash, committeeJson(result));
      return result;
    });
  }
  download(
    actor: string,
    member: string,
    term: string,
    committee: string,
    version: string,
  ) {
    return this.repo.read(async (s) => {
      const d = await this.load(s, actor, term, committee, member);
      if (!d.view.permissions.download || !d.pdf)
        groupError(
          403,
          "AUTH_004",
          "Không có quyền tải PDF của hồ sơ hội đồng.",
        );
      if (d.pdf.version.id !== version) blocked("PDF_VERSION_CHANGED");
      return { bytes: d.pdf.bytes, name: d.pdf.asset.originalName };
    });
  }
  async effectiveInSession(
    s: CommitteeGradeSession,
    actor: string,
    termId: string,
    committeeId: string,
    member: string,
    lecturerId: string,
    revision: number,
  ): Promise<EffectiveCommitteeGrade> {
    const d = await this.load(
      s,
      actor,
      termId,
      committeeId,
      member,
      lecturerId,
    );
    if (!d.own && !this.has(d.u, "FACULTY", "score-read"))
      groupError(403, "AUTH_004", "Thiếu quyền đọc phiếu chính thức.");
    if (
      d.view.state !== "FINALIZED" ||
      !d.sourceCurrent ||
      !d.score?.isLocked ||
      !d.ctx?.finalizedBy ||
      !d.ctx.finalizedAt ||
      !d.policy ||
      !d.effective ||
      !d.official ||
      !d.membership ||
      !d.pdf ||
      !d.schedule ||
      d.score.totalScore === null
    )
      blocked("GRADE_NOT_CURRENT");
    this.review.revision(d.score.revision, revision);
    return {
      termId,
      termStudentId: member,
      proposalId: d.view.proposalId,
      committeeId,
      committeeRevision: d.effective.revision,
      committeeEvidenceHash: d.effective.evidenceHash,
      assignmentRevision: d.official.assignmentRevision,
      membershipHash: d.view.membershipHash,
      lecturerId,
      memberRole: d.membership.role,
      scoreEntryId: d.score.id,
      revision: d.score.revision,
      rubricVersion: d.policy.rubric.version,
      rubricHash: d.view.rubricHash,
      criterionScores: d.ctx.evaluation.criterionScores,
      totalScore: d.score.totalScore.toString(),
      reportVersionId: d.pdf.version.id,
      reportChecksum: d.pdf.asset.checksum,
      schedule: {
        sessionId: d.schedule.sessionId,
        hash: d.view.schedule!.hash,
      },
      policyVersion: d.policy.version,
      policyHash: d.view.policyHash,
      finalizedBy: d.ctx.finalizedBy,
      finalizedAt: d.ctx.finalizedAt,
      evidenceHash: reviewHash({
        binding: d.bindingHash,
        snapshot: gradeSnapshotHash(d.score),
      }),
      locked: true,
      effectiveStatus: "CURRENT",
      releaseStatus: "WITHHELD",
      committee: {
        finalizedBy: d.effective.finalizedBy,
        finalizedAt: d.effective.finalizedAt,
        policyHash: d.effective.policyHash,
      },
    };
  }
}
