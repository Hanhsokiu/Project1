import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ArrowDown, ArrowUp, LockKeyhole, Plus, Trash2 } from "lucide-react";
import type { Phase } from "../../../shared/data/types";
import { uid } from "../../../shared/data/store";
import {
  Back,
  Badge,
  Button,
  Card,
  Confirm,
  Field,
  Notice,
  PageHeader,
} from "../../../shared/components/kit";
import { useWorkspace } from "../../../shared/hooks/use-workspace";
import { useAction } from "../../../shared/hooks/use-demo";
import { step1Api } from "../../../shared/data/snapshot-api";
import { termService } from "../services/term-service";
export default function PhasePlanPage() {
  const { id } = useParams();
  const { db } = useWorkspace();
  const t = db.terms.find((t) => t.id === id);
  const action = useAction();
  const [phases, setPhases] = useState<Phase[]>(() =>
    structuredClone(t?.phases || []),
  );
  const [confirm, setConfirm] = useState<{
    id: string;
    locked: boolean;
  } | null>(null);
  useEffect(
    () => setPhases(structuredClone(t?.phases || [])),
    [t?.id, t?.phases],
  );
  if (!t)
    return (
      <Card>
        <Notice tone="danger">Không tìm thấy đợt đồ án.</Notice>
        <Back to="/terms" />
      </Card>
    );
  const disabled = t.locked || ["COMPLETED", "CANCELLED"].includes(t.status);
  const dirty = JSON.stringify(phases) !== JSON.stringify(t.phases);
  const update = (index: number, patch: Partial<Phase>) =>
    setPhases(phases.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  const move = (index: number, offset: number) => {
    const next = [...phases];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    setPhases(next);
  };
  async function save() {
    try {
      await action.run(() => termService.savePhases(t!.id, phases));
    } catch {
      // useAction displays the failure; keep the current form available for correction.
    }
  }
  async function lock() {
    if (!confirm) return;
    try {
      await action.run(() =>
        termService.savePhases(
          t!.id,
          phases.map((p) =>
            p.id === confirm.id ? { ...p, locked: confirm.locked } : p,
          ),
        ),
      );
      setConfirm(null);
    } catch {
      // useAction displays the failure; keep the current form available for correction.
    }
  }
  return (
    <>
      <Back to={`/terms/${t.id}`} />
      <PageHeader
        title="Kế hoạch giai đoạn"
        description={`${t.code} · Thiết lập mốc, thời hạn và khóa/mở từng giai đoạn.`}
        actions={
          !step1Api.term && (
            <Button
              variant="secondary"
              disabled={disabled}
              onClick={() =>
                setPhases([
                  ...phases,
                  {
                    id: uid("phase"),
                    name: "",
                    start: t.start,
                    end: t.end,
                    locked: false,
                  },
                ])
              }
            >
              <Plus size={15} />
              Thêm giai đoạn
            </Button>
          )
        }
      />
      {disabled && (
        <div className="mb-6">
          <Notice tone="warning">
            Đợt đang khóa hoặc đã kết thúc; chỉ được xem kế hoạch.
          </Notice>
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="stack">
          {phases.map((phase, i) => (
            <Card
              key={phase.id}
              title={`${i + 1}. ${phase.name || "Giai đoạn mới"}`}
              action={
                <div className="flex gap-1">
                  <Badge value={phase.locked ? "LOCKED" : "OPEN_REGISTRATION"}>
                    {phase.locked ? "Đã khóa" : "Theo thời hạn"}
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={step1Api.term || disabled || i === 0}
                    aria-label={`Đưa giai đoạn ${i + 1} lên`}
                    onClick={() => move(i, -1)}
                  >
                    <ArrowUp size={15} />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={
                      step1Api.term || disabled || i === phases.length - 1
                    }
                    aria-label={`Đưa giai đoạn ${i + 1} xuống`}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown size={15} />
                  </Button>
                  {!step1Api.term && i > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={disabled}
                      aria-label={`Xóa giai đoạn ${i + 1}`}
                      onClick={() =>
                        setPhases(phases.filter((p) => p.id !== phase.id))
                      }
                    >
                      <Trash2 size={15} />
                    </Button>
                  )}
                </div>
              }
            >
              <div className="form-grid">
                <Field label="Tên giai đoạn">
                  <input
                    required
                    disabled={disabled}
                    value={phase.name}
                    onChange={(e) => update(i, { name: e.target.value })}
                  />
                </Field>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={disabled || action.pending}
                    onClick={() =>
                      setConfirm({ id: phase.id, locked: !phase.locked })
                    }
                  >
                    <LockKeyhole size={15} />
                    {phase.locked ? "Mở lại giai đoạn" : "Khóa giai đoạn"}
                  </Button>
                </div>
                <Field
                  label={step1Api.term ? "Bắt đầu (giờ Việt Nam)" : "Từ ngày"}
                >
                  <input
                    required
                    disabled={disabled}
                    type={step1Api.term ? "datetime-local" : "date"}
                    min={step1Api.term ? t.start + "T00:00" : t.start}
                    max={step1Api.term ? t.end + "T23:59" : t.end}
                    value={phase.start}
                    onChange={(e) => update(i, { start: e.target.value })}
                  />
                </Field>
                <Field
                  label={step1Api.term ? "Kết thúc (giờ Việt Nam)" : "Đến ngày"}
                >
                  <input
                    required
                    disabled={disabled}
                    type={step1Api.term ? "datetime-local" : "date"}
                    min={phase.start}
                    max={step1Api.term ? t.end + "T23:59" : t.end}
                    value={phase.end}
                    onChange={(e) => update(i, { end: e.target.value })}
                  />
                </Field>
              </div>
            </Card>
          ))}
        </div>
        <div className="mt-6">
          <Notice>
            Thứ tự thời gian phải hợp lý và nằm trong đợt. Khóa giai đoạn chặn
            thao tác ghi tương ứng, kể cả khi chưa hết thời hạn. Khóa/mở sẽ lưu
            toàn bộ kế hoạch đang chỉnh sửa.
          </Notice>
        </div>
        <div className="form-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={!dirty || disabled}
            onClick={() => setPhases(structuredClone(t.phases))}
          >
            Khôi phục bản đã lưu
          </Button>
          <Button disabled={disabled || action.pending || !dirty}>
            Lưu kế hoạch
          </Button>
        </div>
      </form>
      {confirm && (
        <Confirm
          title={confirm.locked ? "Khóa giai đoạn?" : "Mở lại giai đoạn?"}
          description={`${confirm.locked ? "Ngừng" : "Khôi phục"} thao tác theo giai đoạn “${phases.find((p) => p.id === confirm.id)?.name}”. Cửa sổ thời gian vẫn được kiểm tra. Thao tác lưu và được ghi nhật ký.`}
          onClose={() => setConfirm(null)}
          onConfirm={lock}
          pending={action.pending}
        />
      )}
    </>
  );
}
