import { finalReportApi } from "./api";
import { ZodError } from "zod";
import type { FinalReport, FinalReportContext } from "./contracts";
import { uploadBlockers, validateFinalReportFile } from "./validation";

export function finalReportHttpStatus(error: unknown): number | undefined {
  return error &&
    typeof error === "object" &&
    "status" in error &&
    typeof error.status === "number"
    ? error.status
    : undefined;
}
export function finalReportErrorMessage(error: unknown): string {
  if (error instanceof ZodError)
    return "Dữ liệu PDF không đúng hợp đồng backend. Hãy tải lại dữ liệu; không tự dùng dữ liệu demo.";
  const status = finalReportHttpStatus(error);
  const messages: Record<number, string> = {
    400: "File hoặc yêu cầu không hợp lệ. Kiểm tra tên, MIME và nội dung PDF.",
    401: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
    403: "Tài khoản không có quyền thao tác PDF của hồ sơ này hoặc không hoạt động.",
    404: "Không tìm thấy hồ sơ hoặc PDF thuộc quyền truy cập của bạn.",
    409: "Revision, cửa sổ nộp hoặc dữ liệu đã thay đổi. Hãy tải lại dữ liệu và chọn lại file trước khi nộp tiếp.",
    413: "File vượt giới hạn dung lượng. Hãy kiểm tra mức dung lượng backend đang cho phép.",
    422: "Dữ liệu nộp PDF không hợp lệ. Hãy tải lại context và kiểm tra file đã chọn.",
  };
  return (
    (status && messages[status]) ||
    (error instanceof Error
      ? error.message
      : "Không thể kết nối máy chủ. Vui lòng thử lại.")
  );
}

type UploadLifecycle = {
  invalidate: () => void;
  reload: () => Promise<unknown>;
};
export async function uploadFinalReport(
  context: FinalReportContext,
  metadata: FinalReport,
  file: File,
  lifecycle: UploadLifecycle,
  progress?: (percent: number) => void,
) {
  const blockers = uploadBlockers(context, metadata);
  if (blockers.length) throw new Error(blockers.join(" "));
  await validateFinalReportFile(file, context);
  let saved;
  try {
    saved = await finalReportApi.upload(
      context.proposalId,
      file,
      context.expectedRevision,
      progress,
    );
  } catch (error) {
    const status = finalReportHttpStatus(error);
    if (status === 409) lifecycle.invalidate();
    else if (status === undefined || status >= 500) {
      // A network/timeout/invalid acknowledgement can occur after commit. Do not
      // assert the old file survived or blindly retry the same upload.
      lifecycle.invalidate();
      throw new Error(
        "Chưa xác định được kết quả nộp PDF do lỗi kết nối hoặc phản hồi. Hãy tải lại dữ liệu trước khi thử tiếp; hệ thống không tự gửi lại file.",
      );
    }
    throw error;
  }
  lifecycle.invalidate();
  try {
    await lifecycle.reload();
  } catch {
    throw new Error(
      "Backend đã nhận PDF nhưng chưa tải lại đủ context/metadata. Hãy tải lại dữ liệu; không nộp lại chỉ để làm mới màn hình.",
    );
  }
  return saved;
}
