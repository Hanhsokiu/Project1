import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Badge,
  Button,
  Card,
  Confirm,
  DataTable,
  Modal,
  Notice,
  PageHeader,
  Person,
  Stat,
} from "../../../shared/components/kit";
import { useWorkspace } from "../../../shared/hooks/use-workspace";
import { useAction } from "../../../shared/hooks/use-demo";
import {
  assignmentApi,
  assignmentContext,
  type AssignmentPreview,
} from "../services/assignment-api";
export default function ApiAssignmentPlanPage() {
  const { db, term, termId } = useWorkspace(),
    action = useAction();
  const ctx = assignmentContext(termId);
  const [preview, setPreview] = useState<AssignmentPreview | null>(null),
    [all, setAll] = useState(false);
  const [confirm, setConfirm] = useState<"all" | "publish" | "finalize" | null>(
    null,
  );
  const rows = ctx?.results ?? [],
    assignments = db.assignments.filter((a) => a.termId === termId);
  const notices = db.notifications.filter(
    (n) => n.termId === termId && n.channel === "EMAIL",
  );
  const locked =
    term.locked ||
    term.assignmentPublished ||
    term.status !== "CLOSED_REGISTRATION";
  async function calculate(full: boolean) {
    try {
      setAll(full);
      setPreview(await assignmentApi.preview(termId, full));
      setConfirm(null);
    } catch (e) {
      await action.run(() => Promise.reject(e)).catch(() => {});
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="BƯỚC 03 · PHÂN CÔNG GVHD"
        title="Phương án phân công"
        description={`${term.name} · NV1 toàn đợt → NV2 → NV3 → theo hướng.`}
        actions={
          <>
            <Link className="btn btn-secondary" to="/registration/manual">
              Điều chỉnh thủ công
            </Link>
            <Button
              variant="secondary"
              disabled={locked || action.pending}
              onClick={() => calculate(false)}
            >
              Xem trước phân bổ bổ sung
            </Button>
            <Button
              variant="secondary"
              disabled={locked || action.pending}
              onClick={() => setConfirm("all")}
            >
              Tính lại toàn bộ
            </Button>
            <Button
              disabled={locked || !assignments.length || action.pending}
              onClick={() => setConfirm("publish")}
            >
              {term.assignmentPublished ? "Đã công bố" : "Chốt & công bố"}
            </Button>
            {ctx?.plan?.status === "PUBLISHED" && (
              <Button
                disabled={term.locked || action.pending}
                onClick={() => setConfirm("finalize")}
              >
                Chốt phân công chính thức
              </Button>
            )}
            {ctx?.plan?.status === "FINALIZED" && (
              <Badge>Đã chốt chính thức</Badge>
            )}
          </>
        }
      />
      <Notice tone={term.assignmentPublished ? "success" : "info"}>
        {term.assignmentPublished
          ? "Kết quả chính thức được lưu tại máy chủ. Email được gửi qua SMTP sau khi công bố."
          : "Bản nháp chỉ Giáo vụ xem được. Phân bổ bổ sung giữ các phân công đã lưu, bao gồm điều chỉnh thủ công."}{" "}
        GPA giảm dần trong từng vòng; bằng GPA xét thời điểm nộp rồi mã SV.
        Fallback xét tải/quota rồi mã GV.
      </Notice>
      <div className="stat-grid mt-5">
        <Stat label="Đã nộp đăng ký" value={rows.length} />
        <Stat label="Đã phân công" value={assignments.length} />
        <Stat
          label="Chưa phân"
          value={rows.filter((r) => !r.assignedLecturerId).length}
        />
        <Stat
          label="Chưa nộp đăng ký"
          value={ctx?.missingSubmissions.length ?? 0}
        />
      </div>
      <div className="stack">
        {!!ctx?.violations?.length && (
          <Notice tone="warning">{ctx.violations.join(" · ")}</Notice>
        )}
        <Card
          title={`Phương án ${ctx?.plan ? `· phiên ${ctx.plan.revision} · ${ctx.plan.status}` : "chưa lưu"}`}
        >
          <DataTable
            rows={rows}
            columns={[
              {
                key: "student",
                title: "Sinh viên",
                render: (r) => {
                  const s = db.students.find((s) => s.id === r.studentId);
                  return (
                    <Person
                      name={s?.name ?? r.studentId}
                      sub={`${s?.code ?? ""} · GPA ${s?.gpa ?? "thiếu"}`}
                    />
                  );
                },
              },
              {
                key: "advisor",
                title: "GVHD",
                render: (r) =>
                  db.lecturers.find((l) => l.id === r.assignedLecturerId)
                    ?.name ?? "Chưa phân",
              },
              { key: "reason", title: "Lý do", render: (r) => r.reason },
            ]}
          />
        </Card>
        <Card title="SV chưa nộp đăng ký — cần xử lý riêng">
          <DataTable
            rows={ctx?.missingSubmissions ?? []}
            columns={[
              {
                key: "student",
                title: "Sinh viên",
                render: (r) => {
                  const s = db.students.find((s) => s.id === r.studentId);
                  return `${s?.code ?? ""} · ${s?.name ?? r.studentId}`;
                },
              },
              { key: "reason", title: "Lý do", render: (r) => r.reason },
            ]}
          />
        </Card>
        <Card title="Tải giảng viên / quota trong đợt">
          <DataTable
            rows={term.lecturers}
            columns={[
              {
                key: "name",
                title: "Giảng viên",
                render: (r) =>
                  db.lecturers.find((l) => l.id === r.lecturerId)?.name,
              },
              {
                key: "load",
                title: "Tải / Quota",
                render: (r) =>
                  `${assignments.filter((a) => a.lecturerId === r.lecturerId).length} / ${r.quota}`,
              },
            ]}
          />
        </Card>
        <Card
          title="Email outbox"
          description="SENT: SMTP đã chấp nhận thư. FAILED có lỗi và có thể gửi lại."
        >
          <DataTable
            rows={notices}
            columns={[
              { key: "subject", title: "Email", render: (n) => n.title },
              {
                key: "status",
                title: "Trạng thái",
                render: (n) => <Badge value={n.status} />,
              },
              {
                key: "attempts",
                title: "Lần thử",
                render: (n) => n.attempts ?? 0,
              },
              {
                key: "error",
                title: "Chi tiết",
                render: (n) => n.lastError ?? n.content,
              },
              {
                key: "retry",
                title: "Thao tác",
                render: (n) =>
                  n.status === "FAILED" ? (
                    <Button
                      disabled={action.pending}
                      onClick={() =>
                        action
                          .run(() => assignmentApi.retry(n.id))
                          .catch(() => {})
                      }
                    >
                      Gửi lại
                    </Button>
                  ) : null,
              },
            ]}
          />
        </Card>
      </div>
      {preview && (
        <Modal
          title="Xem trước — chưa ghi DB"
          wide
          onClose={() => setPreview(null)}
        >
          <DataTable
            rows={preview.results}
            columns={[
              {
                key: "student",
                title: "Sinh viên",
                render: (r) => {
                  const reg = db.registrations.find(
                    (reg) => reg.id === r.registrationId,
                  );
                  const s = db.students.find((s) => s.id === reg?.studentId);
                  return `${s?.code ?? ""} · ${s?.name ?? r.registrationId}`;
                },
              },
              {
                key: "advisor",
                title: "GVHD",
                render: (r) =>
                  db.lecturers.find((l) => l.id === r.assignedLecturerId)
                    ?.name ?? "Chưa phân",
              },
              { key: "reason", title: "Lý do", render: (r) => r.reason },
            ]}
          />
          <Button
            disabled={action.pending}
            onClick={async () => {
              try {
                await action.run(() =>
                  assignmentApi.save(termId, preview, all),
                );
                setPreview(null);
              } catch {
                setPreview(null);
              }
            }}
          >
            Lưu phương án nháp
          </Button>
        </Modal>
      )}
      {confirm && (
        <Confirm
          title={
            confirm === "finalize"
              ? "Chốt phân công chính thức?"
              : confirm === "all"
                ? "Tính lại toàn bộ phương án nháp?"
                : "Chốt và công bố phân công?"
          }
          description={
            confirm === "finalize"
              ? "Xác nhận phương án đã công bố để sử dụng ở các bước xét duyệt và hướng dẫn. Thao tác này ghi nhận người chốt và thời điểm chốt."
              : confirm === "all"
                ? "Các phân công nháp, kể cả điều chỉnh thủ công, sẽ được tính lại khi bạn lưu kết quả xem trước."
                : "Kết quả chính thức sẽ mở cho SV/GV, chuyển đợt sang Đang thực hiện và tạo email outbox. Không sửa trực tiếp sau công bố."
          }
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            if (confirm === "all") await calculate(true);
            else {
              try {
                await action.run(() =>
                  confirm === "finalize"
                    ? assignmentApi.finalize(termId)
                    : assignmentApi.publish(termId),
                );
              } finally {
                setConfirm(null);
              }
            }
          }}
          pending={action.pending}
        />
      )}
    </>
  );
}
