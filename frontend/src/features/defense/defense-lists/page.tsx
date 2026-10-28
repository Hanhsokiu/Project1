import { useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAccessToken, getApiUser } from "../../../shared/api/api-session";
import {
  Button,
  Card,
  Empty,
  Notice,
  PageHeader,
} from "../../../shared/components/kit";
import {
  confirmationErrorMessage,
  httpStatus,
} from "../../guidance/defense-confirmations/actions";
import DemoEligibilityPage from "../pages/EligibilityPage";
import { defenseListApi as api, defenseListMode, type Preview } from "./api";
import { OfficialEligibilityPanel } from "../workflow/panels";

function listErrorMessage(error: unknown) {
  if (httpStatus(error) === 403)
    return "Bạn không có quyền đọc/quản lý danh sách hoặc grant không bao phủ đúng phạm vi đợt.";
  if (httpStatus(error) === 404)
    return "Không tìm thấy đợt hoặc cấu hình danh sách trong phạm vi được phép.";
  if (httpStatus(error) === 409)
    return "Trạng thái hoặc revision danh sách vừa thay đổi. Hãy tải lại và kiểm tra trước khi thao tác lại.";
  return confirmationErrorMessage(error);
}

const reasons: Record<string, string> = {
  STUDENT_INACTIVE: "Sinh viên không hoạt động",
  PROPOSAL_MISSING: "Thiếu hồ sơ Proposal",
  PROPOSAL_NOT_APPROVED: "Đề cương chưa APPROVED",
  OFFICIAL_ASSIGNMENT_MISSING: "Chưa xác minh phân công FINALIZED hiện hành",
  ADVISOR_DECISION_PENDING: "Chờ quyết định GVHD",
  ADVISOR_DECISION_UNVERIFIED: "Quyết định thiếu bằng chứng/legacy",
  ADVISOR_REJECTED: "GVHD từ chối",
  PDF_EVIDENCE_STALE: "PDF khác snapshot quyết định",
  ASSIGNMENT_EVIDENCE_STALE: "Phân công khác snapshot quyết định",
  UC17_CONFIRMATION_NOT_APPLICABLE:
    "Chưa xác minh được xác nhận GVHD áp dụng cho phân công/PDF hiện hành",
  PDF_MISSING: "Chưa nộp PDF",
  PDF_NOT_VERIFIED:
    "Preview chưa xác minh byte/checksum của PDF; GVHD xác minh qua context UC17",
  ACADEMIC_SOURCE_NOT_VERIFIED:
    "Chưa có nguồn học vụ/nợ học phần được xác nhận",
};
export function PreviewRows({ preview }: { preview: Preview }) {
  return (
    <>
      <Notice>{preview.notice}</Notice>
      <p>
        Phạm vi: {preview.scope} · {preview.rosterCount} sinh viên trong phạm vi
        · {preview.admittedCount} được xác nhận đủ điều kiện.
      </p>
      {!preview.rosterCompleteForTerm && (
        <Notice>
          Đây là phần đối soát theo bộ môn, không phải danh sách toàn đợt. Hồ sơ
          thiếu routing không được tự mở quyền xem.
        </Notice>
      )}
      {preview.blockers.map((b) => (
        <Notice key={b.code}>{b.message}</Notice>
      ))}
      {preview.items.length ? (
        <div className="space-y-3">
          {preview.items.map((row) => (
            <article key={row.termStudentId} className="rounded border p-4">
              <strong>
                {row.studentCode} · {row.studentName}
              </strong>
              <p>{row.title || "Chưa có đề tài/hồ sơ"}</p>
              <p>
                Phân loại đối soát: {row.evidence.result} · Điều kiện chính
                thức: {row.evidence.officialEligibility}
              </p>
              <ul className="list-disc pl-5">
                {row.evidence.reasons.map((r) => (
                  <li key={r}>{reasons[r] || r}</li>
                ))}
              </ul>
              {row.proposalId && (
                <Link
                  className="text-indigo-600"
                  to={`/guidance/defense-confirm?proposalId=${encodeURIComponent(row.proposalId)}&view=FACULTY`}
                >
                  Xem quyết định và lịch sử UC17 theo quyền
                </Link>
              )}
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title="Không có sinh viên trong bộ lọc"
          description="Không tự thêm hoặc bỏ qua sinh viên thiếu hồ sơ."
        />
      )}
    </>
  );
}
export default function DefenseListPage() {
  if (defenseListMode() === "DEMO")
    return (
      <>
        <Notice>
          Chế độ DEMO UC18. Không phải danh sách bảo vệ chính thức.
        </Notice>
        <DemoEligibilityPage />
      </>
    );
  return <DefenseListApiPage />;
}
export function DefenseListApiPage() {
  const location = useLocation();
  const user = getApiUser();
  if (defenseListMode() !== "API")
    return (
      <Notice tone="danger">
        UC18 API yêu cầu VITE_DEFENSE_LIST_API=true và VITE_AUTH_API=true. Không
        dùng dữ liệu demo thay thế.
      </Notice>
    );
  if (!user || !getAccessToken())
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (user.mustChangePassword)
    return <Navigate to="/change-password" replace />;
  return (
    <ListContent
      key={`${user.id}:${getAccessToken()}`}
      sessionKey={`${user.id}:${getAccessToken()}`}
    />
  );
}
function ListContent({ sessionKey }: { sessionKey: string }) {
  const client = useQueryClient();
  const [termId, setTermId] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState("ALL");
  const [message, setMessage] = useState("");
  const terms = useQuery({
    queryKey: ["uc18-terms", sessionKey],
    queryFn: api.terms,
    retry: false,
  });
  const selected = termId || terms.data?.items[0]?.id || "";
  const preview = useQuery({
    queryKey: ["uc18-preview", sessionKey, selected, page, result],
    queryFn: () => api.preview(selected, page, result),
    enabled: !!selected,
    retry: false,
  });
  const state = useQuery({
    queryKey: ["uc18-state", sessionKey, selected],
    queryFn: () => api.state(selected),
    enabled: !!selected,
    retry: false,
  });
  const refresh = async (includeOfficial = true) => {
    const values = await Promise.all([
      preview.refetch({ throwOnError: true }),
      state.refetch({ throwOnError: true }),
      ...(includeOfficial
        ? [
            client.invalidateQueries({
              queryKey: ["official-defense", sessionKey, selected],
            }),
          ]
        : []),
    ]);
    return values;
  };
  const manage = useMutation({
    mutationFn: async (action: "create" | "open") => {
      if (
        !preview.data?.capabilities.canManage ||
        !state.data ||
        preview.isError ||
        state.isError ||
        preview.isFetching ||
        state.isFetching
      )
        throw new Error("Cần quyền quản lý toàn đợt và trạng thái mới nhất.");
      if (action === "create") return api.create(selected);
      if (state.data.state !== "DRAFT" || state.data.revision === null)
        throw new Error("Chỉ mở xét từ DRAFT.");
      return api.open(selected, state.data.revision);
    },
    retry: false,
    onSuccess: async () => {
      setMessage("Đã lưu cấu hình danh sách từ backend.");
      await refresh();
    },
    onError: async (e) => {
      if ((e as { status?: number }).status === 409) {
        setMessage(
          "Danh sách vừa thay đổi. Đã yêu cầu tải lại; hãy xem trạng thái mới trước khi thao tác lại.",
        );
        await refresh().catch(() => undefined);
      }
    },
  });
  const busy = manage.isPending || preview.isFetching || state.isFetching;
  const canManage =
    !!preview.data?.capabilities.canManage &&
    !preview.isError &&
    !state.isError;
  return (
    <section className="max-w-6xl mx-auto space-y-6">
      <Link to="/">← Về không gian làm việc</Link>
      <PageHeader
        title="UC18 · Đối soát danh sách bảo vệ"
        description="Danh sách chính thức toàn đợt. Preview không thay thế xác nhận học vụ hoặc tự công nhận đủ điều kiện."
      />
      <Card title="Đợt và trạng thái">
        <select
          aria-label="Đợt UC18"
          value={selected}
          onChange={(e) => {
            setTermId(e.target.value);
            setPage(1);
            setMessage("");
            manage.reset();
          }}
        >
          {terms.data?.items.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        {!terms.isPending && !terms.isError && !terms.data?.items.length && (
          <Empty
            title="Chưa có đợt trong grant"
            description="Cần permission defense-list:read và AcademicTermGrant đúng phạm vi."
          />
        )}
        {state.data && !state.isError && (
          <p>
            {state.data.configured ? state.data.state : "Chưa cấu hình"} ·
            Revision {state.data.revision ?? "—"} · UC18 đã xác minh:{" "}
            {state.data.uc18.state}
          </p>
        )}
        <div className="flex flex-wrap gap-3 mt-4">
          <Button
            disabled={!canManage || busy || state.data?.configured !== false}
            onClick={() => manage.mutate("create")}
          >
            Tạo DRAFT
          </Button>
          <Button
            disabled={!canManage || busy || state.data?.state !== "DRAFT"}
            onClick={() => manage.mutate("open")}
          >
            Mở xét OPEN
          </Button>
          <Button
            variant="secondary"
            disabled={!selected || busy}
            onClick={() => {
              void refresh().catch(() => undefined);
            }}
          >
            Tải lại
          </Button>
        </div>
      </Card>
      {selected && (
        <OfficialEligibilityPanel
          key={selected}
          termId={selected}
          onChanged={() => refresh(false)}
        />
      )}
      {message && <Notice>{message}</Notice>}
      {[terms.error, state.error, preview.error, manage.error]
        .filter(Boolean)
        .map((e, i) => (
          <Notice key={i} tone="danger">
            {listErrorMessage(e)}
          </Notice>
        ))}
      {(terms.isPending ||
        (!!selected && (preview.isPending || state.isPending))) && (
        <p role="status">Đang tải dữ liệu thật…</p>
      )}
      <Card title="Đối soát metadata — kết quả chứng cứ chính thức ở phần workflow phía trên">
        <select
          aria-label="Lọc kết quả đối soát"
          value={result}
          onChange={(e) => {
            setResult(e.target.value);
            setPage(1);
          }}
        >
          {[
            "ALL",
            "NOT_APPROVED",
            "WAITING_ADVISOR",
            "REVIEW_REQUIRED",
            "ACADEMIC_UNVERIFIED",
          ].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        {preview.data && !preview.isError && (
          <>
            <PreviewRows preview={preview.data} />
            <div className="flex gap-3 mt-4">
              <Button
                disabled={page <= 1 || busy}
                onClick={() => setPage((p) => p - 1)}
              >
                Trước
              </Button>
              <span>
                Trang {page} · {preview.data.total} dòng
              </span>
              <Button
                disabled={
                  page * preview.data.limit >= preview.data.total || busy
                }
                onClick={() => setPage((p) => p + 1)}
              >
                Sau
              </Button>
            </div>
          </>
        )}
      </Card>
    </section>
  );
}
