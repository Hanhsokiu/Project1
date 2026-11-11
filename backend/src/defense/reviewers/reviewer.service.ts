import { HttpException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ReviewerAssignSchema, ReviewerFinalizeSchema } from "@doan/shared";
import type {
  EffectiveCommittee,
  EffectiveReviewerAssignment,
  ReviewerAllocation,
  ReviewerAssign,
  ReviewerBinding,
  ReviewerFinalize,
  ReviewerLecturer,
  ReviewerQuery,
  ReviewerView,
  ReviewerWorkspace,
} from "@doan/shared";
import {
  ReviewerRepository,
  ReviewerRow,
  ReviewerSession,
} from "./reviewer.repository";
import { ReviewerValidator, reviewerConflicts } from "./reviewer.validator";
import { allocateReviewers } from "./reviewer-allocation";
import { CommitteeWorkflowService } from "../committees/committee-workflow.service";
import { CommitteeValidator } from "../committees/committee.validator";
import {
  ProposalReviewValidator,
  reviewHash,
} from "../../topic/proposal-reviews/proposal-review.validator";
import { GuidanceValidator } from "../../guidance/tasks/guidance.validator";
import type { ReviewPrincipal } from "../../topic/proposal-reviews/proposal-review.repository";
import { groupError } from "../../topic/review-groups/review-group.errors";
import { committeeJson } from "../committees/committee.repository";
import { operationWindow } from "../../term/service/term-window.service";

const missing = (): never =>
  groupError(
    404,
    "COMMON_001",
    "Không tìm thấy hồ sơ phản biện trong phạm vi được cấp quyền.",
  );
type BindingContext = {
  evidenceHash: string;
  policyHash: string;
  policyVersion: string;
  eligibility: NonNullable<
    EffectiveCommittee["students"][number]["eligibility"]
  >;
  committee: Pick<
    EffectiveCommittee,
    "committeeId" | "revision" | "evidenceHash" | "policyHash"
  >;
  committeeAssignmentRevision: number;
  advisorId: string;
  advisorHash: string;
  historyHash: string;
};
const facts = (l: ReviewerLecturer) => ({
  id: l.id,
  departmentId: l.departmentId,
  titleId: l.titleId,
  active: l.active,
  inRoster: l.inRoster,
  areaIds: l.areaIds,
});
@Injectable()
export class ReviewerService {
  constructor(
    private readonly repo: ReviewerRepository,
    private readonly committees: CommitteeWorkflowService,
    private readonly review: ProposalReviewValidator,
    private readonly roles: GuidanceValidator,
    private readonly v: ReviewerValidator,
    private readonly keyValidator: CommitteeValidator,
    private readonly config: ConfigService,
  ) {}
  private has(u: ReviewPrincipal, action: string) {
    return this.roles.role(u, "FACULTY", "defense-reviewer", action);
  }
  private async scope(
    s: ReviewerSession,
    actor: string,
    termId: string,
    action = "read",
  ) {
    const u = this.review.principal(await s.principal(actor));
    if (!this.has(u, "read") || !this.has(u, action))
      groupError(
        403,
        "AUTH_004",
        "Cần quyền phản biện thuộc vai trò Khoa/Giáo vụ.",
      );
    const grants = (await s.grants(actor, termId)).filter(
        (g) => g.termId === termId,
      ),
      all = grants.some((g) => g.allDepartments);
    const depts = [
      ...new Set(
        grants.flatMap((g) =>
          g.pr2bGrantDepartmentGrantId.map((d) => d.departmentId),
        ),
      ),
    ];
    if (!grants.length || (!all && !depts.length) || !(await s.term(termId)))
      return missing();
    return {
      u,
      allows: (id: string | null) => all || (!!id && depts.includes(id)),
    };
  }
  options(actor: string) {
    return this.repo.read(async (s) => {
      const u = this.review.principal(await s.principal(actor));
      if (!this.has(u, "read"))
        groupError(403, "AUTH_004", "Thiếu quyền xem phân công phản biện.");
      return s.terms({
        id: {
          in: (await s.grants(actor))
            .filter(
              (g) => g.allDepartments || g.pr2bGrantDepartmentGrantId.length,
            )
            .map((g) => g.termId),
        },
      });
    });
  }
  private assertNo(issues: string[]) {
    if (issues.length) groupError(409, "REVIEWER_BLOCKED", issues.join("; "));
  }
  private async load(s: ReviewerSession, actor: string, termId: string) {
    const scope = await this.scope(s, actor, termId),
      ready = await s.rwReady();
    // UC19 itself uses UC18's official reader in this same caller session.
    const upstream = await this.committees.workspaceInSession(s, actor, termId);
    const policy = this.v.policy((await s.rwPolicy(termId))?.value),
      blockers: string[] = [];
    if (!ready) blockers.push("UC20_SCHEMA_REQUIRED");
    if (
      !upstream.schemaReady ||
      !(await s.schemaReady()) ||
      !(await s.eligibilitySchemaReady())
    )
      blockers.push("UC17_UC18_UC19_SCHEMA_REQUIRED");
    if (!policy) blockers.push("UC20_POLICY_REQUIRED");
    if (
      upstream.blockers.some((b) =>
        [
          "UC17_UC18_POLICY_REQUIRED",
          "UC19_POLICY_REQUIRED",
          "UC18_READ_PERMISSION_REQUIRED",
        ].includes(b),
      )
    )
      blockers.push("UPSTREAM_POLICY_OR_PERMISSION_REQUIRED");
    if (this.config.get("UC20_WRITES_ENABLED", "false") !== "true")
      blockers.push("UC20_NOT_ENABLED");
    const term = await s.windowTerm(termId),
      window = term && policy ? operationWindow(term, policy.phaseCode) : null;
    if (!window?.canWrite)
      blockers.push(
        window?.reason ?? "Chưa có mốc phân công phản biện được duyệt.",
      );
    const rows: ReviewerRow[] = ready
      ? await s.rwRows(termId)
      : (await s.rwLegacyReady())
        ? (await s.rwLegacy(termId)).map((r) => ({
            ...r,
            termId: null,
            termStudentId: null,
            committeeId: null,
            revision: 0,
            state: null,
            selected: null,
            context: null,
            createdBy: null,
            updatedBy: null,
            updatedAt: null,
            finalizedBy: null,
            finalizedAt: null,
          }))
        : [];
    const areas = await s.rwLecturerAreas(termId),
      advisorLoads = await s.rwAdvisorLoads(termId);
    if (!advisorLoads.valid) blockers.push("TERM_ADVISOR_LOAD_UNVERIFIED");
    const ccRows = upstream.schemaReady ? await s.ccList(termId) : [],
      claims = (await s.ccClaimsReady()) ? await s.ccClaims(termId) : [];
    const otherDuties = { ...advisorLoads.counts };
    for (const c of ccRows) {
      const count = new Set([
        ...c.studentAssignments
          .filter((a) => a.state === "ACTIVE")
          .map((a) => a.proposalId),
        ...claims
          .filter((a) => a.session.committeeId === c.id)
          .map((a) => a.proposalId),
      ]).size;
      for (const m of c.members)
        otherDuties[m.lecturerId] = (otherDuties[m.lecturerId] ?? 0) + count;
    }
    const reviewLoads: Record<string, number> = {};
    for (const r of rows)
      if (!r.revision || r.selected)
        reviewLoads[r.reviewerId] = (reviewLoads[r.reviewerId] ?? 0) + 1;
    const lecturers: ReviewerLecturer[] = upstream.lecturers
      .filter((l) => scope.allows(l.departmentId))
      .map((l) => ({
        id: l.id,
        code: l.code,
        name: l.name,
        departmentId: l.departmentId,
        titleId: l.titleId,
        active: l.active,
        inRoster: l.inRoster,
        areaIds: areas
          .filter((a) => a.lecturerId === l.id)
          .map((a) => a.researchAreaId)
          .sort(),
        reviewLoad: reviewLoads[l.id] ?? 0,
        otherStudentDuties: otherDuties[l.id] ?? 0,
        totalLoad: (reviewLoads[l.id] ?? 0) + (otherDuties[l.id] ?? 0),
      }));
    const students: ReviewerView[] = [],
      contexts = new Map<string, BindingContext>(),
      groups = new Map<string, ReviewerRow[]>();
    const committeeProofs = new Map<string, EffectiveCommittee | null>();
    const histories: unknown[] = [];
    for (const c of upstream.candidates) {
      if (!scope.allows(c.departmentId)) continue;
      const rs = rows.filter(
        (r) =>
          r.proposalId === c.proposalId || r.termStudentId === c.termStudentId,
      );
      groups.set(c.termStudentId, rs);
      const committee = upstream.committees.find(
        (r) => r.id === c.currentCommitteeId,
      );
      let effective: EffectiveCommittee | null = null;
      if (committee?.downstream) {
        if (!committeeProofs.has(committee.id)) {
          try {
            committeeProofs.set(
              committee.id,
              await this.committees.effectiveInSession(
                s,
                actor,
                termId,
                committee.id,
                committee.revision,
                committee.downstream.evidenceHash,
              ),
            );
          } catch (e) {
            if (!(e instanceof HttpException) || e.getStatus() !== 409) throw e;
            committeeProofs.set(committee.id, null);
          }
        }
        effective = committeeProofs.get(committee.id) ?? null;
      }
      const owned = effective?.students.find(
        (a) =>
          a.termStudentId === c.termStudentId && a.proposalId === c.proposalId,
      );
      const history = c.proposalId
        ? await s.rwAdvisorHistory(c.proposalId, termId)
        : {
            valid: false,
            advisorIds: [],
            hash: reviewHash(null),
            areaId: null,
          };
      histories.push({ member: c.termStudentId, history });
      const sourceIssues = [...c.blockers];
      if (!effective || !owned)
        sourceIssues.push("UC19_FINALIZED_CURRENT_REQUIRED");
      if (
        !c.eligibility ||
        !owned ||
        reviewHash(c.eligibility) !== reviewHash(owned.eligibility)
      )
        sourceIssues.push("UC18_FINALIZED_CURRENT_REQUIRED");
      if (
        !c.advisorId ||
        !owned ||
        owned.advisorId !== c.advisorId ||
        owned.advisorHash !== c.advisorHash
      )
        sourceIssues.push("OFFICIAL_ADVISOR_BINDING_REQUIRED");
      if (!history.valid) sourceIssues.push("ADVISOR_HISTORY_UNVERIFIED");
      const evidenceHash = reviewHash({
        eligibility: c.eligibility,
        committee: effective
          ? {
              id: effective.committeeId,
              revision: effective.revision,
              evidenceHash: effective.evidenceHash,
            }
          : null,
        owned,
        advisorHash: c.advisorHash,
        historyHash: history.hash,
        policy,
        roster: lecturers.map(facts),
      });
      if (effective && owned && c.eligibility && c.advisorId)
        contexts.set(c.termStudentId, {
          evidenceHash,
          policyHash: reviewHash(policy),
          policyVersion: policy?.version ?? "",
          eligibility: c.eligibility,
          committee: {
            committeeId: effective.committeeId,
            revision: effective.revision,
            evidenceHash: effective.evidenceHash,
            policyHash: effective.policyHash,
          },
          committeeAssignmentRevision: owned.assignmentRevision,
          advisorId: c.advisorId,
          advisorHash: c.advisorHash,
          historyHash: history.hash,
        });
      const revision = rs.length ? Math.max(...rs.map((r) => r.revision)) : 0,
        head = rs[0],
        selected = rs
          .filter((r) => r.selected || !r.revision)
          .map((r) => r.reviewerId)
          .sort();
      const legacy = rs.some(
        (r) =>
          !r.revision ||
          !r.state ||
          r.termId !== termId ||
          r.termStudentId !== c.termStudentId ||
          r.proposalId !== c.proposalId,
      );
      const events = rs.length ? await s.rwEvents(c.termStudentId) : [];
      const provenance =
        !rs.length ||
        (!legacy &&
          rs.every(
            (r) =>
              r.revision === revision &&
              ["DRAFT", "FINALIZED"].includes(r.state ?? "") &&
              r.state === head.state &&
              r.committeeId === head.committeeId &&
              reviewHash(r.context) === reviewHash(head.context) &&
              r.updatedBy === head.updatedBy &&
              !!r.createdBy &&
              !!r.updatedBy &&
              !!r.updatedAt &&
              r.updatedAt <= new Date() &&
              (r.state === "DRAFT"
                ? !r.finalizedBy && !r.finalizedAt
                : !!r.finalizedBy &&
                  !!r.finalizedAt &&
                  r.finalizedAt <= new Date() &&
                  r.finalizedBy === head.finalizedBy &&
                  r.finalizedAt.getTime() === head.finalizedAt?.getTime()),
          ) &&
          events.some((e) => {
            const value = e.newValue as {
              snapshotHash?: string;
              revision?: number;
            } | null;
            return (
              ["REVIEWERS_SAVED", "REVIEWERS_FINALIZED"].includes(e.action) &&
              e.userId === head.updatedBy &&
              value?.revision === revision &&
              value.snapshotHash === reviewHash(rs)
            );
          }));
      const candidates = lecturers.map((l) => {
        const reasons = reviewerConflicts(
          l,
          {
            departmentId: c.departmentId,
            advisorId: c.advisorId,
            history,
            committeeMembers: effective?.members.map((m) => m.lecturerId) ?? [],
          },
          policy,
        );
        const count = l.reviewLoad - (selected.includes(l.id) ? 1 : 0) + 1;
        if (
          policy?.maxReviewsPerLecturer !== null &&
          policy &&
          count > policy.maxReviewsPerLecturer!
        )
          reasons.push("REVIEW_CAPACITY_EXCEEDED");
        if (
          policy?.maxTotalStudentDuties !== null &&
          policy &&
          count + l.otherStudentDuties > policy.maxTotalStudentDuties!
        )
          reasons.push("TOTAL_CAPACITY_EXCEEDED");
        return { lecturerId: l.id, reasons };
      });
      const issues = [
        ...new Set([
          ...sourceIssues,
          ...(!provenance ? ["REVIEWER_PROVENANCE_UNVERIFIED"] : []),
          ...(legacy ? ["LEGACY_REVIEWER_RECONCILIATION_REQUIRED"] : []),
          ...(rs.length &&
          (head.context as BindingContext | null)?.evidenceHash !== evidenceHash
            ? ["REVIEWER_SOURCE_CHANGED"]
            : []),
          ...(policy && selected.length !== policy.reviewersPerStudent
            ? ["REVIEWER_COUNT_REQUIRED"]
            : []),
          ...selected.flatMap(
            (id) =>
              candidates.find((l) => l.lecturerId === id)?.reasons ?? [
                "REVIEWER_NOT_IN_SCOPE_OR_ROSTER",
              ],
          ),
        ]),
      ];
      const state: ReviewerView["state"] = legacy
        ? "LEGACY_UNVERIFIED"
        : !rs.length
          ? "NONE"
          : head.state === "FINALIZED"
            ? issues.length
              ? "STALE"
              : "FINALIZED"
            : issues.some((i) => !["REVIEWER_COUNT_REQUIRED"].includes(i))
              ? "STALE"
              : "DRAFT";
      const frozen = head?.state === "FINALIZED",
        base = [
          ...blockers,
          ...sourceIssues,
          ...(legacy ? ["LEGACY_REVIEWER_RECONCILIATION_REQUIRED"] : []),
          ...(rs.length && !provenance
            ? ["REVIEWER_PROVENANCE_UNVERIFIED"]
            : []),
          ...(frozen ? ["REVIEWER_FINALIZED_IMMUTABLE"] : []),
        ];
      const binding: ReviewerBinding | null =
        effective &&
        owned &&
        c.eligibility &&
        c.advisorId &&
        !sourceIssues.length
          ? {
              termStudentId: c.termStudentId,
              expectedRevision: revision,
              evidenceHash,
              committeeId: effective.committeeId,
              committeeRevision: effective.revision,
              committeeEvidenceHash: effective.evidenceHash,
              eligibilityRevision: c.eligibility.revision,
              eligibilityEvidenceHash: c.eligibility.evidenceHash,
              advisorHash: c.advisorHash,
            }
          : null;
      const ctx = contexts.get(c.termStudentId);
      const downstream: EffectiveReviewerAssignment[] | null =
        state === "FINALIZED" &&
        ctx &&
        head?.finalizedBy &&
        head.finalizedAt &&
        policy &&
        rs.every(
          (r) =>
            r.finalizedBy === head.finalizedBy &&
            r.finalizedAt?.getTime() === head.finalizedAt?.getTime(),
        )
          ? rs
              .filter((r) => r.selected)
              .map((r) => ({
                termId,
                termStudentId: c.termStudentId,
                proposalId: c.proposalId!,
                committeeId: ctx.committee.committeeId,
                lecturerId: r.reviewerId,
                assignmentId: r.id,
                revision,
                finalizedAt: head.finalizedAt!.toISOString(),
                finalizedBy: head.finalizedBy!,
                policyVersion: policy.version,
                policyHash: ctx.policyHash,
                evidenceHash,
                eligibility: ctx.eligibility,
                committee: {
                  revision: ctx.committee.revision,
                  evidenceHash: ctx.committee.evidenceHash,
                  policyHash: ctx.committee.policyHash,
                },
                committeeAssignmentRevision: ctx.committeeAssignmentRevision,
                advisorId: ctx.advisorId,
                advisorHash: ctx.advisorHash,
                effectiveStatus: "CURRENT",
              }))
          : null;
      students.push({
        id: c.termStudentId,
        termId,
        proposalId: c.proposalId,
        departmentId: c.departmentId,
        studentCode: c.studentCode,
        studentName: c.studentName,
        title: c.title,
        advisorId: c.advisorId,
        advisorName: c.advisorName,
        committeeId: committee?.id ?? null,
        committeeCode: committee?.code ?? null,
        revision,
        evidenceHash,
        state,
        reviewerIds: selected,
        binding,
        candidates,
        issues,
        blockers: {
          assign: [
            ...base,
            ...(!this.has(scope.u, "assign") ||
            (rs.length && !this.has(scope.u, "update"))
              ? ["FACULTY_PERMISSION_REQUIRED"]
              : []),
          ],
          finalize: [
            ...base,
            ...issues,
            ...(!this.has(scope.u, "finalize")
              ? ["FACULTY_PERMISSION_REQUIRED"]
              : []),
          ],
        },
        history: events.map((e) => {
          const v = e.newValue as { reason?: string; revision?: number } | null;
          return {
            id: e.id,
            actor: e.userId,
            at: e.createdAt.toISOString(),
            action: e.action,
            reason: v?.reason ?? "",
            revision: v?.revision ?? 0,
          };
        }),
        downstream,
      });
    }
    const workspace: ReviewerWorkspace = {
      termId,
      rosterHash: reviewHash({
        rows,
        lecturers: lecturers.map((l) => ({
          ...facts(l),
          reviewLoad: l.reviewLoad,
          other: l.otherStudentDuties,
        })),
        policy,
        upstream: upstream.rosterHash,
        histories,
      }),
      policy,
      schemaReady: ready,
      blockers,
      lecturers,
      students,
      permissions: {
        assign: this.has(scope.u, "assign"),
        update: this.has(scope.u, "update"),
        finalize: this.has(scope.u, "finalize"),
      },
    };
    return { workspace, scope, contexts, groups, rows };
  }
  workspace(actor: string, termId: string) {
    return this.repo.read((s) =>
      this.load(s, actor, termId).then((d) => d.workspace),
    );
  }
  workspaceInSession(s: ReviewerSession, actor: string, termId: string) {
    return this.load(s, actor, termId).then((d) => d.workspace);
  }
  list(actor: string, q: ReviewerQuery) {
    return this.repo.read(async (s) => {
      const w = (await this.load(s, actor, q.termId)).workspace,
        needle = q.search.normalize("NFC").toLocaleLowerCase("vi");
      const rows = w.students.filter(
        (c) =>
          (!q.state || c.state === q.state) &&
          (!needle ||
            `${c.studentCode} ${c.studentName} ${c.title} ${c.committeeCode ?? ""}`
              .normalize("NFC")
              .toLocaleLowerCase("vi")
              .includes(needle)),
      );
      return {
        items: rows.slice((q.page - 1) * q.limit, q.page * q.limit),
        total: rows.length,
        page: q.page,
        limit: q.limit,
        blockers: w.blockers,
      };
    });
  }
  detail(actor: string, id: string, termId: string) {
    return this.repo.read(
      async (s) =>
        (await this.load(s, actor, termId)).workspace.students.find(
          (c) => c.id === id,
        ) ?? missing(),
    );
  }
  private checkBinding(c: ReviewerView, p: ReviewerBinding) {
    this.review.revision(c.revision, p.expectedRevision);
    if (!c.binding || reviewHash(c.binding) !== reviewHash(p))
      groupError(
        409,
        "REVIEWER_EVIDENCE_CHANGED",
        "Nguồn UC18/UC19/GVHD/revision đã thay đổi; tải lại.",
      );
  }
  private async command(
    actor: string,
    termId: string,
    action: string,
    route: string,
    body: unknown,
    key: string,
    ids: string[],
    fn: (s: ReviewerSession) => Promise<unknown>,
  ) {
    this.keyValidator.key(key);
    return this.repo.write(async (s) => {
      await this.scope(s, actor, termId, action);
      if (!(await s.rwReady()) || !(await s.ccReady()))
        groupError(
          409,
          "UC20_SCHEMA_REQUIRED",
          "Cần schema UC19/UC20 đã được review và kiểm chứng.",
        );
      await s.rwLock(termId);
      await this.scope(s, actor, termId, action);
      const old = await s.replay(actor, route, key),
        hash = reviewHash(body);
      if (old) {
        if (old.payloadHash !== hash)
          groupError(
            409,
            "IDEMPOTENCY_CONFLICT",
            "Key đã dùng cho nội dung khác.",
          );
        const w = (await this.load(s, actor, termId)).workspace;
        if (ids.some((id) => !w.students.some((c) => c.id === id)))
          return missing();
        if (
          action === "assign" &&
          ((body as ReviewerAssign).placements.some(
            (p) => p.expectedRevision > 0,
          ) ||
            route.endsWith("/update")) &&
          !w.permissions.update
        )
          groupError(403, "AUTH_004", "Thiếu quyền sửa phân công.");
        return old.result;
      }
      const result = await fn(s);
      await s.remember(actor, route, key, hash, committeeJson(result));
      return result;
    });
  }
  private async persist(
    s: ReviewerSession,
    actor: string,
    termId: string,
    c: ReviewerView,
    context: BindingContext,
    reviewerIds: string[],
    state: "DRAFT" | "FINALIZED",
    reason: string,
  ) {
    const now = new Date(),
      old = (await s.rwRows(termId)).filter(
        (r) => r.proposalId === c.proposalId,
      ),
      head = old[0];
    await s.rwSave(c.proposalId!, c.revision, reviewerIds, {
      proposalId: c.proposalId!,
      termId,
      termStudentId: c.id,
      committeeId: context.committee.committeeId,
      revision: c.revision + 1,
      state,
      context: committeeJson(context),
      createdBy: head?.createdBy ?? actor,
      updatedBy: actor,
      updatedAt: now,
      assignedAt: head?.assignedAt ?? now,
      finalizedBy: state === "FINALIZED" ? actor : null,
      finalizedAt: state === "FINALIZED" ? now : null,
    });
    const saved = (await s.rwRows(termId)).filter(
      (r) => r.proposalId === c.proposalId,
    );
    await s.rwEvent(
      actor,
      c.id,
      state === "FINALIZED" ? "REVIEWERS_FINALIZED" : "REVIEWERS_SAVED",
      old,
      {
        snapshotHash: reviewHash(saved),
        revision: c.revision + 1,
        reason,
        selected: reviewerIds,
      },
    );
    return { id: c.id, revision: c.revision + 1 };
  }
  assign(actor: string, input: ReviewerAssign, key: string, onlyId?: string) {
    const b = ReviewerAssignSchema.parse(input);
    if (
      onlyId &&
      (b.placements.length !== 1 || b.placements[0].termStudentId !== onlyId)
    )
      groupError(400, "COMMON_003", "ID hồ sơ không khớp lệnh sửa.");
    return this.command(
      actor,
      b.termId,
      "assign",
      onlyId
        ? `/defense-reviewers/${onlyId}/update`
        : "/defense-reviewers/assignments",
      b,
      key,
      b.placements.map((p) => p.termStudentId),
      async (s) => {
        const d = await this.load(s, actor, b.termId),
          w = d.workspace;
        if (w.rosterHash !== b.rosterHash)
          groupError(
            409,
            "ROSTER_CHANGED",
            "Roster/tải/phân công đã thay đổi; tải lại.",
          );
        this.assertNo(w.blockers);
        const results = [];
        for (const p of b.placements) {
          const c = w.students.find((c) => c.id === p.termStudentId);
          if (!c) return missing();
          if ((c.revision > 0 || onlyId) && !w.permissions.update)
            groupError(403, "AUTH_004", "Thiếu quyền sửa phân công phản biện.");
          if (onlyId && !c.revision) return missing();
          const { reviewerIds, ...binding } = p;
          this.checkBinding(c, binding);
          this.assertNo(c.blockers.assign);
          if (reviewerIds.length > w.policy!.reviewersPerStudent)
            groupError(
              409,
              "REVIEWER_COUNT_EXCEEDED",
              "Vượt số GVPB theo policy.",
            );
          if (!reviewerIds.length && !c.revision)
            groupError(
              400,
              "EMPTY_NEW_ASSIGNMENT",
              "Chưa có phân công dự thảo để gỡ.",
            );
          for (const id of reviewerIds) {
            const l = c.candidates.find((l) => l.lecturerId === id);
            if (!l) return missing();
            this.assertNo(
              l.reasons.filter((r) => !r.endsWith("CAPACITY_EXCEEDED")),
            );
          }
          results.push(
            await this.persist(
              s,
              actor,
              b.termId,
              c,
              d.contexts.get(c.id)!,
              reviewerIds,
              "DRAFT",
              b.reason,
            ),
          );
        }
        const after = (await this.load(s, actor, b.termId)).workspace;
        for (const p of b.placements) {
          const c = after.students.find((c) => c.id === p.termStudentId)!;
          this.assertNo(
            c.issues.filter((i) => i !== "REVIEWER_COUNT_REQUIRED"),
          );
        }
        return { assignments: results };
      },
    );
  }
  finalize(actor: string, input: ReviewerFinalize, key: string) {
    const b = ReviewerFinalizeSchema.parse(input);
    return this.command(
      actor,
      b.termId,
      "finalize",
      "/defense-reviewers/finalize",
      b,
      key,
      b.members.map((m) => m.termStudentId),
      async (s) => {
        const d = await this.load(s, actor, b.termId),
          w = d.workspace;
        if (w.rosterHash !== b.rosterHash)
          groupError(
            409,
            "ROSTER_CHANGED",
            "Roster/tải/phân công đã thay đổi; tải lại.",
          );
        this.assertNo(w.blockers);
        const results = [];
        for (const p of b.members) {
          const c = w.students.find((c) => c.id === p.termStudentId);
          if (!c) return missing();
          this.checkBinding(c, p);
          this.assertNo(c.blockers.finalize);
          if (!c.revision)
            groupError(
              409,
              "DRAFT_REQUIRED",
              "Cần lưu dự thảo trước khi chốt.",
            );
          results.push(
            await this.persist(
              s,
              actor,
              b.termId,
              c,
              d.contexts.get(c.id)!,
              c.reviewerIds,
              "FINALIZED",
              b.reason,
            ),
          );
        }
        return { assignments: results };
      },
    );
  }
  propose(
    actor: string,
    termId: string,
    requested?: string,
  ): Promise<ReviewerAllocation> {
    return this.repo.read(async (s) => {
      const d = await this.load(s, actor, termId),
        w = d.workspace;
      if (!w.permissions.assign)
        groupError(403, "AUTH_004", "Thiếu quyền đề xuất phản biện.");
      const base = {
        rosterHash: w.rosterHash,
        placements: [],
        loads: [],
        exploredNodes: 0,
      };
      const blockers = w.blockers.filter(
        (b) => b !== "UC20_NOT_ENABLED" && !b.startsWith("Giai đoạn"),
      );
      if (!w.policy || !w.schemaReady || blockers.length)
        return { ...base, status: "BLOCKED", reasons: blockers };
      const ids = requested
        ? [...new Set(requested.split(",").filter(Boolean))]
        : w.students
            .filter((c) => c.state === "NONE" && c.binding)
            .map((c) => c.id);
      if (ids.length > 200)
        groupError(400, "COMMON_003", "Mỗi đề xuất tối đa 200 sinh viên.");
      const selected = ids.map((id) => w.students.find((c) => c.id === id));
      if (selected.some((c) => !c)) return missing();
      if (
        selected.some(
          (c) =>
            !c!.binding ||
            ["FINALIZED", "LEGACY_UNVERIFIED"].includes(c!.state) ||
            c!.blockers.assign.some((b) => !w.blockers.includes(b)),
        )
      )
        return {
          ...base,
          status: "BLOCKED",
          reasons: ["Có hồ sơ chưa đủ nguồn/quyền hoặc đã chốt."],
        };
      const chosen = selected as ReviewerView[];
      const result = allocateReviewers({
        lecturers: w.lecturers.map((l) => ({
          id: l.id,
          fixedReviewLoad:
            l.reviewLoad -
            chosen.filter((c) => c.reviewerIds.includes(l.id)).length,
          otherDuties: l.otherStudentDuties,
          reviewCapacity: w.policy!.maxReviewsPerLecturer,
          totalCapacity: w.policy!.maxTotalStudentDuties,
        })),
        students: chosen.map((c) => ({
          id: c.id,
          needed: w.policy!.reviewersPerStudent,
          current: c.reviewerIds,
          allowed: c.candidates
            .filter(
              (l) =>
                !l.reasons.filter((r) => !r.endsWith("CAPACITY_EXCEEDED"))
                  .length,
            )
            .map((l) => l.lecturerId),
        })),
      });
      return {
        ...base,
        ...result,
        placements: result.placements.map((p) => ({
          ...chosen.find((c) => c.id === p.studentId)!.binding!,
          reviewerIds: p.reviewerIds,
        })),
        reasons:
          result.status === "UNSAT"
            ? [
                "Không có phương án thỏa xung đột/số GVPB/tải cho toàn bộ lựa chọn.",
              ]
            : result.status === "SEARCH_LIMIT"
              ? ["Đã tới giới hạn tìm kiếm; chưa chứng minh UNSAT."]
              : [],
      };
    });
  }
  async effectiveInSession(
    s: ReviewerSession,
    actor: string,
    termId: string,
    member: string,
    expectedRevision: number,
    evidenceHash: string,
  ) {
    const c = (await this.load(s, actor, termId)).workspace.students.find(
      (c) => c.id === member,
    );
    if (!c) return missing();
    this.review.revision(c.revision, expectedRevision);
    if (!c.downstream || c.evidenceHash !== evidenceHash)
      groupError(
        409,
        "REVIEWER_NOT_CURRENT",
        "Phân công chưa chốt hoặc chứng cứ không còn hiệu lực.",
      );
    return c.downstream;
  }
}
