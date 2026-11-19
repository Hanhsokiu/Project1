import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import type {
  ReviewerAllocation,
  ReviewerAssign,
  ReviewerFinalize,
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
import { reviewerApi as api } from "./api";
import {
  ReviewerEditor,
  ReviewerLoads,
  ReviewerPreview,
  ReviewerReasons,
  ReviewerRows,
  reviewerLabels,
} from "./components";
type Command =
  | { action: "assign"; body: ReviewerAssign; id?: string }
  | { action: "finalize"; body: ReviewerFinalize };
export function ReviewerPage() {
  return AUTH_API ? (
    <ReviewerContent />
  ) : (
    <Notice>
      Phân công phản biện cần API và tài khoản Khoa của hệ thống nhóm.
    </Notice>
  );
}
function ReviewerContent() {
  const user = useApiSession(),
    client = useQueryClient(),
    [params, setParams] = useSearchParams();
  const termId = params.get("termId") ?? "",
    member = params.get("termStudentId") ?? "",
    search = params.get("search") ?? "",
    state = params.get("state") ?? "",
    page = Math.max(1, Number(params.get("page")) || 1);
  const [selected, setSelected] = useState<string[]>([]),
    [message, setMessage] = useState(""),
    [proposal, setProposal] = useState<ReviewerAllocation | null>(null),
    [batchReason, setBatchReason] = useState("");
  const generation = useRef(""),
    keys = useRef(new Map<string, string>());
  generation.current = `${user?.id}:${termId}`;
  const terms = useQuery({
    queryKey: ["reviewer-terms", user?.id],
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
    queryKey: ["reviewer-workspace", user?.id, termId],
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
    setBatchReason("");
  }, [user?.id, termId]);
  const mutation = useMutation({
    mutationFn: async (cmd: Command) => {
      if (
        !w ||
        cmd.body.termId !== termId ||
        cmd.body.rosterHash !== w.rosterHash
      )
        throw new Error("Nguồn phân công đã thay đổi; tải lại.");
      const identity = JSON.stringify([user?.id, termId, cmd]);
      if (!keys.current.has(identity))
        keys.current.set(identity, crypto.randomUUID());
      const key = keys.current.get(identity)!,
        scope = generation.current;
      const result =
        cmd.action === "finalize"
          ? await api.finalize(cmd.body, key)
          : cmd.id
            ? await api.update(cmd.id, cmd.body, key)
            : await api.assign(cmd.body, key);
      return { scope, result };
    },
    onMutate: () => setMessage(""),
    onSuccess: async ({ scope }) => {
      if (scope === generation.current) {
        setMessage("Đã lưu phân công phản biện trên hệ thống.");
        setProposal(null);
      }
      await client.invalidateQueries({ queryKey: ["reviewer-workspace"] });
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
    if (key === "termId") next.delete("termStudentId");
    setMessage("");
    setParams(next);
  };
  const filtered =
    w?.students.filter(
      (c) =>
        (!state || c.state === state) &&
        (!search ||
          `${c.studentCode} ${c.studentName} ${c.title} ${c.committeeCode ?? ""}`
            .normalize("NFC")
            .toLocaleLowerCase("vi")
            .includes(search.normalize("NFC").toLocaleLowerCase("vi"))),
    ) ?? [];
  const current = w?.students.find((c) => c.id === member),
    pending = mutation.isPending || preview.isPending;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Phân công giảng viên phản biện"
        description="Dùng danh sách UC18 và hội đồng UC19 đã chốt, còn hiệu lực; GVHD không phản biện sinh viên mình."
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
        <Field label="Tìm sinh viên / đề tài / hội đồng">
          <input
            value={search}
            maxLength={200}
            onChange={(e) => update("search", e.target.value)}
          />
        </Field>
        <Field label="Trạng thái phản biện">
          <select
            value={state}
            onChange={(e) => update("state", e.target.value)}
          >
            <option value="">Tất cả</option>
            {["NONE", "DRAFT", "FINALIZED", "STALE", "LEGACY_UNVERIFIED"].map(
              (s) => (
                <option key={s} value={s}>
                  {reviewerLabels[s]}
                </option>
              ),
            )}
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
          Tải lại dữ liệu
        </Button>
      </Card>
      {query.isLoading && termId && (
        <Notice>Đang tải hồ sơ và phân công phản biện…</Notice>
      )}
      {query.error && <Notice>{eligibilityError(query.error)}</Notice>}
      {mutation.error && <Notice>{eligibilityError(mutation.error)}</Notice>}
      {preview.error && <Notice>{eligibilityError(preview.error)}</Notice>}
      {mutation.isPending && <Notice>Đang lưu phân công…</Notice>}
      {message && <Notice>{message}</Notice>}
      {!termId && <Empty title="Chọn đợt để xem phân công phản biện" />}
      {w && (
        <>
          <ReviewerReasons values={w.blockers} />
          {w.policy && (
            <Card title={`Chính sách phản biện ${w.policy.version}`}>
              <p>{w.policy.reference}</p>
              <p>
                {w.policy.reviewersPerStudent} GVPB/đồ án · Tối đa phản biện/GV:{" "}
                {w.policy.maxReviewsPerLecturer ??
                  "không giới hạn theo policy đã duyệt"}{" "}
                · Tổng tải:{" "}
                {w.policy.maxTotalStudentDuties ??
                  "không giới hạn theo policy đã duyệt"}
              </p>
              <p>
                Kiêm nhiệm hội đồng:{" "}
                {
                  {
                    ALLOW: "Cho phép",
                    FORBID: "Không cho phép",
                    PENDING_APPROVAL: "Chờ phê duyệt",
                  }[w.policy.committeeMembership]
                }
                ; người từng hướng dẫn:{" "}
                {
                  {
                    ALLOW: "Cho phép",
                    FORBID: "Không cho phép",
                    PENDING_APPROVAL: "Chờ phê duyệt",
                  }[w.policy.formerAdvisorRule]
                }
                .
              </p>
            </Card>
          )}
          <Card title="Danh sách hồ sơ">
            <ReviewerRows
              workspace={w}
              items={filtered.slice((page - 1) * 20, page * 20)}
              selected={selected}
              pending={pending}
              choose={(id) =>
                setSelected((s) =>
                  s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
                )
              }
              select={(id) => update("termStudentId", id)}
            />
            <p>
              {filtered.length} hồ sơ · Trang {page}
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
          <ReviewerLoads workspace={w} />
          <Card title="Đề xuất và chốt nhóm được chọn">
            <p>
              {selected.length} hồ sơ được chọn. Không chọn hồ sơ: đề xuất cho
              danh sách hợp lệ chưa phân.
            </p>
            <Button
              variant="secondary"
              disabled={
                pending || !w.permissions.assign || !w.schemaReady || !w.policy
              }
              onClick={() => preview.mutate()}
            >
              Đề xuất phân phản biện
            </Button>
            {preview.isPending && <Notice>Đang tìm phương án…</Notice>}
            <Field label="Lý do chốt nhóm">
              <textarea
                maxLength={4000}
                value={batchReason}
                disabled={pending}
                onChange={(e) => setBatchReason(e.target.value)}
              />
            </Field>
            <Button
              disabled={
                pending ||
                !selected.length ||
                !batchReason.trim() ||
                selected.some((id) => {
                  const c = w.students.find((c) => c.id === id);
                  return !c?.binding || !!c.blockers.finalize.length;
                })
              }
              onClick={() =>
                mutation.mutate({
                  action: "finalize",
                  body: {
                    termId,
                    rosterHash: w.rosterHash,
                    reason: batchReason,
                    members: selected.map(
                      (id) => w.students.find((c) => c.id === id)!.binding!,
                    ),
                  },
                })
              }
            >
              Chốt nhóm phản biện đã chọn
            </Button>
          </Card>
          {proposal && (
            <ReviewerPreview
              workspace={w}
              proposal={proposal}
              pending={pending}
              blocked={
                !!w.blockers.length ||
                !w.permissions.assign ||
                proposal.rosterHash !== w.rosterHash ||
                proposal.placements.some(
                  (p) =>
                    !!w.students.find((c) => c.id === p.termStudentId)?.blockers
                      .assign.length,
                )
              }
              apply={(reason) =>
                mutation.mutate({
                  action: "assign",
                  body: {
                    termId,
                    rosterHash: proposal.rosterHash,
                    reason,
                    placements: proposal.placements,
                  },
                })
              }
            />
          )}
          {current && (
            <ReviewerEditor
              key={`${user?.id}:${termId}:${current.id}:${current.revision}:${current.evidenceHash}`}
              workspace={w}
              student={current}
              pending={pending}
              save={(body) =>
                mutation.mutate({
                  action: "assign",
                  id: current.revision ? current.id : undefined,
                  body,
                })
              }
              finalize={(body) => mutation.mutate({ action: "finalize", body })}
            />
          )}
          {member && !current && (
            <Empty title="Không tìm thấy hồ sơ trong phạm vi hiện tại" />
          )}
        </>
      )}
    </div>
  );
}
