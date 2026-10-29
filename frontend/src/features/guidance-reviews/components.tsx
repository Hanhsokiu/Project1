import { Save } from "lucide-react";
import React, { useState } from "react";
import {
  ProgressReviewCreateSchema,
  ProgressReviewAmendSchema,
  GuidanceMeetingCreateSchema,
  GuidanceMeetingAmendSchema,
} from "@doan/shared";
import type {
  ProgressReviewContext,
  ProgressReviewCreate,
  ProgressReviewAmend,
  ProgressReviewView,
  GuidanceMeetingCreate,
  GuidanceMeetingAmend,
  GuidanceMeetingView,
  GuidanceMonitorRow,
} from "@doan/shared";
import { Link } from "react-router-dom";
import {
  vietnamDate,
  fromVietnamInput,
  toVietnamInput,
  guidanceStatusLabel,
} from "../guidance-tasks/components";
import { getErrorMessage } from "../../shared/api/error-message";
export const progressDecisionLabel = (decision: string | null) =>
  decision
    ? ({ PASS: "Đạt", FAIL: "Không đạt", REVISION_REQUIRED: "Cần sửa" }[
        decision
      ] ?? decision)
    : "Chưa đánh giá";
export function MeetingHistoryContent({ snapshot }: { snapshot: unknown }) {
  if (!snapshot || typeof snapshot !== "object")
    return <p>Lịch sử cũ cần đối soát.</p>;
  const root = snapshot as Record<string, unknown>,
    parts =
      root.before && root.after
        ? [
            ["Trước khi sửa", root.before],
            ["Sau khi sửa", root.after],
          ]
        : [["Nội dung đã ghi nhận", root]];
  return (
    <div className="space-y-3">
      {parts.map(([label, value]) => {
        const v = value as Record<string, unknown>;
        return (
          <div key={String(label)} className="rounded border p-3 text-sm">
            <h4 className="font-semibold">{String(label)}</h4>
            {typeof v.occurredAt === "string" && (
              <p>{vietnamDate(v.occurredAt)}</p>
            )}
            {typeof v.discussion === "string" && (
              <p className="whitespace-pre-wrap break-words">
                Nội dung: {v.discussion}
              </p>
            )}
            {typeof v.conclusion === "string" && (
              <p className="whitespace-pre-wrap break-words">
                Kết luận: {v.conclusion}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
export function ProgressReviewForm({
  context,
  onSave,
  busy,
  amending = false,
}: {
  context: ProgressReviewContext;
  onSave: (v: ProgressReviewCreate | ProgressReviewAmend) => void;
  busy: boolean;
  amending?: boolean;
}) {
  const [taskRevision] = useState(context.taskRevision),
    [submissionRevision] = useState(context.submission.revision),
    [reviewRevision] = useState(context.effectiveReview?.revision ?? 0),
    [decision, setDecision] = useState<"PASS" | "FAIL" | "REVISION_REQUIRED">(
      context.effectiveReview?.decision ?? "REVISION_REQUIRED",
    ),
    [comment, setComment] = useState(context.effectiveReview?.comment ?? ""),
    [reason, setReason] = useState(""),
    [error, setError] = useState("");
  return (
    <form
      className="rg-panel p-5 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        try {
          const input = {
            expectedTaskRevision: taskRevision,
            expectedSubmissionRevision: submissionRevision,
            decision,
            comment,
          };
          onSave(
            amending
              ? ProgressReviewAmendSchema.parse({
                  ...input,
                  expectedReviewRevision: reviewRevision,
                  reason,
                })
              : ProgressReviewCreateSchema.parse(input),
          );
        } catch {
          setError("Kiểm tra kết quả, nhận xét bắt buộc và lý do sửa.");
        }
      }}
    >
      <h2 className="font-semibold">
        {amending
          ? "Sửa đánh giá có lưu lịch sử"
          : "Đánh giá lần nộp " + context.submission.versionNumber}
      </h2>
      <label className="block">
        Kết quả
        <select
          aria-label="Kết quả đánh giá"
          value={decision}
          onChange={(e) => setDecision(e.target.value as typeof decision)}
          disabled={busy}
          className="block mt-2 rounded border p-2"
        >
          <option value="PASS">Đạt</option>
          <option value="FAIL">Không đạt</option>
          <option value="REVISION_REQUIRED">Cần sửa</option>
        </select>
      </label>
      <label className="block">
        Nhận xét (bắt buộc khi Không đạt/Cần sửa)
        <textarea
          aria-label="Nhận xét đánh giá"
          required={decision !== "PASS"}
          maxLength={20000}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          disabled={busy}
          className="block w-full mt-2 rounded border p-2"
        />
      </label>
      {amending && (
        <label className="block">
          Lý do sửa đánh giá
          <textarea
            aria-label="Lý do sửa đánh giá"
            required
            maxLength={2000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={busy}
            className="block w-full mt-2 rounded border p-2"
          />
        </label>
      )}
      <p className="text-sm text-slate-500">
        Đang xét đúng lần nộp {context.submission.versionNumber}. Đạt hoàn thành
        nhiệm vụ; Không đạt/Cần sửa yêu cầu SV nộp lại. Kết quả này không tính
        điểm tốt nghiệp hoặc điều kiện bảo vệ.
      </p>
      <button
        disabled={busy}
        className="rounded bg-blue-700 px-4 py-2 text-white action-with-icon"
      >
        <Save size={16} aria-hidden="true" />
        {busy
          ? "Đang lưu…"
          : amending
            ? "Lưu sửa đánh giá"
            : "Ghi nhận đánh giá"}
      </button>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}
export function ProgressReviewHistory({
  reviews,
}: {
  reviews: ProgressReviewView[];
}) {
  return (
    <section className="rg-panel p-5 space-y-4">
      <h2 className="font-semibold">Lịch sử đánh giá lần nộp này</h2>
      {!reviews.length && <p>Chưa có nhận xét đánh giá.</p>}
      {reviews.map((r) => (
        <article key={r.id} className="border-b pb-3 last:border-0">
          <h3 className="font-semibold">
            {progressDecisionLabel(r.decision)} ·{" "}
            {r.state === "SUPERSEDED"
              ? "Đã được sửa"
              : "Kết luận của lần nộp này"}
          </h3>
          <p className="text-sm text-slate-500">
            {r.reviewerName} · {vietnamDate(r.recordedAt)}
          </p>
          <p className="whitespace-pre-wrap break-words">
            {r.comment ?? "Không có nhận xét bổ sung."}
          </p>
          {r.amendmentReason && (
            <p className="whitespace-pre-wrap break-words">
              Lý do sửa: {r.amendmentReason}
            </p>
          )}
        </article>
      ))}
    </section>
  );
}
export function ProgressTaskTable({ rows }: { rows: GuidanceMonitorRow[] }) {
  return (
    <div className="rg-panel overflow-x-auto">
      <table className="w-full min-w-[700px] text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="p-3">Sinh viên / nhiệm vụ</th>
            <th className="p-3">GVHD / mốc</th>
            <th className="p-3">Trạng thái</th>
            <th className="p-3">Bài nộp</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.taskId} className="border-b">
              <td className="p-3">
                <p>
                  {r.studentName} · {r.studentCode}
                </p>
                <Link
                  className="text-blue-700"
                  to={`/guidance/tasks/${r.taskId}`}
                >
                  {r.title}
                </Link>
              </td>
              <td className="p-3">
                {r.advisorName ?? "Chưa xác định phân công chính thức"}
                <p>{r.periodLabel ?? "Chưa cấu hình"}</p>
              </td>
              <td className="p-3">
                {r.legacyUnknown
                  ? "Dữ liệu cũ cần đối soát"
                  : guidanceStatusLabel(r.status ?? "")}
                <p>{r.isOverdue ? "Quá hạn" : ""}</p>
              </td>
              <td className="p-3">
                {r.submissionId ? (
                  <>
                    <Link
                      className="text-blue-700 underline"
                      to={`/guidance/review/${r.submissionId}`}
                    >
                      Xem lần nộp {r.versionNumber}
                    </Link>
                    <p>{progressDecisionLabel(r.decision)}</p>
                  </>
                ) : r.legacyUnknown ? (
                  "Chưa xác định"
                ) : (
                  "Chưa nộp"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <p className="p-5">Không có nhiệm vụ trong phạm vi và bộ lọc.</p>
      )}
    </div>
  );
}
export function GuidanceMeetingForm({
  planRevision,
  meeting,
  onSave,
  busy,
}: {
  planRevision: number;
  meeting?: GuidanceMeetingView;
  onSave: (v: GuidanceMeetingCreate | GuidanceMeetingAmend) => void;
  busy: boolean;
}) {
  const [revision] = useState(meeting?.revision ?? planRevision),
    [occurredAt, setOccurredAt] = useState(
      meeting ? toVietnamInput(meeting.occurredAt) : "",
    ),
    [mode, setMode] = useState<"IN_PERSON" | "ONLINE">(
      meeting?.mode ?? "IN_PERSON",
    ),
    [location, setLocation] = useState(meeting?.location ?? ""),
    [discussion, setDiscussion] = useState(meeting?.discussion ?? ""),
    [conclusion, setConclusion] = useState(meeting?.conclusion ?? ""),
    [reason, setReason] = useState(""),
    [error, setError] = useState("");
  return (
    <form
      className="rg-panel p-5 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        try {
          const fields = {
            occurredAt: fromVietnamInput(occurredAt),
            mode,
            location,
            discussion,
            conclusion,
          };
          onSave(
            meeting
              ? GuidanceMeetingAmendSchema.parse({
                  ...fields,
                  expectedRevision: revision,
                  reason,
                })
              : GuidanceMeetingCreateSchema.parse({
                  ...fields,
                  expectedPlanRevision: revision,
                }),
          );
        } catch (e) {
          setError(getErrorMessage(e, "Kiểm tra nhật ký."));
        }
      }}
    >
      <h2 className="font-semibold">
        {meeting ? "Sửa nhật ký có lưu lịch sử" : "Ghi nhận buổi hướng dẫn"}
      </h2>
      <label className="block">
        Thời gian thực tế (UTC+7)
        <input
          aria-label="Thời gian buổi hướng dẫn"
          type="datetime-local"
          required
          value={occurredAt}
          onChange={(e) => setOccurredAt(e.target.value)}
          className="block mt-2 rounded border p-2"
        />
      </label>
      <label className="block">
        Hình thức
        <select
          aria-label="Hình thức hướng dẫn"
          value={mode}
          onChange={(e) => setMode(e.target.value as typeof mode)}
          className="block mt-2 rounded border p-2"
        >
          <option value="IN_PERSON">Trực tiếp</option>
          <option value="ONLINE">Trực tuyến</option>
        </select>
      </label>
      <label className="block">
        Địa điểm / thông tin kết nối
        <input
          aria-label="Địa điểm hướng dẫn"
          maxLength={1000}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="block w-full mt-2 rounded border p-2"
        />
      </label>
      <label className="block">
        Nội dung trao đổi
        <textarea
          aria-label="Nội dung trao đổi"
          required
          maxLength={20000}
          value={discussion}
          onChange={(e) => setDiscussion(e.target.value)}
          className="block w-full mt-2 rounded border p-2"
        />
      </label>
      <label className="block">
        Kết luận / việc tiếp theo
        <textarea
          aria-label="Kết luận hướng dẫn"
          required
          maxLength={20000}
          value={conclusion}
          onChange={(e) => setConclusion(e.target.value)}
          className="block w-full mt-2 rounded border p-2"
        />
      </label>
      {meeting && (
        <label className="block">
          Lý do sửa nhật ký
          <textarea
            aria-label="Lý do sửa nhật ký"
            required
            maxLength={2000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="block w-full mt-2 rounded border p-2"
          />
        </label>
      )}
      <button
        disabled={busy}
        className="rounded bg-blue-700 px-4 py-2 text-white action-with-icon"
      >
        <Save size={16} aria-hidden="true" />
        {busy
          ? "Đang lưu…"
          : meeting
            ? "Lưu sửa nhật ký"
            : "Lưu buổi hướng dẫn"}
      </button>
      {error && (
        <p role="alert">Kiểm tra thời gian, nội dung, kết luận và lý do sửa.</p>
      )}
    </form>
  );
}
