import { Inject, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import {
  committeePreviewSchema,
  reviewerPreviewSchema,
  schedulePreviewSchema,
  type CommitteePreviewInput,
  type ReviewerPreviewInput,
  type SchedulePreviewInput,
  type PlanningContext,
  type PlanningStudent,
  type PlanningPreview,
  type LegacyCommittee,
  type LegacyReviewer,
  type LegacySchedule,
} from "@doan/shared";
import { academicTermScope } from "../../common/security/academic-term-scope.policy";
import { Uc18FinalizationReader } from "../../common/contracts/uc18-finalization.port";
import {
  canonicalDefenseListJson,
  defenseListSnapshotSchema,
  defenseListSnapshotHash,
} from "../../common/uc18-finalization/defense-list-snapshot";
import { DefenseConfirmationValidator } from "../../guidance/defense-confirmations/defense-confirmation.validator";
import {
  DefensePlanningRepository,
  DefensePlanningSession,
} from "./defense-planning.repository";
import {
  PLANNING_BLOCKERS,
  checkCommittees,
  checkReviewers,
  checkSchedule,
  planningError,
} from "./defense-planning.policy";
import type { ReviewPrincipal } from "../../topic/proposal-reviews/proposal-review.repository";

@Injectable()
export class DefensePlanningService {
  constructor(
    @Inject(DefensePlanningRepository)
    private readonly repo: DefensePlanningRepository,
    @Inject(Uc18FinalizationReader)
    private readonly uc18: Uc18FinalizationReader,
    @Inject(DefenseConfirmationValidator)
    private readonly rules: DefenseConfirmationValidator,
  ) {}
  private permitted(user: ReviewPrincipal, action: "read" | "preview") {
    return user.userRoles.some((r) =>
      r.role.rolePermissions.some(
        (p) =>
          p.permission.resource === "defense-planning" &&
          p.permission.action === action,
      ),
    );
  }
  private async actor(
    s: DefensePlanningSession,
    userId: string,
    preview: boolean,
  ) {
    const user = await s.principal(userId);
    if (
      !user ||
      user.id !== userId ||
      user.status !== "ACTIVE" ||
      user.mustChangePassword ||
      !user.userRoles.some((r) => r.role.name === "FACULTY") ||
      !this.permitted(user, "read") ||
      (preview && !this.permitted(user, "preview"))
    )
      planningError(
        403,
        "DEFENSE_PLANNING_FORBIDDEN",
        "Cần tài khoản Khoa hoạt động và quyền đọc/lập preview phù hợp.",
      );
    return user;
  }
  private async scope(
    s: DefensePlanningSession,
    userId: string,
    termId: string,
  ) {
    if (
      !academicTermScope(await s.grants(userId, termId), userId, termId)
        .allDepartments
    )
      planningError(
        403,
        "DEFENSE_PLANNING_SCOPE_FORBIDDEN",
        "Lập phương án toàn đợt cần AcademicTermGrant allDepartments=true đúng đợt; role không thay grant.",
      );
  }
  terms(userId: string) {
    return this.repo.read(async (s) => {
      await this.actor(s, userId, false);
      const ids = (await s.grants(userId))
        .filter((g) => g.userId === userId && g.allDepartments)
        .map((g) => g.termId);
      return { items: await s.terms({ id: { in: ids } }) };
    });
  }
  private async load(
    s: DefensePlanningSession,
    tx: Prisma.TransactionClient,
    userId: string,
    termId: string,
    preview: boolean,
  ) {
    const actor = await this.actor(s, userId, preview);
    await this.scope(s, userId, termId);
    const term = await s.term(termId);
    if (!term)
      planningError(
        404,
        "DEFENSE_PLANNING_TERM_NOT_FOUND",
        "Không tìm thấy đợt tốt nghiệp.",
      );
    const [
      members,
      proposals,
      assignments,
      lecturerRoster,
      candidates,
      rooms,
      committees,
      sessions,
      uc18,
      at,
    ] = await Promise.all([
      s.members(termId),
      s.dossiers(termId),
      s.assignments(termId),
      s.lecturerRoster(termId),
      s.candidates(termId),
      s.rooms(),
      s.committees(termId),
      s.sessions(termId),
      this.uc18.read(termId, tx),
      s.now(),
    ]);
    const proposalIds = proposals.map((p) => p.id);
    const reviewers = await s.reviewers(proposalIds);
    const currentMembers = new Map(members.map((m) => [m.studentId, m]));
    const byStudent = new Map(proposals.map((p) => [p.studentId, p]));
    const byRegistration = new Map(assignments.map((r) => [r.studentId, r]));
    const byLecturer = new Map(lecturerRoster.map((r) => [r.lecturerId, r]));
    let source: PlanningContext["source"] = {
      kind: "ROSTER_PREVIEW",
      finalizationId: null,
      version: null,
      rosterCount: members.length,
      admittedCount: null,
    };
    type Captured = {
      termStudentId: string;
      studentId: string;
      proposalId: string | null;
      admitted: boolean | null;
      pdf?: {
        finalReportId: string;
        revision: number;
        checksum: string;
      } | null;
      confirmation?: {
        id: string;
        status: string;
        revision: number;
        advisorId: string;
        snapshot: {
          assignment: { assignmentId: string; revision: number };
        } | null;
      } | null;
    };
    let captured: Captured[] = members.map((m) => ({
      termStudentId: m.id,
      studentId: m.studentId,
      proposalId: byStudent.get(m.studentId)?.id ?? null,
      admitted: null,
    }));
    if (uc18.termId !== termId || uc18.scope !== "TERM")
      planningError(
        503,
        "UC18_SOURCE_INVALID",
        "Nguồn UC18 không khớp phạm vi đợt.",
      );
    if (uc18.state === "FINALIZED") {
      const proof = uc18.evidence;
      if (!proof || proof.integrity !== "VERIFIED")
        planningError(
          503,
          "UC18_SOURCE_INVALID",
          "Thiếu bằng chứng bản chốt UC18.",
        );
      const row = await s.readFinalization(proof.finalizationId);
      const parsed = defenseListSnapshotSchema.safeParse(row?.snapshot);
      if (
        !row ||
        !parsed.success ||
        row.id !== proof.finalizationId ||
        row.termId !== termId ||
        row.listRevision !== uc18.revision ||
        row.version !== proof.version ||
        row.snapshotSchemaVersion !== parsed.data.schemaVersion ||
        proof.snapshotSchemaVersion !== parsed.data.schemaVersion ||
        row.contentHash !== proof.contentHash ||
        row.finalizedByUserId !== uc18.finalizedByUserId ||
        row.finalizedAt.getTime() !== Date.parse(uc18.finalizedAt) ||
        defenseListSnapshotHash(row.snapshot) !== proof.contentHash ||
        parsed.data.termId !== termId ||
        parsed.data.listRevision !== uc18.revision ||
        parsed.data.finalizationVersion !== proof.version ||
        parsed.data.finalizedByUserId !== row.finalizedByUserId ||
        Date.parse(parsed.data.finalizedAt) !== row.finalizedAt.getTime()
      )
        planningError(
          503,
          "UC18_SOURCE_INVALID",
          "Không xác minh được snapshot bản chốt UC18; không fallback roster thành danh sách chính thức.",
        );
      captured = parsed.data.students;
      source = {
        kind: "UC18_FINALIZED",
        finalizationId: row.id,
        version: row.version,
        rosterCount: captured.length,
        admittedCount: captured.filter((s) => s.admitted).length,
      };
    }
    const evidenceKeys: object[] = [];
    const students = captured.map((c): PlanningStudent => {
      const m = currentMembers.get(c.studentId),
        candidate = byStudent.get(c.studentId);
      const p =
        candidate &&
        candidate.id === c.proposalId &&
        candidate.topic.termId === termId &&
        candidate.studentId === c.studentId
          ? candidate
          : null;
      const reg = byRegistration.get(c.studentId);
      const a =
        reg?.advisorAssignments.find(
          (a) =>
            a.assignmentPlanId ===
            term.pr2bTermWorkflowTermId?.officialAssignmentPlanId,
        ) ?? null;
      const official = p
        ? this.rules.official(
            p,
            term,
            reg ? { ...reg, advisorAssignment: a } : null,
            a ? (byLecturer.get(a.advisorId) ?? null) : null,
            at,
          )
        : null;
      const advisor =
        official?.state === "OFFICIAL"
          ? {
              id: official.advisorId,
              name: official.name,
              assignmentId: official.assignmentId,
              revision: official.revision,
            }
          : null;
      const pdf = this.rules.pdfMetadata(
        p?.finalReport ?? null,
        p?.id ?? "",
        p?.student.userId ?? "",
        at,
      );
      const decision = this.rules.decision(p?.defenseConfirmation ?? null, at);
      let evidence: PlanningStudent["evidence"] = "PRELIMINARY";
      if (source.kind === "UC18_FINALIZED") {
        if (!m || m.id !== c.termStudentId || !p || p.status !== "APPROVED")
          evidence = "STALE";
        else if (
          !advisor ||
          !c.confirmation?.snapshot ||
          !c.pdf ||
          !pdf.snapshot
        )
          evidence = "UNKNOWN";
        else {
          const old = c.confirmation.snapshot.assignment;
          evidence =
            c.confirmation.advisorId !== advisor.id ||
            old.assignmentId !== advisor.assignmentId ||
            old.revision !== advisor.revision ||
            c.pdf.finalReportId !== pdf.snapshot.finalReportId ||
            c.pdf.revision !== pdf.snapshot.revision ||
            c.pdf.checksum !== pdf.snapshot.checksum ||
            decision.id !== c.confirmation.id ||
            decision.revision !== c.confirmation.revision ||
            decision.state !== "RECORDED" ||
            decision.decidedByUserId !==
              (official?.state === "OFFICIAL" ? official.userId : null)
              ? "STALE"
              : "UNCHANGED_METADATA";
        }
      }
      evidenceKeys.push({
        memberId: m?.id ?? null,
        proposalId: p?.id ?? null,
        proposalStatus: p?.status ?? null,
        advisor,
        decisionRevision: decision.revision,
        decisionState: decision.state,
        decisionStatus: decision.status,
        pdfState: pdf.state,
        pdf: pdf.snapshot,
        studentActive: m?.student.isActive ?? null,
      });
      return {
        termStudentId: c.termStudentId,
        studentId: c.studentId,
        code: m?.student.studentCode ?? null,
        name: m?.student.fullName ?? null,
        proposalId: c.proposalId,
        title: p?.topic.title ?? null,
        admitted: c.admitted,
        advisor,
        evidence,
      };
    });
    const lecturerNames = new Map(
      candidates.map((r) => [r.lecturer.id, r.lecturer.fullName]),
    );
    const legacyCommittees: LegacyCommittee[] = committees.map((c) => ({
      id: c.id,
      name: c.name,
      lifecycle: "UNVERIFIED",
      members: c.members.map((m) => ({
        lecturerId: m.lecturerId,
        role: m.role,
        name:
          lecturerNames.get(m.lecturerId) ?? "Không có trong roster hoạt động",
      })),
    }));
    const legacyReviewers: LegacyReviewer[] = reviewers.map((r) => ({
      id: r.id,
      proposalId: r.proposalId,
      reviewerId: r.reviewerId,
      assignedAt: r.assignedAt.toISOString(),
      lifecycle: "UNVERIFIED",
    }));
    const own = new Set(proposalIds);
    const legacySchedule: LegacySchedule[] = sessions.map((s) => ({
      id: s.id,
      committeeId: s.committeeId,
      roomId: s.roomId,
      startsAt: s.scheduledAt.toISOString(),
      durationMin: s.durationMin,
      lifecycle: "UNVERIFIED",
      proposalIds: s.committeeStudents
        .filter((p) => own.has(p.proposalId))
        .map((p) => p.proposalId),
      hasUnscopedReferences: s.committeeStudents.some(
        (p) => !own.has(p.proposalId),
      ),
    }));
    const publicTerm = {
      id: term.id,
      name: term.name,
      status: term.status,
      locked: term.isLocked,
      startsAt: term.startDate.toISOString(),
      endsAt: term.endDate.toISOString(),
    };
    const lecturers = candidates.map(({ lecturer }) => ({
      id: lecturer.id,
      name: lecturer.fullName,
      departmentId: lecturer.departmentId,
    }));
    const expectedContext = createHash("sha256")
      .update(
        canonicalDefenseListJson({
          userId,
          term: publicTerm,
          officialPlanId:
            term.pr2bTermWorkflowTermId?.officialAssignmentPlanId ?? null,
          uc18,
          source,
          students,
          lecturers,
          rooms,
          evidenceKeys,
          legacyCommittees,
          legacyReviewers,
          legacySchedule,
        }),
      )
      .digest("hex");
    const blockers = [...PLANNING_BLOCKERS];
    if (
      source.kind === "UC18_FINALIZED" &&
      captured.some((c) => c.admitted && c.confirmation?.status !== "CONFIRMED")
    )
      blockers.unshift({
        code: "UC18_ADMISSION_INCONSISTENT",
        message:
          "Bản chốt UC18 có hồ sơ được phép bảo vệ nhưng thiếu quyết định CONFIRMED trong snapshot; cần Khoa đối soát. Không thay đổi bản chốt lịch sử.",
      });
    if (source.kind !== "UC18_FINALIZED")
      blockers.unshift({
        code: "UC18_NOT_FINALIZED",
        message:
          "UC18 chưa có bản chốt hợp lệ; chỉ được lập phương án xem trước, không ghi phân công/lịch chính thức.",
      });
    if (term.isLocked || ["COMPLETED", "CANCELLED"].includes(term.status))
      blockers.unshift({
        code: "DEFENSE_TERM_IMMUTABLE",
        message: "Đợt đã khóa/kết thúc; không được ghi nghiệp vụ chính thức.",
      });
    const context: PlanningContext = {
      code: "DEFENSE_PLANNING_CONTEXT",
      asOf: at.toISOString(),
      expectedContext,
      term: publicTerm,
      uc18: {
        state: uc18.state,
        ...(uc18.state === "UNKNOWN" ? { reason: uc18.reason } : {}),
      },
      source,
      students,
      lecturers,
      rooms,
      capabilities: {
        canPreview: this.permitted(actor, "preview"),
        canCreateOfficial: false,
        canFinalize: false,
        canPublish: false,
      },
      blockers,
    };
    return { context, legacyCommittees, legacyReviewers, legacySchedule };
  }
  context(userId: string, termId: string) {
    return this.repo.read(
      async (s, tx) => (await this.load(s, tx, userId, termId, false)).context,
    );
  }
  records(
    userId: string,
    termId: string,
    kind: "committees" | "reviewers" | "schedule",
    committeeId?: string,
  ) {
    return this.repo.read(async (s, tx) => {
      const data = await this.load(s, tx, userId, termId, false);
      const items =
        kind === "committees"
          ? data.legacyCommittees
          : kind === "reviewers"
            ? data.legacyReviewers
            : data.legacySchedule;
      if (committeeId) {
        const record = data.legacyCommittees.find((c) => c.id === committeeId);
        if (!record)
          planningError(
            404,
            "DEFENSE_COMMITTEE_NOT_FOUND",
            "Không tìm thấy hội đồng trong phạm vi đợt.",
          );
        return { record, official: false, lifecycle: "UNVERIFIED" };
      }
      return {
        items,
        official: false,
        lifecycle: "UNVERIFIED",
        notice:
          "Bản ghi cũ chưa có bằng chứng chốt/công bố; không dùng làm nguồn chính thức.",
      };
    });
  }
  async preview(
    userId: string,
    termId: string,
    stage: "COMMITTEES" | "REVIEWERS" | "SCHEDULE",
    value: unknown,
  ): Promise<PlanningPreview> {
    const schema =
      stage === "COMMITTEES"
        ? committeePreviewSchema
        : stage === "REVIEWERS"
          ? reviewerPreviewSchema
          : schedulePreviewSchema;
    const parsed = schema.safeParse(value);
    if (!parsed.success)
      planningError(
        422,
        "DEFENSE_PLANNING_INPUT_INVALID",
        "Phương án chưa đúng cấu trúc. Kiểm tra thành viên, vai trò, thời gian và context.",
      );
    return this.repo.read(async (s, tx) => {
      const { context } = await this.load(s, tx, userId, termId, true);
      const input = parsed.data;
      if (input.expectedContext !== context.expectedContext)
        planningError(
          409,
          "DEFENSE_PLANNING_CONTEXT_CHANGED",
          "Nguồn dữ liệu UC18/phân công/PDF/danh mục vừa thay đổi. Tải lại và lập lại phương án.",
        );
      let issues,
        warnings,
        workload: PlanningPreview["workload"] = [],
        slots: SchedulePreviewInput["slots"] = [];
      if (stage === "SCHEDULE") {
        const body = input as SchedulePreviewInput;
        slots = body.slots;
        const validDates = slots.filter(
          (s) =>
            Date.parse(s.startsAt) < Date.parse(s.endsAt) &&
            Date.parse(s.startsAt) >= Date.parse(context.term.startsAt) &&
            Date.parse(s.endsAt) <= Date.parse(context.term.endsAt),
        );
        const busy = validDates.length
          ? await s.busySessions(
              new Date(
                Math.min(...validDates.map((s) => Date.parse(s.startsAt))),
              ),
              new Date(
                Math.max(...validDates.map((s) => Date.parse(s.endsAt))),
              ),
            )
          : [];
        const busyProposalIds = [
          ...new Set(
            busy.flatMap((b) => b.committeeStudents.map((p) => p.proposalId)),
          ),
        ];
        const bookingStudents = busyProposalIds.length
          ? await s.bookingStudents(busyProposalIds)
          : [];
        const bookingReviewers =
          body.includeReviewersAsAttendees && busyProposalIds.length
            ? await s.reviewers(busyProposalIds)
            : [];
        const result = checkSchedule(
          context,
          body.committees,
          body.reviewers,
          slots,
          body.includeReviewersAsAttendees,
          busy.map((b) => ({
            roomId: b.roomId,
            startsAt: b.scheduledAt.toISOString(),
            endsAt: new Date(
              b.scheduledAt.getTime() + b.durationMin * 60000,
            ).toISOString(),
            lecturerIds: [
              ...b.committee.members.map((m) => m.lecturerId),
              ...bookingReviewers
                .filter((r) =>
                  b.committeeStudents.some(
                    (p) => p.proposalId === r.proposalId,
                  ),
                )
                .map((r) => r.reviewerId),
            ],
            proposalIds: b.committeeStudents.map((p) => p.proposalId),
            studentIds: bookingStudents
              .filter((s) =>
                b.committeeStudents.some((p) => p.proposalId === s.id),
              )
              .map((s) => s.studentId),
          })),
        );
        ({ issues, warnings, workload } = result);
      } else if (stage === "REVIEWERS") {
        const body = input as ReviewerPreviewInput;
        ({ issues, warnings, workload } = checkReviewers(
          context,
          body.committees,
          body.reviewers,
        ));
      } else
        ({ issues, warnings } = checkCommittees(
          context,
          (input as CommitteePreviewInput).committees,
        ));
      issues.push(
        ...context.blockers.filter(
          (b) => b.code === "UC18_ADMISSION_INCONSISTENT",
        ),
      );
      return {
        code: "DEFENSE_PLANNING_PREVIEW",
        stage,
        mode: "PREVIEW_ONLY",
        persisted: false,
        expectedContext: context.expectedContext,
        validForPreview: issues.length === 0,
        officialReady: false,
        source: context.source,
        issues,
        warnings,
        blockers: context.blockers,
        workload,
        slots,
      };
    });
  }
}
