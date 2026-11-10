import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import type {
  CommitteeAllocation,
  CommitteeAssign,
  CommitteeFinalize,
  CommitteeSave,
  CommitteeUnassign,
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
import { committeeApi as api } from "./api";
import {
  AllocationPreview,
  CommitteeDetail,
  CommitteeEditor,
  CommitteeReasons,
  CommitteeRows,
  committeeLabels,
} from "./components";
type Command =
  | { action: "save"; id: string | null; body: CommitteeSave }
  | { action: "assign"; body: CommitteeAssign }
  | { action: "unassign"; id: string; body: CommitteeUnassign }
  | { action: "finalize"; id: string; body: CommitteeFinalize };
export function CommitteePage() {
  return AUTH_API ? (
    <CommitteeContent />
  ) : (
    <Notice>
      Quản lý hội đồng cần API và tài khoản Khoa của hệ thống nhóm.
    </Notice>
  );
}
function CommitteeContent() {
  const user = useApiSession(),
    client = useQueryClient(),
    [params, setParams] = useSearchParams();
  const termId = params.get("termId") ?? "",
    committeeId = params.get("committeeId") ?? "",
    search = params.get("search") ?? "",
    state = params.get("state") ?? "",
    page = Math.max(1, Number(params.get("page")) || 1);
  const [selected, setSelected] = useState<string[]>([]),
    [message, setMessage] = useState(""),
    [proposal, setProposal] = useState<CommitteeAllocation | null>(null);
  const keys = useRef(new Map<string, string>()),
    generation = useRef("");
  generation.current = `${user?.id}:${termId}`;
  const terms = useQuery({
    queryKey: ["committee-terms", user?.id],
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
    queryKey: ["committee-workspace", user?.id, termId],
    queryFn: () => api.workspace(termId),
    enabled: !!user && !!termId,
  });
  const w = query.data?.termId === termId ? query.data : undefined;
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
        throw new Error("Hội đồng đã thay đổi; tải lại.");
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
            : cmd.action === "unassign"
              ? await api.unassign(cmd.id, cmd.body, key)
              : await api.finalize(cmd.id, cmd.body, key);
      return { result, scope };
    },
    onMutate: () => setMessage(""),
    onSuccess: async ({ scope }) => {
      if (scope === generation.current) {
        setMessage("Đã lưu thao tác hội đồng trên hệ thống.");
        setProposal(null);
      }
      await client.invalidateQueries({ queryKey: ["committee-workspace"] });
    },
  });
  const preview = useMutation({
    mutationFn: async () => {
      const scope = generation.current;
      return { result: await api.propose(termId, selected), scope };
    },
    onSuccess: ({ result, scope }) => {
      if (scope === generation.current && w?.rosterHash === result.rosterHash)
        setProposal(result);
    },
  });
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    if (key === "termId") next.delete("committeeId");
    setMessage("");
    setParams(next);
  };
  const current = w?.committees.find((c) => c.id === committeeId),
    filtered =
      w?.committees.filter(
        (c) =>
          (!state || c.state === state) &&
          (!search ||
            `${c.code ?? ""} ${c.name}`
              .normalize("NFC")
              .toLocaleLowerCase("vi")
              .includes(search.normalize("NFC").toLocaleLowerCase("vi"))),
      ) ?? [];
  const assign = (body: CommitteeAssign) =>
    mutation.mutate({ action: "assign", body });
  return (
    <div className="space-y-6">
      <PageHeader
        title="Thành lập hội đồng bảo vệ"
        description="Cơ cấu hội đồng, phân sinh viên và chốt. GVHD không được là bất kỳ thành viên nào của hội đồng có sinh viên mình hướng dẫn."
      />
      {terms.isLoading && <Notice>Đang tải đợt…</Notice>}
      {terms.error && <Notice>{eligibilityError(terms.error)}</Notice>}
      <Card>
        <Field label="Đợt đồ án">
          <select
            value={termId}
            disabled={mutation.isPending}
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
        <Field label="Tìm mã/tên hội đồng">
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
            {["DRAFT", "FINALIZED", "STALE", "LEGACY_UNVERIFIED"].map((v) => (
              <option key={v} value={v}>
                {committeeLabels[v]}
              </option>
            ))}
          </select>
        </Field>
      </Card>
      {query.isLoading && termId && (
        <Notice>Đang tải hội đồng và chứng cứ UC18…</Notice>
      )}
      {query.error && <Notice>{eligibilityError(query.error)}</Notice>}
      {w && (
        <>
          <CommitteeReasons values={w.blockers} />
          {w.policy && (
            <Card title={`Chính sách hội đồng ${w.policy.version}`}>
              <p>{w.policy.reference}</p>
              <p>
                Cơ cấu: {w.policy.chairCount} Chủ tịch,{" "}
                {w.policy.secretaryCount} Thư ký; 3–5 thành viên độc lập.
              </p>
              <p>
                Tối đa sinh viên/hội đồng:{" "}
                {w.policy.maxStudentsPerCommittee ??
                  "không giới hạn theo cấu hình đã duyệt"}
                . Tối đa hội đồng/giảng viên:{" "}
                {w.policy.maxCommitteesPerLecturer ??
                  "không giới hạn theo cấu hình đã duyệt"}
                . Tối đa sinh viên/giảng viên:{" "}
                {w.policy.maxStudentsPerLecturer ??
                  "không giới hạn theo cấu hình đã duyệt"}
                .
              </p>
            </Card>
          )}
          <Card title="Danh sách hội đồng">
            <CommitteeRows
              items={filtered.slice((page - 1) * 20, page * 20)}
              select={(id) => update("committeeId", id)}
            />
            <p>
              {filtered.length} hội đồng · Trang {page}
            </p>
            <Button
              variant="secondary"
              disabled={page <= 1}
              onClick={() => {
                const p = new URLSearchParams(params);
                p.set("page", String(page - 1));
                setParams(p);
              }}
            >
              Trước
            </Button>
            <Button
              variant="secondary"
              disabled={page * 20 >= filtered.length}
              onClick={() => {
                const p = new URLSearchParams(params);
                p.set("page", String(page + 1));
                setParams(p);
              }}
            >
              Sau
            </Button>
            <Button
              variant="secondary"
              onClick={() => update("committeeId", "")}
            >
              Tạo hội đồng mới
            </Button>
          </Card>
          {committeeId && !current && (
            <Notice>
              Không tìm thấy hội đồng trong đợt/phạm vi hiện tại (404).
            </Notice>
          )}
          {current && (
            <CommitteeDetail
              committee={current}
              pending={mutation.isPending}
              finalize={(reason) =>
                mutation.mutate({
                  action: "finalize",
                  id: current.id,
                  body: {
                    termId,
                    rosterHash: w.rosterHash,
                    expectedRevision: current.revision,
                    reason,
                  },
                })
              }
              unassign={(id, revision, reason) =>
                mutation.mutate({
                  action: "unassign",
                  id: current.id,
                  body: {
                    termId,
                    rosterHash: w.rosterHash,
                    expectedRevision: current.revision,
                    termStudentId: id,
                    expectedAssignmentRevision: revision,
                    reason,
                  },
                })
              }
            />
          )}
          {(!committeeId || current) && (
            <CommitteeEditor
              key={`${user?.id}:${termId}:${current?.id ?? "new"}:${current?.revision ?? 0}:${w.rosterHash}`}
              workspace={w}
              committee={current}
              pending={mutation.isPending}
              submit={(id, body) =>
                mutation.mutate({ action: "save", id, body })
              }
            />
          )}
          <Card title="Phân sinh viên từ UC18">
            <p>
              Chỉ hồ sơ Khoa đã chốt, còn hiệu lực mới được phân. Chuyển sinh
              viên giữa hai hội đồng chưa chốt cần xác nhận rõ.
            </p>
            {!w.candidates.length && (
              <Empty title="Không có hồ sơ UC18 trong phạm vi" />
            )}
            <div className="space-y-4">
              {w.candidates.map((c) => {
                const allowed = w.committees.filter(
                  (h) =>
                    h.state === "DRAFT" &&
                    h.departmentId === c.departmentId &&
                    h.issues.every(
                      (i) =>
                        i === `SOURCE_CHANGED:${c.termStudentId}` ||
                        i === "EMPTY_COMMITTEE_NOT_ALLOWED",
                    ) &&
                    !h.members.some((m) => m.lecturerId === c.advisorId),
                );
                return (
                  <div key={c.termStudentId}>
                    <label>
                      <input
                        type="checkbox"
                        checked={selected.includes(c.termStudentId)}
                        disabled={!c.eligibility || !!c.blockers.length}
                        onChange={(e) =>
                          setSelected((prev) =>
                            e.target.checked
                              ? [...prev, c.termStudentId]
                              : prev.filter((id) => id !== c.termStudentId),
                          )
                        }
                      />{" "}
                      {c.studentCode} — {c.studentName} · {c.title}
                    </label>
                    <p>
                      GVHD: {c.advisorName ?? "Chưa xác minh"}.{" "}
                      {c.eligibility
                        ? "UC18 đã chốt, còn hiệu lực"
                        : "Chưa có UC18 đủ điều kiện hiện hành"}
                      . Hội đồng:{" "}
                      {w.committees.find((h) => h.id === c.currentCommitteeId)
                        ?.name ??
                        (c.currentCommitteeId
                          ? "Ngoài phạm vi hiện tại"
                          : "Chưa phân")}
                      .
                    </p>
                    <CommitteeReasons values={c.blockers} />
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget),
                          target = String(f.get("target") ?? ""),
                          ids = [
                            ...new Set([
                              target,
                              ...(c.currentCommitteeId
                                ? [c.currentCommitteeId]
                                : []),
                            ]),
                          ];
                        if (
                          !c.eligibility ||
                          ids.some(
                            (id) => !w.committees.some((h) => h.id === id),
                          )
                        )
                          return;
                        assign({
                          termId,
                          rosterHash: w.rosterHash,
                          reason: String(f.get("reason") ?? ""),
                          committees: ids.map((id) => ({
                            committeeId: id,
                            expectedRevision: w.committees.find(
                              (h) => h.id === id,
                            )!.revision,
                          })),
                          placements: [
                            {
                              termStudentId: c.termStudentId,
                              committeeId: target,
                              expectedAssignmentRevision: c.assignmentRevision,
                              eligibilityRevision: c.eligibility.revision,
                              evidenceHash: c.eligibility.evidenceHash,
                              advisorHash: c.advisorHash,
                            },
                          ],
                        });
                      }}
                    >
                      <fieldset
                        disabled={
                          mutation.isPending ||
                          !w.permissions.assign ||
                          !!w.blockers.length ||
                          !c.eligibility ||
                          !!c.blockers.length ||
                          (!!c.currentCommitteeId &&
                            w.committees.find(
                              (h) => h.id === c.currentCommitteeId,
                            )?.state !== "DRAFT")
                        }
                      >
                        <label>
                          Hội đồng hợp lệ
                          <select name="target" required>
                            <option value="">Chọn hội đồng</option>
                            {allowed.map((h) => (
                              <option key={h.id} value={h.id}>
                                {h.code} — {h.name} ({h.students.length} SV)
                              </option>
                            ))}
                          </select>
                        </label>
                        <input
                          name="reason"
                          required
                          maxLength={4000}
                          aria-label={`Lý do phân ${c.studentCode}`}
                          placeholder="Lý do phân/chuyển"
                        />
                        <Button type="submit">Xác nhận phân/chuyển</Button>
                      </fieldset>
                    </form>
                    {!allowed.length && (
                      <Notice>
                        Chưa có hội đồng đủ cơ cấu, tiêu chuẩn, tải và không
                        xung đột GVHD. Xem lý do ở chi tiết hội đồng.
                      </Notice>
                    )}
                  </div>
                );
              })}
            </div>
            <Button
              variant="secondary"
              disabled={
                preview.isPending ||
                !w.permissions.assign ||
                !w.schemaReady ||
                !w.policy
              }
              onClick={() => preview.mutate()}
            >
              {preview.isPending
                ? "Đang tìm phương án…"
                : "Đề xuất phân cân bằng"}
            </Button>
            <p>
              Chọn hồ sơ để đề xuất lại; không chọn sẽ xét các hồ sơ chưa phân.
              Đề xuất không tự lưu.
            </p>
          </Card>
          {proposal && proposal.rosterHash === w.rosterHash && (
            <AllocationPreview
              proposal={proposal}
              w={w}
              pending={mutation.isPending}
              apply={(reason) =>
                assign({
                  termId,
                  rosterHash: proposal.rosterHash,
                  reason,
                  committees: proposal.committees,
                  placements: proposal.placements,
                })
              }
            />
          )}
        </>
      )}
      {preview.error && <Notice>{eligibilityError(preview.error)}</Notice>}
      {mutation.error && <Notice>{eligibilityError(mutation.error)}</Notice>}
      {message && <Notice>{message}</Notice>}
    </div>
  );
}
