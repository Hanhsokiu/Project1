import { useEffect, useState } from "react";
import { clearApiSession, getAccessToken } from "../api/api-session";
import { acceptanceClientAllowed, isolatedAcceptanceStatus } from "./acceptance-tools";
export function AcceptanceBanner() {
  const [status, setStatus] = useState<{ runId: string; testClock: string }>();
  const [termId, setTermId] = useState("");
  const [phase, setPhase] = useState("REGISTRATION");
  const [message, setMessage] = useState("");
  const enabled = acceptanceClientAllowed(import.meta.env.DEV,
    import.meta.env.VITE_ACCEPTANCE_STAGING === "true", typeof window === "undefined" ? "" : window.location.hostname);
  useEffect(() => {
    if (enabled) fetch("/api/acceptance/status").then(r => r.ok ? r.json() : null).then(s => {
      if (isolatedAcceptanceStatus(s)) setStatus(s);
    }).catch(() => undefined);
  }, [enabled]);
  if (!enabled || !status) return null;
  async function advance() {
    if (!enabled || !status || !getAccessToken()) {
      setMessage("Cần đăng nhập FACULTY TEST trên staging cô lập.");
      return;
    }
    setMessage("");
    const response = await fetch("/api/acceptance/clock", { method: "POST", headers: {
      "Content-Type": "application/json", Authorization: "Bearer " + getAccessToken(),
    }, body: JSON.stringify({ termId, phase }) });
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      return setMessage(typeof error?.message === "string" ? error.message : "Cần đăng nhập FACULTY TEST và chọn đúng ID đợt TEST.");
    }
    clearApiSession(); window.location.assign("/login");
  }
  return <aside className="border-b border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
    <strong>STAGING — DỮ LIỆU TEST. Không kết nối Supabase chung.</strong>
    <p>{status.runId} · Đồng hồ kiểm thử: {status.testClock}. PDF xuất ra chưa ký.</p>
    <details><summary>Chuyển giai đoạn nghiệm thu (FACULTY TEST)</summary>
      <p>Hoàn thành bước hiện tại trước khi chuyển. Sau khi đổi đồng hồ, đăng nhập lại để nhận phiên phù hợp.</p>
      <input aria-label="ID đợt TEST" placeholder="ID đợt trong manifest" value={termId} onChange={e => setTermId(e.target.value)} className="m-1 border p-1" />
      <select aria-label="Giai đoạn TEST" value={phase} onChange={e => setPhase(e.target.value)} className="m-1 border p-1">
        {["REGISTRATION", "ASSIGNMENT", "PROPOSAL", "WEEKLY", "FINAL", "DEFENSE"].map(p => <option key={p}>{p}</option>)}
      </select><button type="button" className="m-1 rounded border p-1" onClick={() => void advance()}>Chuyển đồng hồ TEST</button>
      {message && <p role="alert">{message}</p>}
    </details>
  </aside>;
}
