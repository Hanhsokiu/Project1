import { Inject, Injectable } from "@nestjs/common";
import { academicTermScope } from "../../common/security/academic-term-scope.policy";
import { Uc18FinalizationReader } from "../../common/contracts/uc18-finalization.port";
import { DefenseConfirmationValidator } from "../../guidance/defense-confirmations/defense-confirmation.validator";
import { DefenseConfirmationReadValidator } from "../../guidance/defense-confirmations/defense-confirmation-read.validator";
import { DefenseConfirmationProgressValidator } from "../../guidance/defense-confirmations/defense-confirmation-progress.validator";
import { confirmationError } from "../../guidance/defense-confirmations/defense-confirmation.dto";
import {
  DefenseReviewRepository,
  DefenseReviewSession,
} from "./defense-review.repository";
import {
  previewQuerySchema,
  reviewQuerySchema,
  UC18_BLOCKERS,
  type PreviewQuery,
  type ReviewQuery,
} from "./defense-review.dto";
import { evaluateDefenseEvidence } from "./defense-eligibility.policy";
import type { ReviewPrincipal } from "../../topic/proposal-reviews/proposal-review.repository";
import type { OfficialAdvisorContext } from "../../guidance/defense-confirmations/defense-confirmation.types";

@Injectable()
export class DefenseReviewService {
  constructor(
    @Inject(DefenseReviewRepository)
    private readonly repo: DefenseReviewRepository,
    @Inject(DefenseConfirmationValidator)
    private readonly rules: DefenseConfirmationValidator,
    @Inject(DefenseConfirmationReadValidator)
    private readonly access: DefenseConfirmationReadValidator,
    @Inject(DefenseConfirmationProgressValidator)
    private readonly progress: DefenseConfirmationProgressValidator,
    @Inject(Uc18FinalizationReader)
    private readonly uc18: Uc18FinalizationReader,
  ) {}
  private async actor(
    s: DefenseReviewSession,
    userId: string,
    preview: boolean,
  ) {
    const user = await s.principal(userId);
    if (!preview) return this.access.principal(user, userId);
    if (
      !user ||
      user.id !== userId ||
      user.status !== "ACTIVE" ||
      user.mustChangePassword ||
      !this.permission(user, "defense-list", "read")
    )
      confirmationError(
        403,
        "DEFENSE_LIST_READ_FORBIDDEN",
        "Thiếu quyền đọc danh sách bảo vệ.",
      );
    return user;
  }
  private permission(user: ReviewPrincipal, resource: string, action: string) {
    return user.userRoles.some((r) =>
      r.role.rolePermissions.some(
        (p) =>
          p.permission.resource === resource && p.permission.action === action,
      ),
    );
  }
  terms(userId: string, preview = false) {
    return this.repo.read(async (s) => {
      const user = await this.actor(s, userId, preview);
      const grants = await s.grants(userId);
      const ids = new Set<string>();
      if (
        preview ||
        this.access.role(user, "FACULTY") ||
        this.access.role(user, "ADMIN")
      )
        grants
          .filter(
            (g) =>
              g.userId === userId &&
              (g.allDepartments || g.pr2bGrantDepartmentGrantId.length),
          )
          .forEach((g) => ids.add(g.termId));
      if (
        !preview &&
        this.access.role(user, "STUDENT") &&
        user.student?.isActive
      )
        (await s.studentTerms(user.student.id)).forEach((r) =>
          ids.add(r.termId),
        );
      if (
        !preview &&
        this.access.role(user, "LECTURER") &&
        user.lecturer?.isActive
      )
        (await s.advisorTerms(user.lecturer.id))
          .filter((r) => r.advisorAssignment)
          .forEach((r) => ids.add(r.termId));
      return { items: await s.terms({ id: { in: [...ids] } }) };
    });
  }
  private async rows(
    s: DefenseReviewSession,
    user: ReviewPrincipal,
    termId: string,
    view: ReviewQuery["view"],
    preview: boolean,
  ) {
    const grants = await s.grants(user.id, termId);
    const scope = academicTermScope(grants, user.id, termId);
    if (
      view === "FACULTY" &&
      (!scope.configured ||
        (!preview &&
          !this.access.role(user, "FACULTY") &&
          !this.access.role(user, "ADMIN")))
    )
      confirmationError(
        403,
        "DEFENSE_REVIEW_SCOPE_FORBIDDEN",
        "Cần grant đúng phạm vi đợt.",
      );
    if (view === "ADVISOR") this.access.requireAdvisorReader(user);
    if (
      view === "STUDENT" &&
      (!this.access.role(user, "STUDENT") || !user.student?.isActive)
    )
      confirmationError(
        403,
        "UC17_READ_FORBIDDEN",
        "Chỉ đọc hồ sơ của chính sinh viên.",
      );
    const term = await s.term(termId);
    if (!term)
      confirmationError(
        404,
        "DEFENSE_REVIEW_TERM_NOT_FOUND",
        "Không tìm thấy đợt.",
      );
    const studentId = view === "STUDENT" ? user.student!.id : undefined;
    const [members, proposals, assignments, lecturers, at] = await Promise.all([
      s.members(termId, studentId),
      s.dossiers(termId, studentId),
      s.assignments(termId),
      s.lecturerRoster(termId),
      s.now(),
    ]);
    const byStudent = new Map(proposals.map((p) => [p.studentId, p]));
    const assignmentByStudent = new Map(
      assignments.map((r) => [r.studentId, r]),
    );
    const lecturerById = new Map(lecturers.map((l) => [l.lecturerId, l]));
    const advisors = new Map<string, OfficialAdvisorContext>();
    const items = members.flatMap((member) => {
      const candidate = byStudent.get(member.studentId);
      // A corrupt cross-term topic must not expose another term's title or decision.
      const p =
        candidate?.topic.termId === termId &&
        candidate.student.id === member.studentId &&
        candidate.student.userId === member.student.userId
          ? candidate
          : undefined;
      const departmentId =
        p?.topic.researchArea?.pr2bResearchAreaWorkflowResearchAreaId
          ?.departmentId;
      if (view === "FACULTY" && !scope.contains(departmentId)) return [];
      const reg = assignmentByStudent.get(member.studentId);
      const assignment =
        reg?.advisorAssignments.find(
          (a) =>
            a.assignmentPlanId ===
            term.pr2bTermWorkflowTermId?.officialAssignmentPlanId,
        ) ?? null;
      const advisor = p
        ? this.rules.official(
            p,
            term,
            reg ? { ...reg, advisorAssignment: assignment } : null,
            (assignment ? lecturerById.get(assignment.advisorId) : null) ??
              null,
            at,
          )
        : { state: "NOT_READY" as const, issues: [] };
      if (view === "ADVISOR" && !this.access.advisor(user, advisor)) return [];
      if (p) advisors.set(p.id, advisor);
      const decision = this.rules.decision(p?.defenseConfirmation ?? null, at);
      const pdf = this.rules.pdfMetadata(
        p?.finalReport ?? null,
        p?.id ?? "",
        member.student.userId,
        at,
      );
      const changes = this.rules.changed(decision, pdf, advisor);
      const status =
        decision.state === "ABSENT" || decision.state === "PENDING"
          ? "PENDING"
          : decision.state === "RECORDED"
            ? decision.status!
            : "UNKNOWN";
      return [
        {
          termStudentId: member.id,
          studentId: member.studentId,
          studentCode: member.student.studentCode,
          studentName: member.student.fullName,
          proposalId: p?.id ?? null,
          title: p?.topic.title ?? null,
          status,
          decision: {
            state: decision.state,
            status: decision.status,
            revision: decision.revision,
            note: decision.note,
            decidedAt: decision.decidedAt,
          },
          advisor:
            advisor.state === "OFFICIAL"
              ? { state: advisor.state, name: advisor.name }
              : { state: advisor.state, name: null },
          pdf: { state: pdf.state, revision: pdf.revision },
          ...changes,
          evidence: evaluateDefenseEvidence({
            proposalStatus: p?.status ?? null,
            active: member.student.isActive,
            advisor,
            decision,
            pdf,
            changes,
          }),
          // Academic catalog value is intentionally not projected as an official UC18 verdict.
        },
      ];
    });
    return { items, term, at, scope, advisors };
  }
  inbox(userId: string, query: ReviewQuery) {
    const q = reviewQuerySchema.parse(query);
    return this.repo.read(async (s) => {
      const user = await this.actor(s, userId, false);
      const { items, at, advisors } = await this.rows(
        s,
        user,
        q.termId,
        q.view,
        false,
      );
      const filtered = items.filter(
        (r) => q.status === "ALL" || r.status === q.status,
      );
      const page = filtered.slice((q.page - 1) * q.limit, q.page * q.limit);
      const rows = await Promise.all(
        page.map(async (row) => {
          // Students receive current decision only, never internal progress/context.
          if (q.view !== "ADVISOR" || !row.proposalId)
            return { ...row, progress: null };
          const advisor = advisors.get(row.proposalId);
          if (!advisor) return { ...row, progress: null };
          // Reuse already verified assignment facts in this repeatable-read snapshot.
          const plan = await s.planFor(row.proposalId);
          const progress = this.progress.summarize(
            plan,
            plan ? await s.monitorTasks(plan.id) : [],
            plan ? await s.evaluations(plan.id) : [],
            advisor,
            at,
          );
          return {
            ...row,
            progress: {
              dataState: progress.dataState,
              summary: progress.summary,
              warnings: progress.warnings,
            },
          };
        }),
      );
      return {
        code: "DEFENSE_CONFIRMATION_INBOX",
        termId: q.termId,
        view: q.view,
        items: rows,
        total: filtered.length,
        page: q.page,
        limit: q.limit,
      };
    });
  }
  preview(userId: string, termId: string, query: PreviewQuery) {
    const q = previewQuerySchema.parse(query);
    return this.repo.read(async (s, tx) => {
      const user = await this.actor(s, userId, true);
      const { items, scope, at } = await this.rows(
        s,
        user,
        termId,
        "FACULTY",
        true,
      );
      const filtered = items.filter(
        (r) => q.result === "ALL" || r.evidence.result === q.result,
      );
      return {
        code: "DEFENSE_LIST_PREVIEW",
        termId,
        asOf: at.toISOString(),
        scope: scope.allDepartments ? "TERM" : "DEPARTMENTS",
        rosterCompleteForTerm: scope.allDepartments,
        total: filtered.length,
        rosterCount: items.length,
        admittedCount: 0,
        page: q.page,
        limit: q.limit,
        items: filtered.slice((q.page - 1) * q.limit, q.page * q.limit),
        uc18: await this.uc18.read(termId, tx),
        capabilities: {
          canManage:
            scope.allDepartments &&
            this.permission(user, "defense-list", "manage"),
          canFinalize: false,
          canReopen: false,
        },
        blockers: UC18_BLOCKERS,
        notice:
          "Preview đối soát, chưa phải danh sách được phép bảo vệ. Thiếu nguồn xác minh học vụ; không tự cập nhật DefenseEligibility.",
      };
    });
  }
}
