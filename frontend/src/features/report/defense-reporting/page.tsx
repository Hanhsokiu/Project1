import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { ReportFilterSchema } from "@doan/shared";
import type {
  ReportExportMetadata,
  ReportPreview,
  ReportRequest,
} from "@doan/shared";
import { AUTH_API } from "../../../shared/api/api-session";
import { useApiSession } from "../../../shared/hooks/use-api-session";
import { preferredWorkflowTerm } from "../../../shared/hooks/use-workflow-terms";
import {
  Button,
  Card,
  Field,
  Notice,
  PageHeader,
} from "../../../shared/components/kit";
import { eligibilityError } from "../../defense/eligibility/components";
import {
  reportingApi as api,
  reportingKeys as keys,
  saveReportBlob,
} from "./api";
import { ReportPreviewTable, ReportStatisticsPanel } from "./components";
export function DefenseReportsPage() {
  return AUTH_API ? (
    <Content />
  ) : (
    <Notice>Báo cáo bảo vệ cần API và tài khoản của hệ thống nhóm.</Notice>
  );
}
function filterDate(raw: string | null) {
  if (!raw || Number.isNaN(Date.parse(raw))) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(raw));
}
function Content() {
  const user = useApiSession(),
    actor = user?.id ?? "",
    identity = JSON.stringify([
      actor,
      user?.roles.slice().sort(),
      user?.permissions?.slice().sort(),
    ]),
    client = useQueryClient(),
    [params, setParams] = useSearchParams(),
    term = params.get("termId") ?? "",
    tab = params.get("tab") ?? "XLSX",
    [selected, setSelected] = useState(""),
    [mode, setMode] = useState<"DRAFT" | "OFFICIAL">("DRAFT"),
    [preview, setPreview] = useState<{
      scope: string;
      data: ReportPreview;
    } | null>(null),
    [generated, setGenerated] = useState<{
      scope: string;
      data: ReportExportMetadata;
    } | null>(null),
    [message, setMessage] = useState<{ scope: string; text: string } | null>(
      null,
    ),
    allowed =
      !!user &&
      user.roles.some((r) => r === "FACULTY" || r === "LECTURER") &&
      !!user.permissions?.includes("defense-report:read"),
    scope = JSON.stringify([identity, params.toString(), selected, mode]),
    live = useRef(scope),
    retries = useRef(new Map<string, string>());
  live.current = scope;
  const parsed = ReportFilterSchema.safeParse({
      termId: term,
      committeeId: params.get("committeeId") || undefined,
      departmentId: params.get("departmentId") || undefined,
      className: params.get("className") || undefined,
      termStudentId: params.get("termStudentId") || undefined,
      lecturerId: params.get("lecturerId") || undefined,
      state: params.get("state") || undefined,
      from: params.get("from") || undefined,
      to: params.get("to") || undefined,
    }),
    f = parsed.success ? parsed.data : null;
  const optionFilters = f ?? {},
    options = useQuery({
      queryKey: keys.options(identity, optionFilters),
      queryFn: () => api.options(optionFilters),
      enabled: allowed,
    });
  useEffect(() => {
    if (!term && options.data?.terms.length)
      setParams(
        { termId: preferredWorkflowTerm(options.data.terms)!.id },
        { replace: true },
      );
  }, [term, options.data, setParams]);
  const memberReady =
      !user?.roles.includes("LECTURER") ||
      user.roles.includes("FACULTY") ||
      !!f?.committeeId,
    templates = useQuery({
      queryKey: f
        ? keys.templates(identity, f)
        : ["report-no-template", identity],
      queryFn: () => api.templates(f!),
      enabled:
        allowed &&
        !!f &&
        memberReady &&
        !!user?.permissions?.includes("defense-report:templates-read"),
    }),
    statistics = useQuery({
      queryKey: f
        ? keys.statistics(identity, f)
        : ["report-no-statistics", identity],
      queryFn: () => api.statistics(f!),
      enabled:
        allowed &&
        !!f &&
        memberReady &&
        tab === "STATISTICS" &&
        !!user?.permissions?.includes("defense-report:statistics"),
    }),
    history = useQuery({
      queryKey: f ? keys.history(identity, f) : ["report-no-history", identity],
      queryFn: () => api.history(f!),
      enabled:
        allowed &&
        !!f &&
        memberReady &&
        !!user?.permissions?.includes("defense-report:history-read"),
    });
  const visibleTemplates =
      templates.data?.templates.filter((t) => t.format === tab) ?? [],
    template =
      visibleTemplates.find((t) => t.code === selected) ?? visibleTemplates[0],
    request: ReportRequest | null =
      f && template
        ? {
            filters: f,
            templateCode: template.code,
            templateVersion: template.version,
            mode,
          }
        : null;
  const key = (kind: string, body: unknown) => {
    const id = JSON.stringify([scope, kind, body]);
    if (!retries.current.has(id)) retries.current.set(id, crypto.randomUUID());
    return retries.current.get(id)!;
  };
  const inspect = useMutation({
      mutationFn: async (origin: string) => {
        if (origin !== live.current || !request)
          throw Error("Phạm vi đã thay đổi.");
        return api.preview(request);
      },
      onSuccess: (data, origin) => {
        if (origin === live.current) {
          setPreview({ scope: origin, data });
          setGenerated(null);
        }
      },
    }),
    create = useMutation({
      mutationFn: async (origin: string) => {
        if (
          origin !== live.current ||
          !request ||
          preview?.scope !== origin ||
          !preview.data.canExport
        )
          throw Error("Cần xem trước dữ liệu hiện hành.");
        const body = {
          ...request,
          expectedSnapshotHash: preview.data.snapshotHash,
        };
        return api.create(body, key("create", body));
      },
      onSuccess: async (data, origin) => {
        if (origin === live.current) {
          setGenerated({ scope: origin, data });
          setMessage({
            scope: origin,
            text: "Server đã tạo bản xuất. File chưa được coi là đã tải hoặc đã ký.",
          });
        }
        await client.invalidateQueries({
          queryKey: ["defense-report-history", identity],
        });
      },
    }),
    download = useMutation({
      mutationFn: async (v: {
        id: string;
        filename: string;
        origin: string;
      }) => {
        if (v.origin !== live.current) throw Error("Phạm vi đã thay đổi.");
        const blob = await api.download(v.id, key("download", v.id));
        if (v.origin !== live.current)
          throw Error("Tài khoản/bộ lọc đã đổi; không phát hành file cũ.");
        saveReportBlob(blob, v.filename);
      },
      onSuccess: (_, v) => {
        if (v.origin === live.current)
          setMessage({
            scope: v.origin,
            text: "Đã nhận file và gửi yêu cầu lưu tới trình duyệt. Hệ thống chưa xác nhận file đã được lưu trên máy.",
          });
      },
    });
  const busy = inspect.isPending || create.isPending || download.isPending,
    validPreview = preview?.scope === scope ? preview.data : null;
  useEffect(() => {
    setPreview(null);
    setGenerated(null);
    setMessage(null);
  }, [scope]);
  const update = (name: string, value: string) => {
    const next = new URLSearchParams(params);
    value ? next.set(name, value) : next.delete(name);
    if (name === "termId") {
      next.delete("committeeId");
      next.delete("departmentId");
      next.delete("className");
      next.delete("termStudentId");
    }
    setParams(next);
  };
  if (!allowed)
    return (
      <Notice>
        Bạn chưa có quyền báo cáo học vụ. ADMIN và sinh viên không được xuất
        bảng điểm hội đồng.
      </Notice>
    );
  return (
    <>
      <PageHeader
        title="Báo cáo và biểu mẫu bảo vệ"
        description="Dữ liệu thật trong phạm vi được cấp quyền; mẫu DRAFT và bản xuất chưa ký được phân biệt rõ."
      />
      <div className="flex gap-2">
        {[
          ["XLSX", "Xuất Excel"],
          ["PDF", "PDF / biểu mẫu"],
          ["STATISTICS", "Thống kê"],
        ].map(([value, label]) => (
          <Button
            key={value}
            onClick={() => {
              setSelected("");
              update("tab", value);
            }}
          >
            {label}
          </Button>
        ))}
      </div>
      <Card>
        <Field label="Đợt đồ án">
          <select
            value={term}
            onChange={(e) => update("termId", e.target.value)}
          >
            <option value="">Chọn đợt</option>
            {options.data?.terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.code} — {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Hội đồng">
          <select
            value={params.get("committeeId") ?? ""}
            onChange={(e) => update("committeeId", e.target.value)}
          >
            <option value="">Toàn phạm vi được cấp quyền</option>
            {options.data?.committees
              .filter((c) => c.termId === term)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code ?? c.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Bộ môn">
          <select
            value={params.get("departmentId") ?? ""}
            onChange={(e) => update("departmentId", e.target.value)}
          >
            <option value="">Tất cả trong scope</option>
            {options.data?.departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Lớp">
          <select
            value={params.get("className") ?? ""}
            onChange={(e) => update("className", e.target.value)}
          >
            <option value="">Tất cả lớp</option>
            {options.data?.classes.map((c) => (
              <option key={c} value={c}>
                {c || "Chưa xác minh lớp"}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Sinh viên (phiếu cá nhân/đề cương)">
          <select
            value={params.get("termStudentId") ?? ""}
            onChange={(e) => update("termStudentId", e.target.value)}
          >
            <option value="">Tất cả trong phạm vi</option>
            {options.data?.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.code} — {m.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Ngày bảo vệ từ (giờ Việt Nam)">
          <input
            type="date"
            value={filterDate(params.get("from"))}
            onChange={(e) =>
              update(
                "from",
                e.target.value
                  ? new Date(e.target.value + "T00:00:00+07:00").toISOString()
                  : "",
              )
            }
          />
        </Field>
        <Field label="Trước ngày bảo vệ (giờ Việt Nam)">
          <input
            type="date"
            value={filterDate(params.get("to"))}
            onChange={(e) =>
              update(
                "to",
                e.target.value
                  ? new Date(e.target.value + "T00:00:00+07:00").toISOString()
                  : "",
              )
            }
          />
        </Field>
        <Field label="Trạng thái kết quả">
          <select
            value={params.get("state") ?? ""}
            onChange={(e) => update("state", e.target.value)}
          >
            <option value="">Tất cả</option>
            <option value="FINALIZED">Đã chốt, chưa công bố</option>
            <option value="PUBLISHED">Đã công bố</option>
            <option value="STALE">Nguồn stale</option>
            <option value="MISSING">Thiếu kết quả</option>
          </select>
        </Field>
      </Card>
      {(options.isLoading ||
        templates.isLoading ||
        (statistics.isLoading && tab === "STATISTICS")) && (
        <Notice>Đang tải báo cáo…</Notice>
      )}
      {[
        options.error,
        templates.error,
        statistics.error,
        history.error,
        inspect.error,
        create.error,
        download.error,
      ]
        .filter(Boolean)
        .map((e, i) => (
          <Notice key={i}>{eligibilityError(e)}</Notice>
        ))}
      <Button
        disabled={busy}
        onClick={() => {
          void options.refetch();
          if (f && memberReady) {
            void templates.refetch();
            if (tab === "STATISTICS") void statistics.refetch();
            void history.refetch();
          }
        }}
      >
        Tải lại
      </Button>
      {!memberReady && (
        <Notice>Thành viên hội đồng cần chọn hội đồng của mình.</Notice>
      )}
      {term && !f && <Notice>Bộ lọc chưa hợp lệ.</Notice>}
      {tab === "STATISTICS" ? (
        statistics.data ? (
          <ReportStatisticsPanel statistics={statistics.data} />
        ) : (
          <Notice>
            Chọn phạm vi và cần quyền xem thống kê tương ứng; không có dữ liệu
            giả thay thế.
          </Notice>
        )
      ) : (
        <>
          <Card>
            <Field label="Biểu mẫu và phiên bản">
              <select
                value={template?.code ?? ""}
                onChange={(e) => setSelected(e.target.value)}
              >
                <option value="">Chọn mẫu</option>
                {visibleTemplates.map((t) => (
                  <option key={t.code + t.version} value={t.code}>
                    {t.name} — {t.version} —{" "}
                    {t.status === "APPROVED" ? "Đã duyệt" : "Chưa phê duyệt"}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Mục đích sử dụng">
              <select
                value={mode}
                onChange={(e) =>
                  setMode(e.target.value as "DRAFT" | "OFFICIAL")
                }
              >
                <option value="DRAFT">DRAFT — chưa chính thức</option>
                <option value="OFFICIAL">
                  Bản theo mẫu được duyệt — chưa ký
                </option>
              </select>
            </Field>
            {template && (
              <p>
                {template.status === "APPROVED"
                  ? "Mẫu đã có thông tin phê duyệt; dữ liệu vẫn phải được xác minh trước khi xuất."
                  : "Mẫu kỹ thuật chưa được Khoa phê duyệt. Không dùng nộp hồ sơ chính thức."}
              </p>
            )}
            <Button
              disabled={
                busy ||
                !request ||
                !memberReady ||
                !user?.permissions?.includes("defense-report:preview")
              }
              onClick={() => inspect.mutate(scope)}
            >
              Xem trước
            </Button>
            <Button
              disabled={
                busy ||
                !validPreview?.canExport ||
                !user?.permissions?.includes("defense-report:export")
              }
              onClick={() => create.mutate(scope)}
            >
              {create.isPending ? "Đang tạo file…" : "Tạo bản xuất"}
            </Button>
            {!validPreview && (
              <p>Cần xem trước để kiểm tra số dòng và lý do chặn xuất.</p>
            )}
          </Card>
          {validPreview && <ReportPreviewTable preview={validPreview} />}
          {generated?.scope === scope && (
            <Card>
              <p>
                Đã tạo {generated.data.filename}, {generated.data.count} dòng,
                chưa ký.
              </p>
              <Button
                disabled={
                  busy ||
                  !user?.permissions?.includes("defense-report:download")
                }
                onClick={() =>
                  download.mutate({
                    id: generated.data.id,
                    filename: generated.data.filename,
                    origin: scope,
                  })
                }
              >
                Tải file
              </Button>
            </Card>
          )}
        </>
      )}
      {message?.scope === scope && <Notice>{message.text}</Notice>}
      {history.data && (
        <Card>
          <h2>Lịch sử bản xuất của tôi</h2>
          {!history.data.length && <p>Chưa có bản xuất trong phạm vi này.</p>}
          {history.data.map((h) => (
            <div key={h.id} className="py-2">
              <p>
                {h.templateCode} — {h.templateVersion} — {h.mode} —{" "}
                {h.createdAt} — {h.count} dòng —{" "}
                {h.status === "GENERATED"
                  ? "Đã tạo, chưa xác nhận tải"
                  : "Tạo thất bại"}
              </p>
              <Button
                disabled={
                  busy ||
                  h.status !== "GENERATED" ||
                  !user?.permissions?.includes("defense-report:download")
                }
                onClick={() =>
                  download.mutate({
                    id: h.id,
                    filename: `uc25-${h.templateCode}-${h.id}.${h.templateCode.startsWith("XLSX_") ? "xlsx" : "pdf"}`,
                    origin: scope,
                  })
                }
              >
                Tải lại sau khi kiểm tra quyền và nguồn
              </Button>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
