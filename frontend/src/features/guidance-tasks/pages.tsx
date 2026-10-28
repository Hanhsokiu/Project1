import React, { useEffect, useRef, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  GuidancePlanCreateSchema,
  GuidancePlanUpdateSchema,
  GuidancePlanResumeSchema,
  GuidanceTaskProgressSchema,
  GuidanceTaskCancelSchema,
} from "@doan/shared";
import type {
  GuidanceContext,
  GuidanceTaskView,
  GuidanceTaskCreate,
  GuidanceTaskUpdate,
  GuidancePlanView,
  GuidanceTaskQuery,
} from "@doan/shared";
import { guidanceApi as api } from "./api";
import { proposalReviewApi } from "../proposal-reviews/api";
import { GuidanceState as ReviewState } from "./components";
import {
  GuidanceTaskForm,
  TaskStatus,
  guidanceStatusLabel,
  vietnamDate,
} from "./components";
import { getErrorMessage } from "../../shared/api/error-message";
const issue = (e: unknown) =>
  e ? getErrorMessage(e, "Không thể xử lý kế hoạch/nhiệm vụ.") : undefined;
const readiness: Record<string, string> = {
  TERM_003: "Giai đoạn hướng dẫn chưa mở, đã khóa hoặc hết hạn.",
  INPUT_NOT_READY: "Đầu vào chưa được xác nhận từ bước trước.",
  DOSSIER_NOT_FINALIZED: "Đề cương chưa có hồ sơ chính thức được Khoa chốt.",
  STATE_TRANSITION_INVALID: "Trạng thái hồ sơ không cho phép hướng dẫn.",
  PLAN_PAUSED: "Kế hoạch đang tạm dừng hoặc lưu trữ.",
  REBASE_REQUIRED:
    "GVHD hoặc bản chốt đã đổi. Cần xác nhận lại kế hoạch theo workflow.",
  TOPIC_NOT_AGREED: "GVHD hiện hành cần xác nhận lại đề tài.",
  REPORTING_SCOPE_NOT_CONFIGURED:
    "Chưa cấu hình đủ lịch/đối tượng/nghĩa vụ tuần.",
  MISSING_OBLIGATION_RECORD: "Thiếu bản ghi nghĩa vụ tuần từ producer.",
  MISSING_PLAN: "Chưa có kế hoạch hướng dẫn.",
  MISSING_TASK: "Chưa có nhiệm vụ tuần.",
};
function useKey() {
  const saved = useRef(new Map<string, string>());
  return (action: string, input: unknown) => {
    const v = action + JSON.stringify(input);
    if (!saved.current.has(v)) saved.current.set(v, crypto.randomUUID());
    return saved.current.get(v)!;
  };
}
function useRefresh() {
  const client = useQueryClient();
  return () =>
    Promise.all(
      [
        "guidance-context",
        "guidance-tasks",
        "guidance-plan-tasks",
        "weekly-coverage",
        "guidance-task",
      ].map((k) => client.invalidateQueries({ queryKey: [k] })),
    );
}
function useTerm() {
  const [params, setParams] = useSearchParams(),
    termId = params.get("termId") ?? "",
    terms = useQuery({
      queryKey: ["proposal-review-terms"],
      queryFn: proposalReviewApi.terms,
    });
  useEffect(() => {
    if (!termId && terms.data?.[0])
      setParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.set("termId", terms.data![0].id);
          return n;
        },
        { replace: true },
      );
  }, [termId, terms.data, setParams]);
  return { termId, terms, setParams, search: params.get("search") ?? "" };
}
function PlanActions({
  context: c,
  onSaved,
}: {
  context: GuidanceContext;
  onSaved: () => void;
}) {
  const [description, setDescription] = useState(c.plan?.description ?? ""),
    [reason, setReason] = useState(""),
    [ack, setAck] = useState(false),
    [success, setSuccess] = useState(""),
    key = useKey(),
    initialRevision = useRef(c.plan?.revision ?? 0);
  const mutation = useMutation({
    mutationFn: async (action: "create" | "update" | "resume") => {
      if (action === "create") {
        const input = GuidancePlanCreateSchema.parse({
          finalizationId: c.currentFinalizationId,
          expectedDossierRevision: c.dossierRevision,
          description,
        });
        return api.createPlan(c.proposalId, input, key(action, input));
      }
      if (!c.plan) throw Error("Chưa có kế hoạch.");
      if (action === "update") {
        const input = GuidancePlanUpdateSchema.parse({
          expectedRevision: initialRevision.current,
          description,
          reason,
        });
        return api.updatePlan(c.plan.id, input, key(action, input));
      }
      const input = GuidancePlanResumeSchema.parse({
        expectedRevision: initialRevision.current,
        finalizationId: c.currentFinalizationId,
        expectedDossierRevision: c.dossierRevision,
        acknowledgeRebase: ack,
      });
      return api.resume(c.plan.id, input, key(action, input));
    },
    onSuccess: (plan: GuidancePlanView) => {
      initialRevision.current = plan.revision;
      setSuccess("Đã lưu kế hoạch hướng dẫn.");
      onSaved();
    },
  });
  if (
    !c.canCreate &&
    !c.plan?.allowedActions.some((a) => a === "update" || a === "resume")
  )
    return null;
  return (
    <section className="rg-panel p-5 space-y-4">
      <h2 className="font-semibold">
        {c.plan ? "Quản lý kế hoạch" : "Khởi tạo kế hoạch hướng dẫn"}
      </h2>
      <label className="block">
        Mô tả kế hoạch
        <textarea
          aria-label="Mô tả kế hoạch"
          value={description}
          maxLength={20000}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-2 w-full rounded border p-2"
        />
      </label>
      {c.canCreate && (
        <button
          disabled={mutation.isPending}
          className="rounded bg-blue-700 px-4 py-2 text-white"
          onClick={() => mutation.mutate("create")}
        >
          Tạo kế hoạch hướng dẫn
        </button>
      )}
      {c.plan?.allowedActions.includes("update") && (
        <>
          <label className="block">
            Lý do sửa kế hoạch
            <input
              aria-label="Lý do sửa kế hoạch"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-2 w-full rounded border p-2"
            />
          </label>
          <button
            disabled={mutation.isPending || !reason.trim()}
            className="rounded border px-4 py-2"
            onClick={() => mutation.mutate("update")}
          >
            Lưu mô tả kế hoạch
          </button>
        </>
      )}
      {c.plan?.allowedActions.includes("resume") && (
        <>
          <label className="flex gap-2">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
            />
            Tôi xác nhận GVHD, bản chốt và kế hoạch hiện hành để tiếp tục hướng
            dẫn; giữ toàn bộ nhiệm vụ/bài cũ.
          </label>
          <button
            disabled={mutation.isPending || !ack}
            className="rounded bg-blue-700 px-4 py-2 text-white"
            onClick={() => mutation.mutate("resume")}
          >
            Xác nhận tiếp tục hướng dẫn
          </button>
        </>
      )}
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
export function GuidancePlanListPage() {
  const { termId, terms, setParams } = useTerm(),
    [page, setPage] = useState(1);
  const list = useQuery({
    queryKey: ["guidance-proposals", termId, page],
    queryFn: () =>
      proposalReviewApi.list(termId, { page, limit: 20, status: "APPROVED" }),
    enabled: !!termId,
  });
  return (
    <>
      <h1>Kế hoạch hướng dẫn đồ án</h1>
      <p className="my-4 text-sm text-slate-500">
        Mỗi sinh viên có kế hoạch riêng theo hồ sơ chốt và GVHD chính thức. Đã
        duyệt đề cương chưa đồng nghĩa đã đủ điều kiện tạo kế hoạch.
      </p>
      <label>
        Đợt đồ án
        <select
          aria-label="Đợt hướng dẫn"
          value={termId}
          onChange={(e) => {
            setParams({ termId: e.target.value });
            setPage(1);
          }}
          className="my-4 ml-3 rounded border p-2"
        >
          <option value="">Chọn đợt</option>
          {terms.data?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <ReviewState
        loading={terms.isLoading || (!!termId && list.isLoading)}
        error={issue(terms.error || list.error)}
        empty={!termId || !list.data?.data.length}
      >
        <div className="grid gap-4">
          {list.data?.data.map((p) => (
            <article
              key={p.id}
              className="rg-panel flex flex-wrap justify-between gap-4 p-5"
            >
              <div>
                <h2 className="font-semibold">{p.title}</h2>
                <p>
                  {p.studentName} · {p.studentCode}
                </p>
              </div>
              <Link className="rg-table-action" to={`/guidance/plan/${p.id}`}>
                Mở kế hoạch hướng dẫn
              </Link>
            </article>
          ))}
        </div>
      </ReviewState>
      {list.data && list.data.total > 0 && (
        <div className="mt-4 flex justify-between">
          <span>
            Trang {page}/{list.data.totalPages}
          </span>
          <div className="flex gap-4">
            <button disabled={page <= 1} onClick={() => setPage((v) => v - 1)}>
              Trước
            </button>
            <button
              disabled={page >= list.data.totalPages}
              onClick={() => setPage((v) => v + 1)}
            >
              Sau
            </button>
          </div>
        </div>
      )}
    </>
  );
}
export function GuidancePlanDetailPage() {
  const { proposalId = "" } = useParams(),
    [page, setPage] = useState(1),
    [formEpoch, setFormEpoch] = useState(0),
    refresh = useRefresh();
  const context = useQuery({
      queryKey: ["guidance-context", proposalId],
      queryFn: () => api.context(proposalId),
    }),
    c = context.data;
  const tasks = useQuery({
    queryKey: ["guidance-plan-tasks", c?.plan?.id, page],
    queryFn: () => api.planTasks(c!.plan!.id, { page, limit: 20 }),
    enabled: !!c?.plan,
  });
  return (
    <>
      <Link to="/guidance/plan" className="text-blue-700">
        ← Danh sách kế hoạch
      </Link>
      <h1 className="my-5">Kế hoạch hướng dẫn</h1>
      <ReviewState loading={context.isLoading} error={issue(context.error)}>
        {c && (
          <div className="space-y-5">
            <section className="rg-panel p-5 space-y-2">
              <h2 className="font-semibold">{c.title}</h2>
              <p>
                {c.studentName} · {c.studentCode}
              </p>
              <p>
                {c.plan
                  ? guidanceStatusLabel(c.plan.state)
                  : "Chưa có kế hoạch"}
              </p>
              <p>
                {c.phase
                  ? `Hướng dẫn: ${vietnamDate(c.phase.startsAt)} – ${vietnamDate(c.phase.endsAt)} · ${c.phase.isLocked ? "Đã khóa" : "Theo lịch mở"}`
                  : "Chưa có phase GUIDANCE"}
              </p>
            </section>
            {[...new Set([...c.readiness, ...(c.plan?.readiness ?? [])])].map(
              (code) => (
                <p
                  key={code}
                  role="status"
                  className="rounded border border-amber-200 bg-amber-50 p-4"
                >
                  {readiness[code] ??
                    "Đầu vào cần được kiểm tra trước khi ghi."}
                </p>
              ),
            )}
            <PlanActions
              key={formEpoch}
              context={c}
              onSaved={() => void refresh()}
            />
            {c.plan&&<Link className="inline-block mr-4 rounded border px-4 py-2 text-blue-700" to={`/guidance/meetings?planId=${c.plan.id}`}>Nhật ký hướng dẫn</Link>}
            {c.plan?.allowedActions.includes("create-task") && (
              <Link
                className="inline-block rounded bg-blue-700 px-4 py-2 text-white"
                to={`/guidance/plan/${proposalId}/tasks/new`}
              >
                Giao nhiệm vụ mới
              </Link>
            )}
            {c.plan && (
              <ReviewState
                loading={tasks.isLoading}
                error={issue(tasks.error)}
                empty={!tasks.data?.data.length}
              >
                <div className="grid gap-4">
                  {tasks.data?.data.map((t) => (
                    <TaskCard key={t.id} task={t} />
                  ))}
                </div>
              </ReviewState>
            )}
            {tasks.data && tasks.data.total > 20 && (
              <div className="flex justify-between">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((v) => v - 1)}
                >
                  Trang nhiệm vụ trước
                </button>
                <button
                  disabled={page >= tasks.data.totalPages}
                  onClick={() => setPage((v) => v + 1)}
                >
                  Trang nhiệm vụ sau
                </button>
              </div>
            )}
            <button
              className="text-blue-700"
              onClick={async () => {
                await refresh();
                setFormEpoch((v) => v + 1);
              }}
            >
              Tải lại kế hoạch
            </button>
          </div>
        )}
      </ReviewState>
    </>
  );
}
function TaskCard({ task: t }: { task: GuidanceTaskView }) {
  return (
    <article className="rg-panel p-5 space-y-2">
      <div className="flex flex-wrap justify-between gap-3">
        <h2 className="font-semibold">{t.title}</h2>
        <TaskStatus task={t} />
      </div>
      <p className="text-sm text-slate-500">
        {t.studentName} · {t.studentCode} · {t.periodLabel ?? "Chưa có mốc"}
      </p>
      <p className="text-sm">Hạn: {vietnamDate(t.dueDate)} (UTC+7)</p>
      <Link to={`/guidance/tasks/${t.id}`} className="rg-table-action">
        Xem nhiệm vụ
      </Link>
    </article>
  );
}
function WeeklyCoverage({
  termId,
  periodId,
}: {
  termId: string;
  periodId: string;
}) {
  const [page, setPage] = useState(1),
    key = useKey(),
    refresh = useRefresh();
  const query = useQuery({
    queryKey: ["weekly-coverage", termId, periodId, page],
    queryFn: () =>
      api.coverage(termId, {
        page,
        limit: 20,
        periodId: periodId || undefined,
      }),
    enabled: !!termId,
  });
  const ensure = useMutation({
    mutationFn: async (row: NonNullable<typeof query.data>["data"][number]) => {
      const input = {
        expectedPlanRevision: row.planRevision,
        expectedObligationRevision: row.obligationRevision,
      };
      return api.ensure(
        row.obligationId!,
        input,
        key("weekly:" + row.obligationId, input),
      );
    },
    onSuccess: () => refresh(),
  });
  return (
    <section className="space-y-4">
      <h2 className="font-semibold text-lg">Nghĩa vụ báo cáo tuần</h2>
      <p className="text-sm text-slate-500">
        Hiển thị theo lịch và danh sách áp dụng, kể cả chưa có nhiệm vụ. Tạo
        task hoặc ghi tiến độ không được coi là đã nộp báo cáo hay hoàn thành.
      </p>
      {query.data?.coverageState === "NOT_CONFIGURED" && (
        <p
          role="status"
          className="rounded border border-amber-200 bg-amber-50 p-4"
        >
          Chưa cấu hình đầy đủ nghĩa vụ tuần. Không thể kết luận không thiếu báo
          cáo.
        </p>
      )}
      {ensure.error && <p role="alert">{issue(ensure.error)}</p>}
      <ReviewState
        loading={query.isLoading}
        error={issue(query.error)}
        empty={!query.data?.data.length}
      >
        <div className="grid gap-4">
          {query.data?.data.map((r) => (
            <article
              key={r.termStudentId + ":" + r.periodId}
              className="rg-panel p-5 space-y-2"
            >
              <h3 className="font-semibold">
                {r.periodLabel} · {r.studentName} · {r.studentCode}
              </h3>
              <p>
                {r.submissionState === "SUBMITTED"
                  ? "Đã có báo cáo"
                  : r.submissionState === "NOT_DUE"
                    ? "Chưa đến tuần"
                    : "Chưa có báo cáo"}
                {r.isOverdue ? " · Quá hạn báo cáo" : ""}
              </p>
              <p className="text-sm">
                {r.reportDueAt
                  ? `Hạn tuần: ${vietnamDate(r.reportDueAt)}`
                  : "Chưa cấu hình hạn tuần"}
              </p>
              {r.readiness.map((code) => (
                <p key={code} className="text-sm text-amber-800">
                  {readiness[code] ?? "Cần đối soát cấu hình"}
                </p>
              ))}
              {r.canEnsure && (
                <button
                  disabled={ensure.isPending}
                  onClick={() => ensure.mutate(r)}
                  className="rounded border px-3 py-2"
                >
                  Tạo nhiệm vụ cho {r.periodLabel}
                </button>
              )}
              {r.currentTaskId && (
                <Link
                  className="rg-table-action"
                  to={`/guidance/tasks/${r.currentTaskId}`}
                >
                  Xem nhiệm vụ tuần
                </Link>
              )}
            </article>
          ))}
        </div>
      </ReviewState>
      {query.data && query.data.total > 20 && (
        <div className="flex justify-between">
          <button disabled={page <= 1} onClick={() => setPage((v) => v - 1)}>
            Nghĩa vụ trang trước
          </button>
          <button
            disabled={page >= query.data.totalPages}
            onClick={() => setPage((v) => v + 1)}
          >
            Nghĩa vụ trang sau
          </button>
        </div>
      )}
    </section>
  );
}
export function GuidanceTaskListPage() {
  const { termId, terms, setParams, search } = useTerm(),
    [page, setPage] = useState(1),
    [periodId, setPeriod] = useState(""),
    [status, setStatus] = useState(""),
    [overdue, setOverdue] = useState(false);
  const periods = useQuery({
    queryKey: ["guidance-periods", termId],
    queryFn: () => api.periods(termId),
    enabled: !!termId,
  });
  const q: GuidanceTaskQuery = {
    page,
    limit: 20,
    search,
    periodId: periodId || undefined,
    status: (status || undefined) as GuidanceTaskQuery["status"],
    isOverdue: overdue ? "true" : undefined,
  };
  const list = useQuery({
    queryKey: ["guidance-tasks", termId, q],
    queryFn: () => api.tasks(termId, q),
    enabled: !!termId,
  });
  return (
    <>
      <h1>Nhiệm vụ & tiến độ hướng dẫn</h1>
      <p className="my-4 text-sm text-slate-500">
        Xem trong phạm vi được cấp; Khoa tổng hợp theo đợt, GVHD và SV xem hồ sơ
        của mình.
      </p>
      <Link to="/guidance/plan" className="text-blue-700">
        Mở kế hoạch để giao nhiệm vụ →
      </Link>
      <section className="rg-panel my-5 grid gap-4 p-5 sm:grid-cols-3">
        <label>
          Đợt
          <select
            aria-label="Đợt nhiệm vụ"
            value={termId}
            onChange={(e) => {
              setParams({ termId: e.target.value });
              setPeriod("");
              setPage(1);
            }}
            className="mt-2 w-full rounded border p-2"
          >
            <option value="">Chọn đợt</option>
            {terms.data?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tuần / mốc
          <select
            aria-label="Lọc mốc nhiệm vụ"
            value={periodId}
            onChange={(e) => {
              setPeriod(e.target.value);
              setPage(1);
            }}
            className="mt-2 w-full rounded border p-2"
          >
            <option value="">Tất cả mốc</option>
            {periods.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Trạng thái
          <select
            aria-label="Lọc trạng thái nhiệm vụ"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="mt-2 w-full rounded border p-2"
          >
            <option value="">Tất cả trạng thái</option>
            {[
              "TODO",
              "IN_PROGRESS",
              "SUBMITTED",
              "REVISION_REQUESTED",
              "COMPLETED",
              "CANCELLED",
            ].map((s) => (
              <option key={s} value={s}>
                {guidanceStatusLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex gap-2">
          <input
            type="checkbox"
            checked={overdue}
            onChange={(e) => {
              setOverdue(e.target.checked);
              setPage(1);
            }}
          />
          Chỉ nhiệm vụ quá hạn
        </label>
      </section>
      {list.data && (
        <p className="my-4 text-sm">
          {list.data.total} nhiệm vụ · {list.data.overdueTotal} quá hạn trong bộ
          lọc · Trang {page}/{Math.max(1, list.data.totalPages)}
        </p>
      )}
      <ReviewState
        loading={terms.isLoading || (!!termId && list.isLoading)}
        error={issue(terms.error || periods.error || list.error)}
        empty={!termId || !list.data?.data.length}
      >
        <div className="grid gap-4">
          {list.data?.data.map((t) => (
            <TaskCard key={t.id} task={t} />
          ))}
        </div>
      </ReviewState>
      {list.data && list.data.total > 20 && (
        <div className="my-4 flex justify-between">
          <button disabled={page <= 1} onClick={() => setPage((v) => v - 1)}>
            Trước
          </button>
          <button
            disabled={page >= list.data.totalPages}
            onClick={() => setPage((v) => v + 1)}
          >
            Sau
          </button>
        </div>
      )}
      {termId && (
        <div className="mt-7">
          <WeeklyCoverage
            key={termId + periodId}
            termId={termId}
            periodId={periodId}
          />
        </div>
      )}
    </>
  );
}
export function GuidanceTaskCreatePage() {
  const { proposalId = "" } = useParams(),
    key = useKey(),
    navigate = useNavigate(),
    refresh = useRefresh(),
    context = useQuery({
      queryKey: ["guidance-context", proposalId],
      queryFn: () => api.context(proposalId),
    });
  const create = useMutation({
    mutationFn: (input: GuidanceTaskCreate | GuidanceTaskUpdate) =>
      api.createTask(context.data!.plan!.id, input, key("create", input)),
    onSuccess: async (t) => {
      await refresh();
      navigate(`/guidance/tasks/${t.id}?saved=created`);
    },
  });
  return (
    <>
      <Link to={`/guidance/plan/${proposalId}`} className="text-blue-700">
        ← Kế hoạch hướng dẫn
      </Link>
      <h1 className="my-5">Giao nhiệm vụ</h1>
      <ReviewState loading={context.isLoading} error={issue(context.error)}>
        {context.data?.plan?.allowedActions.includes("create-task") ? (
          <GuidanceTaskForm
            planRevision={context.data.plan.revision}
            periods={context.data.periods}
            busy={create.isPending}
            onSubmit={(v) => create.mutate(v)}
          />
        ) : (
          context.data && (
            <p role="alert">
              Kế hoạch/phân công/giai đoạn không cho phép giao nhiệm vụ.
            </p>
          )
        )}
      </ReviewState>
      {create.error && (
        <p role="alert" className="mt-4 text-red-700">
          {issue(create.error)}
        </p>
      )}
    </>
  );
}
function TaskProgressForm({
  task,
  onSaved,
}: {
  task: GuidanceTaskView;
  onSaved: (v: GuidanceTaskView) => void;
}) {
  const [note, setNote] = useState(""),
    [initialRevision] = useState(task.revision),
    key = useKey(),
    [revision, setRevision] = useState(initialRevision);
  const mutation = useMutation({
    mutationFn: async () => {
      const input = GuidanceTaskProgressSchema.parse({
        expectedRevision: revision,
        note,
      });
      return api.progress(task.id, input, key("progress", input));
    },
    onSuccess: (t) => {
      setNote("");
      setRevision(t.revision);
      onSaved(t);
    },
  });
  return (
    <form
      className="rg-panel p-5 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <label className="block">
        Ghi nhận tiến độ
        <textarea
          aria-label="Ghi nhận tiến độ"
          required
          maxLength={20000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-2 w-full rounded border p-2"
        />
      </label>
      <p className="text-sm text-slate-500">
        Ghi chú này không thay thế báo cáo tuần và không đánh dấu hoàn thành
        nhiệm vụ.
      </p>
      <button
        disabled={mutation.isPending}
        className="rounded bg-blue-700 px-4 py-2 text-white"
      >
        Bắt đầu / Ghi tiến độ
      </button>
      {mutation.error && (
        <p role="alert" className="text-red-700">
          {issue(mutation.error)}
        </p>
      )}
    </form>
  );
}
export function GuidanceTaskDetailPage() {
  const { id = "" } = useParams(),
    [params] = useSearchParams(),
    client = useQueryClient(),
    refresh = useRefresh(),
    key = useKey(),
    [editing, setEditing] = useState(false),
    [progressEpoch, setProgressEpoch] = useState(0),
    [cancelReason, setCancelReason] = useState(""),
    [ack, setAck] = useState(false),
    [success, setSuccess] = useState(
      params.get("saved") === "created" ? "Đã giao nhiệm vụ." : "",
    );
  const query = useQuery({
      queryKey: ["guidance-task", id],
      queryFn: () => api.task(id),
    }),
    t = query.data;
  const context = useQuery({
    queryKey: ["guidance-context", t?.proposalId],
    queryFn: () => api.context(t!.proposalId),
    enabled: !!t?.allowedActions.includes("update"),
  });
  const save = (v: GuidanceTaskView) => {
    client.setQueryData(["guidance-task", id], v);
    void refresh();
    setSuccess("Đã lưu thay đổi nhiệm vụ.");
  };
  const update = useMutation({
    mutationFn: (input: GuidanceTaskCreate | GuidanceTaskUpdate) =>
      api.updateTask(id, input, key("update", input)),
    onSuccess: (v) => {
      setEditing(false);
      save(v);
    },
  });
  const cancel = useMutation({
    mutationFn: () => {
      const input = GuidanceTaskCancelSchema.parse({
        expectedRevision: t!.revision,
        reason: cancelReason,
        acknowledgeExistingSubmissions: ack,
      });
      return api.cancel(id, input, key("cancel", input));
    },
    onSuccess: save,
  });
  return (
    <>
      <Link
        className="text-blue-700"
        to={t ? `/guidance/plan/${t.proposalId}` : "/guidance/tasks"}
      >
        ← Kế hoạch / nhiệm vụ
      </Link>
      <h1 className="my-5">Chi tiết nhiệm vụ</h1>
      <Link className="inline-block mb-5 text-blue-700 underline" to={`/guidance/tasks/${id}/submissions`}>Báo cáo tuần và source</Link>
      <ReviewState loading={query.isLoading} error={issue(query.error)}>
        {t && (
          <div className="space-y-5">
            <section className="rg-panel p-5 space-y-3">
              <h2 className="font-semibold text-lg">{t.title}</h2>
              <TaskStatus task={t} />
              <p>
                {t.studentName} · {t.studentCode} · {t.topicTitle}
              </p>
              <p>Mốc: {t.periodLabel ?? "Chưa cấu hình"}</p>
              <p>
                Bắt đầu:{" "}
                {t.startDate ? vietnamDate(t.startDate) : "Chưa đối soát"} ·
                Hạn: {vietnamDate(t.dueDate)} (UTC+7)
              </p>
              <p className="whitespace-pre-wrap break-words">{t.description}</p>
              <h3 className="font-semibold">Sản phẩm dự kiến</h3>
              <p className="whitespace-pre-wrap break-words">
                {t.expectedDeliverables ?? "Chưa đối soát yêu cầu"}
              </p>
            </section>
            {success && (
              <p role="status" className="text-green-700">
                {success}
              </p>
            )}
            {t.allowedActions.includes("update") && (
              <button
                className="rounded border px-4 py-2"
                onClick={() => setEditing((v) => !v)}
              >
                {editing ? "Đóng chỉnh sửa" : "Chỉnh sửa nhiệm vụ"}
              </button>
            )}
            {editing && context.data && (
              <GuidanceTaskForm
                task={t}
                planRevision={context.data.plan?.revision ?? 0}
                periods={context.data.periods}
                busy={update.isPending}
                onSubmit={(v) => update.mutate(v)}
              />
            )}
            {(update.error || context.error) && (
              <p role="alert">{issue(update.error || context.error)}</p>
            )}
            {t.allowedActions.includes("progress") && (
              <TaskProgressForm key={progressEpoch} task={t} onSaved={save} />
            )}
            {t.allowedActions.includes("cancel") && (
              <section className="rg-panel p-5 space-y-3">
                <h2 className="font-semibold">Hủy nhiệm vụ</h2>
                <label className="block">
                  Lý do hủy
                  <textarea
                    aria-label="Lý do hủy nhiệm vụ"
                    maxLength={2000}
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="mt-2 w-full rounded border p-2"
                  />
                </label>
                {t.hasSubmissions && (
                  <label className="flex gap-2">
                    <input
                      type="checkbox"
                      checked={ack}
                      onChange={(e) => setAck(e.target.checked)}
                    />
                    Tôi xác nhận giữ nguyên các bài nộp và lịch sử đã có.
                  </label>
                )}
                <button
                  disabled={
                    cancel.isPending ||
                    !cancelReason.trim() ||
                    (t.hasSubmissions && !ack)
                  }
                  onClick={() => cancel.mutate()}
                  className="rounded border border-red-200 px-4 py-2 text-red-700"
                >
                  Xác nhận hủy nhiệm vụ
                </button>
                {cancel.error && <p role="alert">{issue(cancel.error)}</p>}
              </section>
            )}
            <section className="rg-panel p-5 space-y-3">
              <h2 className="font-semibold">Lịch sử tiến độ</h2>
              {t.progress.length ? (
                t.progress.map((e) => (
                  <article key={e.id}>
                    <p className="whitespace-pre-wrap break-words">{e.note}</p>
                    <small>
                      {vietnamDate(e.createdAt)} · {e.actorId}
                    </small>
                  </article>
                ))
              ) : (
                <p>Chưa có ghi chú tiến độ.</p>
              )}
            </section>
            <section className="rg-panel p-5">
              <h2 className="font-semibold">Lịch sử thay đổi</h2>
              {t.history.map((h) => (
                <p key={h.id} className="my-2 text-sm">
                  {h.reason} · {vietnamDate(h.createdAt)} · {h.actorId}
                </p>
              ))}
            </section>
            <button
              className="text-blue-700"
              onClick={async () => {
                await query.refetch();
                setEditing(false);
                setProgressEpoch((v) => v + 1);
              }}
            >
              Tải lại nhiệm vụ
            </button>
          </div>
        )}
      </ReviewState>
    </>
  );
}
