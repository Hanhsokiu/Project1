import { HttpException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import {
  ReviewerGradeCommandSchema,
  ProposalContentSchema,
} from "@doan/shared";
import type {
  EffectiveReviewerAssignment,
  EffectiveReviewerGrade,
  ReviewerGradeCommand,
  ReviewerGradeQuery,
  ReviewerGradeView,
} from "@doan/shared";
import {
  ReviewerGradeRepository,
  ReviewerGradeSession,
} from "./reviewer-grade.repository";
import { ReviewerGradeValidator } from "./reviewer-grade.validator";
import { gradeContext, gradeSnapshotHash } from "./reviewer-grade.context";
import { ReviewerService } from "../reviewers/reviewer.service";
import { ScheduleService } from "../scheduling/schedule.service";
import {
  ProposalReviewValidator,
  reviewHash,
} from "../../topic/proposal-reviews/proposal-review.validator";
import type { ReviewPrincipal } from "../../topic/proposal-reviews/proposal-review.repository";
import { GuidanceValidator } from "../../guidance/tasks/guidance.validator";
import { FileStorageService } from "../../common/storage/file-storage.service";
import { groupError } from "../../topic/review-groups/review-group.errors";
import { operationWindow } from "../../term/service/term-window.service";
import { committeeJson } from "../committees/committee.repository";
import { readGradePdf, currentGradeSchedule } from "../grading/grade-evidence";
const missing = (): never =>
  groupError(
    404,
    "COMMON_001",
    "Không tìm thấy phiếu trong phạm vi được cấp quyền.",
  );
function reject(code: string, message = code): never {
  return groupError(409, code, message);
}
@Injectable()
export class ReviewerGradeService {
  constructor(
    private readonly repo: ReviewerGradeRepository,
    private readonly reviewers: ReviewerService,
    private readonly schedules: ScheduleService,
    private readonly review: ProposalReviewValidator,
    private readonly roles: GuidanceValidator,
    private readonly v: ReviewerGradeValidator,
    private readonly storage: FileStorageService,
    private readonly config: ConfigService,
  ) {}
  private has(u: ReviewPrincipal, role: string, action: string) {
    return this.roles.role(u, role, "defense-reviewer-grade", action);
  }
  private async principal(s: ReviewerGradeSession, actor: string) {
    const u = this.review.principal(await s.principal(actor));
    if (
      !(u.lecturer?.isActive && this.has(u, "LECTURER", "read")) &&
      !this.has(u, "FACULTY", "read")
    )
      groupError(
        403,
        "AUTH_004",
        "Cần quyền phản biện thuộc đúng vai trò giảng viên hoặc Khoa.",
      );
    return u;
  }
  private async facultyScope(
    s: ReviewerGradeSession,
    u: ReviewPrincipal,
    termId: string,
    dept: string | null,
  ) {
    if (!this.has(u, "FACULTY", "read")) return false;
    return (await s.grants(u.id, termId)).some(
      (g) =>
        g.termId === termId &&
        (g.allDepartments ||
          g.pr2bGrantDepartmentGrantId.some((d) => d.departmentId === dept)),
    );
  }
  private async source(
    s: ReviewerGradeSession,
    row: Awaited<ReturnType<ReviewerGradeSession["rgAssignments"]>>[number],
  ): Promise<EffectiveReviewerAssignment | null> {
    if (
      !row.termId ||
      !row.termStudentId ||
      !row.selected ||
      row.state !== "FINALIZED" ||
      !row.finalizedBy ||
      !row.revision
    )
      return null;
    try {
      // Persisted UC20 finalizer is a source reader, never a caller-selected identity.
      // Its live permissions/grants, audit and all upstream evidence are revalidated.
      const w = await this.reviewers.workspaceInSession(
          s,
          row.finalizedBy,
          row.termId,
        ),
        c = w.students.find((c) => c.id === row.termStudentId);
      if (!c?.downstream) return null;
      const values = await this.reviewers.effectiveInSession(
        s,
        row.finalizedBy,
        row.termId,
        row.termStudentId,
        c.revision,
        c.evidenceHash,
      );
      return (
        values.find(
          (a) =>
            a.assignmentId === row.id &&
            a.lecturerId === row.reviewerId &&
            a.proposalId === row.proposalId &&
            a.termId === row.termId &&
            a.termStudentId === row.termStudentId &&
            a.effectiveStatus === "CURRENT",
        ) ?? null
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
  private pdf(s: ReviewerGradeSession, proposalId: string) {
    return readGradePdf(s, this.storage, proposalId);
  }
  private schedule(s: ReviewerGradeSession, a: EffectiveReviewerAssignment) {
    return currentGradeSchedule(s, this.schedules, a);
  }
  private async load(
    s: ReviewerGradeSession,
    actor: string,
    termId: string,
    memberId: string,
    requestedReviewer?: string,
  ) {
    const u = await this.principal(s, actor),
      reviewerId = requestedReviewer ?? u.lecturer?.id;
    if (!reviewerId) return missing();
    const member = await s.member(memberId),
      owned = await s.memberProposal(memberId);
    const p = owned.proposals.length === 1 ? owned.proposals[0] : null;
    if (
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
    const dept =
      p.topic.researchArea?.pr2bResearchAreaWorkflowResearchAreaId
        ?.departmentId ?? null;
    const own = !!(
      u.lecturer?.isActive &&
      u.lecturer.id === reviewerId &&
      this.has(u, "LECTURER", "read")
    );
    if (!own && !(await this.facultyScope(s, u, termId, dept)))
      return missing();
    if (!(await s.rwReady())) reject("UC20_SCHEMA_REQUIRED");
    const row = (await s.rgAssignments(termId, reviewerId)).find(
      (r) => r.termStudentId === memberId && r.proposalId === p.id,
    );
    if (!row) return missing();
    const ready = await s.rgReady(),
      score = ready ? await s.rgScore(p.id, reviewerId) : null,
      ctx = gradeContext(score?.context);
    const events = score ? await s.rgEvents(score.id) : [];
    const provenance = !!(
      score &&
      ctx &&
      ctx.termId === termId &&
      ctx.termStudentId === memberId &&
      ctx.reviewerId === reviewerId &&
      score.reportVersionId === ctx.command.reportVersionId &&
      score.comment === ctx.command.comment &&
      score.totalScore?.toString() ===
        (ctx.command.totalScore === null
          ? undefined
          : new Prisma.Decimal(ctx.command.totalScore).toString()) &&
      reviewHash(
        Object.fromEntries(
          score.scoreDetails.map((d) => [
            d.rubricCriteriaId,
            d.score.toString(),
          ]),
        ),
      ) ===
        reviewHash(
          Object.fromEntries(
            Object.entries(ctx.command.criterionScores).map(([k, v]) => [
              k,
              new Prisma.Decimal(v).toString(),
            ]),
          ),
        ) &&
      events.some((e) => {
        const v = e.newValue as {
          revision?: number;
          snapshotHash?: string;
        } | null;
        return (
          e.userId === ctx.updatedBy &&
          v?.revision === score.revision &&
          v.snapshotHash === gradeSnapshotHash(score) &&
          ["REVIEWER_GRADE_SAVED", "REVIEWER_GRADE_FINALIZED"].includes(
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
    // Unfinalized/raw assignment never grants PDF or student access. An old proven
    // own grade may still be read as history, without gaining current authority.
    const assignment = await this.source(s, row);
    if (own && !assignment && !provenance)
      reject(
        "REVIEWER_NOT_CURRENT",
        "Phân công chưa chốt, stale hoặc thiếu chứng cứ chính thức.",
      );
    const blockers: string[] = [];
    if (!assignment) blockers.push("REVIEWER_NOT_CURRENT");
    if (!ready) blockers.push("UC22_SCHEMA_REQUIRED");
    const rawPolicy = (await s.rgPolicy(termId))?.value;
    const policy = this.v.policy(rawPolicy),
      policyHash = reviewHash(policy),
      rubricHash = reviewHash(policy?.rubric ?? null);
    if (!policy) blockers.push(this.v.policyIssue(rawPolicy));
    let pdf: Awaited<ReturnType<ReviewerGradeService["pdf"]>> | null = null;
    if (assignment)
      try {
        pdf = await this.pdf(s, p.id);
        if (
          pdf.asset.createdByUserId !== p.student.userId ||
          pdf.version.submittedAt > new Date()
        )
          reject("FILE_INTEGRITY_FAILED");
      } catch (e) {
        if (!(e instanceof HttpException)) throw e;
        const r = e.getResponse() as { error?: { code?: string } };
        blockers.push(r.error?.code ?? "FINAL_PDF_REQUIRED");
        pdf = null;
      }
    if (policy?.rubric) {
      const db = await s.rgRubric(
        termId,
        policy.rubric.criteria.map((c) => c.id),
      );
      if (
        db.length !== policy.rubric.criteria.length ||
        policy.rubric.criteria.some(
          (c) =>
            !db.some(
              (r) =>
                r.id === c.id &&
                r.name === c.name &&
                r.maxScore.eq(c.maxScore) &&
                r.weight.eq(c.weight),
            ),
        )
      )
        blockers.push("RUBRIC_SOURCE_MISMATCH");
    }
    const schedule =
      assignment && policy?.schedule.required
        ? await this.schedule(s, assignment)
        : null;
    // Publishing an otherwise unchanged finalized schedule is not an academic
    // source change unless this UC22 policy explicitly requires publication.
    const scheduleHash = schedule
      ? reviewHash(
          Object.fromEntries(
            Object.entries(schedule).filter(
              ([key]) =>
                key !== "revision" &&
                (!["publishedBy", "publishedAt"].includes(key) ||
                  policy?.schedule.requirePublished),
            ),
          ),
        )
      : null;
    if (policy?.schedule.required) {
      if (!schedule) blockers.push("UC21_CURRENT_SCHEDULE_REQUIRED");
      else {
        if (policy.schedule.requirePublished && !schedule.publishedAt)
          blockers.push("UC21_PUBLISHED_REQUIRED");
        const slot = schedule.slots.find((x) => x.termStudentId === memberId)!,
          w = policy.schedule.window;
        if (
          w &&
          (Date.now() <
            new Date(slot.startAt).getTime() - w.opensMinutesBefore * 60000 ||
            Date.now() >=
              new Date(slot.endAt).getTime() + w.closesMinutesAfter * 60000)
        )
          blockers.push("GRADING_WINDOW_CLOSED");
      }
    }
    const bindingHash = reviewHash({
      assignment,
      report: pdf ? { id: pdf.version.id, checksum: pdf.asset.checksum } : null,
      policyHash,
      rubricHash,
      scheduleHash,
    });
    const sourceCurrent =
      !!assignment &&
      !!pdf &&
      !!policy &&
      !blockers.some((b) => b !== "GRADING_WINDOW_CLOSED") &&
      (!score ||
        (provenance &&
          ctx?.bindingHash === bindingHash &&
          ctx.command.expectedRevision + 1 === score.revision &&
          ctx.command.termId === termId));
    const state: ReviewerGradeView["state"] = score
      ? !provenance
        ? "LEGACY_UNVERIFIED"
        : !sourceCurrent
          ? "STALE"
          : score.isLocked
            ? "FINALIZED"
            : "DRAFT"
      : "NONE";
    if (score && !provenance)
      blockers.push("LEGACY_SCORE_RECONCILIATION_REQUIRED");
    if (score && provenance && ctx?.bindingHash !== bindingHash)
      blockers.push(
        "GRADE_SOURCE_CHANGED",
        "PDF_OR_ASSIGNMENT_CHANGED_REVIEW_REQUIRED",
      );
    if (this.config.get("UC22_WRITES_ENABLED", "false") !== "true")
      blockers.push("UC22_NOT_ENABLED");
    const term = await s.windowTerm(termId),
      window = term && policy ? operationWindow(term, policy.phaseCode) : null;
    if (!window?.canWrite)
      blockers.push(window?.reason ?? "GRADING_PHASE_REQUIRED");
    if (score?.isLocked) blockers.push("GRADE_FINALIZED_IMMUTABLE");
    const readScore = own || this.has(u, "FACULTY", "score-read"),
      readFeedback = own || this.has(u, "FACULTY", "comment-read");
    let proposalSummary: ReviewerGradeView["proposalSummary"] = null;
    if (assignment) {
      const dossier = await s.dossier(p.id),
        wf = dossier?.pr2bDossierWorkflowDossierId;
      const sealed = dossier?.pr2bDossierFinalizationDossierId.find(
        (f) => f.id === wf?.currentFinalizationId && !f.supersededAt,
      );
      const parsed = ProposalContentSchema.safeParse(
        (sealed?.printSnapshot as { content?: unknown } | null)?.content,
      );
      if (wf?.state === "FINALIZED" && parsed.success) {
        const { objectives, scope, mainContents, tools, expectedResults } =
          parsed.data;
        proposalSummary = {
          objectives,
          scope,
          mainContents,
          tools,
          expectedResults,
        };
      }
    }
    const view: ReviewerGradeView = {
      termId,
      termStudentId: memberId,
      proposalId: p.id,
      reviewerId,
      studentCode: p.student.studentCode,
      studentName: p.student.fullName,
      title: p.topic.title,
      proposalSummary,
      advisorName: assignment
        ? ((await s.eligibilityAdvisor(assignment.advisorId))?.fullName ?? null)
        : null,
      committeeId: assignment?.committeeId ?? null,
      revision: score?.revision ?? 0,
      state,
      policy,
      policyHash,
      rubricHash,
      assignment: assignment
        ? {
            assignmentId: assignment.assignmentId,
            revision: assignment.revision,
            evidenceHash: assignment.evidenceHash,
          }
        : null,
      report: pdf
        ? {
            id: pdf.version.id,
            sequence: pdf.version.sequence,
            checksum: pdf.asset.checksum,
            name: pdf.asset.originalName,
          }
        : null,
      schedule: schedule
        ? {
            id: schedule.sessionId,
            revision: schedule.revision,
            date: schedule.date,
            period: schedule.period,
            startAt: schedule.startAt,
            endAt: schedule.endAt,
            hash: scheduleHash!,
          }
        : null,
      score:
        score && readScore
          ? {
              totalScore: score.totalScore?.toString() ?? null,
              criterionScores: Object.fromEntries(
                score.scoreDetails.map((d) => [
                  d.rubricCriteriaId,
                  d.score.toString(),
                ]),
              ),
            }
          : null,
      feedback:
        score && readFeedback
          ? {
              comment: score.comment ?? "",
              strengths: ctx?.command.strengths ?? "",
              weaknesses: ctx?.command.weaknesses ?? "",
              questions: ctx?.command.questions ?? "",
            }
          : null,
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
      permissions: {
        save: own && this.has(u, "LECTURER", "save") && !!policy?.draftAllowed,
        finalize: own && this.has(u, "LECTURER", "finalize"),
        download:
          own && !!assignment && !!pdf && this.has(u, "LECTURER", "download"),
      },
    };
    return {
      view,
      u,
      own,
      score,
      ctx,
      policy,
      pdf,
      assignment,
      schedule,
      bindingHash,
      sourceCurrent,
    };
  }
  options(actor: string) {
    return this.repo.read(async (s) => {
      const u = await this.principal(s, actor),
        ids = new Set<string>();
      if (
        u.lecturer?.isActive &&
        this.has(u, "LECTURER", "read") &&
        (await s.rwReady())
      )
        for (const r of await s.rgAssignments(undefined, u.lecturer.id))
          if (
            r.termId &&
            r.termStudentId &&
            r.state === "FINALIZED" &&
            r.selected
          )
            ids.add(r.termId);
      if (this.has(u, "FACULTY", "read"))
        for (const g of await s.grants(actor))
          if (g.allDepartments || g.pr2bGrantDepartmentGrantId.length)
            ids.add(g.termId);
      return s.terms({ id: { in: [...ids] } });
    });
  }
  list(actor: string, q: ReviewerGradeQuery) {
    return this.repo.read(async (s) => {
      const u = await this.principal(s, actor),
        faculty = this.has(u, "FACULTY", "read"),
        items: ReviewerGradeView[] = [];
      const blockers: string[] = [];
      if (!(await s.rwReady()))
        return {
          items,
          total: 0,
          page: q.page,
          limit: q.limit,
          blockers: ["UC20_SCHEMA_REQUIRED"],
        };
      const rows = await s.rgAssignments(
        q.termId,
        faculty ? q.reviewerId : u.lecturer!.id,
      );
      for (const r of rows) {
        if (!r.termStudentId) continue;
        try {
          const v = (
            await this.load(s, actor, q.termId, r.termStudentId, r.reviewerId)
          ).view;
          if (
            (!q.state || v.state === q.state) &&
            `${v.studentCode} ${v.studentName} ${v.title}`
              .normalize("NFC")
              .toLocaleLowerCase("vi")
              .includes(q.search.normalize("NFC").toLocaleLowerCase("vi"))
          )
            items.push(v);
        } catch (e) {
          if (
            !(e instanceof HttpException) ||
            ![403, 404, 409].includes(e.getStatus())
          )
            throw e;
          if (e.getStatus() === 409) {
            const response = e.getResponse() as { error?: { code?: string } };
            blockers.push(response.error?.code ?? "REVIEWER_NOT_CURRENT");
          }
        }
      }
      items.sort(
        (a, b) =>
          a.studentCode.localeCompare(b.studentCode) ||
          a.reviewerId.localeCompare(b.reviewerId),
      );
      return {
        items: items.slice((q.page - 1) * q.limit, q.page * q.limit),
        total: items.length,
        page: q.page,
        limit: q.limit,
        blockers: [...new Set(blockers)],
      };
    });
  }
  detail(actor: string, member: string, termId: string, reviewerId?: string) {
    return this.repo.read(
      async (s) => (await this.load(s, actor, termId, member, reviewerId)).view,
    );
  }
  async command(
    actor: string,
    member: string,
    input: ReviewerGradeCommand,
    key: string,
    action: "save" | "finalize",
  ) {
    const b = ReviewerGradeCommandSchema.parse(input);
    if (!key || !/^[\w.-]{1,200}$/.test(key))
      groupError(400, "COMMON_003", "Cần Idempotency-Key hợp lệ.");
    return this.repo.write(async (s) => {
      await this.principal(s, actor);
      await s.rwLock(b.termId);
      const d = await this.load(s, actor, b.termId, member),
        v = d.view;
      if (!d.own || !this.has(d.u, "LECTURER", action))
        groupError(
          403,
          "AUTH_004",
          "Chỉ GVPB chính thức có quyền thao tác phiếu của mình.",
        );
      const route = `/defense-reviewer-grades/${member}/${action}`,
        hash = reviewHash(b),
        replay = await s.replay(actor, route, key);
      // Never replay to a revoked/stale assignment. Phase/flag/policy also remain gates.
      const gates = v.blockers.filter(
        (x) =>
          ![
            "GRADE_FINALIZED_IMMUTABLE",
            "GRADE_SOURCE_CHANGED",
            "PDF_OR_ASSIGNMENT_CHANGED_REVIEW_REQUIRED",
          ].includes(x),
      );
      if (gates.length || !d.assignment || !d.pdf || !d.policy)
        reject("REVIEWER_GRADE_BLOCKED", gates.join("; "));
      if (action === "save" && !d.policy.draftAllowed)
        reject("DRAFT_NOT_ALLOWED", "Policy không cho phép lưu nháp.");
      if (replay) {
        if (replay.payloadHash !== hash)
          reject("IDEMPOTENCY_CONFLICT", "Cùng key có nội dung khác.");
        if (!d.sourceCurrent) reject("GRADE_SOURCE_CHANGED");
        return replay.result;
      }
      if (v.blockers.length)
        reject("REVIEWER_GRADE_BLOCKED", v.blockers.join("; "));
      this.review.revision(v.revision, b.expectedRevision);
      if (
        b.assignmentId !== d.assignment.assignmentId ||
        b.assignmentRevision !== d.assignment.revision ||
        b.assignmentEvidenceHash !== d.assignment.evidenceHash
      )
        reject("ASSIGNMENT_CHANGED", "Phân công đã đổi; tải lại.");
      if (
        b.reportVersionId !== d.pdf.version.id ||
        b.reportChecksum !== d.pdf.asset.checksum
      )
        reject(
          "PDF_VERSION_CHANGED",
          "PDF đã đổi; tải và đọc lại phiên bản hiện hành.",
        );
      if (
        b.policyHash !== v.policyHash ||
        b.rubricHash !== v.rubricHash ||
        b.scheduleHash !== (v.schedule?.hash ?? null)
      )
        reject("POLICY_RUBRIC_SCHEDULE_CHANGED");
      const total = this.v.score(b, d.policy, action === "finalize"),
        now = new Date(),
        id = d.score?.id ?? randomUUID();
      const context = {
        kind: "UC22",
        termId: b.termId,
        termStudentId: member,
        reviewerId: d.u.lecturer!.id,
        bindingHash: d.bindingHash,
        policyVersion: d.policy.version,
        rubricVersion: d.policy.rubric?.version ?? null,
        command: b,
        updatedBy: actor,
        finalizedBy: action === "finalize" ? actor : null,
        finalizedAt: action === "finalize" ? now.toISOString() : null,
      };
      const saved = await s.rgSave(
        v.proposalId,
        v.reviewerId,
        b.expectedRevision,
        {
          id,
          proposalId: v.proposalId,
          scorerId: v.reviewerId,
          role: "REVIEWER",
          totalScore: total,
          comment: b.comment,
          context: committeeJson(context),
          reportVersionId: b.reportVersionId,
          isLocked: action === "finalize",
        },
        b.criterionScores,
      );
      await s.rgEvent(
        actor,
        id,
        action === "finalize"
          ? "REVIEWER_GRADE_FINALIZED"
          : "REVIEWER_GRADE_SAVED",
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
  download(actor: string, member: string, termId: string, versionId: string) {
    return this.repo.read(async (s) => {
      const d = await this.load(s, actor, termId, member);
      if (!d.view.permissions.download || !d.pdf)
        groupError(403, "AUTH_004", "Không có quyền tải PDF phản biện.");
      if (versionId !== d.pdf.version.id) reject("PDF_VERSION_CHANGED");
      return { bytes: d.pdf.bytes, name: d.pdf.asset.originalName };
    });
  }
  // Internal consumer must call inside its own transaction and revalidate again at use time.
  async effectiveInSession(
    s: ReviewerGradeSession,
    actor: string,
    termId: string,
    member: string,
    reviewerId: string,
    revision: number,
  ): Promise<EffectiveReviewerGrade> {
    const d = await this.load(s, actor, termId, member, reviewerId);
    if (!d.own && !this.has(d.u, "FACULTY", "score-read"))
      groupError(403, "AUTH_004", "Thiếu quyền đọc điểm chính thức.");
    if (
      d.view.state !== "FINALIZED" ||
      !d.sourceCurrent ||
      !d.score?.isLocked ||
      !d.ctx?.finalizedBy ||
      !d.ctx.finalizedAt ||
      !d.assignment ||
      !d.pdf ||
      !d.policy ||
      d.score.totalScore === null
    )
      reject("GRADE_NOT_CURRENT");
    this.review.revision(d.score.revision, revision);
    return {
      termId,
      termStudentId: member,
      proposalId: d.view.proposalId,
      reviewerId,
      assignment: d.assignment,
      scoreEntryId: d.score.id,
      revision: d.score.revision,
      reportVersionId: d.pdf.version.id,
      reportChecksum: d.pdf.asset.checksum,
      totalScore: d.score.totalScore.toString(),
      criterionScores: d.ctx.command.criterionScores,
      rubricVersion: d.ctx.rubricVersion,
      rubricHash: d.view.rubricHash,
      policyVersion: d.policy.version,
      policyHash: d.view.policyHash,
      finalizedBy: d.ctx.finalizedBy,
      finalizedAt: d.ctx.finalizedAt,
      evidenceHash: reviewHash({
        binding: d.bindingHash,
        snapshot: gradeSnapshotHash(d.score),
      }),
      effectiveStatus: "CURRENT",
      locked: true,
      releaseStatus: "WITHHELD",
    };
  }
}
