import { useState } from "react";
import { Link, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getAccessToken, getApiUser } from "../../../shared/api/api-session";
import {
  Button,
  Card,
  Empty,
  Notice,
  PageHeader,
} from "../../../shared/components/kit";
import type { PublishedDefenseSchedule } from "@doan/shared";
import { officialWorkflowEnabled, workflowApi, workflowError } from "./api";
export function PublishedRows({
  schedule,
}: {
  schedule: PublishedDefenseSchedule;
}) {
  return (
    <>
      <p>
        Trạng thái: {schedule.state} · Phiên bản {schedule.version ?? "—"}
      </p>
      {schedule.items.length ? (
        schedule.items.map((s) => (
          <article key={s.key} className="border p-4 my-3">
            <strong>
              {s.studentName} · {s.title}
            </strong>
            <p>
              {s.committeeName} · Phòng {s.roomCode}
            </p>
            <p>
              {new Date(s.startsAt).toLocaleString("vi-VN")} →{" "}
              {new Date(s.endsAt).toLocaleString("vi-VN")}
            </p>
          </article>
        ))
      ) : (
        <Empty
          title="Chưa có lịch đã công bố trong phạm vi của bạn"
          description="Không hiển thị draft hoặc lịch của người khác."
        />
      )}
    </>
  );
}
export default function PublishedSchedulePage() {
  const location = useLocation(),
    [params] = useSearchParams(),
    user = getApiUser();
  if (!officialWorkflowEnabled())
    return (
      <Notice tone="danger">
        Tra cứu lịch thật yêu cầu bật API UC18 hoặc UC19–21 cùng JWT auth; không
        có dữ liệu demo thay thế.
      </Notice>
    );
  if (!user || !getAccessToken())
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  if (user.mustChangePassword)
    return <Navigate to="/change-password" replace />;
  return (
    <PublishedContent
      initialTerm={params.get("termId") ?? ""}
      session={`${user.id}:${getAccessToken()}`}
    />
  );
}
function PublishedContent({
  initialTerm,
  session,
}: {
  initialTerm: string;
  session: string;
}) {
  const [draft, setDraft] = useState(initialTerm),
    [termId, setTermId] = useState(initialTerm);
  const q = useQuery({
    queryKey: ["published-defense", session, termId],
    queryFn: () => workflowApi.published(termId),
    enabled: !!termId,
    retry: false,
  });
  return (
    <main className="max-w-5xl mx-auto p-6 space-y-4">
      <Link to="/">← Về không gian làm việc</Link>
      <PageHeader
        title="Lịch bảo vệ đã công bố"
        description="Chỉ hiển thị phần lịch thuộc quan hệ hoặc phạm vi grant hiện hành."
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setTermId(draft.trim());
        }}
      >
        <label>
          Mã đợt{" "}
          <input
            required
            maxLength={36}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </label>
        <Button disabled={q.isFetching}>Tra cứu</Button>
      </form>
      {q.isPending && termId && <p role="status">Đang tải lịch…</p>}
      {q.error && <Notice tone="danger">{workflowError(q.error)}</Notice>}
      {q.data && !q.isError && (
        <Card title="Lịch chính thức">
          <PublishedRows schedule={q.data} />
          <Button
            variant="secondary"
            onClick={() => {
              void q.refetch();
            }}
          >
            Tải lại phiên bản server
          </Button>
        </Card>
      )}
    </main>
  );
}
