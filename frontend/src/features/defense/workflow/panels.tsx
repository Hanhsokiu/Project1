import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  DefenseStage,
  DefenseWorkflowContext,
  DefenseWorkflowPolicy,
  StageDraft,
  WorkflowCommand,
} from "@doan/shared";
import { getAccessToken, getApiUser } from "../../../shared/api/api-session";
import { Button, Card, Field, Notice } from "../../../shared/components/kit";
import { workflowApi as api, workflowError } from "./api";
import type { LocalPlan } from "../planning/layout";

function sessionKey() {
  return `${getApiUser()?.id ?? ""}:${getAccessToken() ?? ""}`;
}
export function workflowInput(
  c: DefenseWorkflowContext,
  revision: number,
): WorkflowCommand {
  return {
    expectedRevision: revision,
    expectedContext: c.expectedContext,
    requestId: crypto.randomUUID(),
  };
}
function WorkflowHistory({ termId }: { termId: string }) {
  const h = useQuery({
    queryKey: ["official-defense-history", sessionKey(), termId],
    queryFn: () => api.artifacts(termId),
    retry: false,
  });
  return (
    <details>
      <summary>Lịch sử bản chốt/công bố bất biến</summary>
      <Button
        variant="secondary"
        onClick={() => {
          void h.refetch();
        }}
      >
        Đọc lại lịch sử server
      </Button>
      {h.error && <Notice tone="danger">{workflowError(h.error)}</Notice>}
      {h.data &&
        !h.isError &&
        h.data.items.map((v) => (
          <p key={v.id}>
            {v.stage} · {v.state} · version {v.version} · revision {v.revision}{" "}
            · {v.sealedAt} · actor {v.actorId} · {v.integrity}
          </p>
        ))}
    </details>
  );
}
const windowKeys = ["UC18", "COMMITTEES", "REVIEWERS", "SCHEDULE"] as const;
const localDate = (value: string) => {
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
export function PolicyEditor({
  context,
  onSave,
  busy,
}: {
  context: DefenseWorkflowContext;
  onSave: (p: DefenseWorkflowPolicy) => void;
  busy: boolean;
}) {
  const structuralFrozen =
    !!context.policy &&
    (context.list.state === "FINALIZED" ||
      context.stages.some((s) => ["FINALIZED", "PUBLISHED"].includes(s.state)));
  const [size, setSize] = useState(
    context.policy?.committeeSize.toString() ?? "",
  );
  const [capacity, setCapacity] = useState(
    context.policy?.committeeCapacity.toString() ?? "",
  );
  const [warning, setWarning] = useState(
    context.policy?.reviewerWarningLoad?.toString() ?? "",
  );
  const [windows, setWindows] = useState(
    () =>
      Object.fromEntries(
        windowKeys.map((k) => [
          k,
          {
            opensAt: context.policy
              ? localDate(context.policy.windows[k].opensAt)
              : "",
            closesAt: context.policy
              ? localDate(context.policy.windows[k].closesAt)
              : "",
            isLocked: context.policy?.windows[k].isLocked ?? true,
          },
        ]),
      ) as Record<
        (typeof windowKeys)[number],
        { opensAt: string; closesAt: string; isLocked: boolean }
      >,
  );
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          schemaVersion: 1,
          committeeSize: Number(size),
          committeeCapacity: Number(capacity),
          ...(warning ? { reviewerWarningLoad: Number(warning) } : {}),
          windows: Object.fromEntries(
            windowKeys.map((k) => [
              k,
              {
                ...windows[k],
                opensAt: new Date(windows[k].opensAt).toISOString(),
                closesAt: new Date(windows[k].closesAt).toISOString(),
              },
            ]),
          ) as DefenseWorkflowPolicy["windows"],
        });
      }}
    >
      <Notice>
        Các mốc độc lập; giờ nhập theo múi giờ máy. Chưa cấu hình thì fail
        closed. Không dùng hạn PDF/UC17 làm mặc định.
      </Notice>
      <div className="flex gap-3">
        <Field label="Số thành viên hội đồng">
          <select
            disabled={structuralFrozen}
            required
            value={size}
            onChange={(e) => setSize(e.target.value)}
          >
            <option value="">Chọn cấu hình</option>
            {[3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Sức chứa SV/hội đồng">
          <input
            required
            type="number"
            min="1"
            disabled={structuralFrozen}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />
        </Field>
        <Field label="Ngưỡng cảnh báo tải GVPB (tùy chọn)">
          <input
            type="number"
            min="1"
            disabled={structuralFrozen}
            value={warning}
            onChange={(e) => setWarning(e.target.value)}
          />
        </Field>
      </div>
      {windowKeys.map((k) => (
        <fieldset key={k} className="border p-3">
          <legend>{k}</legend>
          <Field label="Bắt đầu">
            <input
              required
              type="datetime-local"
              value={windows[k].opensAt}
              onChange={(e) =>
                setWindows({
                  ...windows,
                  [k]: { ...windows[k], opensAt: e.target.value },
                })
              }
            />
          </Field>
          <Field label="Kết thúc">
            <input
              required
              type="datetime-local"
              value={windows[k].closesAt}
              onChange={(e) =>
                setWindows({
                  ...windows,
                  [k]: { ...windows[k], closesAt: e.target.value },
                })
              }
            />
          </Field>
          <label>
            <input
              type="checkbox"
              checked={windows[k].isLocked}
              onChange={(e) =>
                setWindows({
                  ...windows,
                  [k]: { ...windows[k], isLocked: e.target.checked },
                })
              }
            />{" "}
            Khóa mốc
          </label>
        </fieldset>
      ))}
      <Button disabled={busy || !context.capabilities.configure}>
        Lưu policy vào backend
      </Button>
    </form>
  );
}
export function EligibilityState({
  context: c,
}: {
  context: DefenseWorkflowContext;
}) {
  return (
    <>
      <p>
        UC18: {c.list.state} · revision {c.list.revision} · policy revision{" "}
        {c.policyRevision}
      </p>
      {c.blockers.map((b) => (
        <Notice key={b}>{b}</Notice>
      ))}
      <p>
        {c.students.length} hồ sơ toàn roster ·{" "}
        {c.students.filter((s) => s.admitted).length} đủ điều kiện theo chứng cứ
        hiện hành.
      </p>
      {c.students.map((s) => (
        <article key={s.termStudentId} className="border p-3 my-2">
          <strong>
            {s.studentCode} · {s.studentName}
          </strong>
          <p>
            {s.title ?? "Chưa có Proposal"} ·{" "}
            {s.admitted
              ? "Đủ điều kiện theo chứng cứ hiện hành"
              : "Không admit"}
          </p>
          <p>
            Học vụ: {s.academic?.verdict ?? "UNKNOWN"} · revision{" "}
            {s.academic?.revision ?? 0}
          </p>
          {s.reasons.map((r) => (
            <p key={r}>{r}</p>
          ))}
        </article>
      ))}
    </>
  );
}
export function OfficialEligibilityPanel({
  termId,
  onChanged,
}: {
  termId: string;
  onChanged?: () => Promise<unknown>;
}) {
  const client = useQueryClient();
  const q = useQuery({
    queryKey: ["official-defense", sessionKey(), termId],
    queryFn: () => api.context(termId),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const [reviewed, setReviewed] = useState(""),
    [reason, setReason] = useState(""),
    [member, setMember] = useState(""),
    [verdict, setVerdict] = useState(""),
    [reference, setReference] = useState(""),
    [note, setNote] = useState(""),
    [message, setMessage] = useState("");
  const [needsReview, setNeedsReview] = useState(false);
  const history = useQuery({
    queryKey: [
      "academic-history",
      sessionKey(),
      termId,
      member,
      q.data?.expectedContext,
    ],
    queryFn: () => api.history(termId, member),
    enabled: !!member && !!q.data,
    retry: false,
  });
  const mutation = useMutation({
    mutationFn: async (
      action:
        | { kind: "policy"; policy: DefenseWorkflowPolicy }
        | { kind: "academic" | "finalize" | "reopen" },
    ) => {
      if (!q.data || q.isFetching || q.isError || needsReview)
        throw new Error("Cần tải lại context trước khi thao tác.");
      const c = q.data;
      if (action.kind === "policy")
        return api.configure(termId, {
          ...workflowInput(c, c.policyRevision),
          policy: action.policy,
        });
      if (action.kind === "academic") {
        const s = c.students.find((s) => s.termStudentId === member);
        if (!s || !verdict) throw new Error("Chọn hồ sơ và kết luận học vụ.");
        return api.academic(termId, {
          ...workflowInput(c, s.academicRevision),
          termStudentId: member,
          verdict: verdict as "SATISFIED" | "NOT_SATISFIED" | "SPECIAL",
          sourceReference: reference,
          note,
        });
      }
      if (action.kind === "reopen")
        return api.reopen(termId, {
          ...workflowInput(c, c.list.revision),
          reason,
        });
      if (reviewed !== c.expectedContext)
        throw new Error("Cần đối soát full roster mới nhất trước khi chốt.");
      return api.finalizeList(termId, workflowInput(c, c.list.revision));
    },
    onSuccess: async () => {
      setMessage("Command đã commit ở backend; đang đọc lại dữ liệu đã lưu.");
      setReviewed("");
      await q.refetch();
      await client.invalidateQueries({
        queryKey: ["official-defense-history", sessionKey(), termId],
      });
      await onChanged?.();
    },
    onError: async () => {
      setMessage("");
      setReviewed("");
      setNeedsReview(true);
      await q.refetch();
    },
    retry: false,
  });
  const busy = mutation.isPending || q.isFetching || needsReview;
  return (
    <Card title="Workflow UC18 chính thức">
      <Button
        variant="secondary"
        disabled={mutation.isPending || q.isFetching}
        onClick={() => {
          setReviewed("");
          void q.refetch();
        }}
      >
        Tải lại nguồn chính thức
      </Button>
      {needsReview && (
        <Notice tone="danger">
          Thao tác lỗi hoặc nguồn đã đổi. Xem lại dữ liệu mới trước khi thử lại.
          <Button
            variant="secondary"
            disabled={q.isFetching || q.isError}
            onClick={() => setNeedsReview(false)}
          >
            Đã xem lại dữ liệu backend
          </Button>
        </Notice>
      )}
      {q.isPending && <p role="status">Đang xác minh roster và PDF…</p>}
      {q.error && <Notice tone="danger">{workflowError(q.error)}</Notice>}
      {mutation.error && (
        <Notice tone="danger">{workflowError(mutation.error)}</Notice>
      )}
      {message && <Notice>{message}</Notice>}
      {q.data && !q.isError && (
        <>
          <EligibilityState context={q.data} />
          <details>
            <summary>Cấu hình policy và bốn mốc độc lập</summary>
            <PolicyEditor
              key={`${termId}:${q.data.policyRevision}`}
              context={q.data}
              busy={busy}
              onSave={(policy) => mutation.mutate({ kind: "policy", policy })}
            />
          </details>
          <form
            className="space-y-3 border p-3"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate({ kind: "academic" });
            }}
          >
            <h3>Ghi chứng cứ học vụ thủ công — append-only</h3>
            <select
              required
              aria-label="Hồ sơ học vụ"
              value={member}
              onChange={(e) => setMember(e.target.value)}
            >
              <option value="">Chọn TermStudent</option>
              {q.data.students.map((s) => (
                <option key={s.termStudentId} value={s.termStudentId}>
                  {s.studentCode} · {s.studentName}
                </option>
              ))}
            </select>
            <select
              required
              aria-label="Kết luận học vụ"
              value={verdict}
              onChange={(e) => setVerdict(e.target.value)}
            >
              <option value="">Chọn kết luận</option>
              <option value="SATISFIED">Đạt</option>
              <option value="NOT_SATISFIED">Không đạt</option>
              <option value="SPECIAL">Trường hợp đặc biệt cần đối soát</option>
            </select>
            <Field label="Nguồn tham chiếu">
              <input
                required
                maxLength={2000}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </Field>
            <Field label="Nhận xét">
              <textarea
                maxLength={4000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
            <Button disabled={busy || !q.data.capabilities.verifyAcademic}>
              Ghi phiên bản chứng cứ mới
            </Button>
          </form>
          {history.error && (
            <Notice tone="danger">{workflowError(history.error)}</Notice>
          )}
          {history.data && (
            <details>
              <summary>Lịch sử chứng cứ học vụ</summary>
              {history.data.items.map((e) => (
                <p key={e.id}>
                  Revision {e.revision} · {e.verdict} · {e.verifiedAt} ·{" "}
                  {e.sourceReference} · {e.integrity}
                </p>
              ))}
            </details>
          )}
          <label>
            <input
              type="checkbox"
              checked={reviewed === q.data.expectedContext}
              onChange={(e) =>
                setReviewed(e.target.checked ? q.data!.expectedContext : "")
              }
            />{" "}
            Đã đối soát toàn bộ roster và lý do loại/được bảo vệ hiện tại
          </label>
          <Button
            disabled={
              busy ||
              !q.data.capabilities.finalize ||
              reviewed !== q.data.expectedContext
            }
            onClick={() => mutation.mutate({ kind: "finalize" })}
          >
            Chốt danh sách UC18
          </Button>
          <Field label="Lý do mở lại">
            <textarea
              value={reason}
              maxLength={4000}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <Button
            disabled={busy || !q.data.capabilities.reopen || !reason.trim()}
            onClick={() => mutation.mutate({ kind: "reopen" })}
          >
            Mở lại UC18
          </Button>
          <p>
            MVP không mở lại khi đã có downstream FINALIZED/PUBLISHED; không tự
            gia hạn UC17.
          </p>
          <WorkflowHistory termId={termId} />
        </>
      )}
    </Card>
  );
}

export function StageState({
  stage,
  context,
}: {
  stage: DefenseStage;
  context: DefenseWorkflowContext;
}) {
  const row = context.stages.find((s) => s.stage === stage)!;
  return (
    <>
      <p>
        {stage}: {row.state} · revision {row.revision} · version{" "}
        {row.version ?? "—"}
      </p>
      {context.policy && (
        <p>
          Cấu hình: {context.policy.committeeSize} thành viên/hội đồng · tối đa{" "}
          {context.policy.committeeCapacity} SV/hội đồng · đúng 1 GVPB/hồ sơ.
          Mốc {stage}: {context.policy.windows[stage].opensAt} →{" "}
          {context.policy.windows[stage].closesAt} ·{" "}
          {context.policy.windows[stage].isLocked ? "Đang khóa" : "Không khóa"}.
        </p>
      )}
      <p>
        Nguồn hiện hành:{" "}
        {row.sourceCurrent
          ? "Đã xác minh bản chốt"
          : "Chưa có bản chốt hiện hành/nguồn cần đối soát"}
      </p>
      {context.blockers.map((b) => (
        <Notice key={b}>{b}</Notice>
      ))}
      {context.warnings.map((w) => (
        <Notice key={w}>{w}</Notice>
      ))}
    </>
  );
}
export function OfficialStagePanel({
  termId,
  stage,
  plan,
  onLoad,
}: {
  termId: string;
  stage: DefenseStage;
  plan: LocalPlan | null;
  onLoad: (c: DefenseWorkflowContext) => void;
}) {
  const client = useQueryClient();
  const q = useQuery({
    queryKey: ["official-defense", sessionKey(), termId],
    queryFn: () => api.context(termId),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const [reason, setReason] = useState(""),
    [message, setMessage] = useState("");
  const [needsReview, setNeedsReview] = useState(false);
  const mutation = useMutation({
    mutationFn: async (action: "save" | "finalize" | "publish" | "amend") => {
      const c = q.data,
        row = c?.stages.find((s) => s.stage === stage);
      if (!c || !row || q.isError || q.isFetching || needsReview)
        throw new Error("Tải lại nguồn server trước khi thao tác.");
      const input = workflowInput(c, row.revision);
      if (action === "publish") return api.publish(termId, input);
      if (action === "finalize") return api.seal(termId, stage, input);
      if (!plan) throw new Error("Khởi tạo hoặc nạp phương án trước khi lưu.");
      const draft: StageDraft =
        stage === "COMMITTEES"
          ? { committees: plan.committees }
          : stage === "REVIEWERS"
            ? { reviewers: plan.reviewers }
            : { slots: plan.slots };
      return action === "amend"
        ? api.amend(termId, { ...input, draft, reason })
        : api.save(termId, stage, { ...input, draft });
    },
    onSuccess: async () => {
      setMessage(
        "Backend đã commit. Dữ liệu/trạng thái bên dưới được tải lại từ server.",
      );
      await q.refetch();
      await client.invalidateQueries({
        queryKey: ["official-defense-history", sessionKey(), termId],
      });
    },
    onError: async () => {
      setMessage("");
      setNeedsReview(true);
      await q.refetch();
    },
    retry: false,
  });
  const c = q.data,
    row = c?.stages.find((s) => s.stage === stage),
    busy = q.isFetching || mutation.isPending || needsReview;
  return (
    <Card title="Lưu và chốt phương án trên backend">
      <Notice>
        Khác với preview: nút Lưu ghi draft server; Chốt dùng chính bản draft đã
        lưu, không dùng các chỉnh sửa local chưa lưu. GVPB luôn được tính là
        người tham dự khi chốt lịch.
      </Notice>
      {q.isPending && <p role="status">Đang tải workflow…</p>}
      {q.error && <Notice tone="danger">{workflowError(q.error)}</Notice>}
      {mutation.error && (
        <Notice tone="danger">{workflowError(mutation.error)}</Notice>
      )}
      {message && <Notice>{message}</Notice>}
      {needsReview && (
        <Notice tone="danger">
          Cần xem lại nguồn và nạp phương án server trước khi thử lại. Không tự
          rebase input cũ sau 409.
        </Notice>
      )}
      {c && row && !q.isError && (
        <>
          <StageState stage={stage} context={c} />
          <div className="flex gap-3 flex-wrap">
            <Button
              variant="secondary"
              disabled={q.isFetching || mutation.isPending}
              onClick={() => {
                void q.refetch();
              }}
            >
              Tải lại trạng thái server
            </Button>
            <Button
              variant="secondary"
              disabled={q.isFetching || mutation.isPending}
              onClick={() => {
                onLoad(c);
                setNeedsReview(false);
              }}
            >
              Nạp các phương án đã lưu từ server
            </Button>
            <Button
              disabled={busy || !plan || !row.capabilities.save}
              onClick={() => mutation.mutate("save")}
            >
              Lưu draft {stage}
            </Button>
            <Button
              disabled={busy || !row.capabilities.finalize}
              onClick={() => mutation.mutate("finalize")}
            >
              Chốt bản đã lưu {stage}
            </Button>
            {stage === "SCHEDULE" && (
              <>
                <Button
                  disabled={busy || !row.capabilities.publish}
                  onClick={() => mutation.mutate("publish")}
                >
                  Công bố lịch
                </Button>
                <Field label="Lý do điều chỉnh lịch đã công bố">
                  <input
                    value={reason}
                    maxLength={4000}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </Field>
                <Button
                  disabled={
                    busy || !plan || !row.capabilities.amend || !reason.trim()
                  }
                  onClick={() => mutation.mutate("amend")}
                >
                  Công bố phiên bản điều chỉnh mới
                </Button>
              </>
            )}
          </div>
          <details>
            <summary>Dữ liệu draft đang lưu trên server</summary>
            <pre className="overflow-auto max-h-80">
              {JSON.stringify(row.draft, null, 2)}
            </pre>
          </details>
          <WorkflowHistory termId={termId} />
          {stage === "REVIEWERS" && (
            <>
              <p>
                Tải GVPB:{" "}
                {c.workload
                  .map((w) => `${w.lecturerId}: ${w.count}`)
                  .join(" · ")}
              </p>
              <Button
                variant="secondary"
                disabled={busy || !plan || !row.capabilities.save}
                onClick={() =>
                  onLoad({
                    ...c,
                    stages: c.stages.map((r) =>
                      r.stage === "REVIEWERS"
                        ? { ...r, draft: { reviewers: c.suggestions } }
                        : r,
                    ),
                  })
                }
              >
                Nạp gợi ý ít tải để chỉnh thủ công (chưa lưu)
              </Button>
            </>
          )}
        </>
      )}
    </Card>
  );
}
