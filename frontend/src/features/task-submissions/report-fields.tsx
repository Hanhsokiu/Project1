import React from "react";
import type { WeeklyReportContent } from "@doan/shared";
export const reportLabels: Record<keyof WeeklyReportContent, string> = {
  assignedWork: "Công việc được giao",
  completedWork: "Công việc đã thực hiện",
  results: "Kết quả đạt được",
  unfinishedWork: "Công việc chưa hoàn thành",
  unfinishedReason: "Nguyên nhân chưa hoàn thành",
  difficulties: "Khó khăn / vướng mắc",
  solutions: "Phương án giải quyết",
  nextWork: "Dự kiến công việc tiếp theo",
  notes: "Ghi chú bổ sung",
};
export const emptyReport = Object.fromEntries(
  Object.keys(reportLabels).map((k) => [k, ""]),
) as WeeklyReportContent;
export function ReportContent({
  value,
}: {
  value?: Partial<WeeklyReportContent> | null;
}) {
  return value ? (
    <dl className="space-y-2">
      {Object.entries(reportLabels).map(([key, label]) => (
        <div key={key}>
          <dt className="font-semibold">{label}</dt>
          <dd className="whitespace-pre-wrap break-words">
            {value[key as keyof WeeklyReportContent] || "—"}
          </dd>
        </div>
      ))}
    </dl>
  ) : null;
}
