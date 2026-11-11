import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { AUTH_API } from "../../../shared/api/api-session";
import { useApiSession } from "../../../shared/hooks/use-api-session";
import { preferredWorkflowTerm } from "../../../shared/hooks/use-workflow-terms";
import {
  Button,
  Card,
  Empty,
  Field,
  Notice,
  PageHeader,
} from "../../../shared/components/kit";
import type { AdvisorConfirmation, AdvisorSummary } from "@doan/shared";
import { finalDefenseApi as api } from "./api";
import {
  AdvisorDecisionForm,
  AdvisorSummaryForm,
  finalStatusLabel,
  finalBlockerLabel,
  ActionBlockedNotice,
} from "./components";

const issue = (e: unknown) =>
  e instanceof Error ? e.message : "Không xử lý được yêu cầu.";
export function FinalDefensePage() {
  return AUTH_API ? (
    <FinalDefenseContent />
  ) : (
    <Notice>
      Chức năng xác nhận bảo vệ cần kết nối API và đăng nhập vào hệ thống của
      nhóm.
    </Notice>
  );
}
function FinalDefenseContent() {
  const user = useApiSession(),
    client = useQueryClient(),
    [params, setParams] = useSearchParams();
  const termId = params.get("termId") ?? "",
    page = Math.max(1, Number(params.get("page")) || 1);
  const [file, setFile] = useState<File | null>(null),
    [message, setMessage] = useState(""),
    [downloadError, setDownloadError] = useState("");
  const keys = useRef(new Map<string, string>()),
    uploadKey = useRef("");
  const key = (action: string, body: unknown) => {
    const identity = JSON.stringify([
      user?.id,
      termId,
      proposalId,
      action,
      body,
    ]);
    if (!keys.current.has(identity))
      keys.current.set(identity, crypto.randomUUID());
    return keys.current.get(identity)!;
  };
  const terms = useQuery({
    queryKey: ["final-defense-terms", user?.id],
    queryFn: api.terms,
    enabled: !!user,
  });
  useEffect(() => {
    if (!termId && terms.data?.[0]) {
      // Preserve the same selected term preference as B1–B8 without reading DemoDb.
      const preferred = preferredWorkflowTerm(terms.data);
      setParams({ termId: preferred!.id }, { replace: true });
    }
  }, [termId, terms.data, setParams]);
  const list = useQuery({
    queryKey: ["final-defense-list", user?.id, termId, page],
    queryFn: () => api.list(termId, page),
    enabled: !!user && !!termId,
  });
  const requested = params.get("proposalId");
  const proposalId =
    list.data?.items.find((i) => i.proposalId === requested)?.proposalId ??
    list.data?.items[0]?.proposalId ??
    "";
  const detail = useQuery({
    queryKey: ["final-defense-detail", user?.id, proposalId],
    queryFn: () => api.detail(proposalId),
    enabled: !!user && !!proposalId,
  });
  useEffect(() => {
    setFile(null);
    setMessage("");
    setDownloadError("");
    uploadKey.current = "";
  }, [proposalId]);
  const mutation = useMutation({
    mutationFn: async (command: {
      action: "upload" | "summary" | "decide";
      body?: AdvisorSummary | AdvisorConfirmation;
    }) => {
      if (!detail.data || !proposalId || detail.data.termId !== termId)
        throw new Error("Cần tải lại hồ sơ đúng đợt.");
      if (command.action === "upload") {
        if (!file) throw new Error("Chọn PDF đồ án cuối.");
        return api.upload(
          proposalId,
          detail.data.revision,
          file,
          uploadKey.current,
        );
      }
      if (command.action === "summary")
        return api.summary(
          proposalId,
          command.body as AdvisorSummary,
          key("summary", command.body),
        );
      return api.decide(
        proposalId,
        command.body as AdvisorConfirmation,
        key("decide", command.body),
      );
    },
    onMutate: () => setMessage(""),
    onSuccess: async () => {
      setMessage("Đã lưu trên hệ thống.");
      setFile(null);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["final-defense-list"] }),
        client.invalidateQueries({ queryKey: ["final-defense-detail"] }),
      ]);
    },
  });
  const view = detail.data?.termId === termId ? detail.data : undefined;
  return (
    <div className="space-y-6">
      <PageHeader
        title="PDF cuối và xác nhận bảo vệ"
        description="GVHD nhận xét, cho điểm và quyết định đối với đúng phiên bản PDF. Khoa theo dõi trạng thái; xét điều kiện học vụ được thực hiện ở bước sau."
      />
      {terms.isLoading && <p role="status">Đang tải đợt đồ án…</p>}
      {terms.error && (
        <Notice tone="danger">
          {issue(terms.error)}{" "}
          <Button onClick={() => void terms.refetch()}>Thử lại</Button>
        </Notice>
      )}
      <Field label="Đợt đồ án">
        <select
          aria-label="Đợt đồ án"
          disabled={mutation.isPending}
          value={termId}
          onChange={(e) => {
            mutation.reset();
            setParams({ termId: e.target.value });
          }}
        >
          <option value="">Chọn đợt</option>
          {terms.data?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.code} · {t.name}
            </option>
          ))}
        </select>
      </Field>
      {terms.data?.length === 0 && <Empty title="Chưa có đợt trong phạm vi" />}
      {list.isLoading && termId && <p role="status">Đang tải hồ sơ…</p>}
      {list.error && (
        <Notice tone="danger">
          {issue(list.error)}{" "}
          <Button onClick={() => void list.refetch()}>Thử lại</Button>
        </Notice>
      )}
      {list.data?.items.length === 0 && (
        <Empty title="Chưa có hồ sơ trong phạm vi được cấp quyền" />
      )}
      {!!list.data?.items.length && (
        <Card title="Hồ sơ sinh viên">
          <Field label="Sinh viên">
            <select
              aria-label="Sinh viên"
              disabled={mutation.isPending}
              value={proposalId}
              onChange={(e) => {
                mutation.reset();
                setParams({
                  termId,
                  page: String(page),
                  proposalId: e.target.value,
                });
              }}
            >
              {list.data.items.map((i) => (
                <option key={i.proposalId} value={i.proposalId}>
                  {i.studentCode} · {i.studentName} ·{" "}
                  {finalStatusLabel(i.status)}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex gap-3 mt-3">
            <Button
              variant="secondary"
              disabled={mutation.isPending || page <= 1}
              onClick={() => setParams({ termId, page: String(page - 1) })}
            >
              Trang trước
            </Button>
            <span>
              Trang {page} · {list.data.total} hồ sơ
            </span>
            <Button
              variant="secondary"
              disabled={mutation.isPending || page * 20 >= list.data.total}
              onClick={() => setParams({ termId, page: String(page + 1) })}
            >
              Trang sau
            </Button>
          </div>
        </Card>
      )}
      {detail.isLoading && proposalId && (
        <p role="status">Đang tải chi tiết…</p>
      )}
      {detail.error && (
        <Notice tone="danger">
          {issue(detail.error)}{" "}
          <Button onClick={() => void detail.refetch()}>Tải lại hồ sơ</Button>
        </Notice>
      )}
      {view && (
        <>
          <Card title={view.title}>
            <p>
              {view.studentCode} · {view.studentName}
            </p>
            <p>{finalStatusLabel(view.status)}</p>
            <div className="flex gap-4 mt-3">
              <Link
                to={`/guidance/plan/${encodeURIComponent(view.proposalId)}?termId=${encodeURIComponent(termId)}`}
              >
                Xem kế hoạch và nhiệm vụ
              </Link>
              <Link to={`/guidance/weeks?termId=${encodeURIComponent(termId)}`}>
                Xem báo cáo và đánh giá tuần
              </Link>
            </div>
          </Card>
          {!!view.blockers.length && (
            <Notice tone="warning">
              <ul>
                {view.blockers.map((b) => (
                  <li key={b}>{finalBlockerLabel(b, view)}</li>
                ))}
              </ul>
            </Notice>
          )}
          <Card title="Tiến độ và đánh giá hướng dẫn">
            {view.progress ? (
              <>
                <p>
                  Hoàn thành {view.progress.completed}/
                  {view.progress.activeTasks} nhiệm vụ; quá hạn{" "}
                  {view.progress.overdue}; chờ nhận xét{" "}
                  {view.progress.pendingReviews}.
                </p>
                <p>
                  Đánh giá hiện hành: {view.progress.pass} Đạt ·{" "}
                  {view.progress.fail} Không đạt ·{" "}
                  {view.progress.revisionRequired} Cần sửa.
                </p>
                {(!view.progress.currentAssignment ||
                  view.progress.unknownTasks > 0) && (
                  <Notice tone="warning">
                    Kế hoạch có dữ liệu cũ hoặc chưa khớp phân công; cần đối
                    chiếu UC14–UC16.
                  </Notice>
                )}
                {view.progress.completed < view.progress.activeTasks && (
                  <Notice tone="warning">
                    Còn nhiệm vụ chưa hoàn thành. GVHD cần xem xét trước khi
                    quyết định; hệ thống không tự kết luận đủ điều kiện học vụ.
                  </Notice>
                )}
              </>
            ) : (
              <Notice>
                {view.progressBlocker === "GUIDANCE_READ_PERMISSION_REQUIRED"
                  ? "Tài khoản chưa có quyền xem tiến độ hướng dẫn."
                  : "Chưa có kế hoạch hướng dẫn được ghi nhận. GVHD cần kiểm tra dữ liệu UC14–UC16 qua các liên kết trên."}
              </Notice>
            )}
          </Card>
          {mutation.error && (
            <Notice tone="danger">
              {issue(mutation.error)}{" "}
              <Button
                onClick={() => {
                  mutation.reset();
                  void detail.refetch();
                }}
              >
                Tải lại
              </Button>
            </Notice>
          )}
          {message && <Notice tone="success">{message}</Notice>}
          <Card title="PDF đồ án cuối">
            {view.writeWindow?.startAt && (
              <p>
                Lịch FINAL:{" "}
                {new Date(view.writeWindow.startAt).toLocaleString("vi-VN")} –{" "}
                {view.writeWindow.endAt
                  ? new Date(view.writeWindow.endAt).toLocaleString("vi-VN")
                  : "chưa có hạn kết thúc"}
                .
              </p>
            )}
            {!view.versions.length && (
              <p>
                Chưa có PDF cuối hợp lệ. Báo cáo tuần không thay thế PDF đồ án
                cuối.
              </p>
            )}
            <ul>
              {view.versions.map((v) => (
                <li key={v.id} className="flex justify-between gap-4 py-2">
                  <span>
                    Phiên bản {v.sequence} · {v.name} ·{" "}
                    {v.sizeBytes.toLocaleString()} byte ·{" "}
                    {new Date(v.submittedAt).toLocaleString("vi-VN")}
                  </span>
                  <Button
                    variant="secondary"
                    disabled={!view.permissions.download}
                    onClick={async () => {
                      setDownloadError("");
                      try {
                        const bytes = await api.download(proposalId, v.id),
                          url = URL.createObjectURL(bytes),
                          link = document.createElement("a");
                        link.href = url;
                        link.download = v.name;
                        link.click();
                        setTimeout(() => URL.revokeObjectURL(url), 30000);
                      } catch (e) {
                        setDownloadError(issue(e));
                      }
                    }}
                  >
                    Tải PDF
                  </Button>
                </li>
              ))}
            </ul>
            {downloadError && <Notice tone="danger">{downloadError}</Notice>}
            {!!view.versions.length && (
              <ActionBlockedNotice view={view} action="download" />
            )}
            {user?.roles.includes("STUDENT") && (
              <form
                className="mt-4 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  mutation.mutate({ action: "upload" });
                }}
              >
                <Field label="Chọn PDF cuối">
                  <input
                    aria-label="Chọn PDF cuối"
                    type="file"
                    accept="application/pdf,.pdf"
                    disabled={!view.permissions.upload || mutation.isPending}
                    onChange={(e) => {
                      setFile(e.target.files?.[0] ?? null);
                      uploadKey.current = crypto.randomUUID();
                      mutation.reset();
                    }}
                  />
                </Field>
                <ActionBlockedNotice
                  view={view}
                  action="upload"
                  pending={mutation.isPending}
                />
                {view.permissions.upload && !file && (
                  <p>Chọn PDF trước khi nộp phiên bản mới.</p>
                )}
                <Button
                  type="submit"
                  disabled={
                    !view.permissions.upload || !file || mutation.isPending
                  }
                >
                  Nộp phiên bản PDF mới
                </Button>
              </form>
            )}
          </Card>
          {view.summary && (
            <Card title="Đánh giá hướng dẫn đã lưu">
              <p>
                {view.summary.current
                  ? "Đánh giá cho PDF hiện hành"
                  : "Đánh giá cần được cập nhật theo hồ sơ hiện hành"}
              </p>
              {view.summary.score !== undefined && (
                <p>Điểm GVHD: {view.summary.score}/10</p>
              )}
              {view.summary.comment !== undefined && (
                <p className="whitespace-pre-wrap">{view.summary.comment}</p>
              )}
            </Card>
          )}
          {view.decision?.reason && <Notice>{view.decision.reason}</Notice>}
          {user?.roles.includes("LECTURER") && (
            <>
              <Card title="Nhận xét tổng kết và điểm GVHD">
                <AdvisorSummaryForm
                  key={`${view.proposalId}:${view.revision}`}
                  view={view}
                  pending={mutation.isPending}
                  submit={(body) =>
                    mutation.mutate({ action: "summary", body })
                  }
                />
              </Card>
              <Card title="Quyết định của GVHD">
                <AdvisorDecisionForm
                  key={`${view.proposalId}:${view.revision}`}
                  view={view}
                  pending={mutation.isPending}
                  submit={(body) => mutation.mutate({ action: "decide", body })}
                />
              </Card>
            </>
          )}
          {!!view.history.length && (
            <Card title="Lịch sử hồ sơ">
              <ul>
                {view.history.map((h) => (
                  <li key={h.id}>
                    {(
                      {
                        FINAL_PDF_STAGED: "Tiếp nhận yêu cầu nộp PDF",
                        FINAL_PDF_SUBMITTED: "Nộp phiên bản PDF mới",
                        ADVISOR_SUMMARY_RECORDED:
                          "Lưu nhận xét và điểm hướng dẫn",
                        ADVISOR_DEFENSE_DECIDED: "Lưu quyết định bảo vệ",
                      } as Record<string, string>
                    )[h.action] ?? "Cập nhật hồ sơ"}{" "}
                    · {new Date(h.at).toLocaleString("vi-VN")}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
