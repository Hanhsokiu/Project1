import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import type {
  AssignReview,
  ReviewStart,
  ReviewCommentInput,
  ReviewDecisionInput,
  ReviewQuery,
  ProposalReviewSummary,
  ProposalReviewView,
} from "@doan/shared";
import {
  ProposalReviewRepository,
  ProposalReviewSession,
  ReviewPrincipal,
  ReviewProposal,
  ReviewRecord,
} from "./proposal-review.repository";
import {
  ProposalReviewValidator,
  reviewHash,
} from "./proposal-review.validator";
import { groupError } from "../review-groups/review-group.errors";
const json = (v: unknown) =>
  JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const active = (r: ReviewProposal["reviews"][number]) =>
  !r.pr2bProposalReviewWorkflowReviewId?.state ||
  ["ASSIGNED", "IN_REVIEW"].includes(
    r.pr2bProposalReviewWorkflowReviewId.state,
  );
@Injectable()
export class ProposalReviewService {
  constructor(
    private readonly repo: ProposalReviewRepository,
    private readonly v: ProposalReviewValidator,
  ) {}
  private async faculty(
    s: ProposalReviewSession,
    u: ReviewPrincipal,
    termId: string,
    departmentId: string | null | undefined,
    action: string,
  ) {
    if (!departmentId || !this.v.role(u, "FACULTY", action)) return false;
    const [g] = await s.grants(u.id, termId);
    return (
      !!g &&
      (g.allDepartments ||
        g.pr2bGrantDepartmentGrantId.some(
          (d) => d.departmentId === departmentId,
        ))
    );
  }
  private async reviewer(
    s: ProposalReviewSession,
    u: ReviewPrincipal,
    r: ReviewRecord,
    action: string,
  ) {
    if (
      !this.v.role(u, "LECTURER", action) ||
      !u.lecturer?.isActive ||
      (action !== "read" &&
        !!r.reviewGroup.pr2bReviewGroupWorkflowGroupId?.archivedAt) ||
      !r.reviewGroup.members.some((m) => m.lecturerId === u.lecturer!.id) ||
      r.reviewGroup.termId !== r.proposal.topic.termId ||
      !(await s.roster(r.reviewGroup.termId, u.lecturer.id))
    )
      return false;
    const context = await this.v.advisor(s, r.proposal);
    return context.assignment.advisorId !== u.lecturer.id;
  }
  private async observerTerms(s: ProposalReviewSession, u: ReviewPrincipal) {
    const ids: string[] = [];
    if (this.v.role(u, "STUDENT", "read") && u.student?.isActive)
      ids.push(...(await s.studentTerms(u.student.id)).map((t) => t.termId));
    if (this.v.role(u, "LECTURER", "read") && u.lecturer?.isActive) {
      for (const r of await s.advisorTerms(u.lecturer.id))
        if (
          r.advisorAssignment?.assignmentPlanId ===
            r.term.pr2bTermWorkflowTermId?.officialAssignmentPlanId &&
          (await s.roster(r.termId, u.lecturer.id))
        )
          ids.push(r.termId);
    }
    return ids;
  }
  private async observer(
    s: ProposalReviewSession,
    u: ReviewPrincipal,
    p: ReviewProposal,
  ) {
    if (
      this.v.role(u, "STUDENT", "read") &&
      u.student?.isActive &&
      u.student.id === p.studentId
    ) {
      this.v.ownership(p);
      return true;
    }
    if (this.v.role(u, "LECTURER", "read") && u.lecturer?.isActive) {
      const current = await s.advisor(p.topic.termId, p.studentId);
      if (current?.advisorAssignment?.advisorId === u.lecturer.id) {
        await this.v.advisor(s, p);
        return true;
      }
    }
    return false;
  }
  private async visibleReview(
    s: ProposalReviewSession,
    u: ReviewPrincipal,
    r: ReviewRecord | null,
    action = "read",
  ) {
    if (!r) groupError(404, "COMMON_001", "Không tìm thấy vòng duyệt.");
    const departmentId =
      (
        r.pr2bProposalReviewWorkflowReviewId?.routingSnapshot as {
          departmentId?: string;
        } | null
      )?.departmentId ??
      r.reviewGroup.pr2bReviewGroupWorkflowGroupId?.departmentId;
    if (
      (await this.faculty(
        s,
        u,
        r.proposal.topic.termId,
        departmentId,
        action,
      )) ||
      (await this.reviewer(s, u, r, action)) ||
      (action === "read" && (await this.observer(s, u, r.proposal)))
    )
      return r;
    groupError(404, "COMMON_001", "Không tìm thấy vòng duyệt trong phạm vi.");
  }
  private async facultyProposal(
    s: ProposalReviewSession,
    u: ReviewPrincipal,
    p: ReviewProposal | null,
    action: string,
  ) {
    if (
      !p ||
      !(await this.faculty(
        s,
        u,
        p.topic.termId,
        p.topic.researchArea?.pr2bResearchAreaWorkflowResearchAreaId
          ?.departmentId,
        action,
      ))
    )
      groupError(404, "COMMON_001", "Không tìm thấy đề cương trong phạm vi.");
    return p;
  }
  private summary(
    p: ReviewProposal,
    canAssign: boolean,
  ): ProposalReviewSummary {
    const w = p.pr2bProposalWorkflowProposalId,
      review = p.reviews.find(active),
      route = p.topic.researchArea?.pr2bResearchAreaWorkflowResearchAreaId;
    const readiness: string[] = [];
    if (!p.topic.pr2bTopicWorkflowTopicId?.termStudentId)
      readiness.push("OWNERSHIP_NOT_READY");
    if (!route?.departmentId) readiness.push("ROUTING_NOT_CONFIGURED");
    if (
      !w?.refSubmittedVersionId?.pr2bProposalVersionWorkflowVersionId ||
      w.refSubmittedVersionId.pr2bProposalVersionWorkflowVersionId.state !==
        "SEALED"
    )
      readiness.push("SUBMITTED_VERSION_NOT_READY");
    return {
      id: p.id,
      termId: p.topic.termId,
      title: p.topic.title,
      studentName: p.student.fullName,
      studentCode: p.student.studentCode,
      departmentId: route?.departmentId ?? null,
      departmentName: route?.refDepartmentId?.name ?? null,
      researchAreaName: p.topic.researchArea?.name ?? null,
      status: p.status,
      revision: w?.revision ?? null,
      submittedVersionId: w?.submittedVersionId ?? null,
      versionNumber: w?.refSubmittedVersionId?.version ?? null,
      activeReviewId: review?.id ?? null,
      groupName: review?.reviewGroup.name ?? null,
      readiness,
      canAssign,
    };
  }
  async terms(userId: string) {
    return this.repo.transaction(async (s) => {
      const u = this.v.principal(await s.principal(userId));
      const grants = this.v.role(u, "FACULTY", "read")
        ? await s.grants(u.id)
        : [];
      const ids = grants
        .filter((g) => g.allDepartments || g.pr2bGrantDepartmentGrantId.length)
        .map((g) => g.termId);
      ids.push(...(await this.observerTerms(s, u)));
      if (this.v.role(u, "LECTURER", "read") && u.lecturer?.isActive) {
        for (const g of await s.memberTerms(u.lecturer.id))
          if (await s.roster(g.termId, u.lecturer.id)) ids.push(g.termId);
      }
      return s.terms({ id: { in: ids } });
    });
  }
  async options(userId: string, termId: string) {
    return this.repo.transaction(async (s) => {
      const u = this.v.principal(await s.principal(userId)),
        [grant] = this.v.role(u, "FACULTY", "read")
          ? await s.grants(u.id, termId)
          : [];
      const lecturer =
        this.v.role(u, "LECTURER", "read") &&
        u.lecturer?.isActive &&
        (await s.roster(termId, u.lecturer.id)) &&
        (await s.memberTerms(u.lecturer.id)).some((g) => g.termId === termId);
      if (
        !grant?.allDepartments &&
        !grant?.pr2bGrantDepartmentGrantId.length &&
        !lecturer &&
        !(await this.observerTerms(s, u)).includes(termId)
      )
        groupError(404, "COMMON_001", "Không tìm thấy đợt trong phạm vi.");
      const phase = await s.phase(termId),
        term = await s.term(termId);
      if (!term) groupError(404, "COMMON_001", "Không tìm thấy đợt.");
      return {
        term: { id: term.id, name: term.name, status: term.status },
        departments: grant
          ? await s.departments(
              grant.allDepartments
                ? undefined
                : grant.pr2bGrantDepartmentGrantId.map((d) => d.departmentId),
            )
          : [],
        canAssign:
          !!grant &&
          (grant.allDepartments ||
            grant.pr2bGrantDepartmentGrantId.length > 0) &&
          this.v.role(u, "FACULTY", "assign"),
        phase: phase
          ? {
              startsAt: phase.refPhaseId.startDate,
              endsAt: phase.refPhaseId.endDate,
              isLocked: phase.refPhaseId.isLocked,
            }
          : null,
      };
    });
  }
  async list(userId: string, termId: string, q: ReviewQuery) {
    return this.repo.transaction(async (s) => {
      const u = this.v.principal(await s.principal(userId));
      const [grant] = this.v.role(u, "FACULTY", "read")
        ? await s.grants(u.id, termId)
        : [];
      const clauses: Prisma.ProposalWhereInput[] = [];
      if (this.v.role(u, "STUDENT", "read") && u.student?.isActive)
        clauses.push({
          studentId: u.student.id,
          topic: {
            pr2bTopicWorkflowTopicId: { is: { termStudentId: { not: null } } },
          },
        });
      const officialPlanId = (await s.term(termId))?.pr2bTermWorkflowTermId
        ?.officialAssignmentPlanId;
      if (
        officialPlanId &&
        this.v.role(u, "LECTURER", "read") &&
        u.lecturer?.isActive &&
        (await s.roster(termId, u.lecturer.id))
      )
        clauses.push({
          student: {
            registrations: {
              some: {
                termId,
                advisorAssignments: {
                  some: {
                    advisorId: u.lecturer.id,
                    assignmentPlanId: officialPlanId,
                    assignmentPlan: {
                      status: "FINALIZED",
                      pr2bAssignmentPlanWorkflowPlanId: {
                        is: {
                          finalizedAt: { not: null },
                          finalizedByUserId: { not: null },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        });
      if (
        grant &&
        (grant.allDepartments || grant.pr2bGrantDepartmentGrantId.length)
      )
        clauses.push({
          topic: {
            researchArea: {
              pr2bResearchAreaWorkflowResearchAreaId: {
                is: {
                  departmentId: grant.allDepartments
                    ? { not: null }
                    : {
                        in: grant.pr2bGrantDepartmentGrantId.map(
                          (d) => d.departmentId,
                        ),
                      },
                },
              },
            },
          },
        });
      if (
        this.v.role(u, "LECTURER", "read") &&
        u.lecturer?.isActive &&
        (await s.roster(termId, u.lecturer.id)) &&
        (await s.memberTerms(u.lecturer.id)).some((g) => g.termId === termId)
      )
        clauses.push({
          reviews: {
            some: {
              reviewGroup: {
                termId,
                members: { some: { lecturerId: u.lecturer.id } },
              },
              pr2bProposalReviewWorkflowReviewId: {
                is: { versionId: { not: null } },
              },
            },
          },
          NOT: {
            student: {
              registrations: {
                some: {
                  termId,
                  advisorAssignments: {
                    some: {
                      advisorId: u.lecturer.id,
                      assignmentPlanId: officialPlanId ?? "",
                    },
                  },
                },
              },
            },
          },
        });
      if (!clauses.length)
        groupError(404, "COMMON_001", "Không tìm thấy đợt trong phạm vi.");
      const where: Prisma.ProposalWhereInput = {
        AND: [
          { OR: clauses },
          {
            topic: {
              termId,
              researchArea: q.departmentId
                ? {
                    pr2bResearchAreaWorkflowResearchAreaId: {
                      is: { departmentId: q.departmentId },
                    },
                  }
                : undefined,
            },
          },
          q.search
            ? {
                OR: [
                  {
                    topic: {
                      title: { contains: q.search, mode: "insensitive" },
                    },
                  },
                  {
                    student: {
                      studentCode: { contains: q.search, mode: "insensitive" },
                    },
                  },
                  {
                    student: {
                      fullName: { contains: q.search, mode: "insensitive" },
                    },
                  },
                ],
              }
            : {},
          q.groupId ? { reviews: { some: { reviewGroupId: q.groupId } } } : {},
          q.unassigned === "true"
            ? {
                reviews: {
                  none: {
                    OR: [
                      { pr2bProposalReviewWorkflowReviewId: { is: null } },
                      {
                        pr2bProposalReviewWorkflowReviewId: {
                          is: { state: null },
                        },
                      },
                      {
                        pr2bProposalReviewWorkflowReviewId: {
                          is: { state: { in: ["ASSIGNED", "IN_REVIEW"] } },
                        },
                      },
                    ],
                  },
                },
              }
            : {},
        ],
        status: q.status,
      };
      const rows = await s.proposals(where, (q.page - 1) * q.limit, q.limit);
      const data = await Promise.all(
        rows.map(async (p) => {
          const departmentId =
            p.topic.researchArea?.pr2bResearchAreaWorkflowResearchAreaId
              ?.departmentId;
          const summary = this.summary(
            p,
            await this.faculty(s, u, termId, departmentId, "assign"),
          );
          if (
            !(await this.faculty(s, u, termId, departmentId, "read")) &&
            !(await this.observer(s, u, p))
          ) {
            // Reviewer inbox must never expose a newly submitted, unassigned version.
            const assigned = p.reviews
              .filter(
                (r) =>
                  r.reviewGroup.members.some(
                    (m) => m.lecturerId === u.lecturer?.id,
                  ) && r.pr2bProposalReviewWorkflowReviewId?.versionId,
              )
              .sort(
                (a, b) =>
                  (b.pr2bProposalReviewWorkflowReviewId?.roundNumber ?? 0) -
                  (a.pr2bProposalReviewWorkflowReviewId?.roundNumber ?? 0),
              )[0];
            summary.submittedVersionId =
              assigned?.pr2bProposalReviewWorkflowReviewId?.versionId ?? null;
            summary.versionNumber =
              assigned?.pr2bProposalReviewWorkflowReviewId?.refVersionId
                ?.version ?? null;
            summary.activeReviewId = assigned?.id ?? null;
            summary.groupName = assigned?.reviewGroup.name ?? null;
          }
          return summary;
        }),
      );
      const total = await s.count(where);
      return {
        data,
        total,
        page: q.page,
        limit: q.limit,
        totalPages: Math.ceil(total / q.limit),
      };
    });
  }
  async proposal(userId: string, id: string) {
    return this.repo.transaction(async (s) => {
      const u = this.v.principal(await s.principal(userId));
      const p = await s.proposal(id);
      if (!p) groupError(404, "COMMON_001", "Không tìm thấy đề cương.");
      const faculty = await this.faculty(
        s,
        u,
        p.topic.termId,
        p.topic.researchArea?.pr2bResearchAreaWorkflowResearchAreaId
          ?.departmentId,
        "read",
      );
      if (!faculty && !(await this.observer(s, u, p))) {
        let assigned = false;
        for (const r of await s.history(id))
          if (
            r.pr2bProposalReviewWorkflowReviewId?.versionId ===
              p.pr2bProposalWorkflowProposalId?.submittedVersionId &&
            (await this.reviewer(s, u, r, "read"))
          ) {
            assigned = true;
            break;
          }
        if (!assigned)
          groupError(
            404,
            "COMMON_001",
            "Không tìm thấy phiên bản trong phạm vi.",
          );
      }
      const context = await this.v.submitted(s, p);
      return {
        ...this.summary(
          p,
          await this.faculty(
            s,
            u,
            p.topic.termId,
            this.v.routing(p).departmentId,
            "assign",
          ),
        ),
        version: {
          id: context.version.id,
          versionNumber: context.version.version,
          content: context.version.content,
          contentHash: context.meta.contentHash,
          submittedAt: context.meta.submittedAt,
        },
      };
    });
  }
  async candidates(userId: string, id: string) {
    return this.repo.transaction(async (s) => {
      const u = this.v.principal(await s.principal(userId)),
        p = await this.facultyProposal(s, u, await s.proposal(id), "assign");
      const { assignment } = await this.v.submitted(s, p),
        routing = this.v.routing(p);
      const groups = await s.groups(p.topic.termId, routing.departmentId!);
      return Promise.all(
        groups.map(async (g) => {
          const eligible = await s.lecturers(
            p.topic.termId,
            g.members.map((m) => m.lecturerId),
          );
          const reviewers = eligible.filter(
            (l) => l.id !== assignment.advisorId,
          );
          return {
            id: g.id,
            name: g.name,
            memberCount: g.members.length,
            eligibleReviewerCount:
              eligible.length === g.members.length ? reviewers.length : 0,
            specialtyMatchCount: reviewers.filter((l) =>
              l.researchAreas.some(
                (a) => a.researchAreaId === p.topic.researchAreaId,
              ),
            ).length,
            activeReviewCount: g.reviews.filter(active).length,
            explanation:
              "Cùng đợt và bộ môn theo hướng đề tài. Số khớp chuyên môn chỉ để tham khảo; Khoa chọn và xác nhận, hệ thống không tự phân.",
          };
        }),
      );
    });
  }
  private async view(
    s: ProposalReviewSession,
    u: ReviewPrincipal,
    r: ReviewRecord,
  ): Promise<ProposalReviewView> {
    const w = r.pr2bProposalReviewWorkflowReviewId,
      version = w?.refVersionId,
      meta = version?.pr2bProposalVersionWorkflowVersionId;
    if (
      !w?.state ||
      !w.roundNumber ||
      !version ||
      meta?.state !== "SEALED" ||
      !r.proposal.pr2bProposalWorkflowProposalId
    )
      groupError(
        409,
        "INPUT_NOT_READY",
        "Vòng legacy thiếu version/state, cần đối soát.",
      );
    const canReview = await this.reviewer(s, u, r, "review"),
      canComment = await this.reviewer(s, u, r, "comment");
    const phase = await s.phase(r.proposal.topic.termId),
      term = await s.term(r.proposal.topic.termId),
      now = new Date();
    const open =
      !!phase &&
      !!term &&
      ["CLOSED_REGISTRATION", "IN_PROGRESS"].includes(term.status) &&
      !phase.refPhaseId.isLocked &&
      now >= phase.refPhaseId.startDate &&
      now < phase.refPhaseId.endDate;
    const current =
      r.proposal.pr2bProposalWorkflowProposalId?.submittedVersionId ===
      version.id;
    const d = r.pr2bProposalReviewDecisionReviewId;
    const allowedActions: ProposalReviewView["allowedActions"] = [];
    if (open && current && ["ASSIGNED", "IN_REVIEW"].includes(w.state) && !d) {
      if (canReview && w.state === "ASSIGNED") allowedActions.push("start");
      if (canComment) allowedActions.push("comment");
      if (canReview && w.state === "IN_REVIEW") allowedActions.push("decide");
    }
    const routing = (w.routingSnapshot as { departmentId?: string } | null)
      ?.departmentId;
    if (
      open &&
      (await this.faculty(s, u, r.proposal.topic.termId, routing, "assign")) &&
      ["ASSIGNED", "IN_REVIEW"].includes(w.state)
    )
      allowedActions.push("assign");
    return {
      id: r.id,
      proposalId: r.proposalId,
      termId: r.proposal.topic.termId,
      title: r.proposal.topic.title,
      studentName: r.proposal.student.fullName,
      studentCode: r.proposal.student.studentCode,
      proposalStatus: r.proposal.status,
      proposalRevision:
        r.proposal.pr2bProposalWorkflowProposalId?.revision ?? 0,
      revision: w.revision,
      state: w.state,
      roundNumber: w.roundNumber,
      groupId: r.reviewGroupId,
      groupName: r.reviewGroup.name,
      versionId: version.id,
      versionNumber: version.version,
      version: {
        content: version.content,
        contentHash: meta?.contentHash ?? null,
        submittedAt: meta?.submittedAt?.toISOString() ?? null,
        submittedByUserId: meta?.submittedByUserId ?? null,
      },
      assignedAt: w.assignedAt?.toISOString() ?? null,
      assignedByUserId: w.assignedByUserId,
      startedAt: w.startedAt?.toISOString() ?? null,
      startedByUserId: w.startedByUserId,
      routingSnapshot: w.routingSnapshot,
      phaseSnapshot: w.phaseSnapshot,
      supersededByReviewId: w.supersededByReviewId,
      allowedActions,
      comments: r.pr2bReviewCommentReviewId.map((c) => ({
        id: c.id,
        versionId: c.versionId,
        authorUserId: c.authorUserId,
        authorName: c.refAuthorUserId.username,
        createdAt: c.createdAt.toISOString(),
        text: c.text,
      })),
      decision: d
        ? {
            id: d.id,
            versionId: d.versionId,
            decision: d.decision,
            comment: d.comment,
            decidedByUserId: d.decidedByUserId,
            deciderName: d.refDecidedByUserId.username,
            decidedAt: d.decidedAt.toISOString(),
          }
        : null,
    };
  }
  async detail(userId: string, id: string) {
    return this.repo.transaction(async (s) => {
      const u = this.v.principal(await s.principal(userId));
      return this.view(
        s,
        u,
        await this.visibleReview(s, u, await s.review(id)),
      );
    });
  }
  async history(userId: string, proposalId: string) {
    return this.repo.transaction(async (s) => {
      const u = this.v.principal(await s.principal(userId)),
        rows = await s.history(proposalId),
        visible: ReviewRecord[] = [];
      for (const r of rows) {
        const dep = (
          r.pr2bProposalReviewWorkflowReviewId?.routingSnapshot as {
            departmentId?: string;
          } | null
        )?.departmentId;
        if (
          (await this.faculty(s, u, r.proposal.topic.termId, dep, "read")) ||
          (await this.reviewer(s, u, r, "read")) ||
          (await this.observer(s, u, r.proposal))
        )
          visible.push(r);
      }
      if (!visible.length)
        await this.facultyProposal(s, u, await s.proposal(proposalId), "read");
      return Promise.all(visible.map((r) => this.view(s, u, r)));
    });
  }
  async assign(userId: string, id: string, input: AssignReview, key: string) {
    return this.command(
      userId,
      `/proposals/${id}/review-assignments`,
      key,
      input,
      async (s, u) => {
        const p = await this.facultyProposal(
          s,
          u,
          await s.proposal(id),
          "assign",
        );
        return {
          p,
          groups: [
            input.groupId,
            ...p.reviews.filter(active).map((r) => r.reviewGroupId),
          ],
        };
      },
      async (s, u, p) => {
        const { workflow, version, assignment } = await this.v.submitted(
            s,
            p,
            input.proposalVersionId,
          ),
          routing = this.v.routing(p),
          phase = await this.v.phase(s, p.topic.termId);
        this.v.revision(workflow.revision, input.expectedProposalRevision);
        const current = p.reviews.filter(active);
        if (
          current.some((r) => !r.pr2bProposalReviewWorkflowReviewId?.state) ||
          current.length > 1
        )
          groupError(
            409,
            "INPUT_NOT_READY",
            "Vòng legacy/active cần đối soát trước khi phân lại.",
          );
        if (current.length && !input.replacesReviewId)
          groupError(
            409,
            "ACTIVE_REVIEW_EXISTS",
            "Đề cương đã có vòng đang hoạt động.",
          );
        if (input.replacesReviewId && current[0]?.id !== input.replacesReviewId)
          groupError(
            409,
            "REVISION_CONFLICT",
            "Vòng cần thay không còn hiện hành.",
          );
        this.v.state(
          current.length ? ["SUBMITTED", "UNDER_REVIEW"] : ["SUBMITTED"],
          p.status,
        );
        if (!workflow.nextReviewRound || workflow.nextReviewRound < 1)
          groupError(
            409,
            "INPUT_NOT_READY",
            "Producer cần cung cấp nextReviewRound, không tự đoán vòng từ legacy.",
          );
        const group = await s.group(input.groupId),
          groupMeta = group?.pr2bReviewGroupWorkflowGroupId;
        if (
          !group ||
          group.termId !== p.topic.termId ||
          !groupMeta ||
          groupMeta.archivedAt ||
          groupMeta.departmentId !== routing.departmentId
        )
          groupError(
            409,
            "ROUTING_MISMATCH",
            "Nhóm phải đang hoạt động, cùng đợt và bộ môn của hướng đề tài.",
          );
        const eligible = await s.lecturers(
          p.topic.termId,
          group.members.map((m) => m.lecturerId),
        );
        if (
          eligible.length !== group.members.length ||
          !eligible.some((l) => l.id !== assignment.advisorId)
        )
          groupError(
            409,
            "MEMBER_INELIGIBLE",
            "Nhóm cần thành viên hợp lệ trong đợt, có người duyệt ngoài GVHD.",
          );
        if (current.length) {
          const old = current[0].pr2bProposalReviewWorkflowReviewId!;
          this.v.revision(old.revision, input.expectedReviewRevision!);
          await s.advanceReview(current[0].id, old.revision, {
            state: "SUPERSEDED",
          });
        }
        const created = await s.createReview({
          proposal: { connect: { id: p.id } },
          reviewGroup: { connect: { id: group.id } },
          pr2bProposalReviewWorkflowReviewId: {
            create: {
              proposalId: p.id,
              versionId: version.id,
              roundNumber: workflow.nextReviewRound,
              state: "ASSIGNED",
              assignedByUserId: u.id,
              assignedAt: new Date(),
              phaseSnapshot: json({
                phaseId: phase.phaseId,
                revision: phase.revision,
                startsAt: phase.refPhaseId.startDate,
                endsAt: phase.refPhaseId.endDate,
              }),
              routingSnapshot: json({
                researchAreaId: p.topic.researchAreaId,
                departmentId: routing.departmentId,
                revision: routing.revision,
                groupRevision: groupMeta.revision,
                reason: input.reason ?? null,
              }),
            },
          },
        });
        if (current.length)
          await s.advanceReview(
            current[0].id,
            current[0].pr2bProposalReviewWorkflowReviewId!.revision + 1,
            { supersededByReviewId: created.id },
          );
        const changed = await s.advanceProposal(p.id, workflow.revision, {
          nextReviewRound: { increment: 1 },
        });
        if (changed.count !== 1)
          groupError(409, "REVISION_CONFLICT", "Đề cương đã thay đổi.");
        await s.status(p.id, "SUBMITTED");
        await s.audit(
          u.id,
          created.id,
          "ASSIGN",
          json({ previousReviewId: current[0]?.id ?? null }),
          json({
            proposalId: p.id,
            versionId: version.id,
            groupId: group.id,
            roundNumber: workflow.nextReviewRound,
            reason: input.reason ?? null,
          }),
        );
        return this.view(s, u, (await s.review(created.id))!);
      },
    );
  }
  async reviewCommand(
    userId: string,
    id: string,
    kind: "start" | "comment" | "decision",
    input: ReviewStart | ReviewCommentInput | ReviewDecisionInput,
    key: string,
  ) {
    return this.command(
      userId,
      `/proposal-reviews/${id}/${kind === "comment" ? "comments" : kind}`,
      key,
      input,
      async (s, u) => {
        const r = await this.visibleReview(
          s,
          u,
          await s.review(id),
          kind === "comment" ? "comment" : "review",
        );
        if (
          !(await this.reviewer(
            s,
            u,
            r,
            kind === "comment" ? "comment" : "review",
          ))
        )
          groupError(
            403,
            "AUTH_004",
            "Chỉ thành viên hợp lệ của nhóm được thực hiện.",
          );
        return { p: r.proposal, groups: [r.reviewGroupId] };
      },
      async (s, u, p) => {
        const r = (await s.review(id))!,
          w = this.v.active(r);
        await this.v.phase(s, p.topic.termId);
        const { workflow } = await this.v.submitted(
          s,
          p,
          "versionId" in input ? input.versionId : w.versionId!,
        );
        const routing = this.v.routing(p);
        const snapshot = w.routingSnapshot as {
          departmentId?: string;
          researchAreaId?: string;
          revision?: number;
        } | null;
        if (
          snapshot?.departmentId !== routing.departmentId ||
          snapshot?.researchAreaId !== p.topic.researchAreaId ||
          snapshot?.revision !== routing.revision
        )
          groupError(
            409,
            "ROUTING_MISMATCH",
            "Routing đã thay đổi. Khoa cần xác nhận phân lại vòng duyệt.",
          );
        if (w.versionId !== workflow.submittedVersionId)
          groupError(409, "STALE_VERSION", "Vòng đang trỏ phiên bản cũ.");
        this.v.revision(w.revision, input.expectedReviewRevision);
        if ("expectedProposalRevision" in input)
          this.v.revision(workflow.revision, input.expectedProposalRevision);
        if (kind === "start") {
          this.v.state(["ASSIGNED"], w.state!);
          this.v.state(["SUBMITTED"], p.status);
          await s.advanceReview(id, w.revision, {
            state: "IN_REVIEW",
            startedAt: new Date(),
            startedByUserId: u.id,
          });
          await s.advanceProposal(p.id, workflow.revision, {});
          await s.status(p.id, "UNDER_REVIEW");
        } else if (kind === "comment") {
          this.v.state(
            w.state === "ASSIGNED" ? ["SUBMITTED"] : ["UNDER_REVIEW"],
            p.status,
          );
          const comment = input as ReviewCommentInput;
          await s.comment({
            reviewId: id,
            versionId: w.versionId!,
            authorUserId: u.id,
            text: comment.text,
          });
          await s.advanceReview(id, w.revision, {});
        } else {
          this.v.state(["IN_REVIEW"], w.state!);
          this.v.state(["UNDER_REVIEW"], p.status);
          const decision = input as ReviewDecisionInput,
            now = new Date();
          await s.decision({
            reviewId: id,
            versionId: w.versionId!,
            decidedByUserId: u.id,
            decidedAt: now,
            decision: decision.decision,
            comment: decision.comment,
          });
          await s.advanceReview(id, w.revision, { state: "DECIDED" });
          await s.advanceProposal(p.id, workflow.revision, {});
          const status =
            decision.decision === "APPROVED"
              ? "APPROVED"
              : "REVISION_REQUESTED";
          await s.status(p.id, status);
          // Preserve the legacy consumer shape; canonical decision stays immutable above.
          await s.mirrorDecision(id, status, decision.comment ?? null, now);
          const { assignment } = await this.v.advisor(s, p);
          await s.outbox({
            eventId: randomUUID(),
            aggregateId: p.id,
            type: "PROPOSAL_REVIEW_DECIDED",
            payload: json({
              proposalId: p.id,
              reviewId: id,
              versionId: w.versionId,
              decision: decision.decision,
              studentUserId: p.student.userId,
              advisorUserId: assignment.advisor.userId,
            }),
          });
        }
        await s.audit(
          u.id,
          id,
          kind.toUpperCase(),
          json({
            proposalStatus: p.status,
            reviewState: w.state,
            proposalRevision: workflow.revision,
            reviewRevision: w.revision,
          }),
          json({
            proposalId: p.id,
            versionId: w.versionId,
            decision:
              kind === "decision"
                ? (input as ReviewDecisionInput).decision
                : null,
          }),
        );
        return this.view(s, u, (await s.review(id))!);
      },
    );
  }
  private async command(
    userId: string,
    route: string,
    key: string,
    input: unknown,
    authorize: (
      s: ProposalReviewSession,
      u: ReviewPrincipal,
    ) => Promise<{ p: ReviewProposal; groups: string[] }>,
    work: (
      s: ProposalReviewSession,
      u: ReviewPrincipal,
      p: ReviewProposal,
    ) => Promise<ProposalReviewView>,
  ) {
    if (!key || key.length > 200 || !/^[\w.-]+$/.test(key))
      groupError(400, "COMMON_003", "Thiếu hoặc sai Idempotency-Key.");
    const hash = reviewHash(input);
    return this.repo.transaction(async (s) => {
      const u = this.v.principal(await s.principal(userId)),
        initial = await authorize(s, u);
      await s.lock(initial.p.topic.termId, initial.groups, initial.p.id);
      const fresh = await authorize(s, u); // revoked grant/member/advisor cannot replay a cached response
      const previous = await s.replay(u.id, route, key);
      if (previous) {
        if (previous.payloadHash !== hash)
          groupError(
            409,
            "IDEMPOTENCY_CONFLICT",
            "Khóa gửi lại đã được dùng với nội dung khác.",
          );
        return previous.result as unknown as ProposalReviewView;
      }
      const result = await work(s, u, fresh.p);
      await this.v.phase(s, fresh.p.topic.termId); // recheck the clock/lock immediately before completing the command
      await s.remember(u.id, route, key, hash, json(result));
      return result;
    }, true);
  }
}
