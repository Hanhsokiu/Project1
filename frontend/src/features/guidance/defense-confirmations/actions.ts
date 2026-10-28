import { defenseConfirmationApi } from "./api";
import { buildDecisionInput, type DecisionForm } from "./validation";
import type { ConfirmationContext } from "./types";

export function httpStatus(error: unknown): number | undefined {
  if (
    error &&
    typeof error === "object" &&
    "status" in error &&
    typeof error.status === "number"
  )
    return error.status;
  return undefined;
}
export function confirmationErrorMessage(error: unknown): string {
  const status = httpStatus(error);
  const messages: Record<number, string> = {
    400: "Dữ liệu yêu cầu không hợp lệ. Kiểm tra nội dung và tải lại hồ sơ nếu cần.",
    401: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
    403: "Bạn không có quyền thực hiện thao tác UC17 này hoặc tài khoản không hoạt động.",
    404: "Không tìm thấy hồ sơ hoặc PDF trong phạm vi được phép truy cập.",
    409: "Dữ liệu, PDF hoặc điều kiện quyết định đã thay đổi. Hãy tải lại, xem lại hồ sơ/PDF mới và xác nhận lại trước khi quyết định.",
    422: "Nội dung quyết định chưa hợp lệ. Kiểm tra lý do từ chối và lý do thay đổi.",
  };
  // Binary errors pass through the common Axios interceptor too: status remains
  // available even when its JSON error body was delivered as a Blob.
  return (
    (status && messages[status]) ||
    (error instanceof Error
      ? error.message
      : "Không thể xử lý UC17. Vui lòng thử lại.")
  );
}

type ReviewLifecycle = {
  invalidateReview: () => void;
  reload: () => Promise<unknown>;
};
async function conflict(error: unknown, lifecycle: ReviewLifecycle) {
  if (httpStatus(error) !== 409) return;
  lifecycle.invalidateReview();
  // A failed refresh must leave the form blocked, never retry a write/download.
  await lifecycle.reload().catch(() => undefined);
}
export async function recordDecision(
  context: ConfirmationContext,
  form: DecisionForm,
  lifecycle: ReviewLifecycle,
) {
  const input = buildDecisionInput(context, form);
  let result;
  try {
    result = await defenseConfirmationApi.put(context.proposal.id, input);
  } catch (error) {
    await conflict(error, lifecycle);
    throw error;
  }
  lifecycle.invalidateReview();
  try {
    await lifecycle.reload();
  } catch {
    throw new Error(
      "Backend đã xử lý quyết định nhưng chưa tải lại đủ dữ liệu. Hãy tải lại hồ sơ; không gửi lại quyết định chỉ để làm mới màn hình.",
    );
  }
  return result;
}
export async function downloadReport(
  context: ConfirmationContext,
  lifecycle: ReviewLifecycle,
) {
  const identity = context.expectedContext?.pdf;
  if (context.pdf.state !== "READY" || !identity)
    throw new Error("Chưa có PDF hiện hành đã xác minh để tải.");
  try {
    return await defenseConfirmationApi.download(context.proposal.id, identity);
  } catch (error) {
    await conflict(error, lifecycle);
    throw error;
  }
}
