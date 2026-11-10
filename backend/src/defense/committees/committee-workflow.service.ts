import { HttpException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "crypto";
import {
  CommitteeAssignSchema,
  CommitteeFinalizeSchema,
  CommitteeSaveSchema,
  CommitteeUnassignSchema,
} from "@doan/shared";
import type {
  CommitteeAllocation,
  CommitteeAssign,
  CommitteeCandidate,
  CommitteeFinalize,
  CommitteeMemberInput,
  CommitteePolicy,
  CommitteeQuery,
  CommitteeSave,
  CommitteeUnassign,
  CommitteeView,
  CommitteeWorkspace,
} from "@doan/shared";
import {
  CommitteeRepository,
  CommitteeSession,
  CommitteeRecord,
  committeeJson,
} from "./committee.repository";
import {
  CommitteeValidator,
  advisorConflict,
  committeeStructure,
} from "./committee.validator";
import { allocateCommittees } from "./committee-allocation";
import { EligibilityService } from "../eligibility/eligibility.service";
import {
  ProposalReviewValidator,
  reviewHash,
} from "../../topic/proposal-reviews/proposal-review.validator";
import { GuidanceValidator } from "../../guidance/tasks/guidance.validator";
import type { ReviewPrincipal } from "../../topic/proposal-reviews/proposal-review.repository";
import { operationWindow } from "../../term/service/term-window.service";
import { groupError } from "../../topic/review-groups/review-group.errors";

const notFound = (): never =>
  groupError(
    404,
    "COMMON_001",
    "Không tìm thấy hội đồng/hồ sơ trong phạm vi được cấp quyền.",
  );
type AssignmentContext = {
  eligibility: NonNullable<CommitteeCandidate["eligibility"]>;
  advisorId: string;
  advisorHash: string;
  policyHash: string;
};
@Injectable()
export class CommitteeWorkflowService {
  constructor(
    private readonly repo: CommitteeRepository,
    private readonly eligibility: EligibilityService,
    private readonly review: ProposalReviewValidator,
    private readonly roles: GuidanceValidator,
    private readonly v: CommitteeValidator,
    private readonly config: ConfigService,
  ) {}
  private has(u: ReviewPrincipal, action: string) {
    return this.roles.role(u, "FACULTY", "defense-committee", action);
  }
  private async scope(
    s: CommitteeSession,
    actor: string,
    termId: string,
    action = "read",
  ) {
    const u = this.review.principal(await s.principal(actor));
    if (!this.has(u, action) || !this.has(u, "read"))
      groupError(403, "AUTH_004", "Cần quyền UC19 thuộc vai trò Khoa/Giáo vụ.");
    const grants = (await s.grants(actor, termId)).filter(
        (g) => g.termId === termId,
      ),
      all = grants.some((g) => g.allDepartments);
    const departments = [
      ...new Set(
        grants.flatMap((g) =>
          g.pr2bGrantDepartmentGrantId.map((d) => d.departmentId),
        ),
      ),
    ];
    if (
      !grants.length ||
      (!all && !departments.length) ||
      !(await s.term(termId))
    )
      return notFound();
    return {
      u,
      all,
      departments,
      allows: (id: string | null) => all || (!!id && departments.includes(id)),
    };
  }
  options(actor: string) {
    return this.repo.read(async (s) => {
      const u = this.review.principal(await s.principal(actor));
      if (!this.has(u, "read"))
        groupError(403, "AUTH_004", "Thiếu quyền xem hội đồng của Khoa.");
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
  private memberValid(
    m: CommitteeRecord["members"][number],
    row: CommitteeRecord,
    policy: CommitteePolicy | null,
  ) {
    const l = m.lecturer;
    return !!(
      l.isActive &&
      l.user.status === "ACTIVE" &&
      l.user.userRoles.some((r) => r.role.name === "LECTURER") &&
      l.termLecturers.some((t) => t.termId === row.termId) &&
      (!policy ||
        ((policy.memberScope !== "SAME_DEPARTMENT" ||
          l.departmentId === row.departmentId) &&
          (policy.allowedTitleIds === null ||
            (l.titleId && policy.allowedTitleIds.includes(l.titleId)))))
    );
  }
  private active(row: CommitteeRecord) {
    return row.studentAssignments.filter((a) => a.state === "ACTIVE");
  }
  private auditSnapshot(row: CommitteeRecord) {
    return {
      ...row,
      members: row.members.map((m) => ({
        committeeId: m.committeeId,
        lecturerId: m.lecturerId,
        role: m.role,
      })),
      studentAssignments: this.active(row),
    };
  }
  private content(
    row: CommitteeRecord,
    candidates: CommitteeCandidate[],
    policy: CommitteePolicy | null,
  ) {
    return {
      id: row.id,
      termId: row.termId,
      code: row.code,
      name: row.name,
      departmentId: row.departmentId,
      policyHash: reviewHash(policy),
      members: row.members.map((m) => ({
        lecturerId: m.lecturerId,
        role: m.role,
        facts: {
          departmentId: m.lecturer.departmentId,
          titleId: m.lecturer.titleId,
          active:
            m.lecturer.isActive &&
            m.lecturer.user.status === "ACTIVE" &&
            m.lecturer.user.userRoles.some((r) => r.role.name === "LECTURER"),
          inRoster: m.lecturer.termLecturers.some(
            (t) => t.termId === row.termId,
          ),
        },
      })),
      assignments: this.active(row).map((a) => ({
        id: a.id,
        revision: a.revision,
        termStudentId: a.termStudentId,
        proposalId: a.proposalId,
        context: a.context,
        current:
          candidates.find((c) => c.termStudentId === a.termStudentId)
            ?.eligibility ?? null,
        advisorHash:
          candidates.find((c) => c.termStudentId === a.termStudentId)
            ?.advisorHash ?? null,
      })),
    };
  }
  private issues(
    row: CommitteeRecord,
    rows: CommitteeRecord[],
    candidates: CommitteeCandidate[],
    policy: CommitteePolicy | null,
    claims: Awaited<ReturnType<CommitteeSession["ccClaims"]>> = [],
  ) {
    const issues = committeeStructure(
      row.members as CommitteeMemberInput[],
      policy,
    );
    if (row.members.some((m) => !this.memberValid(m, row, policy)))
      issues.push("MEMBER_NOT_QUALIFIED_OR_ROSTER");
    const active = this.active(row);
    if (policy && !policy.allowEmptyFinalization && !active.length)
      issues.push("EMPTY_COMMITTEE_NOT_ALLOWED");
    if (claims.some((c) => c.session.committeeId === row.id))
      issues.push("LEGACY_SESSION_ASSIGNMENT_RECONCILIATION_REQUIRED");
    for (const a of active) {
      const c = candidates.find((c) => c.termStudentId === a.termStudentId),
        bound = a.context as unknown as AssignmentContext;
      if (
        !c?.eligibility ||
        c.blockers.length ||
        c.proposalId !== a.proposalId ||
        a.termId !== row.termId
      ) {
        issues.push(`ELIGIBILITY_NOT_CURRENT:${a.termStudentId}`);
        continue;
      }
      if (c.departmentId !== row.departmentId)
        issues.push(`STUDENT_DEPARTMENT_MISMATCH:${a.termStudentId}`);
      if (
        !bound ||
        reviewHash(bound.eligibility ?? null) !== reviewHash(c.eligibility) ||
        bound.advisorId !== c.advisorId ||
        bound.advisorHash !== c.advisorHash ||
        bound.policyHash !== reviewHash(policy)
      )
        issues.push(`SOURCE_CHANGED:${a.termStudentId}`);
      if (c.advisorId && advisorConflict(row.members, c.advisorId))
        issues.push(`ADVISOR_CONFLICT:${a.termStudentId}`);
    }
    if (
      policy?.maxStudentsPerCommittee !== null &&
      policy &&
      active.length > policy.maxStudentsPerCommittee
    )
      issues.push("COMMITTEE_STUDENT_LOAD_EXCEEDED");
    for (const m of row.members) {
      const related = rows.filter((r) =>
        r.members.some((x) => x.lecturerId === m.lecturerId),
      );
      if (
        policy?.maxCommitteesPerLecturer !== null &&
        policy &&
        related.length > policy.maxCommitteesPerLecturer
      )
        issues.push(`LECTURER_COMMITTEE_LOAD_EXCEEDED:${m.lecturerId}`);
      if (
        policy?.maxStudentsPerLecturer !== null &&
        policy &&
        related.reduce(
          (sum, r) =>
            sum +
            this.active(r).length +
            new Set(
              claims
                .filter((c) => c.session.committeeId === r.id)
                .map((c) => c.proposalId),
            ).size,
          0,
        ) > policy.maxStudentsPerLecturer
      )
        issues.push(`LECTURER_STUDENT_LOAD_EXCEEDED:${m.lecturerId}`);
    }
    return [...new Set(issues)];
  }
  private async load(s: CommitteeSession, actor: string, termId: string) {
    const scope = await this.scope(s, actor, termId),
      ready = await s.ccReady();
    const policy = this.v.policy((await s.ccPolicy(termId))?.value),
      blockers: string[] = [];
    if (!ready) blockers.push("UC19_SCHEMA_REQUIRED");
    if (!policy) blockers.push("UC19_POLICY_REQUIRED");
    if (!(await this.eligibility.committeePolicyReady(s, termId)))
      blockers.push("UC17_UC18_POLICY_REQUIRED");
    if (this.config.get("UC19_WRITES_ENABLED", "false") !== "true")
      blockers.push("UC19_NOT_ENABLED");
    if (!(await s.schemaReady()) || !(await s.eligibilitySchemaReady()))
      blockers.push("UC17_UC18_SCHEMA_REQUIRED");
    const term = await s.windowTerm(termId),
      window = term && policy ? operationWindow(term, policy.phaseCode) : null;
    if (!window?.canWrite)
      blockers.push(
        window?.reason ?? "Chưa có mốc thành lập hội đồng được duyệt.",
      );
    const rows: CommitteeRecord[] = ready
      ? await s.ccList(termId)
      : (await s.ccLegacyReady())
        ? (await s.ccLegacy(termId)).map((r) => ({
            ...r,
            members: r.members.map((m) => ({ ...m, committeeId: r.id })),
            code: null,
            departmentId: null,
            revision: 0,
            state: null,
            context: null,
            studentAssignments: [],
            createdBy: null,
            updatedBy: null,
            updatedAt: null,
            finalizedBy: null,
            finalizedAt: null,
          }))
        : [];
    const lecturers = await s.ccLecturers(termId),
      candidates: CommitteeCandidate[] = [];
    const claims = (await s.ccClaimsReady()) ? await s.ccClaims(termId) : [];
    if (!this.roles.role(scope.u, "FACULTY", "defense-eligibility", "read"))
      blockers.push("UC18_READ_PERMISSION_REQUIRED");
    else
      for (const member of [
        ...new Set([
          ...(await s.ccCandidateMembers(termId)).map((m) => m.id),
          ...rows.flatMap((r) => this.active(r).map((a) => a.termStudentId)),
        ]),
      ]) {
        try {
          const e = await s.ccEvidence(actor, termId, member, () =>
            this.eligibility.forCommittee(s, actor, member, termId),
          );
          if (!scope.allows(e.departmentId)) continue;
          const a = rows
            .flatMap((r) => r.studentAssignments)
            .find((a) => a.termStudentId === member);
          candidates.push({
            termStudentId: member,
            proposalId: e.proposalId,
            departmentId: e.departmentId,
            studentCode: e.studentCode,
            studentName: e.studentName,
            title: e.title,
            eligibility: e.effective,
            advisorId: e.advisor?.id ?? null,
            advisorName: e.advisor?.name ?? null,
            advisorHash: reviewHash(
              e.advisor
                ? {
                    id: e.advisor.id,
                    assignmentId: e.advisor.assignmentId,
                    revision: e.advisor.revision,
                  }
                : null,
            ),
            assignmentRevision: a?.revision ?? 0,
            currentCommitteeId: a?.state === "ACTIVE" ? a.committeeId : null,
            blockers: [
              ...e.blockers,
              ...(!e.advisor ? ["OFFICIAL_ADVISOR_REQUIRED"] : []),
              ...(claims.some((a) => a.proposalId === e.proposalId)
                ? ["LEGACY_SESSION_ASSIGNMENT_RECONCILIATION_REQUIRED"]
                : []),
            ],
          });
        } catch (e) {
          if (e instanceof HttpException && e.getStatus() === 404) continue;
          throw e;
        }
      }
    candidates.sort((a, b) => a.termStudentId.localeCompare(b.termStudentId));
    const rosterHash = reviewHash({ rows, lecturers, policy, claims });
    const committees: CommitteeView[] = [];
    for (const row of rows.filter((r) => scope.allows(r.departmentId))) {
      const issues = this.issues(row, rows, candidates, policy, claims),
        events = ready ? await s.ccEvents(row.id) : [];
      const trusted = events.some((e) => {
        const value = e.newValue as { snapshot?: unknown } | null;
        return (
          e.userId === row.updatedBy &&
          reviewHash(value?.snapshot ?? null) ===
            reviewHash(this.auditSnapshot(row))
        );
      });
      const context = row.context as { contentHash?: string } | null;
      const contentHash = reviewHash(this.content(row, candidates, policy));
      const state: CommitteeView["state"] =
        !row.revision || !row.state
          ? "LEGACY_UNVERIFIED"
          : row.state === "FINALIZED"
            ? trusted &&
              context?.contentHash === contentHash &&
              !issues.length &&
              policy
              ? "FINALIZED"
              : "STALE"
            : "DRAFT";
      const base = [...blockers];
      if (state === "LEGACY_UNVERIFIED")
        base.push("LEGACY_RECONCILIATION_REQUIRED");
      if (row.state === "FINALIZED") base.push("COMMITTEE_FINALIZED");
      if (row.revision && !trusted) base.push("COMMITTEE_PROVENANCE_REQUIRED");
      const action = (name: "update" | "assign" | "finalize") => [
        ...base,
        ...(!this.has(scope.u, name) ? ["FACULTY_PERMISSION_REQUIRED"] : []),
        ...(name === "finalize" ? issues : []),
      ];
      const view: CommitteeView = {
        id: row.id,
        termId,
        code: row.code,
        name: row.name,
        departmentId: row.departmentId,
        revision: row.revision,
        state,
        members: row.members.map((m) => ({
          lecturerId: m.lecturerId,
          role: m.role as CommitteeMemberInput["role"],
          name: m.lecturer.fullName,
          valid: this.memberValid(m, row, policy),
        })),
        students: this.active(row).map((a) => {
          const c = candidates.find((c) => c.termStudentId === a.termStudentId);
          return {
            termStudentId: a.termStudentId,
            studentCode: c?.studentCode ?? "Ngoài phạm vi đọc",
            studentName: c?.studentName ?? "",
            advisorName: c?.advisorName ?? null,
            revision: a.revision,
            blockers: issues.filter((i) => i.endsWith(`:${a.termStudentId}`)),
          };
        }),
        issues,
        blockers: {
          update: action("update"),
          assign: action("assign"),
          finalize: action("finalize"),
        },
        history: events.map((e) => {
          const v = e.newValue as {
            reason?: string;
            snapshot?: { revision?: number };
          } | null;
          return {
            id: e.id,
            at: e.createdAt.toISOString(),
            actor: e.userId,
            action: e.action,
            reason: v?.reason,
            revision: v?.snapshot?.revision,
          };
        }),
        downstream: null,
      };
      if (
        state === "FINALIZED" &&
        row.finalizedBy &&
        row.finalizedAt &&
        row.departmentId &&
        row.code &&
        policy
      )
        view.downstream = {
          termId,
          committeeId: row.id,
          code: row.code,
          departmentId: row.departmentId,
          revision: row.revision,
          finalizedBy: row.finalizedBy,
          finalizedAt: row.finalizedAt.toISOString(),
          policyHash: reviewHash(policy),
          evidenceHash: contentHash,
          members: view.members.map((m) => ({
            lecturerId: m.lecturerId,
            role: m.role,
          })),
          students: this.active(row).map((a) => {
            const c = candidates.find(
              (c) => c.termStudentId === a.termStudentId,
            )!;
            return {
              termStudentId: a.termStudentId,
              proposalId: a.proposalId,
              assignmentRevision: a.revision,
              advisorId: c.advisorId!,
              advisorHash: c.advisorHash,
              eligibility: c.eligibility!,
            };
          }),
          effectiveStatus: "CURRENT",
        };
      committees.push(view);
    }
    const workspace: CommitteeWorkspace = {
      termId,
      rosterHash,
      policy,
      schemaReady: ready,
      blockers,
      committees,
      candidates,
      departments: await s.departments(
        scope.all ? undefined : scope.departments,
      ),
      lecturers: lecturers.map((l) => {
        const related = rows.filter((r) =>
          r.members.some((m) => m.lecturerId === l.id),
        );
        return {
          id: l.id,
          code: l.lecturerCode,
          name: l.fullName,
          departmentId: l.departmentId,
          titleId: l.titleId,
          active:
            l.isActive &&
            l.user.status === "ACTIVE" &&
            l.user.userRoles.some((r) => r.role.name === "LECTURER"),
          inRoster: l.termLecturers.some((t) => t.termId === termId),
          committeeLoad: related.length,
          studentLoad: related.reduce(
            (n, r) =>
              n +
              this.active(r).length +
              new Set(
                claims
                  .filter((c) => c.session.committeeId === r.id)
                  .map((c) => c.proposalId),
              ).size,
            0,
          ),
        };
      }),
      permissions: {
        create: this.has(scope.u, "create"),
        update: this.has(scope.u, "update"),
        assign: this.has(scope.u, "assign"),
        finalize: this.has(scope.u, "finalize"),
      },
    };
    return { workspace, rows, scope, candidates, policy, claims };
  }
  workspace(actor: string, termId: string) {
    return this.repo.read(
      async (s) => (await this.load(s, actor, termId)).workspace,
    );
  }
  // Contract reader for future UC20/UC21 commands; caller supplies its transaction.
  workspaceInSession(s: CommitteeSession, actor: string, termId: string) {
    return this.load(s, actor, termId).then((d) => d.workspace);
  }
  // This does not perform reviewer assignment or scheduling.
  async effectiveInSession(
    s: CommitteeSession,
    actor: string,
    termId: string,
    id: string,
    expectedRevision: number,
    evidenceHash: string,
  ) {
    const { workspace } = await this.load(s, actor, termId),
      c = workspace.committees.find((c) => c.id === id);
    if (!c) return notFound();
    this.review.revision(c.revision, expectedRevision);
    if (!c.downstream || c.downstream.evidenceHash !== evidenceHash)
      groupError(
        409,
        "COMMITTEE_NOT_CURRENT",
        "Hội đồng chưa chốt hoặc nguồn đã thay đổi; không được dùng cho nghiệp vụ tiếp theo.",
      );
    return c.downstream;
  }
  list(actor: string, q: CommitteeQuery) {
    return this.repo.read(async (s) => {
      const { workspace: w } = await this.load(s, actor, q.termId),
        needle = q.search.normalize("NFC").toLocaleLowerCase("vi");
      const items = w.committees.filter(
        (c) =>
          (!q.state || c.state === q.state) &&
          (!needle ||
            `${c.code ?? ""} ${c.name}`
              .normalize("NFC")
              .toLocaleLowerCase("vi")
              .includes(needle)),
      );
      return {
        items: items.slice((q.page - 1) * q.limit, q.page * q.limit),
        total: items.length,
        page: q.page,
        limit: q.limit,
        blockers: w.blockers,
        rosterHash: w.rosterHash,
      };
    });
  }
  detail(actor: string, id: string, termId: string) {
    return this.repo.read(async (s) => {
      const { workspace } = await this.load(s, actor, termId);
      const row = workspace.committees.find((c) => c.id === id);
      if (!row) return notFound();
      return { committee: row, rosterHash: workspace.rosterHash };
    });
  }
  private assertNo(issues: string[]) {
    if (issues.length) groupError(409, "COMMITTEE_BLOCKED", issues.join("; "));
  }
  private expect(w: CommitteeWorkspace, hash: string) {
    if (w.rosterHash !== hash)
      groupError(
        409,
        "ROSTER_CHANGED",
        "Hội đồng/thành viên/phân công đã thay đổi; tải lại.",
      );
  }
  private editable(
    w: CommitteeWorkspace,
    id: string,
    rev: number,
    action: "update" | "assign" | "finalize",
  ) {
    const row = w.committees.find((c) => c.id === id);
    if (!row) return notFound();
    this.review.revision(row.revision, rev);
    this.assertNo(row.blockers[action]);
    return row;
  }
  private async command<T>(
    actor: string,
    termId: string,
    action: string,
    route: string,
    body: unknown,
    key: string,
    fn: (s: CommitteeSession) => Promise<T>,
  ) {
    this.v.key(key);
    return this.repo.write(async (s) => {
      await this.scope(s, actor, termId, action);
      if (!(await s.ccReady()))
        groupError(
          409,
          "UC19_SCHEMA_REQUIRED",
          "Cần migration UC19 đã được review/kiểm chứng.",
        );
      await s.ccLock(termId);
      await this.scope(s, actor, termId, action);
      const hash = reviewHash(body),
        old = await s.replay(actor, route, key);
      if (old) {
        if (old.payloadHash !== hash)
          groupError(
            409,
            "IDEMPOTENCY_CONFLICT",
            "Key đã dùng cho nội dung khác.",
          );
        const current = await this.load(s, actor, termId);
        const request = body as {
          departmentId?: string;
          committees?: { committeeId: string }[];
          placements?: { committeeId: string; termStudentId: string }[];
        };
        const response = old.result as {
          id?: string;
          committees?: { id: string }[];
        } | null;
        const ids = [
          response?.id,
          ...(response?.committees?.map((c) => c.id) ?? []),
          ...(request.committees?.map((c) => c.committeeId) ?? []),
          ...(request.placements?.map((p) => p.committeeId) ?? []),
        ].filter((id): id is string => !!id);
        if (
          (request.departmentId &&
            !current.scope.allows(request.departmentId)) ||
          ids.some(
            (id) => !current.workspace.committees.some((c) => c.id === id),
          ) ||
          request.placements?.some(
            (p) =>
              !current.candidates.some(
                (c) => c.termStudentId === p.termStudentId,
              ),
          )
        )
          return notFound();
        return old.result;
      }
      const result = await fn(s);
      await s.remember(actor, route, key, hash, committeeJson(result));
      return result;
    });
  }
  private async commitSnapshot(
    s: CommitteeSession,
    actor: string,
    termId: string,
    id: string,
    revision: number,
    reason: string,
    action: string,
    old: unknown,
    data: Record<string, unknown> = {},
  ) {
    const loaded = await this.load(s, actor, termId),
      row = loaded.rows.find((r) => r.id === id)!;
    const virtual = { ...row, ...data } as CommitteeRecord;
    await s.ccAdvance(id, revision, {
      ...data,
      updatedBy: actor,
      updatedAt: new Date(),
      context: committeeJson({
        policy: loaded.policy,
        policyHash: reviewHash(loaded.policy),
        contentHash: reviewHash(
          this.content(virtual, loaded.candidates, loaded.policy),
        ),
      }),
    });
    const saved = (await s.ccList(termId)).find((r) => r.id === id)!;
    await s.ccEvent(actor, id, action, old, {
      snapshot: this.auditSnapshot(saved),
      inactiveAssignments: saved.studentAssignments.filter(
        (a) => a.state !== "ACTIVE",
      ),
      reason,
    });
    return { id, revision: saved.revision };
  }
  save(actor: string, id: string | null, input: CommitteeSave, key: string) {
    const b = CommitteeSaveSchema.parse(input),
      action = id ? "update" : "create";
    return this.command(
      actor,
      b.termId,
      action,
      `/defense-committees/${id ?? "new"}`,
      b,
      key,
      async (s) => {
        const d = await this.load(s, actor, b.termId),
          w = d.workspace;
        this.expect(w, b.rosterHash);
        this.assertNo(w.blockers);
        if (!d.scope.allows(b.departmentId)) return notFound();
        if (id) this.editable(w, id, b.expectedRevision, "update");
        else this.review.revision(0, b.expectedRevision);
        if (
          d.rows.some(
            (r) =>
              r.id !== id &&
              r.code?.toLocaleLowerCase("vi") ===
                b.code.toLocaleLowerCase("vi"),
          )
        )
          groupError(409, "CODE_EXISTS", "Mã hội đồng đã tồn tại trong đợt.");
        const members = b.members.map((m) => {
          const l = w.lecturers.find((l) => l.id === m.lecturerId);
          if (
            !l?.active ||
            !l.inRoster ||
            (d.policy?.memberScope === "SAME_DEPARTMENT" &&
              l.departmentId !== b.departmentId) ||
            (d.policy?.allowedTitleIds &&
              (!l.titleId || !d.policy.allowedTitleIds.includes(l.titleId)))
          )
            groupError(
              409,
              "MEMBER_NOT_QUALIFIED_OR_ROSTER",
              "Thành viên không đủ tiêu chuẩn hoặc không thuộc roster kỳ.",
            );
          return m;
        });
        const committeeId = id ?? randomUUID(),
          old = d.rows.find((r) => r.id === committeeId) ?? null;
        if (!id)
          await s.ccCreate({
            id: committeeId,
            termId: b.termId,
            code: b.code,
            name: b.name,
            departmentId: b.departmentId,
            revision: 1,
            state: "DRAFT",
            createdBy: actor,
            updatedBy: actor,
            updatedAt: new Date(),
            context: committeeJson({ pending: true }),
          });
        await s.ccMembers(committeeId, members);
        const next = await this.load(s, actor, b.termId),
          raw = next.rows.find((r) => r.id === committeeId)!;
        const virtual = {
          ...raw,
          departmentId: b.departmentId,
          code: b.code,
          name: b.name,
        };
        const issues = this.issues(
          virtual,
          next.rows.map((r) => (r.id === committeeId ? virtual : r)),
          next.candidates,
          next.policy,
          next.claims,
        );
        this.assertNo(
          this.active(raw).length
            ? issues
            : issues.filter(
                (i) =>
                  ![
                    "COMMITTEE_SIZE_3_TO_5",
                    "OFFICER_COUNTS_REQUIRED",
                    "EMPTY_COMMITTEE_NOT_ALLOWED",
                  ].includes(i),
              ),
        );
        // Creation is a single transaction; the second CAS binds the nested member snapshot.
        return this.commitSnapshot(
          s,
          actor,
          b.termId,
          committeeId,
          id ? b.expectedRevision : 1,
          b.reason,
          id ? "COMMITTEE_UPDATED" : "COMMITTEE_CREATED",
          old,
          { code: b.code, name: b.name, departmentId: b.departmentId },
        );
      },
    );
  }
  assign(actor: string, input: CommitteeAssign, key: string) {
    const b = CommitteeAssignSchema.parse(input);
    return this.command(
      actor,
      b.termId,
      "assign",
      "/defense-committees/assignments",
      b,
      key,
      async (s) => {
        const d = await this.load(s, actor, b.termId),
          w = d.workspace;
        this.expect(w, b.rosterHash);
        this.assertNo(w.blockers);
        const touched = new Set<string>(),
          targets = new Set<string>();
        for (const p of b.placements) {
          const c = w.candidates.find(
            (c) => c.termStudentId === p.termStudentId,
          );
          if (!c) return notFound();
          if (
            !c.eligibility ||
            c.blockers.length ||
            c.eligibility.revision !== p.eligibilityRevision ||
            c.eligibility.evidenceHash !== p.evidenceHash ||
            c.advisorHash !== p.advisorHash
          )
            groupError(
              409,
              "ELIGIBILITY_CHANGED",
              "UC18/GVHD không còn khớp chứng cứ đã xem.",
            );
          this.review.revision(
            c.assignmentRevision,
            p.expectedAssignmentRevision,
          );
          const target = w.committees.find((r) => r.id === p.committeeId);
          if (!target) return notFound();
          if (target.departmentId !== c.departmentId)
            groupError(
              409,
              "STUDENT_DEPARTMENT_MISMATCH",
              "Sinh viên và hội đồng khác phạm vi bộ môn được duyệt.",
            );
          if (advisorConflict(target.members, c.advisorId!))
            groupError(
              409,
              "ADVISOR_CONFLICT",
              "GVHD thuộc một trong các thành viên hội đồng; không được phân sinh viên vào hội đồng này.",
            );
          touched.add(p.committeeId);
          targets.add(p.committeeId);
          if (c.currentCommitteeId) touched.add(c.currentCommitteeId);
        }
        for (const id of touched) {
          const e = b.committees.find((c) => c.committeeId === id);
          if (!e)
            groupError(
              400,
              "EXPECTED_REVISION_REQUIRED",
              "Thiếu revision hội đồng nguồn/đích.",
            );
          this.editable(w, id, e.expectedRevision, "assign");
        }
        for (const p of b.placements) {
          const c = w.candidates.find(
            (c) => c.termStudentId === p.termStudentId,
          )!;
          await s.ccAssign(c.termStudentId, p.expectedAssignmentRevision, {
            committeeId: p.committeeId,
            termId: b.termId,
            termStudentId: c.termStudentId,
            proposalId: c.proposalId!,
            state: "ACTIVE",
            revision: 1,
            context: committeeJson({
              eligibility: c.eligibility,
              advisorId: c.advisorId,
              advisorHash: c.advisorHash,
              policyHash: reviewHash(d.policy),
            }),
            assignedBy: actor,
            assignedAt: new Date(),
            updatedBy: actor,
            updatedAt: new Date(),
          });
        }
        const next = await this.load(s, actor, b.termId);
        for (const id of targets)
          this.assertNo(
            this.issues(
              next.rows.find((r) => r.id === id)!,
              next.rows,
              next.candidates,
              next.policy,
              next.claims,
            ),
          );
        const result = [];
        for (const id of [...touched].sort())
          result.push(
            await this.commitSnapshot(
              s,
              actor,
              b.termId,
              id,
              b.committees.find((c) => c.committeeId === id)!.expectedRevision,
              b.reason,
              "COMMITTEE_STUDENTS_ASSIGNED",
              d.rows.find((r) => r.id === id),
            ),
          );
        return { committees: result };
      },
    );
  }
  unassign(actor: string, id: string, input: CommitteeUnassign, key: string) {
    const b = CommitteeUnassignSchema.parse(input);
    return this.command(
      actor,
      b.termId,
      "assign",
      `/defense-committees/${id}/unassign`,
      b,
      key,
      async (s) => {
        const d = await this.load(s, actor, b.termId);
        this.expect(d.workspace, b.rosterHash);
        this.editable(d.workspace, id, b.expectedRevision, "assign");
        const row = d.rows.find((r) => r.id === id)!,
          a = this.active(row).find((a) => a.termStudentId === b.termStudentId);
        if (!a) return notFound();
        this.review.revision(a.revision, b.expectedAssignmentRevision);
        await s.ccAssign(a.termStudentId, a.revision, {
          ...a,
          state: "REMOVED",
          context: committeeJson(a.context),
          updatedBy: actor,
          updatedAt: new Date(),
        });
        return this.commitSnapshot(
          s,
          actor,
          b.termId,
          id,
          b.expectedRevision,
          b.reason,
          "COMMITTEE_STUDENT_REMOVED",
          row,
        );
      },
    );
  }
  finalize(actor: string, id: string, input: CommitteeFinalize, key: string) {
    const b = CommitteeFinalizeSchema.parse(input);
    return this.command(
      actor,
      b.termId,
      "finalize",
      `/defense-committees/${id}/finalize`,
      b,
      key,
      async (s) => {
        const d = await this.load(s, actor, b.termId);
        this.expect(d.workspace, b.rosterHash);
        this.editable(d.workspace, id, b.expectedRevision, "finalize");
        return this.commitSnapshot(
          s,
          actor,
          b.termId,
          id,
          b.expectedRevision,
          b.reason,
          "COMMITTEE_FINALIZED",
          d.rows.find((r) => r.id === id),
          { state: "FINALIZED", finalizedBy: actor, finalizedAt: new Date() },
        );
      },
    );
  }
  propose(
    actor: string,
    termId: string,
    requested?: string,
  ): Promise<CommitteeAllocation> {
    return this.repo.read(async (s) => {
      const d = await this.load(s, actor, termId),
        w = d.workspace;
      if (!this.has(d.scope.u, "assign"))
        groupError(403, "AUTH_004", "Thiếu quyền đề xuất phân sinh viên.");
      const base = {
        rosterHash: w.rosterHash,
        committees: w.committees
          .filter((c) => c.state === "DRAFT")
          .map((c) => ({ committeeId: c.id, expectedRevision: c.revision })),
        placements: [],
        exploredNodes: 0,
        loads: [],
      };
      if (
        !d.policy ||
        !w.schemaReady ||
        w.blockers.some((b) =>
          [
            "UC17_UC18_SCHEMA_REQUIRED",
            "UC17_UC18_POLICY_REQUIRED",
            "UC18_READ_PERMISSION_REQUIRED",
          ].includes(b),
        )
      )
        return { ...base, status: "BLOCKED", reasons: w.blockers };
      const ids = requested
        ? [...new Set(requested.split(",").filter(Boolean))]
        : w.candidates
            .filter(
              (c) =>
                !c.currentCommitteeId && !!c.eligibility && !c.blockers.length,
            )
            .map((c) => c.termStudentId);
      if (ids.length > 200)
        groupError(400, "COMMON_003", "Mỗi đề xuất tối đa 200 sinh viên.");
      const selected = ids.map((id) =>
        w.candidates.find((c) => c.termStudentId === id),
      );
      if (selected.some((c) => !c)) return notFound();
      if (selected.some((c) => !c!.eligibility || c!.blockers.length))
        return {
          ...base,
          status: "BLOCKED",
          reasons: ["Danh sách có UC18/GVHD chưa còn hiệu lực."],
        };
      const eligible = selected as CommitteeCandidate[],
        fixedRows = d.rows.map((r) => ({
          ...r,
          studentAssignments: r.studentAssignments.filter(
            (a) => !ids.includes(a.termStudentId),
          ),
        }));
      const lecturerLoads: Record<string, number> = {};
      for (const r of fixedRows)
        for (const m of r.members)
          lecturerLoads[m.lecturerId] =
            (lecturerLoads[m.lecturerId] ?? 0) +
            this.active(r).length +
            new Set(
              d.claims
                .filter((c) => c.session.committeeId === r.id)
                .map((c) => c.proposalId),
            ).size;
      const available = w.committees.filter(
        (c) =>
          c.state === "DRAFT" &&
          !this.issues(
            fixedRows.find((r) => r.id === c.id)!,
            fixedRows,
            d.candidates,
            d.policy,
            d.claims,
          ).filter((i) => i !== "EMPTY_COMMITTEE_NOT_ALLOWED").length &&
          !c.blockers.assign.filter((b) => !w.blockers.includes(b)).length,
      );
      if (
        eligible.some(
          (c) =>
            c.currentCommitteeId &&
            !available.some((r) => r.id === c.currentCommitteeId),
        )
      )
        return {
          ...base,
          status: "BLOCKED",
          reasons: [
            "Không tự chuyển sinh viên từ hội đồng đã chốt/ngoài quyền.",
          ],
        };
      const result = allocateCommittees({
        committees: available.map((c) => ({
          id: c.id,
          memberIds: c.members.map((m) => m.lecturerId),
          fixedStudents: this.active(fixedRows.find((r) => r.id === c.id)!)
            .length,
          capacity: d.policy!.maxStudentsPerCommittee,
        })),
        students: eligible.map((c) => ({
          id: c.termStudentId,
          currentCommitteeId: c.currentCommitteeId,
          allowed: available
            .filter(
              (r) =>
                r.departmentId === c.departmentId &&
                !advisorConflict(r.members, c.advisorId!),
            )
            .map((r) => r.id),
        })),
        lecturerLoads,
        maxStudentsPerLecturer: d.policy.maxStudentsPerLecturer,
      });
      return {
        ...base,
        ...result,
        placements: result.placements.map((p) => {
          const c = eligible.find((c) => c.termStudentId === p.studentId)!;
          return {
            termStudentId: c.termStudentId,
            committeeId: p.committeeId,
            expectedAssignmentRevision: c.assignmentRevision,
            eligibilityRevision: c.eligibility!.revision,
            evidenceHash: c.eligibility!.evidenceHash,
            advisorHash: c.advisorHash,
          };
        }),
        reasons:
          result.status === "UNSAT"
            ? [
                "Không có phương án thỏa xung đột/tải/roster cho toàn bộ lựa chọn.",
              ]
            : result.status === "SEARCH_LIMIT"
              ? [
                  "Đã tới giới hạn tìm kiếm; chưa chứng minh được không khả thi.",
                ]
              : [],
      };
    });
  }
}
