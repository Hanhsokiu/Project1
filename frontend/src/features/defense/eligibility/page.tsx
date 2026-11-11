import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { EligibilityQuerySchema } from "@doan/shared";
import type {
  EligibilityDecision,
  EligibilityReview,
  EligibilityView,
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
import { eligibilityApi as api } from "./api";
import {
  EligibilityCommandForm,
  EligibilityEvidence,
  EligibilityRows,
  eligibilityError,
  eligibilityLabels,
} from "./components";

export function EligibilityPage() {
  return AUTH_API ? (
    <EligibilityContent />
  ) : (
    <Notice>
      Xét điều kiện bảo vệ cần API và tài khoản của hệ thống nhóm.
    </Notice>
  );
}
function EligibilityContent() {
  const user = useApiSession(),
    client = useQueryClient(),
    [params, setParams] = useSearchParams();
  const termId = params.get("termId") ?? "",
    requested = params.get("termStudentId") ?? "";
  const parsed = EligibilityQuerySchema.safeParse({
    termId,
    page: params.get("page") ?? 1,
    limit: 20,
    search: params.get("search") ?? "",
    preview: params.get("preview") || undefined,
    official: params.get("official") || undefined,
  });
  const query = parsed.success ? parsed.data : null;
  const [chosen, setChosen] = useState<EligibilityView[]>([]),
    [message, setMessage] = useState("");
  const keys = useRef(new Map<string, string>());
  const key = (action: string, body: unknown) => {
    const identity = JSON.stringify([
      user?.id,
      termId,
      requested,
      action,
      body,
    ]);
    if (!keys.current.has(identity))
      keys.current.set(identity, crypto.randomUUID());
    return keys.current.get(identity)!;
  };
  const terms = useQuery({
    queryKey: ["eligibility-terms", user?.id],
    queryFn: api.terms,
    enabled: !!user,
  });
  useEffect(() => {
    if (!termId && terms.data?.length)
      setParams(
        { termId: preferredWorkflowTerm(terms.data)!.id },
        { replace: true },
      );
  }, [termId, terms.data, setParams]);
  useEffect(() => {
    setChosen([]);
    setMessage("");
  }, [termId, user?.id]);
  const list = useQuery({
    queryKey: ["eligibility-list", user?.id, query],
    queryFn: () => api.list(query!),
    enabled: !!user && !!query,
  });
  const detail = useQuery({
    queryKey: ["eligibility-detail", user?.id, termId, requested],
    queryFn: () => api.detail(requested, termId),
    enabled: !!user && !!requested && !!query,
  });
  const mutation = useMutation({
    mutationFn: async (
      command:
        | {
            action: "review" | "decide";
            body: EligibilityReview | EligibilityDecision;
          }
        | { action: "finalize"; reason: string },
    ) => {
      if (command.action === "finalize") {
        if (!chosen.length || chosen.some((v) => v.termId !== termId))
          throw new Error("Chọn hồ sơ đúng đợt.");
        const body = {
          termId,
          reason: command.reason,
          members: chosen.map((v) => ({
            termStudentId: v.termStudentId,
            expectedRevision: v.revision,
            evidenceHash: v.evidenceHash,
          })),
        };
        return api.finalize(body, key("finalize", body));
      }
      if (
        !detail.data ||
        detail.data.termId !== termId ||
        detail.data.termStudentId !== requested
      )
        throw new Error("Tải lại đúng hồ sơ.");
      return command.action === "review"
        ? api.review(
            requested,
            command.body as EligibilityReview,
            key("review", command.body),
          )
        : api.decide(
            requested,
            command.body as EligibilityDecision,
            key("decide", command.body),
          );
    },
    onMutate: () => setMessage(""),
    onSuccess: async () => {
      setMessage("Đã lưu thao tác của Khoa trên hệ thống.");
      setChosen([]);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["eligibility-list"] }),
        client.invalidateQueries({ queryKey: ["eligibility-detail"] }),
      ]);
    },
  });
  const view =
    detail.data?.termId === termId && detail.data.termStudentId === requested
      ? detail.data
      : undefined;
  const update = (name: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    next.delete("page");
    next.delete("termStudentId");
    setChosen([]);
    setMessage("");
    setParams(next);
  };
  return (
    <div className="space-y-6">
      <PageHeader
        title="Xét điều kiện bảo vệ"
        description="Kiểm tra chứng cứ, quyết định của Khoa và chốt danh sách là các bước riêng."
      />
      {terms.isLoading && <Notice>Đang tải đợt…</Notice>}
      {terms.error && <Notice>{eligibilityError(terms.error)}</Notice>}
      <Card>
        <Field label="Đợt đồ án">
          <select
            value={termId}
            onChange={(e) => update("termId", e.target.value)}
          >
            <option value="">Chọn đợt</option>
            {terms.data?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.code} — {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tìm mã sinh viên, họ tên, đề tài">
          <input
            value={params.get("search") ?? ""}
            onChange={(e) => update("search", e.target.value)}
            maxLength={200}
          />
        </Field>
        <Field label="Kết quả kiểm tra">
          <select
            value={params.get("preview") ?? ""}
            onChange={(e) => update("preview", e.target.value)}
          >
            <option value="">Tất cả</option>
            {[
              "QUALIFIED",
              "NEGATIVE",
              "PENDING",
              "MISSING",
              "STALE",
              "UNVERIFIED",
            ].map((s) => (
              <option key={s} value={s}>
                {eligibilityLabels[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Trạng thái Khoa">
          <select
            value={params.get("official") ?? ""}
            onChange={(e) => update("official", e.target.value)}
          >
            <option value="">Tất cả</option>
            {[
              "NONE",
              "REVIEWED",
              "DECIDED",
              "FINALIZED",
              "STALE",
              "LEGACY_UNVERIFIED",
            ].map((s) => (
              <option key={s} value={s}>
                {eligibilityLabels[s]}
              </option>
            ))}
          </select>
        </Field>
      </Card>
      {!!termId && !query && <Notice>Bộ lọc không hợp lệ.</Notice>}
      {list.isLoading && <Notice>Đang tải hồ sơ…</Notice>}
      {list.error && <Notice>{eligibilityError(list.error)}</Notice>}
      {list.data && (
        <Card>
          <EligibilityRows
            items={list.data.items}
            chosen={chosen.map((v) => v.termStudentId)}
            select={(v) => {
              const next = new URLSearchParams(params);
              next.set("termStudentId", v.termStudentId);
              setMessage("");
              setParams(next);
            }}
            toggle={(v) =>
              setChosen((prev) =>
                prev.some((i) => i.termStudentId === v.termStudentId)
                  ? prev.filter((i) => i.termStudentId !== v.termStudentId)
                  : [...prev, v],
              )
            }
          />
          <p>
            {list.data.total} hồ sơ · Trang {list.data.page}
          </p>
          <Button
            variant="secondary"
            disabled={list.data.page <= 1}
            onClick={() => {
              const next = new URLSearchParams(params);
              next.set("page", String(list.data.page - 1));
              setParams(next);
            }}
          >
            Trước
          </Button>
          <Button
            variant="secondary"
            disabled={list.data.page * list.data.limit >= list.data.total}
            onClick={() => {
              const next = new URLSearchParams(params);
              next.set("page", String(list.data.page + 1));
              setParams(next);
            }}
          >
            Sau
          </Button>
        </Card>
      )}
      {user?.roles.includes("FACULTY") && (
        <Card title={`Chốt các hồ sơ được chọn (${chosen.length})`}>
          <p>
            Chỉ chốt nhóm được chọn trong phạm vi được cấp quyền; thao tác này
            không khóa toàn đợt.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate({
                action: "finalize",
                reason: String(
                  new FormData(e.currentTarget).get("reason") ?? "",
                ),
              });
            }}
          >
            <Field label="Lý do chốt danh sách">
              <textarea name="reason" required maxLength={4000} />
            </Field>
            <Button
              type="submit"
              disabled={
                mutation.isPending ||
                !chosen.length ||
                !user.permissions?.includes("defense-eligibility:finalize")
              }
            >
              Chốt danh sách được chọn
            </Button>
          </form>
          {!chosen.length && (
            <Notice>
              Chọn hồ sơ có quyết định đủ điều kiện, chứng cứ hiện hành và quyền
              chốt.
            </Notice>
          )}
        </Card>
      )}
      {detail.isLoading && requested && <Notice>Đang tải chứng cứ…</Notice>}
      {detail.error && <Notice>{eligibilityError(detail.error)}</Notice>}
      {view && (
        <>
          <EligibilityEvidence view={view} />
          {view.proposalId &&
            user?.permissions?.includes("final-report:read") &&
            user.permissions.includes("defense-confirmation:read") && (
              <Link
                to={`/guidance/final-report?termId=${encodeURIComponent(view.termId)}&proposalId=${encodeURIComponent(view.proposalId)}`}
              >
                Xem và tải PDF qua hồ sơ cuối
              </Link>
            )}
          {user?.roles.includes("FACULTY") && (
            <EligibilityCommandForm
              key={`${view.termStudentId}:${view.revision}`}
              view={view}
              pending={mutation.isPending}
              submit={(action, body) => mutation.mutate({ action, body })}
            />
          )}
        </>
      )}
      {mutation.error && <Notice>{eligibilityError(mutation.error)}</Notice>}
      {message && <Notice>{message}</Notice>}
    </div>
  );
}
