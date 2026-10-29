import { useState, type ReactNode } from "react";
import { Link, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type {
  AggregateView,
  GradeContext,
  GradingDraft,
  GradingKind,
  GradingPolicy,
  PublishedGrade,
} from "@doan/shared";
import { gradingPolicySchema } from "@doan/shared";
import { getAccessToken, getApiUser } from "../../../shared/api/api-session";
import { routeManifest } from "../../../app/router/route-manifest";
import { GradingHistory } from "./history";
import { GradingUnavailable } from "./mode-boundary";
import {
  Button,
  Card,
  Empty,
  Field,
  Notice,
  PageHeader,
} from "../../../shared/components/kit";
import {
  gradingApi as api,
  gradingErrorText,
  gradingBlockerText,
  gradingMode,
  savePrivateDownload,
  type PolicyView,
} from "./api";

export function scoreCommand(
  c: Pick<GradeContext, "expectedContext" | "expectedRevision">,
) {
  return {
    expectedRevision: c.expectedRevision,
    expectedContext: c.expectedContext,
    requestId: crypto.randomUUID(),
  };
}
export function cleanGradeDraft(draft: GradingDraft): GradingDraft {
  return {
    ...draft,
    questions: draft.questions.map((q) => q.trim()).filter(Boolean),
  };
}
export function draftForCurrentRubric(c: GradeContext): GradingDraft {
  const old = c.grade.draft ?? { values: {}, comment: "", questions: [] };
  return {
    ...old,
    values: Object.fromEntries(
      Object.entries(old.values).filter(([code]) =>
        c.rubric?.some((r) => r.code === code),
      ),
    ),
  };
}
export function canSealForm(c: GradeContext, draft: GradingDraft) {
  const d = cleanGradeDraft(draft);
  return (
    c.canSeal &&
    c.grade.state === "DRAFT" &&
    !!c.rubric &&
    !!d.comment.trim() &&
    (c.kind !== "REVIEWER" || d.questions.length >= 2) &&
    c.rubric.every(
      (r) =>
        Number.isFinite(d.values[r.code]) &&
        d.values[r.code] >= 0 &&
        d.values[r.code] <= r.maxScore,
    ) &&
    JSON.stringify(d) === JSON.stringify(c.grade.draft)
  );
}
function ErrorNotice({ error }: { error: unknown }) {
  return error ? (
    <Notice tone="danger">{gradingErrorText(error)}</Notice>
  ) : null;
}
export function GradeStatus({ context: c }: { context: GradeContext }) {
  return (
    <>
      <p>
        Phiếu: {c.grade.state} · Revision {c.expectedRevision}
      </p>
      <p>
        Mốc riêng:{" "}
        {c.window
          ? `${c.window.opensAt} → ${c.window.closesAt}${c.window.isLocked ? " (KHÓA)" : ""}`
          : "Chưa cấu hình"}
      </p>
      {c.blockers.map((b) => (
        <Notice tone="warning" key={b}>
          {gradingBlockerText(b)}
        </Notice>
      ))}
      {c.grade.state === "SEALED" && (
        <Notice>
          Phiếu đã chốt. Chưa mở sửa sau chốt khi chưa có chính sách được duyệt.
        </Notice>
      )}
    </>
  );
}
export function PublishedGradeRows({ items }: { items: PublishedGrade[] }) {
  return items.length ? (
    <>
      {items.map((r) => (
        <Card key={r.proposalId}>
          <p>
            Hồ sơ {r.proposalId} · {r.state}
          </p>
          {r.state === "PUBLISHED" && r.result ? (
            <p>
              QT: {r.result.process} · KTHP: {r.result.committee} · HP:{" "}
              {r.result.final} · {r.result.passed ? "Đạt" : "Không đạt"} · Công
              bố: {r.publishedAt}
            </p>
          ) : (
            <Notice>
              Kết quả của hồ sơ chưa công bố. Chưa có điểm để xem.
            </Notice>
          )}
        </Card>
      ))}
    </>
  ) : (
    <Empty title="Chưa có hồ sơ trong đợt của bạn" />
  );
}
export function ResultPreviewRows({
  items,
  onCommand,
  termId,
}: {
  items: AggregateView[];
  onCommand: (r: AggregateView, publish: boolean) => void;
  termId?: string;
}) {
  return (
    <>
      {items.length ? (
        items.map((r) => (
          <Card key={r.proposalId}>
            <h3>
              {r.studentName} · {r.title}
            </h3>
            <p>
              {r.state} · Revision {r.revision}
            </p>
            <p>
              QT {r.process ?? "—"} · KTHP {r.committee ?? "—"} · HP{" "}
              {r.final ?? "—"}
            </p>
            {r.blockers.map((b) => (
              <p key={b}>{gradingBlockerText(b)}</p>
            ))}
            <Button disabled={!r.canSeal} onClick={() => onCommand(r, false)}>
              Chốt kết quả hồ sơ
            </Button>{" "}
            <Button disabled={!r.canPublish} onClick={() => onCommand(r, true)}>
              Công bố hồ sơ
            </Button>
            {termId && (
              <GradingHistory
                key={`${termId}:${r.proposalId}:${r.revision}`}
                termId={termId}
                proposalId={r.proposalId}
                revision={r.revision}
              />
            )}
          </Card>
        ))
      ) : (
        <Empty title="Không có hồ sơ trong phạm vi được cấp" />
      )}
    </>
  );
}
function GradeHistory({
  termId,
  proposalId,
  kind,
  refresh,
}: {
  termId: string;
  proposalId: string;
  kind: GradingKind;
  refresh: string;
}) {
  const [after, setAfter] = useState(0),
    h = useQuery({
      queryKey: [
        "grade-history",
        getApiUser()?.id,
        termId,
        proposalId,
        kind,
        after,
        refresh,
      ],
      queryFn: () => api.history(termId, proposalId, kind, after),
      retry: false,
    });
  return (
    <details>
      <summary>Lịch sử phiếu của bạn</summary>
      <ErrorNotice error={h.error} />
      {h.isFetching && <p>Đang đọc lịch sử…</p>}
      {h.data?.items.map((r) => (
        <p key={r.revision}>
          Revision {r.revision} · {r.state} · {r.recordedAt} · {r.integrity} ·{" "}
          {r.total ?? "—"}
        </p>
      ))}
      {h.data?.nextRevision != null && (
        <Button onClick={() => setAfter(h.data!.nextRevision!)}>
          Trang tiếp
        </Button>
      )}
      {after > 0 && <Button onClick={() => setAfter(0)}>Về đầu</Button>}
    </details>
  );
}
function ScoreDetail({
  termId,
  proposalId,
  kind,
  onSaved,
}: {
  termId: string;
  proposalId: string;
  kind: GradingKind;
  onSaved: () => void;
}) {
  const q = useQuery({
      queryKey: ["official-grade", getApiUser()?.id, termId, proposalId, kind],
      queryFn: () => api.context(termId, proposalId, kind),
      retry: false,
    }),
    [accepted, setAccepted] = useState<GradeContext | null>(null),
    [draft, setDraft] = useState<GradingDraft>({
      values: {},
      comment: "",
      questions: [],
    }),
    [pending, setPending] = useState(false),
    [error, setError] = useState<unknown>(),
    [message, setMessage] = useState("");
  const reload = async () => {
    setAccepted(null);
    setMessage("");
    await q.refetch();
  };
  const load = () => {
    if (q.data) {
      setAccepted(q.data);
      setDraft(draftForCurrentRubric(q.data));
      setError(undefined);
      setMessage("");
    }
  };
  const run = async (seal: boolean) => {
    if (!accepted) return;
    setPending(true);
    setError(undefined);
    setMessage("");
    try {
      if (seal)
        await api.seal(termId, proposalId, kind, scoreCommand(accepted));
      else
        await api.save(termId, proposalId, kind, {
          ...scoreCommand(accepted),
          draft: cleanGradeDraft(draft),
        });
      setAccepted(null);
      await q.refetch();
      onSaved();
      setMessage(
        seal
          ? "Backend đã chốt phiếu; điểm chưa đồng nghĩa đã công bố."
          : "Backend đã lưu draft. Xem lại bản đã lưu trước khi chốt.",
      );
    } catch (e) {
      setError(e);
      setAccepted(null);
      await q.refetch();
    } finally {
      setPending(false);
    }
  };
  const download = async () => {
    const c = accepted ?? q.data;
    if (!c?.pdf) return;
    setPending(true);
    setError(undefined);
    try {
      const { finalReportId, revision, checksum } = c.pdf;
      savePrivateDownload(
        await api.download(termId, proposalId, kind, {
          finalReportId,
          revision,
          checksum,
        }),
        "final-report.pdf",
      );
    } catch (e) {
      setError(e);
      setAccepted(null);
      await q.refetch();
    } finally {
      setPending(false);
    }
  };
  return (
    <Card>
      <ErrorNotice error={q.error || error} />
      {q.isFetching && <p>Đang tải context từ backend…</p>}
      {q.data && (
        <>
          <h2>
            {q.data.studentName} · {q.data.title}
          </h2>
          <GradeStatus context={q.data} />
          <Button
            variant="secondary"
            disabled={pending || !q.data.pdf}
            onClick={() => {
              void download();
            }}
          >
            Tải PDF đúng revision context
          </Button>{" "}
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => {
              void reload();
            }}
          >
            Tải lại context
          </Button>{" "}
          <Button disabled={pending} onClick={load}>
            Nạp phiếu, đã xem lại nguồn hiện hành
          </Button>
          {!accepted && (
            <Notice>
              Cần chủ động nạp và xem lại dữ liệu trước khi lưu/chốt. Tải PDF
              không tự xác nhận đã đọc.
            </Notice>
          )}
          {accepted && (
            <>
              <p>Đang sửa trên revision {accepted.expectedRevision}</p>
              {(accepted.rubric ?? []).map((r) => (
                <Field label={`${r.label} (0–${r.maxScore})`} key={r.code}>
                  <input
                    type="number"
                    min="0"
                    max={r.maxScore}
                    step="0.01"
                    disabled={!accepted.canSave || pending}
                    value={draft.values[r.code] ?? ""}
                    onChange={(e) =>
                      setDraft((d) => {
                        const values = { ...d.values };
                        if (!e.target.value) delete values[r.code];
                        else values[r.code] = Number(e.target.value);
                        return { ...d, values };
                      })
                    }
                  />
                </Field>
              ))}
              <Field label="Nhận xét">
                <textarea
                  disabled={!accepted.canSave || pending}
                  value={draft.comment}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, comment: e.target.value }))
                  }
                />
              </Field>
              {kind === "REVIEWER" && (
                <Field label="Ít nhất hai câu hỏi khi chốt, mỗi dòng một câu">
                  <textarea
                    disabled={!accepted.canSave || pending}
                    value={draft.questions.join("\n")}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        questions: e.target.value.split("\n"),
                      }))
                    }
                  />
                </Field>
              )}
              <Button
                disabled={pending || !accepted.canSave}
                onClick={() => {
                  void run(false);
                }}
              >
                Lưu draft vào backend
              </Button>{" "}
              <Button
                disabled={pending || !canSealForm(accepted, draft)}
                onClick={() => {
                  void run(true);
                }}
              >
                Chốt bản đã lưu
              </Button>
            </>
          )}
          <GradeHistory
            termId={termId}
            proposalId={proposalId}
            kind={kind}
            refresh={q.data.expectedContext}
          />
        </>
      )}
      {message && <Notice>{message}</Notice>}
    </Card>
  );
}
function Scoring({ termId, kind }: { termId: string; kind: GradingKind }) {
  const q = useQuery({
      queryKey: ["grading-inbox", getApiUser()?.id, termId, kind],
      queryFn: () => api.inbox(termId, kind),
      retry: false,
    }),
    [proposalId, setProposal] = useState("");
  return (
    <>
      <ErrorNotice error={q.error} />
      {q.isFetching && <p>Đang đọc phân công chính thức…</p>}
      {q.data && !q.data.items.length && (
        <Empty title="Không có hồ sơ được phân công chính thức" />
      )}
      {q.data?.items.map((p) => (
        <Button
          variant="secondary"
          key={p.proposalId}
          onClick={() => setProposal(p.proposalId)}
        >
          {p.studentName} · {p.title} · {p.state}
        </Button>
      ))}
      {proposalId && (
        <ScoreDetail
          key={`${termId}:${kind}:${proposalId}`}
          termId={termId}
          kind={kind}
          proposalId={proposalId}
          onSaved={() => {
            void q.refetch();
          }}
        />
      )}
    </>
  );
}
function PolicyForm({
  termId,
  view,
  refreshed,
}: {
  termId: string;
  view: PolicyView;
  refreshed: () => Promise<unknown>;
}) {
  const [windows, setWindows] = useState(
      view.config?.windows ??
        (Object.fromEntries(
          ["REVIEWER", "COMMITTEE", "PUBLICATION"].map((k) => [
            k,
            { opensAt: "", closesAt: "", isLocked: true },
          ]),
        ) as GradingPolicy["windows"]),
    ),
    [rubric, setRubric] = useState(view.config?.committeeRubric ?? []),
    [error, setError] = useState<unknown>(),
    [pending, setPending] = useState(false);
  const submit = async () => {
    setPending(true);
    setError(undefined);
    try {
      const config = gradingPolicySchema.parse({
        schemaVersion: 1,
        windows,
        committeeRubric: rubric.length ? rubric : null,
        calculation: { state: "NEEDS_APPROVAL" },
      });
      await api.configure(termId, {
        expectedRevision: view.revision,
        expectedContext: view.expectedContext,
        requestId: crypto.randomUUID(),
        config,
      });
      await refreshed();
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
    }
  };
  return (
    <Card>
      <p>
        Policy revision {view.revision}. Không có mốc mở hoặc rubric mặc định.
      </p>
      <ErrorNotice error={error} />
      {(["REVIEWER", "COMMITTEE", "PUBLICATION"] as const).map((k) => (
        <fieldset key={k}>
          <legend>{k}</legend>
          {(["opensAt", "closesAt"] as const).map((f) => (
            <Field
              key={f}
              label={
                f === "opensAt"
                  ? "Bắt đầu (ISO có múi giờ)"
                  : "Kết thúc (ISO có múi giờ)"
              }
            >
              <input
                placeholder="2026-11-02T08:00:00+07:00"
                value={windows[k][f]}
                onChange={(e) =>
                  setWindows((w) => ({
                    ...w,
                    [k]: { ...w[k], [f]: e.target.value },
                  }))
                }
              />
            </Field>
          ))}
          <label>
            <input
              type="checkbox"
              checked={windows[k].isLocked}
              onChange={(e) =>
                setWindows((w) => ({
                  ...w,
                  [k]: { ...w[k], isLocked: e.target.checked },
                }))
              }
            />{" "}
            Khóa mốc
          </label>
        </fieldset>
      ))}
      <h3>Rubric hội đồng do Khoa cấu hình (tổng tối đa 10)</h3>
      {rubric.map((r, i) => (
        <div className="flex gap-2" key={i}>
          <input
            aria-label={`Mã tiêu chí ${i + 1}`}
            value={r.code}
            onChange={(e) =>
              setRubric((a) =>
                a.map((v, j) => (i === j ? { ...v, code: e.target.value } : v)),
              )
            }
          />
          <input
            aria-label={`Tên tiêu chí ${i + 1}`}
            value={r.label}
            onChange={(e) =>
              setRubric((a) =>
                a.map((v, j) =>
                  i === j ? { ...v, label: e.target.value } : v,
                ),
              )
            }
          />
          <input
            aria-label={`Tối đa tiêu chí ${i + 1}`}
            type="number"
            min="0.01"
            max="10"
            step="0.01"
            value={r.maxScore || ""}
            onChange={(e) =>
              setRubric((a) =>
                a.map((v, j) =>
                  i === j ? { ...v, maxScore: Number(e.target.value) } : v,
                ),
              )
            }
          />
          <Button
            variant="secondary"
            onClick={() => setRubric((a) => a.filter((_, j) => j !== i))}
          >
            Bỏ
          </Button>
        </div>
      ))}
      <Button
        variant="secondary"
        onClick={() =>
          setRubric((a) => [...a, { code: "", label: "", maxScore: 0 }])
        }
      >
        Thêm tiêu chí
      </Button>{" "}
      <Button
        disabled={pending}
        onClick={() => {
          void submit();
        }}
      >
        Lưu cấu hình có revision/audit
      </Button>
      <Notice tone="warning">
        Quorum, làm tròn, nguồn điểm GVHD và xác nhận kết quả Hội đồng đang
        NEEDS_APPROVAL. Cấu hình này không tự duyệt công thức hoặc mở công bố.
      </Notice>
    </Card>
  );
}
function Policy({ termId }: { termId: string }) {
  const q = useQuery({
    queryKey: ["grading-policy", getApiUser()?.id, termId],
    queryFn: () => api.policy(termId),
    retry: false,
  });
  return (
    <>
      <ErrorNotice error={q.error} />
      {q.isFetching && <p>Đang đọc cấu hình…</p>}
      {q.data && (
        <PolicyForm
          key={`${termId}:${q.data.revision}`}
          termId={termId}
          view={q.data}
          refreshed={() => q.refetch()}
        />
      )}
      {q.data && !q.isError && (
        <GradingHistory
          key={`${termId}:${q.data.revision}`}
          termId={termId}
          revision={q.data.revision}
        />
      )}
    </>
  );
}
function Results({ termId }: { termId: string }) {
  const student = getApiUser()?.roles.includes("STUDENT"),
    [error, setError] = useState<unknown>(),
    [pending, setPending] = useState(false),
    q = useQuery({
      queryKey: ["grading-results", getApiUser()?.id, termId, student],
      queryFn: async () =>
        student
          ? { student: await api.myResults(termId) }
          : { faculty: await api.preview(termId) },
      retry: false,
    });
  const run = async (r: AggregateView, publish: boolean) => {
    setPending(true);
    setError(undefined);
    try {
      await api.resultCommand(termId, r.proposalId, publish, {
        expectedRevision: r.revision,
        expectedContext: r.expectedContext,
        requestId: crypto.randomUUID(),
      });
      await q.refetch();
    } catch (e) {
      setError(e);
      await q.refetch();
    } finally {
      setPending(false);
    }
  };
  return (
    <>
      <ErrorNotice error={q.error || error} />
      {(q.isFetching || pending) && <p>Đang đọc/kiểm tra kết quả…</p>}
      {q.data?.student && <PublishedGradeRows items={q.data.student.items} />}
      {q.data?.faculty && (
        <>
          <Notice tone="warning">
            Chỉ mở chốt/công bố khi đủ mọi nguồn và policy được xác nhận. Thu đủ
            phiếu không tự coi là Hội đồng đã xác nhận.
          </Notice>
          <ResultPreviewRows
            termId={termId}
            items={q.data.faculty.items}
            onCommand={(r, p) => {
              if (!pending) void run(r, p);
            }}
          />
        </>
      )}
    </>
  );
}
function Reports({ termId }: { termId: string }) {
  const summary = useQuery({
    queryKey: ["official-report-summary", getApiUser()?.id, termId],
    queryFn: () => api.summary(termId),
    retry: false,
  });
  const [kind, setKind] = useState<"RESULTS" | "REVIEWERS" | "SCHEDULE">(
      "SCHEDULE",
    ),
    [format, setFormat] = useState<"XLSX" | "PDF">("XLSX"),
    [committeeKey, setCommittee] = useState(""),
    [className, setClassName] = useState(""),
    [error, setError] = useState<unknown>(),
    [pending, setPending] = useState(false);
  const run = async () => {
    setPending(true);
    setError(undefined);
    try {
      savePrivateDownload(
        await api.export(termId, kind, format, {
          ...(committeeKey ? { committeeKey } : {}),
          ...(className ? { className } : {}),
        }),
        `official-${kind.toLowerCase()}.${format.toLowerCase()}`,
      );
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
    }
  };
  return (
    <Card>
      <ErrorNotice error={summary.error} />
      {summary.isFetching && <p>Đang đọc thống kê trong phạm vi được cấp…</p>}
      {summary.data && (
        <p>
          Admitted: {summary.data.admitted} · Hội đồng:{" "}
          {summary.data.committees} · Phân công phản biện:{" "}
          {summary.data.reviewerAssignments} · Lịch công bố:{" "}
          {summary.data.publishedSlots} · Kết quả công bố:{" "}
          {summary.data.publishedResults} · Đạt: {summary.data.passed}
        </p>
      )}
      <ErrorNotice error={error} />
      <Field label="Loại báo cáo">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as typeof kind)}
        >
          <option value="SCHEDULE">Lịch đã công bố</option>
          <option value="REVIEWERS">Phân công phản biện đã chốt</option>
          <option value="RESULTS">Kết quả đã công bố theo hồ sơ</option>
        </select>
      </Field>
      <Field label="Định dạng">
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value as typeof format)}
        >
          <option>XLSX</option>
          <option>PDF</option>
        </select>
      </Field>
      <Field label="Hội đồng (để trống: toàn phạm vi được cấp)">
        <input
          value={committeeKey}
          onChange={(e) => setCommittee(e.target.value)}
        />
      </Field>
      <Field label="Lớp (tùy chọn)">
        <input
          value={className}
          onChange={(e) => setClassName(e.target.value)}
        />
      </Field>
      <Button
        disabled={pending || (format === "PDF" && kind !== "RESULTS")}
        onClick={() => {
          void run();
        }}
      >
        Tải file riêng tư từ backend
      </Button>
      <Notice>
        PDF hiện là bảng tra cứu kết quả đã công bố. Mẫu biên bản ký và quyền
        xuất phiếu chưa công bố chưa được mở.
      </Notice>
    </Card>
  );
}
type Mode = "REVIEWER" | "COMMITTEE" | "RESULTS" | "POLICY" | "REPORTS";
export default function GradingWorkflowPage({ mode }: { mode: Mode }) {
  const location = useLocation(),
    [params] = useSearchParams(),
    user = getApiUser();
  if (gradingMode() !== "API") return <GradingUnavailable />;
  if (!user || !getAccessToken())
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  if (user.mustChangePassword)
    return <Navigate to="/change-password" replace />;
  return (
    <GradingContent
      key={`${user.id}:${getAccessToken()}:${mode}`}
      initialTerm={params.get("termId") ?? ""}
      mode={mode}
    />
  );
}
function GradingContent({
  initialTerm,
  mode,
}: {
  initialTerm: string;
  mode: Mode;
}) {
  const [draftTerm, setDraftTerm] = useState(initialTerm),
    [termId, setTerm] = useState(initialTerm);
  let body: ReactNode = null;
  if (termId)
    body =
      mode === "REVIEWER" || mode === "COMMITTEE" ? (
        <Scoring key={`${termId}:${mode}`} termId={termId} kind={mode} />
      ) : mode === "POLICY" ? (
        <Policy key={termId} termId={termId} />
      ) : mode === "REPORTS" ? (
        <Reports key={termId} termId={termId} />
      ) : (
        <Results key={termId} termId={termId} />
      );
  return (
    <section className="max-w-6xl mx-auto space-y-4">
      <Link to="/">← Không gian làm việc</Link>
      <PageHeader
        title="Chấm điểm và kết quả đồ án"
        description="Dữ liệu API thật, theo phân công/permission/grant hiện hành."
      />
      <nav className="flex flex-wrap gap-3">
        {[
          ["/grading/reviewer", "Phản biện"],
          ["/grading/committee", "Hội đồng"],
          ["/grading/results", "Kết quả"],
          ["/grading/policy", "Cấu hình Khoa"],
          ["/report/official", "Báo cáo"],
        ]
          .filter(([url]) =>
            routeManifest
              .find((route) => route.path === url)
              ?.roles.some((role) => getApiUser()?.roles.includes(role)),
          )
          .map(([url, label]) => (
            <Link
              key={url}
              to={`${url}${termId ? `?termId=${encodeURIComponent(termId)}` : ""}`}
            >
              {label}
            </Link>
          ))}
      </nav>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setTerm(draftTerm.trim());
        }}
      >
        <Field label="ID đợt tốt nghiệp">
          <input
            maxLength={36}
            required
            value={draftTerm}
            onChange={(e) => setDraftTerm(e.target.value)}
          />
        </Field>
        <Button type="submit">Đọc dữ liệu đợt</Button>
      </form>
      {body || <Empty title="Chọn đợt để bắt đầu" />}
    </section>
  );
}
