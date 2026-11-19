import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { CommitteeGradeQuerySchema } from "@doan/shared";
import type { CommitteeGradeCommand } from "@doan/shared";
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
  committeeGradeApi as api,
  committeeGradeKeys as keys,
  saveCommitteePdf,
} from "./api";
import {
  committeeGradeLabels as labels,
  CommitteeGradeRows,
  CommitteeGradeEditor,
  CommitteeProgressRows,
} from "./components";
export function CommitteeGradePage() {
  return AUTH_API ? (
    <CommitteeGradeContent />
  ) : (
    <Notice>Chấm điểm hội đồng cần API và tài khoản của hệ thống nhóm.</Notice>
  );
}
function CommitteeGradeContent() {
  const u = useApiSession(),
    actor = u?.id ?? "",
    client = useQueryClient(),
    [params, setParams] = useSearchParams(),
    term = params.get("termId") ?? "",
    committee = params.get("committeeId") ?? "",
    member = params.get("termStudentId") ?? "",
    lecturer = params.get("lecturerId") ?? "";
  const allowed =
      !!u &&
      u.roles.some((r) => r === "LECTURER" || r === "FACULTY") &&
      !!u.permissions?.includes("defense-committee-grade:read"),
    faculty =
      !!u?.roles.includes("FACULTY") &&
      !!u.permissions?.includes("defense-committee-grade:progress-read");
  const scope = JSON.stringify([actor, term, committee, member, lecturer]),
    live = useRef(scope);
  live.current = scope;
  const [message, setMessage] = useState<{
      scope: string;
      text: string;
    } | null>(null),
    keysRef = useRef(new Map<string, string>());
  const parsed = CommitteeGradeQuerySchema.safeParse({
      termId: term,
      committeeId: committee || undefined,
      search: params.get("search") ?? "",
      state: params.get("state") || undefined,
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
    queryKey: q
      ? keys.list(actor, q)
      : ["committee-grade-invalid", actor, term],
    queryFn: () => api.list(q!),
    enabled: allowed && !!q,
  });
  const progress = useQuery({
    queryKey: q
      ? keys.progress(actor, q)
      : ["committee-grade-progress-invalid", actor, term],
    queryFn: () => api.progress(q!),
    enabled: allowed && faculty && !!q,
  });
  const detail = useQuery({
    queryKey: keys.detail(actor, term, committee, member, lecturer),
    queryFn: () => api.detail(member, term, committee, lecturer || undefined),
    enabled: allowed && !!q && !!committee && !!member,
  });
  const mutation = useMutation({
    mutationFn: async ({
      action,
      body,
      origin,
    }: {
      action: "save" | "finalize";
      body: CommitteeGradeCommand;
      origin: string;
    }) => {
      if (
        origin !== live.current ||
        !detail.data ||
        detail.data.committeeId !== committee ||
        detail.data.termId !== term ||
        detail.data.termStudentId !== member
      )
        throw Error("Tài khoản/hội đồng/hồ sơ đã đổi; tải lại.");
      const identity = JSON.stringify([origin, action, body]);
      if (!keysRef.current.has(identity))
        keysRef.current.set(identity, crypto.randomUUID());
      return api.command(member, action, body, keysRef.current.get(identity)!);
    },
    onSuccess: async (_, v) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["committee-grade-list", actor] }),
        client.invalidateQueries({
          queryKey: ["committee-grade-detail", actor],
        }),
        client.invalidateQueries({
          queryKey: ["committee-grade-progress", actor],
        }),
      ]);
      if (v.origin === live.current)
        setMessage({
          scope: v.origin,
          text: "Đã lưu phiếu hội đồng trên hệ thống.",
        });
    },
  });
  const reset = mutation.reset;
  useEffect(() => {
    setMessage(null);
    reset();
  }, [scope, reset]);
  const update = (key: string, value: string) => {
    const n = new URLSearchParams(params);
    value ? n.set(key, value) : n.delete(key);
    if (key !== "page") n.delete("page");
    if (key === "termId") n.delete("committeeId");
    n.delete("termStudentId");
    n.delete("lecturerId");
    setParams(n);
  };
  if (!allowed)
    return (
      <Notice>
        Không có quyền xem/chấm hội đồng. Điểm và nhận xét chưa công bố cho sinh
        viên.
      </Notice>
    );
  const view =
    detail.data?.termId === term &&
    detail.data.committeeId === committee &&
    detail.data.termStudentId === member &&
    (!lecturer || detail.data.lecturerId === lecturer)
      ? detail.data
      : null;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Chấm điểm hội đồng"
        description="Mỗi thành viên chấm một phiếu riêng theo rubric của đợt."
      />
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
        <Field label="Hội đồng của tôi / Phạm vi Khoa">
          <select
            value={committee}
            onChange={(e) => update("committeeId", e.target.value)}
          >
            <option value="">Tất cả hội đồng được phép</option>
            {options.data?.committees
              .filter((c) => c.termId === term)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} · {c.name}
                  {c.role ? ` · ${labels[c.role]}` : ""}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Tìm sinh viên / đề tài">
          <input
            maxLength={200}
            value={params.get("search") ?? ""}
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
                  {labels[s]}
                </option>
              ),
            )}
          </select>
        </Field>
        <Button
          variant="secondary"
          onClick={() => {
            void options.refetch();
            if (q) void list.refetch();
            if (q && faculty) void progress.refetch();
            if (member && committee) void detail.refetch();
          }}
        >
          Tải lại dữ liệu
        </Button>
      </Card>
      {options.isLoading && <Notice>Đang tải đợt và hội đồng…</Notice>}
      {options.error && <Notice>{eligibilityError(options.error)}</Notice>}
      {term && !q && <Notice>Bộ lọc không hợp lệ.</Notice>}
      {q && list.isLoading && <Notice>Đang tải phiếu hội đồng…</Notice>}
      {list.error && <Notice>{eligibilityError(list.error)}</Notice>}
      {faculty && q && (
        <Card title="Tiến độ số phiếu hội đồng">
          {progress.isLoading && <Notice>Đang tải tiến độ…</Notice>}
          {progress.error && (
            <Notice>{eligibilityError(progress.error)}</Notice>
          )}
          {progress.data && (
            <>
              <CommitteeProgressRows items={progress.data.items} />
              {!!progress.data.blockers.length && (
                <Notice>
                  {progress.data.blockers.map((b) => labels[b] ?? b).join("; ")}
                </Notice>
              )}
            </>
          )}
        </Card>
      )}
      {list.data && (
        <Card>
          {!!list.data.blockers.length && (
            <Notice>
              {list.data.blockers.map((b) => labels[b] ?? b).join("; ")}
            </Notice>
          )}
          <CommitteeGradeRows
            items={list.data.items}
            select={(v) => {
              const n = new URLSearchParams(params);
              n.set("committeeId", v.committeeId);
              n.set("termStudentId", v.termStudentId);
              n.set("lecturerId", v.lecturerId);
              setParams(n);
            }}
          />
          <p>
            {list.data.total} phiếu · Trang {list.data.page}
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
      {member && detail.isLoading && <Notice>Đang tải chi tiết phiếu…</Notice>}
      {detail.error && <Notice>{eligibilityError(detail.error)}</Notice>}
      {view && (
        <CommitteeGradeEditor
          key={JSON.stringify([
            scope,
            view.revision,
            view.membershipHash,
            view.policyHash,
            view.rubricHash,
            view.report,
            view.schedule,
            view.blockers,
            view.finalizeBlockers,
          ])}
          view={view}
          pending={mutation.isPending && mutation.variables?.origin === scope}
          submit={(action, body) => {
            setMessage(null);
            mutation.mutate({ action, body, origin: scope });
          }}
          download={async () => {
            if (!view.report) throw Error("Chưa có PDF cuối");
            const blob = await api.download(
              member,
              term,
              committee,
              view.report.id,
            );
            if (live.current !== scope)
              throw Error("Hồ sơ đã đổi; tải lại PDF.");
            await saveCommitteePdf(blob);
          }}
        />
      )}
      {mutation.variables?.origin === scope && mutation.error && (
        <Notice>{eligibilityError(mutation.error)}</Notice>
      )}
      {message?.scope === scope && <Notice>{message.text}</Notice>}
    </div>
  );
}
