import {
  ConflictException,
  ForbiddenException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { LoadedProposal } from "../repository/topic.repository";
import { ProposalContent } from "../dto/proposal.dto";
export class ProposalValidator {
  static editable(p: LoadedProposal) {
    if (p.pr2bProposalWorkflowProposalId)
      throw new ConflictException(
        "Đề cương đã chuyển sang quản lý phiên bản. Hãy chỉnh sửa trong Đề cương & phiên bản.",
      );
    if (
      ["APPROVED", "UNDER_REVIEW"].includes(p.status) ||
      p.dossier?.status === "APPROVED"
    )
      throw new ConflictException(
        "Hồ sơ đã duyệt/chốt hoặc đang được duyệt; không sửa trực tiếp.",
      );
  }
  static version(p: LoadedProposal | null, expected: number) {
    if ((p?.versions[p.versions.length - 1]?.version ?? 0) !== expected)
      throw new ConflictException(
        "Đề cương đã có phiên bản mới. Hãy tải lại trước khi sửa.",
      );
  }
  static owner(
    studentId: string,
    advisorId: string,
    actor: { student: { id: string } | null; lecturer: { id: string } | null },
  ) {
    if (actor.student?.id !== studentId && actor.lecturer?.id !== advisorId)
      throw new ForbiddenException(
        "Chỉ sinh viên và GVHD chính thức của hồ sơ được ghi.",
      );
  }
  static submit(content: ProposalContent, advisorAgreed: boolean) {
    if (!advisorAgreed)
      throw new ConflictException(
        "Nội dung thay đổi hoặc GVHD chưa thống nhất; lưu nháp và xác nhận lại.",
      );
    if (
      content.title.length < 10 ||
      content.objectives.length < 15 ||
      content.scope.length < 15 ||
      content.technology.length < 3 ||
      content.expected.length < 10 ||
      !content.plan.length ||
      content.plan.some((p) => !p.week || p.content.length < 3)
    )
      throw new UnprocessableEntityException(
        "Đề cương cần đủ mục tiêu, nội dung/phạm vi, công nghệ, kết quả và kế hoạch thực hiện.",
      );
  }
}
