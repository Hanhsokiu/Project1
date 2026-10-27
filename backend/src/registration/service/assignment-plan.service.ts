import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import {
  operationWindow,
  TermWindowService,
} from "../../term/service/term-window.service";
import { LoadedTerm } from "../../term/repository/term.repository";
import {
  AssignmentRepository,
  WorkflowTx,
  LoadedPlan,
} from "../repository/assignment.repository";
import { AssignmentValidator as V } from "../validator/assignment.validator";
import {
  runAssignmentAlgorithm,
  AssignmentResult,
} from "../engine/assignment-algorithm";
export interface RunPlan {
  mode: "remaining" | "all";
  confirmed: boolean;
  revision: number;
  inputHash?: string;
}
@Injectable()
export class AssignmentPlanService {
  constructor(
    private readonly repo: AssignmentRepository,
    private readonly windows: TermWindowService,
  ) {}
  private async load(termId: string, tx: WorkflowTx, write = false) {
    const term = await this.repo.term(termId, tx);
    if (!term) throw new NotFoundException("Không tìm thấy đợt.");
    if (write)
      await this.windows.requireOpen(termId, "ASSIGNMENT", new Date(), tx);
    const [registrations, plans] = await Promise.all([
      this.repo.registrations(termId, tx),
      this.repo.plans(termId, tx),
    ]);
    const official = plans.find((p) => p.status !== "DRAFT");
    if (write && official)
      throw new ConflictException(
        "Phân công đã công bố, không thay đổi phương án.",
      );
    return {
      term,
      registrations,
      plan: official ?? plans.find((p) => p.status === "DRAFT") ?? null,
    };
  }
  private async calculate(termId: string, options: RunPlan, tx: WorkflowTx) {
    const ctx = await this.load(termId, tx, true);
    V.revision(ctx.plan?.revision ?? 0, options.revision);
    V.require(
      options.mode !== "all" || options.confirmed,
      "Cần xác nhận khi tính lại toàn bộ phương án nháp.",
    );
    const submitted = ctx.registrations.filter((r) => r.status === "SUBMITTED");
    const issues = submitted
      .map((r) => ({
        registrationId: r.id,
        studentId: r.studentId,
        reason: V.issue(r, ctx.term),
      }))
      .filter((r) => r.reason);
    const valid = submitted.filter(
      (r) => !issues.some((i) => i.registrationId === r.id),
    );
    const retained =
      options.mode === "remaining" ? (ctx.plan?.advisorAssignments ?? []) : [];
    const capacities = ctx.term.termLecturers
      .map((l) => ({
        lecturerId: l.lecturerId,
        lecturerCode: l.lecturer.lecturerCode,
        quota: l.quota,
        currentCount: retained.filter((a) => a.advisorId === l.lecturerId)
          .length,
        active: l.lecturer.isActive,
        directionIds: l.lecturer.researchAreas.map((a) => a.researchAreaId),
      }))
      .sort((a, b) =>
        a.lecturerCode < b.lecturerCode
          ? -1
          : a.lecturerCode > b.lecturerCode
            ? 1
            : 0,
      );
    const inputs = valid.map((r) => ({
      registrationId: r.id,
      studentId: r.studentId,
      studentCode: r.student.studentCode,
      gpa: r.student.gpa === null ? null : Number(r.student.gpa),
      submittedAt: r.submittedAt!.toISOString(),
      directionId: r.directionId!,
      preferences: r.preferences.map((p) => ({
        lecturerId: p.lecturerId,
        order: p.preferenceOrder,
      })),
    }));
    const results: AssignmentResult[] = [
      ...retained.map((a) => ({
        registrationId: a.registrationId,
        assignedLecturerId: a.advisorId,
        isManual: a.isManual,
        preference: a.isManual
          ? 0
          : Number(a.note?.match(/^NV([123])$/)?.[1] ?? 4),
        reason: a.note ?? (a.isManual ? "Thủ công" : "Theo hướng"),
      })),
      ...runAssignmentAlgorithm(
        inputs.filter(
          (r) => !retained.some((a) => a.registrationId === r.registrationId),
        ),
        capacities,
      ),
      ...issues
        .filter(
          (i) => !retained.some((a) => a.registrationId === i.registrationId),
        )
        .map((i) => ({
          ...i,
          assignedLecturerId: null,
          isManual: false,
          preference: 0,
          reason: `Chưa phân: ${i.reason}`,
        })),
    ];
    const missingSubmissions = ctx.term.termStudents
      .filter((s) => !submitted.some((r) => r.studentId === s.studentId))
      .map((s) => ({
        studentId: s.studentId,
        studentCode: s.student.studentCode,
        fullName: s.student.fullName,
        reason: "Chưa nộp đăng ký hợp lệ; không tự suy đoán hướng.",
      }));
    const inputSnapshot = {
      algorithm: "rounds-gpa-v1",
      mode: options.mode,
      registrations: inputs,
      capacities,
      issues,
      retained: retained.map((a) => ({
        registrationId: a.registrationId,
        advisorId: a.advisorId,
        note: a.note,
      })),
      roster: ctx.term.termStudents.map((s) => s.studentId).sort(),
    };
    const inputHash = createHash("sha256")
      .update(JSON.stringify(inputSnapshot))
      .digest("hex");
    return { ...ctx, results, missingSubmissions, inputSnapshot, inputHash };
  }
  preview(termId: string, options: RunPlan) {
    return this.repo.transaction(async (tx) => {
      const c = await this.calculate(termId, options, tx);
      return {
        revision: c.plan?.revision ?? 0,
        inputHash: c.inputHash,
        results: c.results,
        missingSubmissions: c.missingSubmissions,
      };
    });
  }
  save(termId: string, options: RunPlan, userId: string) {
    return this.repo.transaction(async (tx) => {
      const c = await this.calculate(termId, options, tx);
      if (!options.inputHash || options.inputHash !== c.inputHash)
        throw new ConflictException(
          "Dữ liệu đầu vào đã thay đổi. Hãy xem trước lại trước khi lưu.",
        );
      return this.persistDraft(c, options.mode, userId, tx);
    });
  }
  createAutomaticDraft(termId: string) {
    return this.repo.transaction(async (tx) => {
      // Recheck within the serializable transaction: a user or another worker
      // may have saved/published a plan or changed the window after discovery.
      const term = await this.repo.term(termId, tx);
      if (!term || !operationWindow(term, "ASSIGNMENT").canWrite) return null;
      if ((await this.repo.plans(termId, tx)).length) return null;
      const c = await this.calculate(
        termId,
        { mode: "remaining", confirmed: false, revision: 0 },
        tx,
      );
      return this.persistDraft(c, "remaining", null, tx, true);
    });
  }
  private async persistDraft(
    c: Awaited<ReturnType<AssignmentPlanService["calculate"]>>,
    mode: RunPlan["mode"],
    userId: string | null,
    tx: WorkflowTx,
    automatic = false,
  ) {
    const termId = c.term.id;
    const plan = await this.repo.savePlan(
      c.plan?.id,
      {
        termId,
        revision: (c.plan?.revision ?? 0) + 1,
        inputSnapshot: c.inputSnapshot as unknown as Prisma.InputJsonValue,
        outcome: {
          results: c.results,
          missingSubmissions: c.missingSubmissions,
        } as unknown as Prisma.InputJsonValue,
      },
      tx,
    );
    await this.repo.replaceAssignments(
      plan.id,
      c.results
        .filter((r) => r.assignedLecturerId)
        .map((r) => ({
          registrationId: r.registrationId,
          advisorId: r.assignedLecturerId!,
          isManual: r.isManual,
          note: r.reason,
        })),
      tx,
    );
    await this.repo.audit(
      userId,
      automatic ? "ASSIGNMENT_AUTO_DRAFT_SAVED" : "ASSIGNMENT_DRAFT_SAVED",
      plan.id,
      {
        inputHash: c.inputHash,
        revision: plan.revision,
        mode,
        results: c.results,
      },
      tx,
    );
    return this.managerView(
      (await this.load(termId, tx)).plan!,
      c.registrations,
      c.term,
    );
  }
  private managerView(
    plan: LoadedPlan | null,
    registrations: Awaited<ReturnType<AssignmentRepository["registrations"]>>,
    term: LoadedTerm,
  ) {
    const roster = term.termStudents.map((s) => s.studentId);
    const violations: string[] = [];
    for (const r of registrations.filter((r) => r.status === "SUBMITTED")) {
      const issue = V.issue(r, term);
      if (issue) violations.push(`${r.student.studentCode}: ${issue}`);
    }
    for (const a of plan?.advisorAssignments ?? []) {
      try {
        const r = registrations.find((r) => r.id === a.registrationId);
        V.require(r, "Đăng ký không thuộc đợt.");
        const member = V.advisor(r, a.advisorId, term);
        V.require(
          plan!.advisorAssignments.filter((b) => b.advisorId === a.advisorId)
            .length <= member.quota,
          "Vượt quota hiện tại.",
        );
      } catch (error) {
        violations.push(
          `${a.registration.student.studentCode}: ${(error as Error).message}`,
        );
      }
    }
    const results = registrations
      .filter((r) => r.status === "SUBMITTED")
      .map((r) => {
        const a = plan?.advisorAssignments.find(
          (a) => a.registrationId === r.id,
        );
        return {
          registrationId: r.id,
          studentId: r.studentId,
          assignedLecturerId: a?.advisorId ?? null,
          isManual: a?.isManual ?? false,
          reason:
            a?.note ??
            (plan?.outcome as { results?: AssignmentResult[] })?.results?.find(
              (i) => i.registrationId === r.id,
            )?.reason ??
            "Chưa phân công",
        };
      });
    return {
      plan: plan
        ? {
            id: plan.id,
            termId: plan.termId,
            status: plan.status,
            revision: plan.revision,
            publishedAt: plan.publishedAt,
            createdAt: plan.createdAt,
          }
        : null,
      assignments: plan ? this.assignmentDtos(plan) : [],
      results,
      violations,
      missingSubmissions: roster
        .filter(
          (id) =>
            !registrations.some(
              (r) => r.studentId === id && r.status === "SUBMITTED",
            ),
        )
        .map((studentId) => ({
          studentId,
          reason: "Chưa nộp đăng ký hợp lệ; không tự suy đoán hướng.",
        })),
    };
  }
  private assignmentDtos(plan: LoadedPlan) {
    return plan.advisorAssignments.map((a) => ({
      id: a.id,
      termId: plan.termId,
      studentId: a.registration.studentId,
      lecturerId: a.advisorId,
      preference: a.isManual
        ? 0
        : Number(a.note?.match(/^NV([123])$/)?.[1] ?? 4),
      manual: a.isManual,
      reason: a.note ?? "",
      published: plan.status !== "DRAFT",
      directionId: a.registration.directionId,
      student: {
        id: a.registration.student.id,
        code: a.registration.student.studentCode,
        name: a.registration.student.fullName,
        className: a.registration.student.className,
        email: a.registration.student.user.email ?? "",
        phone:
          a.registration.student.user.phone ??
          a.registration.student.phone ??
          "",
        program: a.registration.student.trainingSystem.name,
        gpa: Number(a.registration.student.gpa),
        eligible: a.registration.student.academicEligible,
        departmentId: "",
      },
    }));
  }
  view(termId: string, userId: string, manage = false) {
    return this.repo.transaction(async (tx) => {
      const c = await this.load(termId, tx);
      if (manage) return this.managerView(c.plan, c.registrations, c.term);
      if (!c.plan || c.plan.status === "DRAFT")
        throw new ForbiddenException("Phân công chưa được công bố.");
      const actor = await this.repo.actor(userId, tx);
      const manager = actor.userRoles.some((r) =>
        ["ADMIN", "FACULTY"].includes(r.role.name),
      );
      const assignments = this.assignmentDtos(c.plan).filter(
        (a) =>
          manager ||
          a.studentId === actor.student?.id ||
          a.lecturerId === actor.lecturer?.id,
      );
      return {
        plan: {
          id: c.plan.id,
          termId,
          status: c.plan.status,
          publishedAt: c.plan.publishedAt,
          revision: c.plan.revision,
        },
        assignments,
        results: [],
        missingSubmissions: [],
      };
    });
  }
  adjust(
    termId: string,
    input: {
      studentId: string;
      lecturerId: string;
      reason: string;
      revision: number;
    },
    userId: string,
  ) {
    return this.repo.transaction(async (tx) => {
      const c = await this.load(termId, tx, true);
      V.require(c.plan, "Cần lưu phương án nháp trước khi điều chỉnh.");
      V.revision(c.plan.revision, input.revision);
      const reg = c.registrations.find((r) => r.studentId === input.studentId);
      V.require(reg, "Không tìm thấy đăng ký trong đợt.");
      const issue = V.issue(reg, c.term);
      V.require(!issue, issue);
      const member = V.advisor(reg, input.lecturerId, c.term);
      const kept = c.plan.advisorAssignments.filter(
        (a) => a.registrationId !== reg.id,
      );
      V.require(
        kept.filter((a) => a.advisorId === input.lecturerId).length <
          member.quota,
        "GV đã hết quota.",
      );
      const rows = [
        ...kept.map((a) => ({
          registrationId: a.registrationId,
          advisorId: a.advisorId,
          isManual: a.isManual,
          note: a.note ?? "",
        })),
        {
          registrationId: reg.id,
          advisorId: input.lecturerId,
          isManual: true,
          note: `Thủ công: ${input.reason.trim()}`,
        },
      ];
      await this.repo.replaceAssignments(c.plan.id, rows, tx);
      await this.repo.savePlan(
        c.plan.id,
        { termId, revision: c.plan.revision + 1 },
        tx,
      );
      await this.repo.audit(
        userId,
        "ASSIGNMENT_MANUAL",
        c.plan.id,
        { ...input, registrationId: reg.id },
        tx,
        c.plan.advisorAssignments.map((a) => ({
          registrationId: a.registrationId,
          advisorId: a.advisorId,
          note: a.note,
        })),
      );
      return this.managerView(
        (await this.load(termId, tx)).plan!,
        c.registrations,
        c.term,
      );
    });
  }
  publish(termId: string, revision: number, userId: string) {
    return this.repo.transaction(async (tx) => {
      const c = await this.load(termId, tx);
      V.require(c.plan, "Chưa lưu phương án nháp.");
      // Idempotent response on retries; no additional event or notification is created.
      if (c.plan.status !== "DRAFT")
        return this.managerView(c.plan, c.registrations, c.term);
      await this.windows.requireOpen(termId, "ASSIGNMENT", new Date(), tx);
      V.revision(c.plan.revision, revision);
      const regs = c.registrations.filter((r) => r.status === "SUBMITTED");
      V.require(regs.length > 0, "Chưa có đăng ký đã nộp.");
      for (const reg of regs) {
        const issue = V.issue(reg, c.term);
        V.require(!issue, issue);
        V.require(
          c.plan.advisorAssignments.some((a) => a.registrationId === reg.id),
          "Còn đăng ký hợp lệ chưa được phân công.",
        );
      }
      for (const a of c.plan.advisorAssignments) {
        const reg = regs.find((r) => r.id === a.registrationId);
        V.require(reg, "Phân công chứa đăng ký không hợp lệ.");
        const member = V.advisor(reg, a.advisorId, c.term);
        V.require(
          c.plan.advisorAssignments.filter((b) => b.advisorId === a.advisorId)
            .length <= member.quota,
          "Phương án vượt quota hiện tại.",
        );
      }
      await this.repo.publish(c.plan, userId, tx);
      return this.managerView(
        (await this.load(termId, tx)).plan!,
        c.registrations,
        c.term,
      );
    });
  }
}
