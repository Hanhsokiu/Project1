import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Calculator, CheckCheck } from "lucide-react";
import {
  academicDegreeLabels,
  academicRankLabels,
  defaultQuotaSettings,
  MAX_QUOTA,
  QuotaSettingsSchema,
  type QuotaPolicy,
  type QuotaSettings,
} from "@doan/shared";
import {
  Badge,
  Button,
  Card,
  Confirm,
  Field,
  Notice,
  Stat,
} from "../../../shared/components/kit";
import { useWorkspace } from "../../../shared/hooks/use-workspace";
import { useAction } from "../../../shared/hooks/use-demo";
import type { Term } from "../../../shared/data/types";
import { step1Api } from "../../../shared/data/snapshot-api";
import { quotaApi } from "../services/quota-api";

const number = (value: number) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 4 }).format(value);
export function QuotaPanel({
  term,
  rosterDirty,
}: {
  term: Term;
  rosterDirty: boolean;
}) {
  const { db } = useWorkspace();
  const action = useAction({ invalidateTerms: true });
  const [policy, setPolicy] = useState<QuotaPolicy | null>(
    term.quotaPolicy ?? null,
  );
  const [settings, setSettings] = useState<QuotaSettings>(
    structuredClone(policy?.settings ?? defaultQuotaSettings),
  );
  const [limits, setLimits] = useState<Record<string, number>>(
    Object.fromEntries(
      (policy?.members ?? []).map((m) => [m.lecturerId, m.maxQuota]),
    ),
  );
  const [finals, setFinals] = useState<
    Record<string, { quota: number; reason: string }>
  >(
    Object.fromEntries(
      (policy?.members ?? []).map((m) => [
        m.lecturerId,
        { quota: m.quota, reason: m.reason },
      ]),
    ),
  );
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    const p = term.quotaPolicy ?? null;
    setPolicy(p);
    setSettings(structuredClone(p?.settings ?? defaultQuotaSettings));
    setLimits(
      Object.fromEntries(
        (p?.members ?? []).map((m) => [m.lecturerId, m.maxQuota]),
      ),
    );
    setFinals(
      Object.fromEntries(
        (p?.members ?? []).map((m) => [
          m.lecturerId,
          { quota: m.quota, reason: m.reason },
        ]),
      ),
    );
    setConfirm(false);
  }, [term.id, term.quotaPolicy?.revision]);
  const locked =
    term.locked ||
    term.assignmentPublished ||
    ["COMPLETED", "CANCELLED"].includes(term.status) ||
    term.phases.some((p) => p.code === "ASSIGNMENT" && p.locked);
  const unavailable = locked || rosterDirty || !step1Api.term || action.pending;
  const rows = term.lecturers.map((m) => ({
    ...m,
    lecturer: db.lecturers.find((l) => l.id === m.lecturerId),
    snapshot: policy?.members.find((p) => p.lecturerId === m.lecturerId),
  }));
  const matches =
    !!policy &&
    JSON.stringify(settings) === JSON.stringify(policy.settings) &&
    rows.every(
      (r) =>
        (limits[r.lecturerId] ?? settings.defaultLimit) ===
        r.snapshot?.maxQuota,
    ) &&
    rows.length === policy.members.length;
  const finalTotal = rows.reduce(
    (n, r) => n + (finals[r.lecturerId]?.quota ?? 0),
    0,
  );
  const invalidFinal = rows.some((r) => {
    const f = finals[r.lecturerId],
      m = r.snapshot;
    return (
      !f ||
      !m ||
      !Number.isInteger(f.quota) ||
      f.quota < m.currentCount ||
      f.quota > m.maxQuota ||
      (f.quota !== m.suggestedQuota && f.reason.trim().length < 5)
    );
  });
  async function preview() {
    const parsed = QuotaSettingsSchema.safeParse(settings);
    if (!parsed.success) {
      await action
        .run(() =>
          Promise.reject(
            new Error(
              "Nhập giới hạn nguyên từ 0–500 và hệ số lớn hơn 0, tối đa 10 (4 chữ số thập phân).",
            ),
          ),
        )
        .catch(() => {});
      return;
    }
    try {
      const p = (await action.run(() =>
        quotaApi.preview(term.id, {
          revision: policy?.revision ?? 0,
          settings: parsed.data,
          limits: rows.map((r) => ({
            lecturerId: r.lecturerId,
            maxQuota: limits[r.lecturerId] ?? settings.defaultLimit,
          })),
        }),
      )) as QuotaPolicy;
      setPolicy(p);
      setFinals(
        Object.fromEntries(
          p.members.map((m) => [
            m.lecturerId,
            { quota: m.quota, reason: m.reason },
          ]),
        ),
      );
    } catch {
      /* useAction shows the server error. */
    }
  }
  async function approve() {
    if (!policy) return;
    try {
      const p = (await action.run(() =>
        quotaApi.approve(term.id, {
          revision: policy.revision,
          members: rows.map((r) => ({
            lecturerId: r.lecturerId,
            ...finals[r.lecturerId],
          })),
        }),
      )) as QuotaPolicy;
      setPolicy(p);
      setConfirm(false);
    } catch {
      setConfirm(false);
    }
  }
  return (
    <Card title="Chỉ tiêu hướng dẫn theo hệ số">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <p className="muted text-sm">
          Hệ thống tính đề xuất; Khoa điều chỉnh và chốt trước khi phân công.
        </p>
        <Badge>
          {!policy
            ? "Chỉ tiêu thủ công hiện có"
            : policy.status === "APPROVED" && term.quotaReady !== false
              ? "Đã chốt chỉ tiêu"
              : "Cần tính / chốt chỉ tiêu"}
        </Badge>
      </div>
      {rosterDirty && (
        <Notice tone="warning">
          Lưu danh sách tham gia bên dưới trước khi tính hoặc chốt chỉ tiêu.
        </Notice>
      )}
      {!step1Api.term && (
        <Notice tone="warning">
          Chức năng chốt chỉ tiêu sử dụng dữ liệu chính thức. Cần kết nối API
          đợt để sử dụng.
        </Notice>
      )}
      {term.quotaReady === false && policy?.status === "APPROVED" && (
        <Notice tone="warning">
          Danh sách hoặc chỉ tiêu đã thay đổi sau lần chốt. Hãy tính và chốt
          lại; kết quả phân công hiện có được giữ để kiểm tra.
        </Notice>
      )}
      <div className="form-grid mt-4">
        <Field
          label="Số sinh viên dùng để tính"
          hint="Trước khi đóng đăng ký, dùng danh sách tham gia để lập kế hoạch."
        >
          <select
            value={settings.basis}
            disabled={unavailable}
            onChange={(e) =>
              setSettings({
                ...settings,
                basis: e.target.value as QuotaSettings["basis"],
              })
            }
          >
            <option value="ROSTER">Toàn bộ danh sách tham gia</option>
            <option
              value="SUBMITTED"
              disabled={
                !["CLOSED_REGISTRATION", "IN_PROGRESS"].includes(term.status)
              }
            >
              Đăng ký đã nộp (sau đóng đăng ký)
            </option>
          </select>
        </Field>
        <Field
          label="Giới hạn tối đa chung (SV/GV)"
          hint="Đây là trần do Khoa lựa chọn; có thể đặt riêng từng người."
        >
          <div className="flex gap-2">
            <input
              aria-label="Giới hạn tối đa chung"
              type="number"
              min={0}
              max={MAX_QUOTA}
              step={1}
              value={settings.defaultLimit}
              disabled={unavailable}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  defaultLimit: Number(e.target.value),
                })
              }
            />
            <Button
              variant="secondary"
              disabled={unavailable}
              onClick={() => setLimits({})}
            >
              Áp dụng cho tất cả
            </Button>
          </div>
        </Field>
        {Object.entries(settings.factors).map(([key, value]) => (
          <Field
            key={key}
            label={`Hệ số ${key in academicDegreeLabels ? academicDegreeLabels[key as keyof typeof academicDegreeLabels] : academicRankLabels[key as keyof typeof academicRankLabels]}`}
          >
            <input
              aria-label={`Hệ số ${key}`}
              type="number"
              min={0.0001}
              max={10}
              step={0.0001}
              value={value}
              disabled={unavailable}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  factors: {
                    ...settings.factors,
                    [key]: Number(e.target.value),
                  },
                })
              }
            />
          </Field>
        ))}
      </div>
      <p className="text-sm muted my-4">
        Đề xuất = số SV × hệ số GV / tổng hệ số, có xét giới hạn và tải đã phân.
        Học hàm được ưu tiên khi quy đổi, mỗi GV dùng một hệ số.{" "}
        <Link className="text-blue-700 underline" to="/catalog/lecturers">
          Cập nhật học hàm, học vị
        </Link>
        .
      </p>
      <Button disabled={unavailable || !rows.length} onClick={preview}>
        <Calculator size={16} aria-hidden="true" />
        Tính chỉ tiêu đề xuất
      </Button>
      {policy && policy.members.length > 0 && (
        <>
          <div className="stat-grid mt-5">
            <Stat
              icon={<Calculator size={18} aria-hidden="true" />}
              label="SV cần phân"
              value={policy.demandCount}
            />
            <Stat
              icon={<Calculator size={18} aria-hidden="true" />}
              label="Tổng hệ số"
              value={number(policy.totalCoefficient)}
            />
            <Stat
              icon={<Calculator size={18} aria-hidden="true" />}
              label="Hệ số trung bình"
              value={number(policy.averageCoefficient)}
            />
            <Stat
              icon={<Calculator size={18} aria-hidden="true" />}
              label="Tổng chỉ tiêu chốt"
              value={finalTotal}
            />
          </div>
          <p className="text-sm muted mb-4">
            Trung bình{" "}
            {number(
              policy.demandCount /
                Math.max(
                  1,
                  policy.members.filter((m) => m.maxQuota > 0).length,
                ),
            )}{" "}
            SV/GV nhận hướng dẫn. Giới hạn 0 nghĩa là không nhận SV. Quota là
            sức chứa, không bảo đảm mọi GV được phân đủ.
          </p>
          {policy.warnings.map((w) => (
            <div key={w} className="mb-3">
              <Notice tone={policy.shortage > 0 ? "warning" : "info"}>
                {w}
              </Notice>
            </div>
          ))}
          {!matches && (
            <Notice tone="warning">
              Cấu hình đã thay đổi. Tính lại đề xuất trước khi chốt.
            </Notice>
          )}
        </>
      )}
      <p className="text-xs muted mt-4 sm:hidden">
        Cuộn bảng sang ngang để xem giới hạn, quota chốt và lý do điều chỉnh.
      </p>
      <div className="overflow-x-auto mt-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              {[
                "Giảng viên",
                "Học vị / học hàm",
                "Hệ số",
                "Giới hạn",
                "Đề xuất",
                "Đã phân",
                "Quota chốt",
                "Lý do điều chỉnh",
              ].map((h) => (
                <th key={h} scope="col" className="p-3 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const l = r.lecturer,
                m = r.snapshot,
                f = finals[r.lecturerId];
              return (
                <tr key={r.lecturerId} className="border-b align-top">
                  <td className="p-3 min-w-40">
                    <strong>{l?.name ?? r.lecturerId}</strong>
                    <small className="block muted">{l?.code}</small>
                  </td>
                  <td className="p-3">
                    {(m?.academicDegree ?? l?.academicDegree)
                      ? academicDegreeLabels[
                          (m?.academicDegree ??
                            l?.academicDegree) as keyof typeof academicDegreeLabels
                        ]
                      : "Chưa cập nhật"}
                    <small className="block muted">
                      {
                        academicRankLabels[
                          (m?.academicRank ??
                            l?.academicRank ??
                            "NONE") as keyof typeof academicRankLabels
                        ]
                      }
                    </small>
                  </td>
                  <td className="p-3">{m ? number(m.coefficient) : "—"}</td>
                  <td className="p-3">
                    <input
                      className="w-24"
                      aria-label={`Giới hạn ${l?.code}`}
                      type="number"
                      min={m?.currentCount ?? 0}
                      max={MAX_QUOTA}
                      step={1}
                      value={limits[r.lecturerId] ?? settings.defaultLimit}
                      disabled={unavailable}
                      onChange={(e) =>
                        setLimits({
                          ...limits,
                          [r.lecturerId]: Number(e.target.value),
                        })
                      }
                    />
                  </td>
                  <td className="p-3">{m?.suggestedQuota ?? "—"}</td>
                  <td className="p-3">{m?.currentCount ?? "—"}</td>
                  <td className="p-3">
                    <input
                      className="w-24"
                      aria-label={`Quota chốt ${l?.code}`}
                      type="number"
                      min={m?.currentCount ?? 0}
                      max={m?.maxQuota ?? MAX_QUOTA}
                      step={1}
                      value={f?.quota ?? r.quota}
                      disabled={
                        unavailable || !matches || policy?.status !== "DRAFT"
                      }
                      onChange={(e) =>
                        setFinals({
                          ...finals,
                          [r.lecturerId]: {
                            quota: Number(e.target.value),
                            reason: f?.reason ?? "",
                          },
                        })
                      }
                    />
                  </td>
                  <td className="p-3">
                    <input
                      className="min-w-44"
                      aria-label={`Lý do điều chỉnh ${l?.code}`}
                      maxLength={1000}
                      value={f?.reason ?? ""}
                      placeholder={
                        f && m && f.quota !== m.suggestedQuota
                          ? "Nhập ít nhất 5 ký tự"
                          : "Theo đề xuất"
                      }
                      disabled={
                        unavailable || !matches || policy?.status !== "DRAFT"
                      }
                      onChange={(e) =>
                        setFinals({
                          ...finals,
                          [r.lecturerId]: {
                            quota: f?.quota ?? 0,
                            reason: e.target.value,
                          },
                        })
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {policy?.status === "DRAFT" && policy.members.length > 0 && (
        <div className="form-actions">
          <Button
            disabled={
              unavailable ||
              !matches ||
              invalidFinal ||
              finalTotal < policy.demandCount
            }
            onClick={() => setConfirm(true)}
          >
            <CheckCheck size={16} aria-hidden="true" />
            Chốt chỉ tiêu hướng dẫn
          </Button>
        </div>
      )}
      {policy?.approvedAt && (
        <p className="muted text-sm mt-3">
          Đã chốt lúc{" "}
          {new Date(policy.approvedAt).toLocaleString("vi-VN", {
            timeZone: "Asia/Ho_Chi_Minh",
          })}
          . Phiên bản {policy.revision}.
        </p>
      )}
      {action.error && <Notice tone="danger">{action.error.message}</Notice>}
      {confirm && (
        <Confirm
          title="Chốt chỉ tiêu hướng dẫn?"
          description={`Áp dụng ${finalTotal} chỉ tiêu cho ${policy?.demandCount} sinh viên. Phương án phân công vẫn cần Khoa kiểm tra và công bố riêng.`}
          onClose={() => setConfirm(false)}
          onConfirm={approve}
          pending={action.pending}
        />
      )}
    </Card>
  );
}
