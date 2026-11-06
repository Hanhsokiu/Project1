import React, { useRef, useState } from "react";
import { WeeklyReopenSchema } from "@doan/shared";
import { progressApi } from "./api";
import { fromVietnamInput } from "../guidance-tasks/components";
import { getErrorMessage } from "../../shared/api/error-message";
export function ReopenReportForm({
  submissionId,
  taskRevision,
  onSaved,
}: {
  submissionId: string;
  taskRevision: number;
  onSaved: () => Promise<void>;
}) {
  const [reason, setReason] = useState(""),
    [due, setDue] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const keys = useRef(new Map<string, string>());
  return (
    <form
      className="rg-panel p-4 space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (
          !window.confirm(
            "Mở lại báo cáo Không đạt? Kết quả cũ vẫn được giữ trong lịch sử.",
          )
        )
          return;
        setBusy(true);
        setError("");
        try {
          const input = WeeklyReopenSchema.parse({
            expectedTaskRevision: taskRevision,
            reason,
            revisionDueAt: fromVietnamInput(due),
          });
          const hash = JSON.stringify(input);
          if (!keys.current.has(hash))
            keys.current.set(hash, crypto.randomUUID());
          await progressApi.reopen(
            submissionId,
            input,
            keys.current.get(hash)!,
          );
          await onSaved();
        } catch (e) {
          setError(getErrorMessage(e, "Không thể xử lý yêu cầu."));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Mở lại báo cáo Không đạt</h2>
      <label className="block">
        Lý do mở lại
        <textarea
          className="input w-full"
          required
          maxLength={2000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      <label className="block">
        Hạn nộp lại (UTC+7)
        <input
          className="input"
          type="datetime-local"
          required
          value={due}
          onChange={(e) => setDue(e.target.value)}
        />
      </label>
      <button
        className="btn btn-primary"
        disabled={busy || !reason.trim() || !due}
      >
        Xác nhận mở lại
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
