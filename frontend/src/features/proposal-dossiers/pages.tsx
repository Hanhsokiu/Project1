import { WorkflowHeading } from "../review-groups/workflow-heading";
import React, { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DOSSIER_TEMPLATE_VERSION,
  DossierFinalizeSchema,
  DossierReceiptSchema,
} from "@doan/shared";
import type { DossierView } from "@doan/shared";
import { dossierApi as api } from "./api";
import { proposalReviewApi } from "../proposal-reviews/api";
import { ReviewState, reviewStatusLabel } from "../proposal-reviews/components";
import { DossierSnapshotPreview, DossierStatus } from "./components";
import { getErrorMessage } from "../../shared/api/error-message";
const issue = (e: unknown) =>
  e ? getErrorMessage(e, "Không thể xử lý hồ sơ. Hãy thử lại.") : undefined;
function savePdf(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const readiness: Record<string, string> = {
  STUDENT_PROFILE_NOT_READY:
    "Bước 1–3 chưa cung cấp lớp/ngành đã xác nhận. Chưa thể chốt hồ sơ.",
  STATE_TRANSITION_INVALID: "Đề cương chưa ở trạng thái đủ điều kiện chốt.",
  TERM_003: "Giai đoạn chốt/tiếp nhận chưa mở hoặc đã khóa.",
  INPUT_NOT_READY: "Thiếu dữ liệu đã xác nhận từ bước 1–3.",
  APPROVAL_NOT_READY: "Chưa có kết luận duyệt hợp lệ cho phiên bản hiện hành.",
  ROUTING_MISMATCH:
    "Routing đã đổi sau vòng duyệt. Khoa cần đối soát trước khi chốt.",
  DOSSIER_LOCKED: "Hồ sơ đã chốt hoặc cần đối soát.",
  TOPIC_NOT_AGREED: "GVHD cần xác nhận lại đề tài theo phân công hiện hành.",
};
export function DossierListPage() {
  const [params, setParams] = useSearchParams(),
    termId = params.get("termId") ?? "",
    search = params.get("search") ?? "";
  const [page, setPage] = useState(1),
    [onlyApproved, setOnlyApproved] = useState(false);
  const terms = useQuery({
    queryKey: ["proposal-review-terms"],
    queryFn: proposalReviewApi.terms,
  });
  useEffect(() => {
    if (!termId && terms.data?.[0])
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.set("termId", terms.data![0].id);
          return next;
        },
        { replace: true },
      );
  }, [termId, terms.data, setParams]);
  useEffect(() => setPage(1), [search]);
  const list = useQuery({
    queryKey: ["dossier-list", termId, page, onlyApproved, search],
    queryFn: () =>
      proposalReviewApi.list(termId, {
        page,
        limit: 20,
        search,
        status: onlyApproved ? "APPROVED" : undefined,
      }),
    enabled: !!termId,
  });
  return (
    <>
      <WorkflowHeading path="/topic/dossier" />
      <section className="rg-panel mb-5 p-5 flex flex-wrap gap-5">
        <label>
          Đợt đồ án
          <select
            aria-label="Đợt hồ sơ"
            value={termId}
            onChange={(e) => {
              setParams({ termId: e.target.value });
              setPage(1);
            }}
            className="ml-3 rounded border p-2"
          >
            <option value="">Chọn đợt</option>
            {terms.data?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={onlyApproved}
            onChange={(e) => {
              setOnlyApproved(e.target.checked);
              setPage(1);
            }}
          />
          Chỉ đề cương đã được duyệt
        </label>
      </section>
      <ReviewState
        loading={terms.isLoading || (!!termId && list.isLoading)}
        error={issue(terms.error || list.error)}
        empty={!termId || !list.data?.data.length}
      >
        <div className="grid gap-4">
          {list.data?.data.map((p) => (
            <article
              key={p.id}
              className="rg-panel p-5 flex flex-wrap justify-between gap-4"
            >
              <div>
                <h2 className="font-semibold">{p.title}</h2>
                <p>
                  {p.studentName} · {p.studentCode} · {reviewStatusLabel(p.status)}
                </p>
              </div>
              <Link className="rg-table-action" to={`/topic/dossier/${p.id}`}>
                Xem hồ sơ chính thức
              </Link>
            </article>
          ))}
        </div>
      </ReviewState>
      {list.data && list.data.total > 0 && (
        <div className="mt-4 flex justify-between text-sm">
          <span>
            {list.data.total} hồ sơ · Trang {page}/{list.data.totalPages}
          </span>
          <div className="flex gap-4">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Trước
            </button>
            <button
              disabled={page >= list.data.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Sau
            </button>
          </div>
        </div>
      )}
    </>
  );
}
function DossierActions({
  d,
  onResult,
}: {
  d: DossierView;
  onResult: (d: DossierView) => void;
}) {
  const [note, setNote] = useState(""),
    [success, setSuccess] = useState("");
  const requestKeys = useRef(new Map<string, string>());
  const key = (action: string, input: unknown) => {
    const signature = action + JSON.stringify(input);
    if (!requestKeys.current.has(signature))
      requestKeys.current.set(signature, crypto.randomUUID());
    return requestKeys.current.get(signature)!;
  };
  const mutation = useMutation({
    mutationFn: async (
      action: "finalize" | "receive" | "download" | "preview",
    ) => {
      if (action === "preview") {
        if (!d.previewVersionId) throw Error("Chưa có phiên bản để xem trước.");
        savePdf(
          await api.preview(d.proposalId, d.previewVersionId),
          "de-cuong-xem-truoc-chua-chot.pdf",
        );
        return "Đã tải bản xem trước có watermark. Bản này không dùng nộp hồ sơ chính thức.";
      }
      if (action === "finalize") {
        const input = DossierFinalizeSchema.parse({
          expectedProposalRevision: d.proposalRevision,
          expectedDossierRevision: d.revision,
          approvedVersionId: d.submittedVersionId,
          templateVersion: DOSSIER_TEMPLATE_VERSION,
        });
        const result = await api.finalize(
          d.proposalId,
          input,
          key(action, input),
        );
        onResult(result);
        return "Đã chốt đúng phiên bản được duyệt. Chưa ghi nhận bản giấy.";
      }
      const f = d.currentFinalization;
      if (!f) throw Error("Hồ sơ chưa chốt.");
      if (action === "receive") {
        const input = DossierReceiptSchema.parse({
          expectedRevision: d.revision,
          finalizationId: f.id,
          note: note || undefined,
        });
        const result = await api.receive(
          d.proposalId,
          input,
          key(action, input),
        );
        onResult(result);
        return "Đã ghi nhận Khoa tiếp nhận bản giấy.";
      }
      if (!f.pdfGeneratedAt) {
        const input = { expectedRevision: d.revision, finalizationId: f.id };
        onResult(await api.generate(d.proposalId, input, key(action, input)));
      }
      savePdf(
        await api.download(d.proposalId, f.id),
        "de-cuong-chinh-thuc.pdf",
      );
      return "Đã tải PDF. Hãy in, xin đủ bốn chữ ký giấy và nộp Khoa. Việc tải không xác nhận đã ký/nộp.";
    },
    onSuccess: setSuccess,
  });
  return (
    <section className="rg-panel p-5 space-y-4">
      {d.previewVersionId && (
        <button
          className="rounded border px-4 py-2"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate("preview")}
        >
          Tải PDF xem trước (chưa chốt)
        </button>
      )}
      {d.allowedActions.includes("finalize") && (
        <div>
          <p className="mb-3 text-sm">
            Chốt phiên bản v{d.submittedVersionNumber}; nội dung in được lưu bất
            biến. Chốt không đồng nghĩa hồ sơ đã ký hoặc đã nộp giấy.
          </p>
          <button
            className="rounded bg-blue-700 px-4 py-2 text-white"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate("finalize")}
          >
            Chốt đề cương chính thức
          </button>
        </div>
      )}
      {d.allowedActions.includes("download") && (
        <button
          className="rounded border px-4 py-2"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate("download")}
        >
          Tải PDF để in và ký
        </button>
      )}
      {d.allowedActions.includes("receive") && (
        <div>
          <label className="block">
            Ghi chú tiếp nhận
            <textarea
              aria-label="Ghi chú tiếp nhận"
              maxLength={2000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="block w-full rounded border p-2 my-2"
            />
          </label>
          <p className="text-sm mb-3">
            Chỉ xác nhận sau khi Khoa thực tế đã nhận hồ sơ giấy. Không tạo chữ
            ký điện tử.
          </p>
          <button
            className="rounded bg-blue-700 px-4 py-2 text-white"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate("receive")}
          >
            Xác nhận đã nhận bản giấy
          </button>
        </div>
      )}
      {mutation.isPending && <p role="status">Đang xử lý hồ sơ…</p>}
      {mutation.error && (
        <p role="alert" className="text-red-700">
          {issue(mutation.error)}
        </p>
      )}
      {success && (
        <p role="status" className="text-green-700">
          {success}
        </p>
      )}
    </section>
  );
}
function FinalizationHistory({ d }: { d: DossierView }) {
  const download = useMutation({
    mutationFn: async (id: string) => {
      savePdf(
        await api.download(d.proposalId, id),
        `de-cuong-ban-chot-${id}.pdf`,
      );
    },
  });
  return (
    <section className="rg-panel p-5 space-y-4" aria-label="Các bản chốt">
      <h2 className="font-semibold">Các bản chốt chính thức</h2>
      {(d.finalizations ?? []).map((f) => (
        <article key={f.id} className="border rounded p-4 space-y-3">
          <h3>
            Bản chốt {f.sequence} · v{f.versionNumber} ·{" "}
            {f.supersededAt ? "Đã thay thế" : "Hiện hành"}
          </h3>
          <p>Chốt lúc {new Date(f.finalizedAt).toLocaleString("vi-VN")}</p>
          {f.supersededAt && (
            <p>
              Đã thay thế lúc {new Date(f.supersededAt).toLocaleString("vi-VN")}
              . Đây là chứng cứ của bản chốt cũ.
            </p>
          )}
          <p>
            Tiếp nhận bản giấy của bản chốt này:{" "}
            {f.receipt
              ? new Date(f.receipt.receivedAt).toLocaleString("vi-VN")
              : "Chưa ghi nhận"}
          </p>
          {f.receipt?.note && (
            <p className="break-words">Ghi chú: {f.receipt.note}</p>
          )}
          {f.snapshot ? (
            <details>
              <summary>Xem nội dung bản chốt {f.sequence}</summary>
              <DossierSnapshotPreview snapshot={f.snapshot} />
            </details>
          ) : (
            <p>Bản chốt cần đối soát dữ liệu in.</p>
          )}
          {f.canDownload && (
            <button
              className="rounded border px-4 py-2"
              disabled={download.isPending}
              onClick={() => download.mutate(f.id)}
            >
              Tải PDF bản chốt {f.sequence}
              {f.supersededAt ? " (đã thay thế)" : ""}
            </button>
          )}
        </article>
      ))}
      {download.error && <p role="alert">{issue(download.error)}</p>}
      {download.isSuccess && (
        <p role="status">Đã tải đúng PDF của bản chốt được chọn.</p>
      )}
    </section>
  );
}
export function DossierDetailPage() {
  const { proposalId = "" } = useParams(),
    client = useQueryClient();
  const query = useQuery({
    queryKey: ["proposal-dossier", proposalId],
    queryFn: () => api.detail(proposalId),
  });
  const d = query.data,
    snapshot = d?.currentFinalization?.snapshot ?? d?.previewSnapshot;
  return (
    <>
      <Link className="text-blue-700" to="/topic/dossier">
        ← Danh sách hồ sơ
      </Link>
      <h1 className="my-5">Hồ sơ đề cương chính thức</h1>
      <ReviewState loading={query.isLoading} error={issue(query.error)}>
        {d && (
          <div className="space-y-5">
            <h2>{d.title}</h2>
            <DossierStatus dossier={d} />
            {d.readiness.map((code) => (
              <p
                key={code}
                role="status"
                className="rounded border border-amber-200 bg-amber-50 p-4"
              >
                {readiness[code] ??
                  "Hồ sơ cần kiểm tra đầu vào trước khi chốt."}
              </p>
            ))}
            {snapshot && <DossierSnapshotPreview snapshot={snapshot} />}
            <DossierActions
              key={proposalId}
              d={d}
              onResult={(value) => {
                client.setQueryData(["proposal-dossier", proposalId], value);
                void client.invalidateQueries({ queryKey: ["dossier-list"] });
              }}
            />
            {!!d.finalizations?.length && (
              <FinalizationHistory key={"history-" + proposalId} d={d} />
            )}
            <button
              className="text-blue-700"
              onClick={() => void query.refetch()}
            >
              Tải lại trạng thái hồ sơ
            </button>
            <section className="rg-panel p-5">
              <h2 className="font-semibold">Lịch sử hồ sơ</h2>
              {d.history.length ? (
                d.history.map((h) => (
                  <p key={h.id} className="mt-2 text-sm">
                    {h.action} · {new Date(h.createdAt).toLocaleString("vi-VN")}{" "}
                    · {h.actorId}
                  </p>
                ))
              ) : (
                <p>Chưa có thao tác chốt hoặc tiếp nhận.</p>
              )}
            </section>
          </div>
        )}
      </ReviewState>
    </>
  );
}
