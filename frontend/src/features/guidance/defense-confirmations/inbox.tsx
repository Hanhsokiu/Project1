import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, Notice, Button, Empty } from "../../../shared/components/kit";
import { defenseConfirmationApi as api } from "./api";
import { confirmationErrorMessage } from "./actions";
import type { InboxResponse } from "./types";

export function InboxRows({ response }: { response: InboxResponse }) {
  return response.items.length ? (
    <div className="space-y-3">
      {response.items.map((row) => (
        <article key={row.termStudentId} className="rounded border p-3">
          <strong>
            {row.studentCode} · {row.studentName}
          </strong>
          <p>{row.title || "Chưa có hồ sơ đề tài"}</p>
          <p>
            Quyết định: {row.status} · Phân công: {row.advisor.state}
          </p>
          {row.pdfChangedSinceDecision === true && (
            <Notice>
              PDF đã thay đổi sau quyết định. Cần xem lại bản hiện hành.
            </Notice>
          )}
          {row.advisorChangedSinceDecision === true && (
            <Notice>Phân công đã thay đổi sau quyết định.</Notice>
          )}
          {row.progress && (
            <p>
              Tiến độ: {row.progress.summary.completed}/
              {row.progress.summary.total} hoàn thành ·{" "}
              {row.progress.summary.overdue} quá hạn. Cảnh báo không tự chặn
              UC17.
            </p>
          )}
          {row.proposalId && (
            <Link
              className="text-indigo-600"
              to={`?proposalId=${encodeURIComponent(row.proposalId)}&view=${response.view}`}
            >
              Xem hồ sơ
            </Link>
          )}
        </article>
      ))}
    </div>
  ) : (
    <Empty
      title="Không có hồ sơ trong phạm vi/bộ lọc"
      description="Chỉ phân công chính thức hiện hành được đưa vào inbox GVHD."
    />
  );
}
export function DefenseConfirmationInbox({
  sessionKey,
  roles,
}: {
  sessionKey: string;
  roles: string[];
}) {
  const views = [
    roles.includes("LECTURER") && "ADVISOR",
    roles.includes("STUDENT") && "STUDENT",
    (roles.includes("FACULTY") || roles.includes("ADMIN")) && "FACULTY",
  ].filter(Boolean) as InboxResponse["view"][];
  const [view, setView] = useState<InboxResponse["view"]>(
    views[0] || "ADVISOR",
  );
  const [termId, setTermId] = useState("");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const terms = useQuery({
    queryKey: ["uc17-terms", sessionKey],
    queryFn: api.terms,
    retry: false,
  });
  const selected = termId || terms.data?.items[0]?.id || "";
  const inbox = useQuery({
    queryKey: ["uc17-inbox", sessionKey, selected, view, status, page],
    queryFn: () => api.inbox({ termId: selected, view, status, page }),
    enabled: !!selected,
    retry: false,
  });
  return (
    <Card title="Danh sách xác nhận bảo vệ">
      {terms.isPending && <p role="status">Đang tải đợt được phép truy cập…</p>}
      {terms.error && (
        <Notice tone="danger">{confirmationErrorMessage(terms.error)}</Notice>
      )}
      {terms.data && !terms.data.items.length && (
        <Empty
          title="Chưa có đợt trong phạm vi"
          description="Cần phân công chính thức, roster hoặc AcademicTermGrant phù hợp."
        />
      )}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          aria-label="Đợt UC17"
          value={selected}
          onChange={(e) => {
            setTermId(e.target.value);
            setPage(1);
          }}
        >
          {terms.data?.items.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Phạm vi UC17"
          value={view}
          onChange={(e) => {
            setView(e.target.value as InboxResponse["view"]);
            setPage(1);
          }}
        >
          {views.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <select
          aria-label="Trạng thái quyết định"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          {["ALL", "PENDING", "CONFIRMED", "REJECTED", "UNKNOWN"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <Button
          variant="secondary"
          onClick={() => {
            void terms.refetch();
            void inbox.refetch();
          }}
        >
          Tải lại
        </Button>
      </div>
      {selected && inbox.isPending && <p role="status">Đang tải danh sách…</p>}
      {inbox.error && (
        <Notice tone="danger">{confirmationErrorMessage(inbox.error)}</Notice>
      )}
      {inbox.data && !inbox.isError && (
        <>
          <InboxRows response={inbox.data} />
          <div className="flex gap-3 mt-4">
            <Button
              disabled={page <= 1 || inbox.isFetching}
              onClick={() => setPage((p) => p - 1)}
            >
              Trước
            </Button>
            <span>
              Trang {page} · {inbox.data.total} hồ sơ
            </span>
            <Button
              disabled={
                page * inbox.data.limit >= inbox.data.total || inbox.isFetching
              }
              onClick={() => setPage((p) => p + 1)}
            >
              Sau
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
