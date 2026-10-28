import {
  expectedRevisionSchema,
  type FinalReport,
  type FinalReportContext,
} from "./contracts";

const readinessText: Record<string, string> = {
  FINAL_REPORT_WINDOW_NOT_CONFIGURED: "Chưa cấu hình cửa sổ nộp PDF.",
  FINAL_REPORT_WINDOW_LOCKED: "Cửa sổ nộp hoặc đợt đã khóa/kết thúc.",
  FINAL_REPORT_WINDOW_NOT_OPEN: "Chưa đến thời gian nộp PDF.",
  FINAL_REPORT_WINDOW_CLOSED: "Đã hết hạn nộp PDF.",
  FINAL_REPORT_FORBIDDEN: "Tài khoản chưa có quyền nộp PDF cho hồ sơ này.",
  INPUT_NOT_READY: "Dữ liệu hồ sơ hoặc cấu hình thời gian chưa hợp lệ.",
};
export const submissionReadinessText = (code: string) =>
  readinessText[code] || "Backend chưa cho phép nộp PDF trong context này.";

export function reportsMatch(
  context: FinalReportContext,
  metadata: FinalReport,
): boolean {
  const embedded = context.report;
  return (
    context.proposalId === metadata.proposalId &&
    embedded.proposalId === metadata.proposalId &&
    context.expectedRevision === embedded.revision &&
    context.expectedRevision === metadata.revision &&
    embedded.state === metadata.state &&
    embedded.submittedAt === metadata.submittedAt &&
    embedded.file?.checksum === metadata.file?.checksum &&
    embedded.file?.originalName === metadata.file?.originalName &&
    embedded.file?.sizeBytes === metadata.file?.sizeBytes
  );
}

export function uploadBlockers(
  context: FinalReportContext,
  metadata: FinalReport,
): string[] {
  const reasons: string[] = [];
  if (!reportsMatch(context, metadata))
    reasons.push(
      "Revision hoặc metadata đã thay đổi. Hãy tải lại dữ liệu trước khi nộp.",
    );
  if (!context.canSubmit)
    reasons.push(
      ...(context.readiness.length
        ? context.readiness.map(submissionReadinessText)
        : ["Backend chưa cho phép nộp PDF."]),
    );
  const window = context.window;
  if (!window) reasons.push(readinessText.FINAL_REPORT_WINDOW_NOT_CONFIGURED);
  else if (window.locked)
    reasons.push(readinessText.FINAL_REPORT_WINDOW_LOCKED);
  else {
    const now = Date.parse(context.serverNow),
      opensAt = Date.parse(window.opensAt),
      closesAt = Date.parse(window.closesAt);
    if (![now, opensAt, closesAt].every(Number.isFinite) || opensAt >= closesAt)
      reasons.push(readinessText.INPUT_NOT_READY);
    else if (now < opensAt)
      reasons.push(readinessText.FINAL_REPORT_WINDOW_NOT_OPEN);
    else if (now >= closesAt)
      reasons.push(readinessText.FINAL_REPORT_WINDOW_CLOSED);
  }
  if (!expectedRevisionSchema.safeParse(context.expectedRevision).success)
    reasons.push("Không có revision hợp lệ để nộp PDF.");
  return [...new Set(reasons)];
}

export async function validateFinalReportFile(
  file: File,
  policy: Pick<FinalReportContext, "maxFileBytes" | "allowedExtensions">,
) {
  if (
    !Number.isInteger(policy.maxFileBytes) ||
    policy.maxFileBytes < 1 ||
    policy.maxFileBytes > 100 * 1024 * 1024 ||
    !policy.allowedExtensions.includes("pdf")
  )
    throw new Error(
      "Chưa có cấu hình dung lượng/định dạng PDF hợp lệ từ backend.",
    );
  const name = file.name.normalize("NFC");
  if (
    !name ||
    name.length > 180 ||
    name !== name.trim() ||
    /[. ]$/.test(name) ||
    Array.from(name).some(
      (c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127,
    ) ||
    /[<>:"/\\|?*\u202a-\u202e\u2066-\u2069]/u.test(name) ||
    /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)
  )
    throw new Error("Tên file không an toàn; hãy đổi tên file.");
  if (
    !name.toLowerCase().endsWith(".pdf") ||
    file.type.toLowerCase() !== "application/pdf"
  )
    throw new Error("Chỉ nhận một tệp .pdf có MIME application/pdf.");
  if (!Number.isInteger(file.size) || file.size <= 0)
    throw new Error("Không nhận file PDF rỗng.");
  if (file.size > policy.maxFileBytes)
    throw new Error("File vượt dung lượng cho phép từ backend.");
  // Bounded preliminary screening, not a replacement for server-side PDF/checksum
  // validation. Never encode the PDF as a data URL or read it into localStorage.
  const [head, tail] = await Promise.all([
    file.slice(0, 16).arrayBuffer(),
    file.slice(Math.max(0, file.size - 1024)).arrayBuffer(),
  ]);
  const decoder = new TextDecoder("latin1");
  if (
    !/^%PDF-(1\.[0-7]|2\.0)[\r\n]/.test(decoder.decode(head)) ||
    !/startxref\s+\d+\s+%%EOF\s*$/.test(decoder.decode(tail))
  )
    throw new Error("Nội dung không có cấu trúc PDF hợp lệ.");
}

/** Resets file selection on fresh context, without deriving a backend revision. */
export const uploadContextKey = (context: FinalReportContext) =>
  JSON.stringify([
    context.proposalId,
    context.serverNow,
    context.expectedRevision,
    context.window,
    context.canSubmit,
    context.maxFileBytes,
    context.allowedExtensions,
  ]);
