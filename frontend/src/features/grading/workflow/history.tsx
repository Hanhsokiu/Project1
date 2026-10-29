import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAccessToken, getApiUser } from "../../../shared/api/api-session";
import { Button, Empty, Notice } from "../../../shared/components/kit";
import {
  gradingApi,
  gradingErrorText,
  type HistoryPage,
  type PolicyHistoryRow,
  type ResultHistoryRow,
} from "./api";

type HistoryRow = PolicyHistoryRow | ResultHistoryRow;
export function HistoryRows({ items }: { items: HistoryRow[] }) {
  if (!items.length) return <Empty title="Chưa có lịch sử thay đổi" />;
  return (
    <ul className="space-y-3">
      {items.map((row) => (
        <li key={row.revision} className="border rounded p-3">
          <p>
            Revision {row.revision} ·{" "}
            <time dateTime={row.recordedAt}>{row.recordedAt}</time>
          </p>
          <p>Người thực hiện (ID): {row.actorUserId}</p>
          {"state" in row && (
            <p>
              Trạng thái: {row.state === "SEALED" ? "Đã chốt" : "Đã công bố"} (
              {row.state})
            </p>
          )}
          <p>Xác minh: {row.integrity}</p>
          {"contentHash" in row && (
            <p className="break-all">SHA-256: {row.contentHash}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

export function GradingHistory({
  termId,
  proposalId,
  revision,
}: {
  termId: string;
  proposalId?: string;
  revision: number;
}) {
  const [open, setOpen] = useState(false);
  const [after, setAfter] = useState(0);
  const user = getApiUser();
  // Defense in depth: student/multi-role student sessions never mount history data.
  const allowed =
    !!user?.roles.includes("FACULTY") && !user.roles.includes("STUDENT");
  const q = useQuery<HistoryPage<HistoryRow>>({
    queryKey: [
      "grading-admin-history",
      user?.id,
      getAccessToken(),
      termId,
      proposalId,
      revision,
      after,
    ],
    queryFn: () =>
      proposalId
        ? gradingApi.resultHistory(termId, proposalId, after)
        : gradingApi.policyHistory(termId, after),
    enabled: allowed && open,
    retry: false,
  });
  if (!allowed) return null;
  return (
    <details onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>{proposalId ? "Lịch sử kết quả" : "Lịch sử thay đổi"}</summary>
      {open && (
        <div className="space-y-3 py-3">
          <p>
            Chỉ đọc. API không cung cấp lý do hoặc tên hiển thị của người thực
            hiện.
          </p>
          {q.isFetching && <p role="status">Đang đọc lịch sử…</p>}
          {q.error && (
            <Notice tone="danger">{gradingErrorText(q.error)}</Notice>
          )}
          {!q.isError && q.data && <HistoryRows items={q.data.items} />}
          <div className="flex gap-3">
            <Button
              variant="secondary"
              disabled={q.isFetching}
              onClick={() => void q.refetch()}
            >
              Tải lại lịch sử
            </Button>
            {after > 0 && (
              <Button disabled={q.isFetching} onClick={() => setAfter(0)}>
                Về đầu lịch sử
              </Button>
            )}
            {!q.isError && q.data?.nextRevision != null && (
              <Button
                disabled={q.isFetching}
                onClick={() => setAfter(q.data!.nextRevision!)}
              >
                Trang lịch sử tiếp
              </Button>
            )}
          </div>
        </div>
      )}
    </details>
  );
}
