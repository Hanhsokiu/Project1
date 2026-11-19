import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { FinalResultQuerySchema } from "@doan/shared";
import type { FinalResultCommand } from "@doan/shared";
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
import { eligibilityError } from "../eligibility/components";
import { finalResultApi as api, finalResultKeys as keys } from "./api";
import { FinalResultRows, FinalResultDetail, resultStates } from "./components";
export function FinalResultPage() {
  return AUTH_API ? (
    <Content />
  ) : (
    <Notice>Kết quả bảo vệ cần API và tài khoản của hệ thống nhóm.</Notice>
  );
}
function Content() {
  const u = useApiSession(),
    actor = u?.id ?? "",
    client = useQueryClient(),
    [params, setParams] = useSearchParams(),
    term = params.get("termId") ?? "",
    member = params.get("termStudentId") ?? "",
    [message, setMessage] = useState<{ scope: string; text: string } | null>(
      null,
    ),
    allowed =
      !!u &&
      u.roles.some((r) => ["FACULTY", "LECTURER", "STUDENT"].includes(r)) &&
      !!u.permissions?.includes("defense-result:read"),
    scope = JSON.stringify([actor, term, member]),
    live = useRef(scope),
    idempotency = useRef(new Map<string, string>());
  live.current = scope;
  const parsed = FinalResultQuerySchema.safeParse({
      termId: term,
      committeeId: params.get("committeeId") || undefined,
      state: params.get("state") || undefined,
      search: params.get("search") ?? "",
      page: params.get("page") ?? 1,
      limit: 20,
    }),
    q = parsed.success ? parsed.data : null;
  const options = useQuery({
    queryKey: keys.options(actor),
    queryFn: api.options,
    enabled: allowed,
  });
  useEffect(() => {
    if (!term && options.data?.terms.length)
      setParams(
        { termId: preferredWorkflowTerm(options.data.terms)!.id },
        { replace: true },
      );
  }, [term, options.data, setParams]);
  const list = useQuery({
      queryKey: q ? keys.list(actor, q) : ["final-result-invalid", actor, term],
      queryFn: () => api.list(q!),
      enabled: allowed && !!q,
    }),
    detail = useQuery({
      queryKey: keys.detail(actor, term, member),
      queryFn: () => api.detail(member, term),
      enabled: allowed && !!q && !!member,
    });
  const mutation = useMutation({
    mutationFn: async (v: {
      action: "preview" | "confirm" | "finalize" | "publish";
      origin: string;
      body?: FinalResultCommand;
    }) => {
      if (
        v.origin !== live.current ||
        !detail.data ||
        detail.data.termId !== term ||
        detail.data.termStudentId !== member
      )
        throw Error("Tài khoản/đợt/hồ sơ đã thay đổi; tải lại.");
      if (v.action === "preview")
        return { preview: await api.preview(member, term) };
      const identity = JSON.stringify([v.origin, v.action, v.body]);
      if (!idempotency.current.has(identity))
        idempotency.current.set(identity, crypto.randomUUID());
      await api.command(
        member,
        v.action,
        v.body!,
        idempotency.current.get(identity)!,
      );
      return { preview: null };
    },
    onSuccess: async (result, v) => {
      if (v.origin !== live.current) return;
      if (result.preview)
        client.setQueryData(keys.detail(actor, term, member), result.preview);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["final-result-list", actor] }),
        client.invalidateQueries({ queryKey: ["final-result-detail", actor] }),
      ]);
      if (v.origin === live.current)
        setMessage({
          scope: v.origin,
          text:
            v.action === "preview"
              ? "Đã kiểm tra lại dữ liệu; tính thử chưa phải chốt."
              : "Thao tác đã được backend lưu thành công.",
        });
    },
  });
  const reset = mutation.reset;
  useEffect(() => {
    reset();
    setMessage(null);
  }, [scope, reset]);
  const update = (key: string, value: string) => {
    const n = new URLSearchParams(params);
    value ? n.set(key, value) : n.delete(key);
    if (key !== "page") n.delete("page");
    if (key === "termId") n.delete("committeeId");
    n.delete("termStudentId");
    setParams(n);
  };
  if (!allowed) return <Notice>Bạn chưa có quyền xem kết quả bảo vệ.</Notice>;
  return (
    <>
      <PageHeader
        title="Kết quả bảo vệ"
        description="Tổng hợp, xác nhận, chốt và công bố theo quy định được duyệt."
      />
      {(options.isLoading || list.isLoading) && (
        <Notice>Đang tải kết quả…</Notice>
      )}
      {[options.error, list.error, detail.error, mutation.error]
        .filter(Boolean)
        .map((e, i) => (
          <Notice key={i}>{eligibilityError(e)}</Notice>
        ))}
      <Button
        type="button"
        disabled={list.isFetching || detail.isFetching}
        onClick={() => {
          void options.refetch();
          void list.refetch();
          if (member) void detail.refetch();
        }}
      >
        Tải lại
      </Button>
      {options.data && (
        <Card>
          <Field label="Đợt đồ án">
            <select
              value={term}
              onChange={(e) => update("termId", e.target.value)}
            >
              <option value="">Chọn đợt</option>
              {options.data.terms.map((t) => (
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
              <option value="">Tất cả trong phạm vi</option>
              {options.data.committees
                .filter((c) => c.termId === term)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code ?? c.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Tìm sinh viên">
            <input
              value={params.get("search") ?? ""}
              onChange={(e) => update("search", e.target.value)}
            />
          </Field>
          <Field label="Trạng thái">
            <select
              value={params.get("state") ?? ""}
              onChange={(e) => update("state", e.target.value)}
            >
              <option value="">Tất cả</option>
              {Object.entries(resultStates).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </Card>
      )}
      {!term && !options.isLoading && <Notice>Chọn đợt để xem kết quả.</Notice>}
      {term && !q && <Notice>Bộ lọc không hợp lệ.</Notice>}
      {q && list.data && (
        <>
          <FinalResultRows
            items={list.data.items}
            select={(v) => {
              const n = new URLSearchParams(params);
              n.set("termStudentId", v.termStudentId);
              setParams(n);
            }}
          />
          <p>
            {list.data.total} hồ sơ — trang {q.page}
          </p>
          <Button
            disabled={q.page <= 1}
            onClick={() => update("page", String(q.page - 1))}
          >
            Trước
          </Button>
          <Button
            disabled={q.page * q.limit >= list.data.total}
            onClick={() => update("page", String(q.page + 1))}
          >
            Sau
          </Button>
        </>
      )}
      {member && detail.isLoading && <Notice>Đang tải chi tiết…</Notice>}
      {message?.scope === scope && <Notice>{message.text}</Notice>}
      {detail.data &&
        detail.data.termId === term &&
        detail.data.termStudentId === member && (
          <FinalResultDetail
            key={scope + detail.data.revision}
            value={detail.data}
            pending={mutation.isPending}
            preview={() =>
              mutation.mutate({ action: "preview", origin: scope })
            }
            command={(action, body) =>
              mutation.mutate({ action, body, origin: scope })
            }
          />
        )}
    </>
  );
}
