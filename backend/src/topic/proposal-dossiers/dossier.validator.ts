import { Injectable } from "@nestjs/common";
import { z } from "zod";
import { SubmittedProposalContentSchema } from "@doan/shared";
import type { DossierPrintSnapshot, ProposalContent } from "@doan/shared";
import {
  ProposalReviewValidator,
  reviewHash,
} from "../proposal-reviews/proposal-review.validator";
import type { ReviewProposal } from "../proposal-reviews/proposal-review.repository";
import type { DossierRecord, DossierSession } from "./dossier.repository";
import { groupError } from "../review-groups/review-group.errors";
// Validate stored structure without transforming or backfilling the frozen payload.
const optionalContact = z.string().nullable().optional();
const snapshotSchema = z.object({
  schemaVersion: z.literal(1),
  title: z.string().min(1),
  termName: z.string().min(1),
  student: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    code: z.string().min(1),
    className: z.string().min(1),
    majorName: z.string().min(1),
    trainingSystem: z.string().min(1),
    cohort: optionalContact,
    phone: optionalContact,
    email: optionalContact,
  }),
  advisor: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    department: z.string().min(1),
    phone: optionalContact,
    email: optionalContact,
  }),
  academicProfileRevision: z.number().int().nonnegative(),
  assignmentId: z.string().min(1),
  assignmentRevision: z.number().int().nonnegative(),
  topicRevision: z.number().int().nonnegative(),
  content: SubmittedProposalContentSchema,
});
@Injectable()
export class DossierValidator {
  constructor(private readonly review: ProposalReviewValidator) {}
  open(d: DossierRecord | null, expectedRevision: number) {
    if (
      d &&
      (!d.pr2bDossierWorkflowDossierId ||
        !["DRAFT", "REOPENED"].includes(
          d.pr2bDossierWorkflowDossierId.state ?? "",
        ) ||
        d.pr2bDossierWorkflowDossierId.currentFinalizationId ||
        d.pr2bDossierFinalizationDossierId.some((f) => !f.supersededAt))
    )
      groupError(
        409,
        "DOSSIER_LOCKED",
        "Hồ sơ đã chốt hoặc dữ liệu legacy cần đối soát.",
      );
    this.review.revision(
      d?.pr2bDossierWorkflowDossierId?.revision ?? 0,
      expectedRevision,
    );
  }
  async approval(s: DossierSession, p: ReviewProposal, versionId: string) {
    this.review.state(["APPROVED"], p.status);
    const context = await this.review.submitted(s, p, versionId);
    if (context.workflow.workingVersionId !== versionId)
      groupError(409, "STALE_VERSION", "Bản làm việc khác bản đã được duyệt.");
    const rounds = await s.history(p.id);
    if (
      rounds.some(
        (r) =>
          !r.pr2bProposalReviewWorkflowReviewId?.state ||
          ["ASSIGNED", "IN_REVIEW"].includes(
            r.pr2bProposalReviewWorkflowReviewId.state,
          ),
      )
    )
      groupError(
        409,
        "ACTIVE_REVIEW_EXISTS",
        "Còn vòng duyệt đang hoạt động/chưa đối soát.",
      );
    const round = rounds
      .filter(
        (r) => r.pr2bProposalReviewWorkflowReviewId?.state !== "SUPERSEDED",
      )
      .sort(
        (a, b) =>
          (b.pr2bProposalReviewWorkflowReviewId?.roundNumber ?? 0) -
          (a.pr2bProposalReviewWorkflowReviewId?.roundNumber ?? 0),
      )[0];
    const decision = round?.pr2bProposalReviewDecisionReviewId;
    if (
      !round ||
      round.pr2bProposalReviewWorkflowReviewId?.state !== "DECIDED" ||
      decision?.decision !== "APPROVED" ||
      decision.versionId !== versionId ||
      decision.decidedAt > new Date() ||
      round.reviewGroup.termId !== p.topic.termId ||
      round.pr2bProposalReviewWorkflowReviewId.versionId !== versionId
    )
      groupError(
        409,
        "APPROVAL_NOT_READY",
        "Thiếu kết luận APPROVED hiệu lực gắn đúng phiên bản.",
      );
    const routing = this.review.routing(p);
    const approvedRouting = round.pr2bProposalReviewWorkflowReviewId
      .routingSnapshot as {
      departmentId?: string;
      researchAreaId?: string;
      revision?: number;
    } | null;
    if (
      approvedRouting?.departmentId !== routing.departmentId ||
      approvedRouting?.researchAreaId !== p.topic.researchAreaId ||
      approvedRouting?.revision !== routing.revision
    )
      groupError(
        409,
        "ROUTING_MISMATCH",
        "Routing đã đổi sau vòng duyệt; cần Khoa đối soát theo workflow được phép, không chốt dựa trên routing cũ.",
      );
    const parsed = SubmittedProposalContentSchema.safeParse(
      context.version.content,
    );
    if (!parsed.success)
      groupError(
        409,
        "PROPOSAL_CONTENT_INVALID",
        "Phiên bản được duyệt chưa đủ trường theo mẫu.",
      );
    return { ...context, content: parsed.data, decision };
  }
  async snapshot(
    s: DossierSession,
    p: ReviewProposal,
    approved: {
      assignment: { id: string; advisorId: string };
      revision: number;
      content: ProposalContent;
    },
  ): Promise<DossierPrintSnapshot> {
    const owner = this.review.ownership(p),
      profile = await s.profile(owner.termStudentId!),
      student = await s.printStudent(p.studentId),
      advisor = await s.printAdvisor(approved.assignment.advisorId),
      term = await s.term(p.topic.termId);
    if (!profile?.className.trim() || !profile.majorName.trim())
      groupError(
        409,
        "STUDENT_PROFILE_NOT_READY",
        "Bước 1–3 chưa cung cấp lớp/ngành đã xác nhận cho sinh viên trong đợt.",
      );
    if (
      !student?.isActive ||
      !advisor?.isActive ||
      !term ||
      !p.topic.title.trim()
    )
      groupError(409, "INPUT_NOT_READY", "Thiếu thông tin thật để in hồ sơ.");
    return {
      schemaVersion: 1,
      title: p.topic.title,
      termName: term.name,
      student: {
        id: student.id,
        name: student.fullName,
        code: student.studentCode,
        className: profile.className,
        majorName: profile.majorName,
        trainingSystem: student.trainingSystem.name,
        cohort: student.cohort.trim() || null,
        phone: student.phone?.trim() || student.user.phone?.trim() || null,
        email: student.user.email?.trim() || null,
      },
      advisor: {
        id: advisor.id,
        name: advisor.fullName,
        department: advisor.department.name,
        phone: advisor.phone?.trim() || advisor.user.phone?.trim() || null,
        email: advisor.user.email?.trim() || null,
      },
      academicProfileRevision: profile.revision,
      assignmentId: approved.assignment.id,
      assignmentRevision: approved.revision,
      topicRevision: owner.revision,
      content: approved.content,
    };
  }
  snapshotIntegrity(snapshot: unknown, hash: string) {
    const value = snapshot as DossierPrintSnapshot | null;
    if (!snapshotSchema.safeParse(value).success || reviewHash(value) !== hash)
      groupError(
        409,
        "INPUT_NOT_READY",
        "Snapshot in chưa sẵn sàng hoặc không khớp hash.",
      );
    return value as DossierPrintSnapshot;
  }
}
