import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { WorkflowTx } from "../../registration/repository/assignment.repository";
export const proposalInclude = Prisma.validator<Prisma.ProposalInclude>()({
  topic: true,
  versions: { orderBy: { version: "asc" } },
  dossier: true,
  pr2bProposalWorkflowProposalId: true,
});
export type LoadedProposal = Prisma.ProposalGetPayload<{
  include: typeof proposalInclude;
}>;
@Injectable()
export class TopicRepository {
  async assignmentReadContext(
    termId: string,
    plans: { id: string; advisorAssignments: { id: string }[] }[],
    rows: LoadedProposal[],
    tx: WorkflowTx,
  ) {
    // One set of facts for the entire list, not several remote queries per row.
    const [term, metadata, changes, roster, departments] = await Promise.all([
      tx.termWorkflow.findUnique({ where: { termId } }),
      tx.assignmentPlanWorkflow.findMany({
        where: { planId: { in: plans.map((p) => p.id) } },
      }),
      tx.assignmentChange.findMany({
        where: {
          assignmentId: {
            in: plans.flatMap((p) => p.advisorAssignments.map((a) => a.id)),
          },
        },
        orderBy: { assignmentRevision: "desc" },
        distinct: ["assignmentId"],
      }),
      tx.termLecturer.findMany({
        where: { termId },
        select: { termId: true, lecturerId: true },
      }),
      tx.researchAreaWorkflow.findMany({
        where: {
          researchAreaId: {
            in: rows
              .map((p) => p.topic.researchAreaId)
              .filter((id): id is string => !!id),
          },
        },
      }),
    ]);
    return {
      term,
      metadata: new Map(metadata.map((m) => [m.planId, m])),
      changes: new Map(changes.map((c) => [c.assignmentId, c])),
      roster: new Map(roster.map((r) => [r.lecturerId, r])),
      departments: new Map(
        departments.map((d) => [d.researchAreaId, d.departmentId]),
      ),
    };
  }
  proposals(termId: string, tx: WorkflowTx) {
    return tx.proposal.findMany({
      where: { termId },
      include: proposalInclude,
    });
  }
  find(id: string, tx: WorkflowTx) {
    return tx.proposal.findUnique({ where: { id }, include: proposalInclude });
  }
  create(
    termId: string,
    studentId: string,
    directionId: string,
    title: string,
    tx: WorkflowTx,
  ) {
    return tx.proposal.create({
      data: {
        term: { connect: { id: termId } },
        student: { connect: { id: studentId } },
        topic: {
          create: {
            term: { connect: { id: termId } },
            researchArea: { connect: { id: directionId } },
            title,
          },
        },
      },
      include: proposalInclude,
    });
  }
  async save(
    p: LoadedProposal,
    body: { title: string; advisorAgreed: boolean; studentAgreed: boolean },
    content: Prisma.InputJsonValue,
    userId: string,
    submit: boolean,
    tx: WorkflowTx,
  ) {
    const latest = p.versions[p.versions.length - 1];
    await tx.topic.update({
      where: { id: p.topicId },
      data: { ...body, agreedAt: body.advisorAgreed ? p.topic.agreedAt : null },
    });
    await tx.proposal.update({
      where: { id: p.id },
      data: { status: submit ? "SUBMITTED" : "DRAFT" },
    });
    await tx.proposalVersion.create({
      data: {
        proposalId: p.id,
        version: (latest?.version ?? 0) + 1,
        content,
        createdBy: userId,
        status: submit ? "SUBMITTED" : "DRAFT",
        submittedAt: submit ? new Date() : null,
      },
    });
    await tx.topicHistory.create({
      data: {
        topicId: p.topicId,
        changedBy: userId,
        oldValue: latest?.content ?? {},
        newValue: content,
      },
    });
    await this.audit(
      p.id,
      userId,
      submit
        ? "PROPOSAL_SUBMITTED"
        : p.status === "SUBMITTED"
          ? "PROPOSAL_RETURNED_TO_DRAFT"
          : "PROPOSAL_DRAFT_SAVED",
      { previousStatus: p.status, version: (latest?.version ?? 0) + 1 },
      tx,
    );
    return (await this.find(p.id, tx))!;
  }
  async agree(
    p: LoadedProposal,
    userId: string,
    advisor: boolean,
    agreed: boolean,
    tx: WorkflowTx,
  ) {
    await tx.topic.update({
      where: { id: p.topicId },
      data: advisor
        ? { advisorAgreed: agreed, agreedAt: agreed ? new Date() : null }
        : { studentAgreed: agreed },
    });
    await tx.topicHistory.create({
      data: {
        topicId: p.topicId,
        changedBy: userId,
        oldValue: {
          advisorAgreed: p.topic.advisorAgreed,
          studentAgreed: p.topic.studentAgreed,
        },
        newValue: { [advisor ? "advisorAgreed" : "studentAgreed"]: agreed },
      },
    });
    await this.audit(
      p.id,
      userId,
      "TOPIC_AGREEMENT",
      { advisor, agreed, version: p.versions[p.versions.length - 1]?.version },
      tx,
    );
    return (await this.find(p.id, tx))!;
  }
  audit(
    id: string,
    userId: string,
    action: string,
    data: unknown,
    tx: WorkflowTx,
  ) {
    return tx.auditLog.create({
      data: {
        resource: "topic",
        resourceId: id,
        userId,
        action,
        newValue: JSON.parse(JSON.stringify(data)),
      },
    });
  }
}
export type TopicAssignmentReadContext = Awaited<
  ReturnType<TopicRepository["assignmentReadContext"]>
>;
