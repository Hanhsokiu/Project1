import { Injectable } from "@nestjs/common";
import { FileAsset } from "@prisma/client";
import {
  FINAL_REPORT_KEY,
  FinalReportAction,
  reportError,
} from "./final-report.dto";
import type {
  ReportPrincipal,
  ReportProposal,
} from "./final-report.repository";

@Injectable()
export class FinalReportValidator {
  principal(user: ReportPrincipal, userId: string, action: FinalReportAction) {
    if (
      !user ||
      user.id !== userId ||
      user.status !== "ACTIVE" ||
      user.mustChangePassword ||
      !user.student?.isActive
    )
      reportError(
        403,
        "FINAL_REPORT_FORBIDDEN",
        "Tài khoản sinh viên không được phép thực hiện thao tác.",
      );
    const permitted = user.userRoles.some(
      (r) =>
        r.role.name === "STUDENT" &&
        r.role.rolePermissions.some(
          (p) =>
            p.permission.resource === "submission" &&
            p.permission.action === action,
        ),
    );
    if (!permitted)
      reportError(
        403,
        "FINAL_REPORT_FORBIDDEN",
        "Thiếu quyền nộp hoặc đọc báo cáo.",
      );
    return user;
  }
  ownership(
    user: NonNullable<ReportPrincipal>,
    p: ReportProposal | null,
    roster: { id: string } | null,
  ) {
    if (!p || p.studentId !== user.student?.id || !roster)
      reportError(
        404,
        "FINAL_REPORT_NOT_FOUND",
        "Không tìm thấy hồ sơ trong phạm vi truy cập.",
      );
    if (p.topic.termId !== p.termId || p.term.id !== p.termId)
      reportError(409, "INPUT_NOT_READY", "Hồ sơ chưa có liên kết đợt hợp lệ.");
    return p;
  }
  open(p: ReportProposal, at: Date) {
    const w = p.term.finalReportSubmissionWindow;
    if (!w)
      reportError(
        409,
        "FINAL_REPORT_WINDOW_NOT_CONFIGURED",
        "Chưa cấu hình cửa sổ nộp PDF.",
      );
    if (
      p.term.isLocked ||
      ["COMPLETED", "CANCELLED"].includes(p.term.status) ||
      w.isLocked
    )
      reportError(
        409,
        "FINAL_REPORT_WINDOW_LOCKED",
        "Cửa sổ nộp hoặc đợt đã khóa/kết thúc.",
      );
    if (
      w.opensAt >= w.closesAt ||
      w.opensAt < p.term.startDate ||
      w.closesAt > p.term.endDate
    )
      reportError(
        409,
        "INPUT_NOT_READY",
        "Cấu hình cửa sổ nộp không nằm trong thời gian của đợt.",
      );
    if (at < w.opensAt)
      reportError(
        409,
        "FINAL_REPORT_WINDOW_NOT_OPEN",
        "Chưa đến thời gian nộp PDF.",
      );
    if (at >= w.closesAt)
      reportError(409, "FINAL_REPORT_WINDOW_CLOSED", "Đã hết hạn nộp PDF.");
    return w;
  }
  revision(expected: number, actual: number) {
    if (
      !Number.isInteger(expected) ||
      expected < 0 ||
      expected > 2147483646 ||
      expected !== actual
    )
      reportError(
        409,
        "REVISION_CONFLICT",
        "Báo cáo vừa thay đổi. Hãy tải lại trước khi nộp.",
      );
  }
  asset(asset: FileAsset | null, userId: string) {
    if (
      !asset ||
      asset.kind !== "REPORT" ||
      asset.state !== "READY" ||
      asset.createdByUserId !== userId ||
      !FINAL_REPORT_KEY.test(asset.storageKey) ||
      asset.mimeType !== "application/pdf" ||
      !Number.isInteger(asset.sizeBytes) ||
      asset.sizeBytes <= 0 ||
      asset.sizeBytes > 100 * 1024 * 1024 ||
      !/^[0-9a-f]{64}$/.test(asset.checksum)
    )
      reportError(
        409,
        "FINAL_REPORT_FILE_NOT_READY",
        "File PDF cần đối soát trước khi sử dụng.",
      );
    return asset;
  }
}
