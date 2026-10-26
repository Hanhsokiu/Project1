import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  AssignmentRepository,
  WorkflowTx,
} from "../../registration/repository/assignment.repository";
import { TermWindowService } from "../../term/service/term-window.service";
import {
  LoadedProposal,
  TopicRepository,
} from "../repository/topic.repository";
import { ProposalContent } from "../dto/proposal.dto";
import { ProposalValidator as V } from "../validator/proposal.validator";
@Injectable()
export class TopicService {
  constructor(
    private readonly assignments: AssignmentRepository,
    private readonly repo: TopicRepository,
    private readonly windows: TermWindowService,
  ) {}
  private async access(
    termId: string,
    studentId: string,
    userId: string,
    tx: WorkflowTx,
    write: boolean,
  ) {
    const plans = await this.assignments.plans(termId, tx);
    const plan = plans.find((p) => p.status !== "DRAFT");
    const assignment = plan?.advisorAssignments.find(
      (a) => a.registration.studentId === studentId,
    );
    if (!assignment)
      throw new ForbiddenException("Chưa có GVHD chính thức trong đợt.");
    const actor = await this.assignments.actor(userId, tx);
    if (write) {
      V.owner(studentId, assignment.advisorId, actor);
      await this.windows.requireOpen(termId, "PROPOSAL", new Date(), tx);
    } else if (
      !actor.userRoles.some((r) => ["ADMIN", "FACULTY"].includes(r.role.name))
    )
      V.owner(studentId, assignment.advisorId, actor);
    return { assignment, actor };
  }
  private dto(
    p: LoadedProposal,
    advisorId: string,
    directionId: string | null,
  ) {
    const content = (p.versions[p.versions.length - 1]?.content ??
      {}) as unknown as ProposalContent;
    return {
      id: p.id,
      termId: p.termId,
      studentId: p.studentId,
      lecturerId: advisorId,
      directionId: directionId ?? "",
      title: p.topic.title,
      objectives: content.objectives ?? "",
      scope: content.scope ?? "",
      technology: content.technology ?? "",
      expected: content.expected ?? "",
      plan: content.plan ?? [],
      advisorAgreed: p.topic.advisorAgreed,
      studentAgreed: p.topic.studentAgreed,
      status:
        p.dossier?.status === "APPROVED"
          ? "LOCKED"
          : p.status === "REVISION_REQUESTED"
            ? "REVISION"
            : p.status,
      versions: p.versions.map((v) => ({
        ...(v.content as object),
        versionId: v.id,
        version: v.version,
        at: v.createdAt,
        status: v.status,
        comment: "",
      })),
      groupId: "",
      comment: "",
    };
  }
  list(termId: string, userId: string) {
    return this.assignments.transaction(async (tx) => {
      const plans = await this.assignments.plans(termId, tx),
        plan = plans.find((p) => p.status !== "DRAFT");
      if (!plan) return [];
      const actor = await this.assignments.actor(userId, tx),
        manager = actor.userRoles.some((r) =>
          ["ADMIN", "FACULTY"].includes(r.role.name),
        );
      const rows = await this.repo.proposals(termId, tx);
      return rows.flatMap((p) => {
        const a = plan.advisorAssignments.find(
          (a) => a.registration.studentId === p.studentId,
        );
        return a &&
          (manager ||
            actor.student?.id === p.studentId ||
            actor.lecturer?.id === a.advisorId)
          ? [this.dto(p, a.advisorId, a.registration.directionId)]
          : [];
      });
    });
  }
  save(
    termId: string,
    studentId: string,
    userId: string,
    input: { content: ProposalContent; expectedVersion: number },
    submit: boolean,
  ) {
    return this.assignments.transaction(async (tx) => {
      const { assignment: a, actor } = await this.access(
        termId,
        studentId,
        userId,
        tx,
        true,
      );
      if (submit && actor.student?.id !== studentId)
        throw new ForbiddenException("Chỉ sinh viên được nộp đề cương.");
      let p =
        (await this.repo.proposals(termId, tx)).find(
          (p) => p.studentId === studentId,
        ) ?? null;
      V.version(p, input.expectedVersion);
      if (p) V.editable(p);
      const previous = p?.versions[p.versions.length - 1]
        ?.content as unknown as
        (ProposalContent & { metadata?: unknown }) | undefined;
      const oldContent = previous
        ? {
            title: previous.title,
            objectives: previous.objectives,
            scope: previous.scope,
            technology: previous.technology,
            expected: previous.expected,
            plan: previous.plan,
          }
        : null;
      const changed =
        JSON.stringify(oldContent) !== JSON.stringify(input.content);
      const advisorAgreed = !changed && !!p?.topic.advisorAgreed;
      if (submit) V.submit(input.content, advisorAgreed);
      if (!p)
        p = await this.repo.create(
          termId,
          studentId,
          a.registration.directionId!,
          input.content.title,
          tx,
        );
      const term = await this.assignments.term(termId, tx);
      const snapshot = {
        ...input.content,
        metadata: {
          studentName: a.registration.student.fullName,
          studentCode: a.registration.student.studentCode,
          className: a.registration.student.className,
          course: a.registration.student.cohort,
          program: a.registration.student.trainingSystem.name,
          studentEmail: a.registration.student.user.email ?? "",
          studentPhone:
            a.registration.student.user.phone ??
            a.registration.student.phone ??
            "",
          advisorEmail: a.advisor.user.email ?? "",
          advisorPhone: a.advisor.user.phone ?? "",
          advisorName: a.advisor.fullName,
          advisorInstitution: "Trường Đại học Giao thông vận tải",
          termName: term!.name,
          termCode: term!.code,
        },
      };
      const saved = await this.repo.save(
        p,
        {
          title: input.content.title,
          advisorAgreed,
          studentAgreed:
            actor.student?.id === studentId ||
            (!changed && p.topic.studentAgreed),
        },
        snapshot as Prisma.InputJsonValue,
        userId,
        submit,
        tx,
      );
      return this.dto(saved, a.advisorId, a.registration.directionId);
    });
  }
  agree(id: string, userId: string, agreed: boolean, expectedVersion: number) {
    return this.assignments.transaction(async (tx) => {
      const p = await this.repo.find(id, tx);
      if (!p) throw new NotFoundException("Không tìm thấy đề cương.");
      const { assignment: a, actor } = await this.access(
        p.termId,
        p.studentId,
        userId,
        tx,
        true,
      );
      V.editable(p);
      V.version(p, expectedVersion);
      if (p.status === "SUBMITTED")
        throw new ForbiddenException(
          "Cần chuyển về nháp trước khi đổi xác nhận.",
        );
      const saved = await this.repo.agree(
        p,
        userId,
        actor.lecturer?.id === a.advisorId,
        agreed,
        tx,
      );
      return this.dto(saved, a.advisorId, a.registration.directionId);
    });
  }
  version(id: string, version: number, userId: string) {
    return this.assignments.transaction(async (tx) => {
      const p = await this.repo.find(id, tx);
      if (!p) throw new NotFoundException("Không tìm thấy đề cương.");
      await this.access(p.termId, p.studentId, userId, tx, false);
      const v = p.versions.find((v) => v.version === version);
      if (!v) throw new NotFoundException("Không tìm thấy phiên bản đã lưu.");
      await this.repo.audit(
        id,
        userId,
        "PROPOSAL_PDF_REQUESTED",
        { version, versionId: v.id },
        tx,
      );
      return {
        version: v,
        official:
          p.dossier?.status === "APPROVED" &&
          p.status === "APPROVED" &&
          v.status === "APPROVED",
      };
    });
  }
}
