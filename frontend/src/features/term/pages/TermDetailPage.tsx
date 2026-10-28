import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  LockKeyhole,
  Settings2,
  Users,
  GraduationCap,
  ClipboardCheck,
  UserCheck,
  FileText,
} from "lucide-react";
import type { TermStatus } from "../../../shared/data/types";
import {
  Back,
  Badge,
  Button,
  Card,
  Confirm,
  Notice,
  PageHeader,
  Stat,
  date,
  labels,
} from "../../../shared/components/kit";
import { useWorkspace } from "../../../shared/hooks/use-workspace";
import { useAction } from "../../../shared/hooks/use-demo";
import { termService, transitions } from "../services/term-service";
export default function TermDetailPage() {
  const { id } = useParams();
  const { db, setTermId } = useWorkspace();
  const action = useAction();
  const [confirm, setConfirm] = useState<"lock" | TermStatus | null>(null);
  const t = db.terms.find((t) => t.id === id);
  if (!t)
    return (
      <Card>
        <Notice tone="danger">Đợt đồ án không tồn tại.</Notice>
        <Back to="/terms" />
      </Card>
    );
  const checks = [
    {
      name: "Sinh viên đủ điều kiện",
      ok: t.studentIds.length > 0,
      detail: `${t.studentIds.length} sinh viên trong danh sách tham gia`,
      path: "roster",
    },
    {
      name: "GV tham gia và quota",
      ok: t.lecturers.some((l) => l.quota > 0),
      detail: `${t.lecturers.length} giảng viên · ${t.lecturers.reduce((a, l) => a + l.quota, 0)} chỉ tiêu`,
      path: "roster",
    },
    {
      name: "Kế hoạch các giai đoạn",
      ok:
        t.phases.length > 0 &&
        t.phases.every(
          (p) => p.start >= t.start && p.end <= t.end && p.start <= p.end,
        ),
      detail: `${t.phases.length} giai đoạn đã cấu hình`,
      path: "phases",
    },
    {
      name: "Tham số đăng ký",
      ok:
        t.parameters.max_preferences >= 1 &&
        t.parameters.max_preferences <= 3 &&
        t.parameters.passing_gpa_threshold >= 0 &&
        t.parameters.passing_gpa_threshold <= 4,
      detail: `Tối đa ${t.parameters.max_preferences} NV · GPA ≥ ${t.parameters.passing_gpa_threshold}`,
      path: "parameters",
    },
  ];
  async function execute() {
    if (!t || !confirm) return;
    try {
      await action.run(() =>
        confirm === "lock"
          ? termService.toggleLock(t.id)
          : termService.transition(t.id, confirm),
      );
      setConfirm(null);
    } catch {
      // useAction displays the failure; keep the current form available for correction.
    }
  }
  return (
    <>
      <Back to="/terms" />
      <PageHeader
        title={t.name}
        description={`${t.code} · ${t.semester} · ${t.program}`}
        actions={
          <>
            <Badge value={t.status} />
            <Button
              variant="secondary"
              disabled={
                action.pending || ["COMPLETED", "CANCELLED"].includes(t.status)
              }
              onClick={() => setConfirm("lock")}
            >
              <LockKeyhole size={15} />
              {t.locked ? "Mở khóa đợt" : "Khóa đợt"}
            </Button>
          </>
        }
      />
      <div className="stat-grid">
        <Stat
          icon={<GraduationCap size={18} />}
          label="Sinh viên tham gia"
          value={t.studentIds.length}
        />
        <Stat
          icon={<ClipboardCheck size={18} />}
          label="Đăng ký đã nộp"
          value={
            db.registrations.filter(
              (r) => r.termId === t.id && r.status === "SUBMITTED",
            ).length
          }
        />
        <Stat
          icon={<UserCheck size={18} />}
          label="Đã phân GVHD"
          value={db.assignments.filter((r) => r.termId === t.id).length}
        />
        <Stat
          icon={<FileText size={18} />}
          label="Đề cương đã nộp"
          value={
            db.topics.filter((r) => r.termId === t.id && r.status !== "DRAFT")
              .length
          }
        />
      </div>
      {t.locked && (
        <div className="mb-6">
          <Notice tone="warning">
            Đợt đã khóa dữ liệu. Mở khóa khi cần điều chỉnh, thao tác được ghi
            nhật ký.
          </Notice>
        </div>
      )}
      <div className="section-grid">
        <div className="stack">
          <Card title="Cấu hình sẵn sàng">
            <div className="stack">
              {checks.map((c) => (
                <div
                  className="flex gap-3 items-center justify-between"
                  key={c.name}
                >
                  <div>
                    <h3 className="text-sm font-medium">{c.name}</h3>
                    <p className="muted text-xs mt-1">{c.detail}</p>
                  </div>
                  <Badge value={c.ok ? "PASS" : "PENDING"}>
                    {c.ok ? "Đã có" : "Cần bổ sung"}
                  </Badge>
                  <Link
                    className="btn btn-ghost"
                    to={`/terms/${t.id}/${c.path}`}
                  >
                    Cấu hình
                    <ArrowRight size={14} />
                  </Link>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Kế hoạch thực hiện">
            <div className="timeline">
              {t.phases.map((p) => (
                <div className="timeline-item" key={p.id}>
                  <small>
                    {date(p.start)} – {date(p.end)}
                  </small>
                  <h3>{p.name}</h3>
                  <Badge value={p.locked ? "LOCKED" : "OPEN_REGISTRATION"}>
                    {p.locked ? "Đã khóa" : "Cho phép theo thời hạn"}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
        <div className="stack">
          <Card title="Thông tin đợt">
            <dl className="info-grid">
              <div>
                <dt>Thời gian thực hiện</dt>
                <dd>
                  {date(t.start)} – {date(t.end)}
                </dd>
              </div>
              <div>
                <dt>Hệ đào tạo</dt>
                <dd>{t.program}</dd>
              </div>
              <div>
                <dt>Mở đăng ký</dt>
                <dd>{date(t.registrationStart)}</dd>
              </div>
              <div>
                <dt>Đóng đăng ký</dt>
                <dd>{date(t.registrationEnd)}</dd>
              </div>
              <div>
                <dt>Phân công GVHD</dt>
                <dd>{t.assignmentPublished ? "Đã công bố" : "Chưa công bố"}</dd>
              </div>
              <div>
                <dt>Dữ liệu</dt>
                <dd>{t.locked ? "Đã khóa" : "Đang mở"}</dd>
              </div>
            </dl>
          </Card>
          <Card title="Điều khiển vòng đời">
            <p className="muted text-sm mb-4">
              Các bước chuyển tiếp được kiểm tra cấu hình và kết quả trước khi
              lưu.
            </p>
            <div className="flex flex-wrap gap-2">
              {transitions[t.status]
                .filter((s) => !["DEFENDING", "COMPLETED"].includes(s))
                .map((s) => (
                  <Button
                    key={s}
                    variant={s === "CANCELLED" ? "danger" : "secondary"}
                    disabled={t.locked || action.pending}
                    onClick={() => setConfirm(s)}
                  >
                    {labels[s]}
                  </Button>
                ))}
              {!transitions[t.status].length && (
                <Notice>Đợt đã kết thúc, dữ liệu được giữ để tra cứu.</Notice>
              )}
            </div>
          </Card>
          <Card title="Truy cập nhanh">
            <div className="stack">
              <Link className="quick-link" to={`/terms/${t.id}/roster`}>
                <Users />
                Danh sách SV/GV và quota
              </Link>
              <Link className="quick-link" to={`/terms/${t.id}/phases`}>
                <CalendarDays />
                Kế hoạch giai đoạn
              </Link>
              <Link className="quick-link" to={`/terms/${t.id}/parameters`}>
                <Settings2 />
                Tham số đợt
              </Link>
              <Link
                className="quick-link"
                to="/registration/assignment"
                onClick={() => setTermId(t.id)}
              >
                <ArrowRight />
                Phân công GVHD
              </Link>
            </div>
          </Card>
        </div>
      </div>
      {confirm && (
        <Confirm
          title={
            confirm === "lock"
              ? t.locked
                ? "Mở khóa đợt?"
                : "Khóa đợt?"
              : `Chuyển sang ${labels[confirm].toLocaleLowerCase("vi")}?`
          }
          description={
            confirm === "lock"
              ? `Đợt ${t.code} sẽ ${t.locked ? "cho phép chỉnh sửa trở lại theo thời hạn" : "ngừng các thao tác ghi dữ liệu"}. Thao tác được ghi nhật ký.`
              : `Áp dụng trạng thái ${labels[confirm]} cho ${t.code}. Hệ thống kiểm tra điều kiện nghiệp vụ trước khi chuyển.`
          }
          onClose={() => setConfirm(null)}
          onConfirm={execute}
          pending={action.pending}
        />
      )}
    </>
  );
}
