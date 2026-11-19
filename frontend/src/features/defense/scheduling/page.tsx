import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import type {
  ScheduleBatch,
  ScheduleCommand,
  ScheduleProposal,
  ScheduleSave,
} from "@doan/shared";
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
import { eligibilityError } from "../eligibility/components";
import { scheduleApi as api } from "./api";
import {
  ScheduleDetail,
  ScheduleEditor,
  ScheduleProposalPreview,
  ScheduleReasons,
  ScheduleRows,
  scheduleLabels,
} from "./components";
type Command =
  | { action: "save"; id: string | null; body: ScheduleSave }
  | { action: "assign"; body: ScheduleBatch }
  | { action: "finalize" | "publish" | "cancel"; body: ScheduleCommand };
export function SchedulePage() {
  return AUTH_API ? (
    <ScheduleContent />
  ) : (
    <Notice>Lịch bảo vệ cần API và quyền truy cập của hệ thống nhóm.</Notice>
  );
}
function ScheduleContent() {
  const user = useApiSession(),
    client = useQueryClient(),
    [params, setParams] = useSearchParams(),
    termId = params.get("termId") ?? "",
    sessionId = params.get("sessionId") ?? "",
    search = params.get("search") ?? "",
    date = params.get("date") ?? "",
    period = params.get("period") ?? "",
    roomId = params.get("roomId") ?? "",
    committeeId = params.get("committeeId") ?? "",
    state = params.get("state") ?? "",
    page = Math.max(1, Number(params.get("page")) || 1);
  const [selected, setSelected] = useState<string[]>([]),
    [proposal, setProposal] = useState<ScheduleProposal | null>(null),
    [message, setMessage] = useState("");
  const generation = useRef(""),
    keys = useRef(new Map<string, string>());
  generation.current = `${user?.id}:${termId}`;
  const terms = useQuery({
    queryKey: ["schedule-terms", user?.id],
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
  const query = useQuery({
      queryKey: ["schedule-workspace", user?.id, termId],
      queryFn: () => api.workspace(termId),
      enabled: !!user && !!termId,
    }),
    w = query.data?.termId === termId ? query.data : undefined;
  useEffect(() => {
    setSelected([]);
    setProposal(null);
  }, [user?.id, termId, w?.rosterHash]);
  useEffect(() => {
    setMessage("");
  }, [user?.id, termId]);
  const mutation = useMutation({
    mutationFn: async (cmd: Command) => {
      if (
        !w ||
        cmd.body.termId !== termId ||
        cmd.body.rosterHash !== w.rosterHash
      )
        throw Error("Lịch hoặc nguồn đã thay đổi; tải lại.");
      const identity = JSON.stringify([user?.id, termId, cmd]);
      if (!keys.current.has(identity))
        keys.current.set(identity, crypto.randomUUID());
      const key = keys.current.get(identity)!,
        scope = generation.current;
      const result =
        cmd.action === "save"
          ? await api.save(cmd.id, cmd.body, key)
          : cmd.action === "assign"
            ? await api.assign(cmd.body, key)
            : await api.transition(cmd.action, cmd.body, key);
      return { result, scope };
    },
    onMutate: () => setMessage(""),
    onSuccess: async ({ scope }) => {
      if (scope === generation.current) {
        setMessage("Đã lưu thao tác lịch bảo vệ trên hệ thống.");
        setProposal(null);
      }
      await client.invalidateQueries({ queryKey: ["schedule-workspace"] });
      await client.invalidateQueries({ queryKey: ["schedule-terms"] });
    },
  });
  const preview = useMutation({
    mutationFn: async () => {
      const scope = generation.current;
      return { scope, result: await api.propose(termId, selected) };
    },
    onSuccess: ({ scope, result }) => {
      if (scope === generation.current && result.rosterHash === w?.rosterHash)
        setProposal(result);
    },
  });
  useEffect(() => {
    mutation.reset();
    preview.reset();
  }, [user?.id, termId, mutation.reset, preview.reset]);
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    if (key === "termId") next.delete("sessionId");
    setParams(next);
    setMessage("");
  };
  const filtered =
      w?.schedules
        .filter(
          (s) =>
            (!date || s.date === date) &&
            (!period || s.period === period) &&
            (!roomId || s.roomId === roomId) &&
            (!committeeId || s.committeeId === committeeId) &&
            (!state || s.state === state) &&
            (!search ||
              s.slots.some((a) =>
                `${a.studentCode} ${a.studentName}`
                  .normalize("NFC")
                  .toLocaleLowerCase("vi")
                  .includes(search.normalize("NFC").toLocaleLowerCase("vi")),
              )),
        )
        .sort(
          (a, b) =>
            a.startAt.localeCompare(b.startAt) || a.id.localeCompare(b.id),
        ) ?? [],
    current = w?.schedules.find((s) => s.id === sessionId),
    pending = mutation.isPending || preview.isPending;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Lịch bảo vệ đồ án"
        description="Ngày, buổi, phòng và thứ tự Tên + Họ đệm. Thời gian hiển thị theo giờ Việt Nam."
      />
      {terms.isLoading && <Notice>Đang tải đợt…</Notice>}
      {terms.error && <Notice>{eligibilityError(terms.error)}</Notice>}
      <Card>
        <Field label="Đợt đồ án">
          <select
            value={termId}
            disabled={pending}
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
        <Field label="Ngày">
          <input
            type="date"
            value={date}
            onChange={(e) => update("date", e.target.value)}
          />
        </Field>
        <Field label="Buổi">
          <select
            value={period}
            onChange={(e) => update("period", e.target.value)}
          >
            <option value="">Tất cả</option>
            <option value="MORNING">Sáng</option>
            <option value="AFTERNOON">Chiều</option>
          </select>
        </Field>
        <Field label="Hội đồng">
          <select
            value={committeeId}
            onChange={(e) => update("committeeId", e.target.value)}
          >
            <option value="">Tất cả</option>
            {[
              ...new Map(
                w?.schedules.map((s) => [s.committeeId, s.committeeCode]) ?? [],
              ),
              ...new Map(w?.sources.map((s) => [s.committeeId, s.code]) ?? []),
            ]
              .filter(([id], i, a) => a.findIndex((x) => x[0] === id) === i)
              .map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Phòng">
          <select
            value={roomId}
            onChange={(e) => update("roomId", e.target.value)}
          >
            <option value="">Tất cả</option>
            {[
              ...new Map(w?.schedules.map((s) => [s.roomId, s.roomName]) ?? []),
            ].map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Sinh viên">
          <input
            value={search}
            maxLength={200}
            onChange={(e) => update("search", e.target.value)}
          />
        </Field>
        <Field label="Trạng thái">
          <select
            value={state}
            onChange={(e) => update("state", e.target.value)}
          >
            <option value="">Tất cả</option>
            {[
              "DRAFT",
              "FINALIZED",
              "STALE",
              "LEGACY_UNVERIFIED",
              "CANCELLED",
            ].map((v) => (
              <option key={v} value={v}>
                {scheduleLabels[v]}
              </option>
            ))}
          </select>
        </Field>
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => {
            setProposal(null);
            void query.refetch();
          }}
        >
          Tải lại lịch
        </Button>
      </Card>
      {query.isLoading && termId && (
        <Notice>Đang tải lịch và chứng cứ nguồn…</Notice>
      )}
      {query.error && <Notice>{eligibilityError(query.error)}</Notice>}
      {mutation.error && <Notice>{eligibilityError(mutation.error)}</Notice>}
      {preview.error && <Notice>{eligibilityError(preview.error)}</Notice>}
      {mutation.isPending && <Notice>Đang lưu lịch…</Notice>}
      {message && <Notice>{message}</Notice>}
      {!termId && <Empty title="Chọn đợt để xem lịch bảo vệ" />}
      {w && (
        <>
          <ScheduleReasons values={w.blockers} />
          <Card
            title={
              w.mode === "PERSONAL"
                ? "Lịch cá nhân đã công bố"
                : "Danh sách lịch bảo vệ"
            }
          >
            <ScheduleRows
              items={filtered.slice((page - 1) * 20, page * 20)}
              select={(id) => update("sessionId", id)}
            />
            <p>
              {filtered.length} phiên · Trang {page}
            </p>
            <Button
              variant="secondary"
              disabled={page <= 1}
              onClick={() => update("page", String(page - 1))}
            >
              Trước
            </Button>
            <Button
              variant="secondary"
              disabled={page * 20 >= filtered.length}
              onClick={() => update("page", String(page + 1))}
            >
              Sau
            </Button>
          </Card>
          {w.mode === "FACULTY" && (
            <>
              {w.policy && (
                <Card title={`Chính sách ${w.policy.version}`}>
                  <p>{w.policy.reference}</p>
                  <p>
                    Sáng {w.policy.periods.MORNING.start}–
                    {w.policy.periods.MORNING.end}; Chiều{" "}
                    {w.policy.periods.AFTERNOON.start}–
                    {w.policy.periods.AFTERNOON.end}. {w.policy.durationMin}{" "}
                    phút/lượt, đệm {w.policy.bufferMin} phút, tối đa{" "}
                    {w.policy.maxStudentsPerSession} sinh viên/phiên.
                  </p>
                </Card>
              )}
              <Card title="Đề xuất tự động">
                <p>Giữ các phiên đã có, chỉ xếp sinh viên chưa có lịch.</p>
                {w.sources.map((s) => (
                  <label key={s.committeeId} className="block">
                    <input
                      type="checkbox"
                      checked={selected.includes(s.committeeId)}
                      disabled={pending}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [...selected, s.committeeId]
                            : selected.filter((id) => id !== s.committeeId),
                        )
                      }
                    />
                    {s.code} · {s.students.length} sinh viên
                    <ScheduleReasons values={s.issues} />
                  </label>
                ))}
                <Button
                  disabled={
                    pending ||
                    !w.permissions.create ||
                    !w.schemaReady ||
                    !w.policy
                  }
                  onClick={() => preview.mutate()}
                >
                  Đề xuất lịch sáng/chiều
                </Button>
                {!w.permissions.create && (
                  <ScheduleReasons values={["FACULTY_PERMISSION_REQUIRED"]} />
                )}
              </Card>
              {proposal && (
                <ScheduleProposalPreview
                  workspace={w}
                  proposal={proposal}
                  pending={pending}
                  apply={(reason) =>
                    mutation.mutate({
                      action: "assign",
                      body: {
                        termId,
                        rosterHash: proposal.rosterHash,
                        reason,
                        sessions: proposal.sessions.map((b) => ({
                          id: null,
                          body: { ...b, reason },
                        })),
                      },
                    })
                  }
                />
              )}
              <Button
                variant="secondary"
                onClick={() => update("sessionId", "")}
              >
                Tạo phiên mới
              </Button>
              <ScheduleEditor
                key={`${user?.id}:${termId}:${current?.id ?? "new"}:${current?.revision}:${w.rosterHash}`}
                workspace={w}
                current={current}
                pending={pending}
                save={(id, body) =>
                  mutation.mutate({ action: "save", id, body })
                }
              />
            </>
          )}
          {current && (
            <ScheduleDetail
              key={`${user?.id}:${termId}:${current.id}:${current.revision}`}
              workspace={w}
              schedule={current}
              pending={pending}
              transition={(action, body) => mutation.mutate({ action, body })}
            />
          )}
          {sessionId && !current && (
            <Empty title="Không tìm thấy lịch trong phạm vi được phép" />
          )}
        </>
      )}
    </div>
  );
}
