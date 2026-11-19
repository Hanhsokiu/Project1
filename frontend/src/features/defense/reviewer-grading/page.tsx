import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { ReviewerGradeQuerySchema } from "@doan/shared";
import type { ReviewerGradeCommand } from "@doan/shared";
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
import {
  reviewerGradeApi as api,
  reviewerGradeKeys as keys,
  saveReviewerPdf,
} from "./api";
import {
  gradeLabels,
  ReviewerGradeEditor,
  ReviewerGradeRows,
} from "./components";
export function ReviewerGradePage() {
  return AUTH_API ? (
    <ReviewerGradeContent />
  ) : (
    <Notice>
      Chấm phản biện cần API và tài khoản giảng viên của hệ thống nhóm.
    </Notice>
  );
}
function ReviewerGradeContent() {
  const u = useApiSession(),
    client = useQueryClient(),
    [params, setParams] = useSearchParams(),
    actor = u?.id ?? "",
    term = params.get("termId") ?? "",
    member = params.get("termStudentId") ?? "",
    reviewer = params.get("reviewerId") ?? "";
  const allowed =
    !!u &&
    u.roles.some((r) => r === "LECTURER" || r === "FACULTY") &&
    !!u.permissions?.includes("defense-reviewer-grade:read");
  const scope = JSON.stringify([actor, term, member, reviewer]),
    live = useRef(scope);
  live.current = scope;
  const [notice, setNotice] = useState<{ scope: string; text: string } | null>(
      null,
    ),
    keyMap = useRef(new Map<string, string>());
  const parsed = ReviewerGradeQuerySchema.safeParse({
      termId: term,
      search: params.get("search") ?? "",
      state: params.get("state") || undefined,
      page: params.get("page") ?? 1,
      limit: 20,
    }),
    q = parsed.success ? parsed.data : null;
  const terms = useQuery({
    queryKey: keys.terms(actor),
    queryFn: api.terms,
    enabled: allowed,
  });
  useEffect(() => {
    if (!term && terms.data?.length)
      setParams(
        { termId: preferredWorkflowTerm(terms.data)!.id },
        { replace: true },
      );
  }, [term, terms.data, setParams]);
  const list = useQuery({
    queryKey: q ? keys.list(actor, q) : ["reviewer-grade-invalid", actor, term],
    queryFn: () => api.list(q!),
    enabled: allowed && !!q,
  });
  const detail = useQuery({
    queryKey: keys.detail(actor, term, member, reviewer),
    queryFn: () => api.detail(member, term, reviewer || undefined),
    enabled: allowed && !!q && !!member,
  });
  const mutation = useMutation({
    mutationFn: async ({
      action,
      body,
      origin,
    }: {
      action: "save" | "finalize";
      body: ReviewerGradeCommand;
      origin: string;
    }) => {
      if (
        origin !== live.current ||
        !detail.data ||
        detail.data.termStudentId !== member ||
        detail.data.termId !== term
      )
        throw Error("Tài khoản hoặc hồ sơ đã đổi; tải lại.");
      const identity = JSON.stringify([origin, action, body]);
      if (!keyMap.current.has(identity))
        keyMap.current.set(identity, crypto.randomUUID());
      return api.command(member, action, body, keyMap.current.get(identity)!);
    },
    onSuccess: async (_, v) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["reviewer-grade-list", actor] }),
        client.invalidateQueries({
          queryKey: ["reviewer-grade-detail", actor],
        }),
      ]);
      if (v.origin === live.current)
        setNotice({
          scope: v.origin,
          text: "Đã lưu phiếu phản biện trên hệ thống.",
        });
    },
  });
  const resetMutation = mutation.reset;
  useEffect(() => {
    setNotice(null);
    resetMutation();
  }, [scope, resetMutation]);
  const update = (name: string, value: string) => {
    const next = new URLSearchParams(params);
    value ? next.set(name, value) : next.delete(name);
    if (name !== "page") next.delete("page");
    next.delete("termStudentId");
    next.delete("reviewerId");
    setParams(next);
  };
  if (!allowed)
    return (
      <Notice>
        Không có quyền xem/chấm phản biện. Sinh viên chưa được công bố điểm hoặc
        nhận xét.
      </Notice>
    );
  const view =
    detail.data?.termId === term &&
    detail.data.termStudentId === member &&
    (!reviewer || detail.data.reviewerId === reviewer)
      ? detail.data
      : null;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Nhận xét và chấm điểm phản biện"
        description="Phiếu riêng của GVPB; nguồn phân công và PDF được kiểm tra lại khi lưu."
      />
      <Card>
        <Field label="Đợt đồ án">
          <select
            value={term}
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
        <Field label="Tìm sinh viên / đề tài">
          <input
            value={params.get("search") ?? ""}
            maxLength={200}
            onChange={(e) => update("search", e.target.value)}
          />
        </Field>
        <Field label="Trạng thái phiếu">
          <select
            value={params.get("state") ?? ""}
            onChange={(e) => update("state", e.target.value)}
          >
            <option value="">Tất cả</option>
            {["NONE", "DRAFT", "FINALIZED", "STALE", "LEGACY_UNVERIFIED"].map(
              (s) => (
                <option key={s} value={s}>
                  {gradeLabels[s]}
                </option>
              ),
            )}
          </select>
        </Field>
        <Button
          variant="secondary"
          onClick={() => {
            void terms.refetch();
            void list.refetch();
            if (member) void detail.refetch();
          }}
        >
          Tải lại dữ liệu
        </Button>
      </Card>
      {terms.isLoading && <Notice>Đang tải đợt…</Notice>}
      {terms.error && <Notice>{eligibilityError(terms.error)}</Notice>}
      {term && !q && <Notice>Bộ lọc không hợp lệ.</Notice>}
      {q && list.isLoading && <Notice>Đang tải hồ sơ phản biện…</Notice>}
      {list.error && <Notice>{eligibilityError(list.error)}</Notice>}
      {list.data && (
        <Card>
          {!!list.data.blockers?.length && (
            <Notice>
              {list.data.blockers.map((b) => gradeLabels[b] ?? b).join("; ")}
            </Notice>
          )}
          <ReviewerGradeRows
            items={list.data.items}
            select={(v) => {
              const n = new URLSearchParams(params);
              n.set("termStudentId", v.termStudentId);
              n.set("reviewerId", v.reviewerId);
              setParams(n);
            }}
          />
          <p>
            {list.data.total} hồ sơ · Trang {list.data.page}
          </p>
          <Button
            variant="secondary"
            disabled={list.data.page <= 1}
            onClick={() => update("page", String(list.data!.page - 1))}
          >
            Trước
          </Button>
          <Button
            variant="secondary"
            disabled={list.data.page * list.data.limit >= list.data.total}
            onClick={() => update("page", String(list.data!.page + 1))}
          >
            Sau
          </Button>
        </Card>
      )}
      {member && detail.isLoading && <Notice>Đang tải phiếu phản biện…</Notice>}
      {detail.error && <Notice>{eligibilityError(detail.error)}</Notice>}
      {view && (
        <ReviewerGradeEditor
          key={JSON.stringify([
            scope,
            view.revision,
            view.assignment,
            view.report,
            view.policyHash,
            view.rubricHash,
            view.schedule,
            view.blockers,
          ])}
          view={view}
          pending={mutation.isPending}
          submit={(action, body) => {
            setNotice(null);
            mutation.mutate({ action, body, origin: scope });
          }}
          download={async () => {
            if (!view.report) throw Error("Chưa có PDF");
            const blob = await api.download(member, term, view.report.id);
            if (live.current !== scope)
              throw Error("Hồ sơ đã đổi; tải lại PDF.");
            await saveReviewerPdf(blob);
          }}
        />
      )}
      {mutation.variables?.origin === scope && mutation.error && (
        <Notice>{eligibilityError(mutation.error)}</Notice>
      )}
      {notice?.scope === scope && <Notice>{notice.text}</Notice>}
    </div>
  );
}
