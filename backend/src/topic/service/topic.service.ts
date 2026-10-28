import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  AssignmentRepository,
  WorkflowTx,
  type LoadedPlan,
} from "../../registration/repository/assignment.repository";
import { TermWindowService } from "../../term/service/term-window.service";
import {
  LoadedProposal,
  TopicRepository,
  type TopicAssignmentReadContext,
} from "../repository/topic.repository";
import { ProposalContent } from "../dto/proposal.dto";
import { ProposalValidator as V } from "../validator/proposal.validator";
import {
  ProposalReviewValidator,
  reviewHash,
} from "../proposal-reviews/proposal-review.validator";
import {
  ProposalReviewSession,
  type ReviewPrincipal,
} from "../proposal-reviews/proposal-review.repository";
import { academicTermScope } from "../../common/security/academic-term-scope.policy";
@Injectable()
export class TopicService {
  constructor(
    private readonly assignments: AssignmentRepository,
    private readonly repo: TopicRepository,
    private readonly windows: TermWindowService,
    private readonly policy: ProposalReviewValidator,
  ) {}
  private async principal(
    userId: string,
    tx: WorkflowTx,
    action: "read" | "write",
  ) {
    const session = new ProposalReviewSession(tx);
    const actor = this.policy.principal(await session.principal(userId));
    if (
      actor.id !== userId ||
      actor.mustChangePassword ||
      !actor.userRoles.some((r) =>
        r.role.rolePermissions.some(
          (p) =>
            p.permission.resource === "topic" && p.permission.action === action,
        ),
      )
    )
      throw new ForbiddenException("Thiếu quyền thao tác đề tài.");
    return { actor, session };
  }
  private manager(actor: ReviewPrincipal) {
    return actor.userRoles.some((r) =>
      ["ADMIN", "FACULTY"].includes(r.role.name),
    );
  }
  private async scope(actor: ReviewPrincipal, termId: string, tx: WorkflowTx) {
    return academicTermScope(
      this.manager(actor)
        ? await new ProposalReviewSession(tx).grants(actor.id, termId)
        : [],
      actor.id,
      termId,
    );
  }
  private async assignment(
    termId: string,
    studentId: string,
    tx: WorkflowTx,
    handedOver: boolean,
    plans?: LoadedPlan[],
    facts?: TopicAssignmentReadContext,
  ) {
    const available = plans ?? (await this.assignments.plans(termId, tx));
    const term = facts
      ? facts.term
      : await tx.termWorkflow.findUnique({ where: { termId } });
    const official =
      handedOver ||
      !!term?.officialAssignmentPlanId ||
      available.some((p) => p.status === "FINALIZED");
    const plan = official
      ? available.find(
          (p) =>
            p.id === term?.officialAssignmentPlanId &&
            p.termId === termId &&
            p.status === "FINALIZED",
        )
      : available.find((p) => p.termId === termId && p.status === "PUBLISHED");
    if (official) {
      const meta = plan
        ? facts
          ? facts.metadata.get(plan.id)
          : await tx.assignmentPlanWorkflow.findUnique({
              where: { planId: plan.id },
            })
        : null;
      if (
        !plan ||
        !meta?.finalizedAt ||
        !meta.finalizedByUserId ||
        meta.finalizedAt > new Date()
      )
        throw new ConflictException(
          "Thiếu phân công FINALIZED và officialAssignmentPlanId hợp lệ.",
        );
    }
    const assignment = plan?.advisorAssignments.find(
      (a) =>
        a.registration.termId === termId &&
        a.registration.studentId === studentId,
    );
    if (!assignment) return null;
    if (official) {
      const change = facts
        ? facts.changes.get(assignment.id)
        : await tx.assignmentChange.findFirst({
            where: { assignmentId: assignment.id },
            orderBy: { assignmentRevision: "desc" },
          });
      const roster = facts
        ? facts.roster.get(assignment.advisorId)
        : await tx.termLecturer.findUnique({
            where: {
              termId_lecturerId: { termId, lecturerId: assignment.advisorId },
            },
          });
      if (
        assignment.advisor.id !== assignment.advisorId ||
        !assignment.advisor.isActive ||
        assignment.advisor.user.status !== "ACTIVE" ||
        !roster ||
        roster.termId !== termId ||
        roster.lecturerId !== assignment.advisorId ||
        (change &&
          (change.assignmentId !== assignment.id ||
            change.newAdvisorId !== assignment.advisorId ||
            !Number.isInteger(change.assignmentRevision) ||
            change.assignmentRevision < 1 ||
            !Number.isFinite(change.effectiveAt?.getTime()) ||
            change.effectiveAt > new Date()))
      )
        throw new ConflictException(
          "Phân công GVHD hoặc lịch sử bàn giao hiện hành không hợp lệ.",
        );
    }
    return assignment;
  }
  private async department(
    p: LoadedProposal,
    tx: WorkflowTx,
    facts?: TopicAssignmentReadContext,
  ) {
    if (p.termId !== p.topic.termId)
      throw new ConflictException("Hồ sơ không khớp đợt.");
    if (facts) return facts.departments.get(p.topic.researchAreaId ?? "");
    const mapping = p.topic.researchAreaId
      ? await tx.researchAreaWorkflow.findUnique({
          where: { researchAreaId: p.topic.researchAreaId },
        })
      : null;
    return mapping?.departmentId;
  }
  private async access(
    termId: string,
    studentId: string,
    userId: string,
    tx: WorkflowTx,
    write: boolean,
  ) {
    const { actor } = await this.principal(
      userId,
      tx,
      write ? "write" : "read",
    );
    const p = (await this.repo.proposals(termId, tx)).find(
      (p) => p.studentId === studentId,
    );
    if (p && p.topic.termId !== termId)
      throw new ConflictException("Hồ sơ không khớp đợt.");
    const assignment = await this.assignment(
      termId,
      studentId,
      tx,
      !!p?.pr2bProposalWorkflowProposalId,
    );
    if (!assignment)
      throw new ForbiddenException("Chưa có GVHD chính thức trong đợt.");
    const owner = !!actor.student?.isActive && actor.student.id === studentId;
    const advisor =
      !!actor.lecturer?.isActive && actor.lecturer.id === assignment.advisorId;
    if (write) {
      if (!owner && !advisor)
        throw new ForbiddenException(
          "Chỉ chủ hồ sơ và GVHD hiện hành được ghi.",
        );
      V.owner(studentId, assignment.advisorId, actor);
      await this.windows.requireOpen(termId, "PROPOSAL", new Date(), tx);
    } else if (!owner && !advisor) {
      const scope = await this.scope(actor, termId, tx);
      if (!p || !scope.contains(await this.department(p, tx)))
        throw new ForbiddenException({
          error: {
            code: "TOPIC_SCOPE_FORBIDDEN",
            message: "Hồ sơ nằm ngoài AcademicTermGrant được cấp.",
          },
        });
    }
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
      workflowReady: !!p.pr2bProposalWorkflowProposalId,
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
      const { actor } = await this.principal(userId, tx, "read");
      const scope = await this.scope(actor, termId, tx);
      if (
        this.manager(actor) &&
        !scope.configured &&
        !actor.student?.isActive &&
        !actor.lecturer?.isActive
      )
        throw new ForbiddenException({
          error: {
            code: "TOPIC_SCOPE_FORBIDDEN",
            message: "Thiếu AcademicTermGrant cho đợt.",
          },
        });
      const plans = await this.assignments.plans(termId, tx);
      const rows = await this.repo.proposals(termId, tx);
      const facts = await this.repo.assignmentReadContext(
        termId,
        plans,
        rows,
        tx,
      );
      const result = [];
      for (const p of rows) {
        if (p.termId !== termId || p.topic.termId !== termId) continue;
        const a = await this.assignment(
          termId,
          p.studentId,
          tx,
          !!p.pr2bProposalWorkflowProposalId,
          plans,
          facts,
        );
        if (
          a &&
          ((actor.student?.isActive && actor.student.id === p.studentId) ||
            (actor.lecturer?.isActive && actor.lecturer.id === a.advisorId) ||
            scope.contains(await this.department(p, tx, facts)))
        )
          result.push(this.dto(p, a.advisorId, a.registration.directionId));
      }
      return result;
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
  prepareWorkflow(id: string, userId: string) {
    return this.assignments.transaction(async (tx) => {
      const p = await this.repo.find(id, tx);
      if (!p) throw new NotFoundException("Không tìm thấy đề cương.");
      const { assignment } = await this.access(
        p.termId,
        p.studentId,
        userId,
        tx,
        true,
      );
      if (p.pr2bProposalWorkflowProposalId) return { proposalId: p.id };
      V.editable(p);
      const planMeta = await tx.assignmentPlanWorkflow.findUnique({
        where: { planId: assignment.assignmentPlanId },
      });
      const termMeta = await tx.termWorkflow.findUnique({
        where: { termId: p.termId },
      });
      if (
        !planMeta?.finalizedAt ||
        !planMeta.finalizedByUserId ||
        termMeta?.officialAssignmentPlanId !== assignment.assignmentPlanId ||
        (
          await tx.assignmentPlan.findUnique({
            where: { id: assignment.assignmentPlanId },
          })
        )?.status !== "FINALIZED"
      )
        throw new ConflictException(
          "Cần chốt phân công chính thức trước khi chuyển đề cương.",
        );
      if (await tx.proposalReview.count({ where: { proposalId: id } }))
        throw new ConflictException(
          "Đề cương đã có vòng duyệt; cần đối soát trước khi chuyển.",
        );
      const roster = await tx.termStudent.findUnique({
        where: {
          termId_studentId: { termId: p.termId, studentId: p.studentId },
        },
      });
      if (!roster)
        throw new ConflictException("Sinh viên chưa thuộc danh sách đợt.");
      const owner = await tx.topicWorkflow.findUnique({
        where: { topicId: p.topicId },
      });
      if (
        owner &&
        (owner.termId !== p.termId || owner.termStudentId !== roster.id)
      )
        throw new ConflictException(
          "Ownership đề tài không khớp đợt/sinh viên.",
        );
      const change = await tx.assignmentChange.findFirst({
        where: { assignmentId: assignment.id },
        orderBy: { assignmentRevision: "desc" },
      });
      if (!owner)
        await tx.topicWorkflow.create({
          data: {
            topicId: p.topicId,
            termId: p.termId,
            termStudentId: roster.id,
            ...(p.topic.advisorAgreed && p.topic.agreedAt
              ? {
                  confirmedAt: p.topic.agreedAt,
                  confirmedByAdvisorId: assignment.advisorId,
                  confirmedTopicRevision: 0,
                  confirmedAssignmentRevision: change?.assignmentRevision ?? 0,
                }
              : {}),
          },
        });
      const latest = p.versions[p.versions.length - 1];
      const source = (latest?.content ?? {}) as Record<string, unknown>;
      const text = (key: string) =>
        typeof source[key] === "string" ? (source[key] as string) : "";
      // Missing academic dates, milestones and main content require explicit input.
      // Keep the source snapshot intact; this is a new draft, never a submission.
      const content = {
        schemaVersion: 1,
        objectives: text("objectives"),
        scope: text("scope"),
        mainContents: "",
        tools: text("technology"),
        expectedResults: text("expected"),
        startsAt: "",
        endsAt: "",
        schedule: [],
      };
      const version = await tx.proposalVersion.create({
        data: {
          proposalId: p.id,
          version: (latest?.version ?? 0) + 1,
          content,
          createdBy: userId,
          status: "DRAFT",
          pr2bProposalVersionWorkflowVersionId: {
            create: {
              state: "DRAFT",
              contentSchemaVersion: 1,
              contentHash: reviewHash(content),
              createdByUserId: userId,
              basedOnVersionId: latest?.id,
              revisionResponses: [],
              provenance: {
                source: "STEP3_HANDOFF",
                sourceVersionId: latest?.id ?? null,
              },
            },
          },
        },
      });
      await tx.proposalWorkflow.create({
        data: {
          proposalId: p.id,
          workingVersionId: version.id,
          nextVersionNumber: version.version + 1,
          nextReviewRound: 1,
        },
      });
      await tx.proposal.update({ where: { id }, data: { status: "DRAFT" } });
      await this.repo.audit(
        id,
        userId,
        "PROPOSAL_WORKFLOW_PREPARED",
        {
          sourceVersionId: latest?.id ?? null,
          workingVersionId: version.id,
          previousStatus: p.status,
        },
        tx,
      );
      return { proposalId: p.id };
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
