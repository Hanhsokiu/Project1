const legacyActionLabels: Record<string, string> = {
  "Tạo công việc xuất dữ liệu Bước 1–3": "Tạo yêu cầu xuất dữ liệu đồ án",
  "Hoàn tất xuất dữ liệu Bước 1–3": "Hoàn tất xuất dữ liệu đồ án",
  "Xuất dữ liệu Bước 1–3 thất bại": "Xuất dữ liệu đồ án thất bại",
};

// Rename historical actions for display without changing stored audit records.
export function auditActionLabel(action: string): string {
  return legacyActionLabels[action] ?? action;
}
