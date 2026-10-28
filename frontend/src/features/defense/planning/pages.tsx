import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type {
  CommitteePlan,
  PlanningPreview,
  ScheduleSlot,
} from "@doan/shared";
import {
  Button,
  Card,
  Empty,
  Field,
  Notice,
} from "../../../shared/components/kit";
import { planningApi, planningErrorMessage } from "./api";
import { usePlanning } from "./layout";

export function PreviewResult({ result }: { result: PlanningPreview }) {
  return (
    <Card title="Kết quả kiểm tra từ backend">
      <Notice tone={result.validForPreview ? "info" : "danger"}>
        {result.validForPreview
          ? "Không phát hiện lỗi trong phần quy tắc preview đã kiểm tra."
          : "Phương án có lỗi cần chỉnh sửa."}{" "}
        Đây là preview chưa lưu; không phải xác nhận đủ điều kiện chốt/công bố.
      </Notice>
      {result.issues.map((i, n) => (
        <Notice tone="danger" key={`i${n}`}>
          {i.target ? `${i.target}: ` : ""}
          {i.message}
        </Notice>
      ))}
      {result.warnings.map((i, n) => (
        <Notice key={`w${n}`}>{i.message}</Notice>
      ))}
      {result.workload.length > 0 && (
        <p>
          Tải phản biện:{" "}
          {result.workload
            .map((w) => `${w.lecturerId}: ${w.count}`)
            .join(" · ")}
          . Không tự đặt giới hạn tải.
        </p>
      )}
      <p>
        Chưa lưu dữ liệu chính thức. Không gửi thông báo cho giảng viên từ
        preview.
      </p>
    </Card>
  );
}
function usePreview(stage: "COMMITTEES" | "REVIEWERS" | "SCHEDULE") {
  const w = usePlanning();
  const [sentPlan, setSentPlan] = useState<typeof w.plan | null>(null);
  const mutation = useMutation({
    retry: false,
    mutationFn: () => {
      if (w.blocked)
        throw new Error("Cần nguồn và phương án mới nhất trước khi kiểm tra.");
      setSentPlan(w.plan);
      const base = {
        expectedContext: w.plan.expectedContext,
        committees: w.plan.committees,
      };
      return stage === "COMMITTEES"
        ? planningApi.previewCommittees(w.termId, base)
        : stage === "REVIEWERS"
          ? planningApi.previewReviewers(w.termId, {
              ...base,
              reviewers: w.plan.reviewers,
            })
          : planningApi.previewSchedule(w.termId, {
              ...base,
              reviewers: w.plan.reviewers,
              slots: w.plan.slots,
              includeReviewersAsAttendees: w.plan.includeReviewersAsAttendees,
            });
    },
    onError: async (e) => {
      if ([401, 403, 409].includes((e as { status?: number }).status ?? 0))
        await w.conflict();
    },
  });
  return {
    w,
    mutation,
    result: sentPlan === w.plan ? mutation.data : undefined,
  };
}
const freshMembers = (): CommitteePlan["members"] => [
  { lecturerId: "", role: "CHAIR" },
  { lecturerId: "", role: "SECRETARY" },
  { lecturerId: "", role: "MEMBER" },
];

export function CommitteePlanningPage() {
  const { w, mutation, result } = usePreview("COMMITTEES");
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [members, setMembers] = useState(freshMembers);
  const [selected, setSelected] = useState<string[]>([]);
  const [maxStudents, setMaxStudents] = useState("");
  const existing = useQuery({
    queryKey: ["planning-committees", w.termId, w.context.expectedContext],
    queryFn: () => planningApi.committees(w.termId),
    retry: false,
  });
  const [detailId, setDetailId] = useState("");
  const detail = useQuery({
    queryKey: [
      "planning-committee-detail",
      w.termId,
      detailId,
      w.context.expectedContext,
    ],
    queryFn: () => planningApi.committee(w.termId, detailId),
    enabled: !!detailId,
    retry: false,
  });
  const eligible = w.context.students.filter(
    (s) =>
      s.proposalId &&
      (w.context.source.kind !== "UC18_FINALIZED" || s.admitted),
  );
  const edit = (c: CommitteePlan) => {
    mutation.reset();
    setEditing(c.key);
    setName(c.name);
    setMembers(c.members);
    setSelected(c.proposalIds);
    setMaxStudents(c.maxStudents?.toString() ?? "");
  };
  return (
    <div className="space-y-5">
      <Card title="UC19 · Hội đồng trong phương án chưa lưu">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (w.blocked) return;
            const c: CommitteePlan = {
              key: editing || crypto.randomUUID(),
              name: name.trim(),
              members,
              proposalIds: selected,
              ...(maxStudents ? { maxStudents: Number(maxStudents) } : {}),
            };
            w.setPlan({
              ...w.plan,
              committees: [
                ...w.plan.committees.filter((p) => p.key !== c.key),
                c,
              ],
            });
            mutation.reset();
            setEditing(null);
            setName("");
            setMembers(freshMembers());
            setSelected([]);
            setMaxStudents("");
          }}
        >
          <Field label="Tên hội đồng đề xuất">
            <input
              required
              maxLength={200}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Sức chứa sinh viên giả định (tùy chọn, chưa phải cấu hình đợt)">
            <input
              type="number"
              min={1}
              max={1000}
              value={maxStudents}
              onChange={(e) => setMaxStudents(e.target.value)}
            />
          </Field>
          {members.map((m, i) => (
            <div key={i} className="flex gap-3">
              <select
                aria-label={`Thành viên ${i + 1}`}
                required
                value={m.lecturerId}
                onChange={(e) =>
                  setMembers(
                    members.map((v, n) =>
                      n === i ? { ...v, lecturerId: e.target.value } : v,
                    ),
                  )
                }
              >
                <option value="">Chọn giảng viên trong đợt</option>
                {w.context.lecturers.map((l) => (
                  <option value={l.id} key={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <select
                aria-label={`Vai trò ${i + 1}`}
                value={m.role}
                onChange={(e) =>
                  setMembers(
                    members.map((v, n) =>
                      n === i
                        ? { ...v, role: e.target.value as typeof m.role }
                        : v,
                    ),
                  )
                }
              >
                <option value="CHAIR">Chủ tịch</option>
                <option value="SECRETARY">Thư ký</option>
                <option value="MEMBER">Ủy viên</option>
              </select>
              <Button
                type="button"
                disabled={members.length <= 3}
                onClick={() => setMembers(members.filter((_, n) => n !== i))}
              >
                Bỏ dòng
              </Button>
            </div>
          ))}
          <Button
            type="button"
            disabled={members.length >= 5}
            onClick={() =>
              setMembers([...members, { lecturerId: "", role: "MEMBER" }])
            }
          >
            Thêm thành viên
          </Button>
          <Field label="Hồ sơ đưa vào phương án">
            {eligible.map((s) => (
              <label key={s.proposalId} className="block">
                <input
                  type="checkbox"
                  checked={selected.includes(s.proposalId!)}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? [...selected, s.proposalId!]
                        : selected.filter((id) => id !== s.proposalId),
                    )
                  }
                />{" "}
                {s.code || s.studentId} · {s.name || "Thiếu dữ liệu"} · GVHD{" "}
                {s.advisor?.name || "Chưa chính thức"}
              </label>
            ))}
          </Field>
          <Button disabled={w.blocked}>
            Thêm/cập nhật trong phương án chưa lưu
          </Button>
        </form>
        {!w.plan.committees.length && (
          <Empty
            title="Chưa có hội đồng trong phương án"
            description="Nhập thành viên và hồ sơ, rồi gửi preview để backend kiểm tra."
          />
        )}
        {w.plan.committees.map((c) => (
          <article className="border rounded p-3 mt-3" key={c.key}>
            <strong>{c.name}</strong>
            <p>
              {c.members.length} thành viên · {c.proposalIds.length} hồ sơ
            </p>
            <Button variant="secondary" onClick={() => edit(c)}>
              Sửa phương án
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                w.setPlan({
                  ...w.plan,
                  committees: w.plan.committees.filter((x) => x.key !== c.key),
                });
                mutation.reset();
              }}
            >
              Bỏ khỏi phương án
            </Button>
          </article>
        ))}
        <div className="flex gap-3 mt-4">
          <Button
            disabled={w.blocked || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Kiểm tra hội đồng bằng API
          </Button>
          <p>
            Lưu/chốt bằng panel workflow server phía trên sau khi kiểm tra
            phương án.
          </p>
        </div>
        {mutation.isPending && <p role="status">Đang kiểm tra phương án…</p>}
        {mutation.error && (
          <Notice tone="danger">{planningErrorMessage(mutation.error)}</Notice>
        )}
        {result && !w.blocked && <PreviewResult result={result} />}
      </Card>
      <Card title="Bản ghi hội đồng đã có — chưa xác minh chốt">
        {existing.isPending && <p role="status">Đang đọc hội đồng…</p>}
        {existing.error && (
          <Notice tone="danger">{planningErrorMessage(existing.error)}</Notice>
        )}
        {existing.data?.items.map((c) => (
          <div key={c.id} className="flex gap-3">
            <span>
              {c.name} · {c.lifecycle}
            </span>
            <Button variant="secondary" onClick={() => setDetailId(c.id)}>
              Xem chi tiết
            </Button>
          </div>
        ))}
        {existing.data && !existing.data.items.length && (
          <Empty title="Chưa có bản ghi hội đồng" />
        )}
        {detail.isFetching && detailId && (
          <p role="status">Đang đọc chi tiết…</p>
        )}
        {detail.error && (
          <Notice tone="danger">{planningErrorMessage(detail.error)}</Notice>
        )}
        {detail.data && !detail.isError && (
          <div>
            <strong>
              {detail.data.record.name} · {detail.data.record.lifecycle}
            </strong>
            {detail.data.record.members.map((m) => (
              <p key={m.lecturerId}>
                {m.name} · {m.role}
              </p>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export function ReviewerPlanningPage() {
  const { w, mutation, result } = usePreview("REVIEWERS");
  const allocated = new Set(w.plan.committees.flatMap((c) => c.proposalIds));
  const rows = w.context.students.filter(
    (s) => s.proposalId && allocated.has(s.proposalId),
  );
  const existing = useQuery({
    queryKey: ["planning-reviewers", w.termId, w.context.expectedContext],
    queryFn: () => planningApi.reviewers(w.termId),
    retry: false,
  });
  return (
    <div className="space-y-5">
      <Card title="UC20 · Phản biện trong phương án chưa lưu">
        <Notice>
          Không tự chọn số GVPB hoặc giới hạn tải khi chưa có policy. Chọn những
          giảng viên dự kiến rồi dùng API kiểm tra; chưa gửi thông báo hay tạo
          quyền phản biện.
        </Notice>
        {!rows.length && (
          <Empty
            title="Chưa có hồ sơ trong phương án hội đồng"
            description="Lập phương án UC19 trước khi chọn GVPB."
          />
        )}
        {rows.map((s) => (
          <article className="border rounded p-3 my-3" key={s.proposalId}>
            <strong>
              {s.code} · {s.name}
            </strong>
            <p>GVHD chính thức: {s.advisor?.name || "Chưa xác minh"}</p>
            {w.context.lecturers.map((l) => {
              const chosen =
                w.plan.reviewers.find((r) => r.proposalId === s.proposalId)
                  ?.reviewerIds ?? [];
              return (
                <label className="block" key={l.id}>
                  <input
                    type="checkbox"
                    disabled={w.blocked || !s.advisor || s.advisor.id === l.id}
                    checked={chosen.includes(l.id)}
                    onChange={(e) => {
                      mutation.reset();
                      w.setPlan({
                        ...w.plan,
                        reviewers: [
                          ...w.plan.reviewers.filter(
                            (r) => r.proposalId !== s.proposalId,
                          ),
                          {
                            proposalId: s.proposalId!,
                            reviewerIds: e.target.checked ? [l.id] : [],
                          },
                        ],
                      });
                    }}
                  />{" "}
                  {l.name}
                  {s.advisor?.id === l.id
                    ? " — GVHD, không được phản biện"
                    : ""}
                </label>
              );
            })}
          </article>
        ))}
        <Button
          disabled={w.blocked || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Kiểm tra phản biện bằng API
        </Button>{" "}
        <p>Lưu/chốt và thông báo qua panel workflow server phía trên.</p>
        {mutation.isPending && <p role="status">Đang kiểm tra phương án…</p>}
        {mutation.error && (
          <Notice tone="danger">{planningErrorMessage(mutation.error)}</Notice>
        )}
        {result && !w.blocked && <PreviewResult result={result} />}
      </Card>
      <Card title="Phân công đã có — chưa xác minh chốt">
        {existing.isPending && <p role="status">Đang đọc phân công…</p>}
        {existing.error && (
          <Notice tone="danger">{planningErrorMessage(existing.error)}</Notice>
        )}
        {existing.data?.items.map((r) => (
          <p key={r.id}>
            {r.proposalId} ·{" "}
            {w.context.lecturers.find((l) => l.id === r.reviewerId)?.name ||
              r.reviewerId}{" "}
            · {r.lifecycle}
          </p>
        ))}
        {existing.data && !existing.data.items.length && (
          <Empty title="Chưa có bản ghi phản biện" />
        )}
      </Card>
    </div>
  );
}

export function SchedulePlanningPage() {
  const { w, mutation, result } = usePreview("SCHEDULE");
  const [committeeKey, setCommittee] = useState("");
  const [proposalId, setProposal] = useState("");
  const [roomId, setRoom] = useState("");
  const [startsAt, setStart] = useState("");
  const [endsAt, setEnd] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const existing = useQuery({
    queryKey: ["planning-schedule", w.termId, w.context.expectedContext],
    queryFn: () => planningApi.schedule(w.termId),
    retry: false,
  });
  const edit = (s: ScheduleSlot) => {
    setEditing(s.key);
    setCommittee(s.committeeKey);
    setProposal(s.proposalId);
    setRoom(s.roomId);
    const local = (iso: string) => {
      const date = new Date(iso);
      return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
    };
    setStart(local(s.startsAt));
    setEnd(local(s.endsAt));
    mutation.reset();
  };
  return (
    <div className="space-y-5">
      <Card title="UC21 · Lịch đề xuất chưa lưu/chưa công bố">
        <Notice>
          Thời gian nhập theo múi giờ máy đang dùng. Không tự đặt thời lượng 30
          phút, quy tắc alphabet hoặc coi bản ghi cũ là lịch đã công bố.
        </Notice>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (w.blocked) return;
            const s = {
              key: editing || crypto.randomUUID(),
              committeeKey,
              proposalId,
              roomId,
              startsAt: new Date(startsAt).toISOString(),
              endsAt: new Date(endsAt).toISOString(),
            };
            w.setPlan({
              ...w.plan,
              slots: [...w.plan.slots.filter((v) => v.key !== s.key), s],
            });
            setEditing(null);
            mutation.reset();
          }}
        >
          <Field label="Hội đồng đề xuất">
            <select
              required
              value={committeeKey}
              onChange={(e) => {
                setCommittee(e.target.value);
                setProposal("");
              }}
            >
              <option value="">Chọn hội đồng</option>
              {w.plan.committees.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Hồ sơ">
            <select
              required
              value={proposalId}
              onChange={(e) => setProposal(e.target.value)}
            >
              <option value="">Chọn hồ sơ thuộc hội đồng</option>
              {w.plan.committees
                .find((c) => c.key === committeeKey)
                ?.proposalIds.map((id) => (
                  <option value={id} key={id}>
                    {w.context.students.find((s) => s.proposalId === id)
                      ?.name || id}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Phòng">
            <select
              required
              value={roomId}
              onChange={(e) => setRoom(e.target.value)}
            >
              <option value="">Chọn phòng</option>
              {w.context.rooms.map((r) => (
                <option value={r.id} key={r.id}>
                  {r.code} · {r.capacity} chỗ
                </option>
              ))}
            </select>
          </Field>
          <Field label="Bắt đầu">
            <input
              required
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStart(e.target.value)}
            />
          </Field>
          <Field label="Kết thúc">
            <input
              required
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEnd(e.target.value)}
            />
          </Field>
          <Button disabled={w.blocked}>
            Thêm/cập nhật dòng lịch trong phương án
          </Button>
        </form>
        <label className="block mt-4">
          <input
            type="checkbox"
            checked={w.plan.includeReviewersAsAttendees}
            disabled={w.blocked}
            onChange={(e) => {
              mutation.reset();
              w.setPlan({
                ...w.plan,
                includeReviewersAsAttendees: e.target.checked,
              });
            }}
          />{" "}
          Giả định GVPB tham dự để kiểm tra trùng lịch (chỉ cho preview)
        </label>
        {w.plan.slots.map((s) => (
          <article className="border rounded p-3 my-3" key={s.key}>
            <p>
              {w.context.students.find((p) => p.proposalId === s.proposalId)
                ?.name || s.proposalId}{" "}
              · {new Date(s.startsAt).toLocaleString()} →{" "}
              {new Date(s.endsAt).toLocaleString()}
            </p>
            <Button variant="secondary" onClick={() => edit(s)}>
              Sửa dòng
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                mutation.reset();
                w.setPlan({
                  ...w.plan,
                  slots: w.plan.slots.filter((v) => v.key !== s.key),
                });
              }}
            >
              Bỏ dòng
            </Button>
          </article>
        ))}
        <Button
          disabled={w.blocked || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Kiểm tra lịch bằng API
        </Button>{" "}
        <p>Lưu/chốt/công bố qua panel workflow server phía trên.</p>
        {mutation.isPending && <p role="status">Đang kiểm tra phương án…</p>}
        {mutation.error && (
          <Notice tone="danger">{planningErrorMessage(mutation.error)}</Notice>
        )}
        {result && !w.blocked && <PreviewResult result={result} />}
      </Card>
      <Card title="Bản ghi lịch đã có — không phải bằng chứng công bố">
        {existing.isPending && <p role="status">Đang đọc lịch…</p>}
        {existing.error && (
          <Notice tone="danger">{planningErrorMessage(existing.error)}</Notice>
        )}
        {existing.data?.items.map((s) => (
          <p key={s.id}>
            {new Date(s.startsAt).toLocaleString()} · {s.durationMin} phút đã
            lưu · {s.lifecycle}
            {s.hasUnscopedReferences
              ? " · Có tham chiếu hồ sơ chưa xác minh"
              : ""}
          </p>
        ))}
        {existing.data && !existing.data.items.length && (
          <Empty title="Chưa có bản ghi lịch" />
        )}
      </Card>
    </div>
  );
}
