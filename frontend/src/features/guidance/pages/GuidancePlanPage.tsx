import { useState } from "react";
import {
  CalendarDays,
  ClipboardList,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  Button,
  Card,
  Confirm,
  DataBoundary,
  DataTable,
  Empty,
  Field,
  Modal,
  Notice,
  PageHeader,
  Progress,
  Stat,
  date,
} from "../../../shared/components/kit";
import type { DemoDb, Task } from "../../../shared/data/types";
import { useAction } from "../../../shared/hooks/use-demo";
import {
  guidanceService,
  latestSubmission,
} from "../services/guidance-service";
import {
  ActionError,
  GuidanceSelector,
  TaskEditor,
  TaskStatus,
  useGuidance,
} from "../components/guidance-kit";

function PlanContent({ db }: { db: DemoDb }) {
  const context = useGuidance(db);
  const { termId, studentId, student, advisor, topic, locked } = context;
  const action = useAction();
  const plan = db.plans.find(
    (p) => p.termId === termId && p.studentId === studentId,
  );
  const tasks = db.tasks
    .filter((t) => t.termId === termId && t.studentId === studentId)
    .sort((a, b) => a.week - b.week);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [taskEditor, setTaskEditor] = useState<Task | "new" | null>(null);
  const [form, setForm] = useState({ content: "", milestones: "" });
  const approved = !!topic && ["APPROVED", "LOCKED"].includes(topic.status);
  const openEditor = () => {
    setForm({
      content: plan?.content || "",
      milestones: plan?.milestones || "",
    });
    setEditing(true);
  };
  const canEdit = advisor && !locked && approved;
  return (
    <>
      <PageHeader
        eyebrow="HƯỚNG DẪN ĐỒ ÁN / KẾ HOẠCH"
        title="Kế hoạch hướng dẫn"
        description="Thống nhất lộ trình cá nhân, mốc bàn giao và nhiệm vụ hàng tuần giữa sinh viên với GVHD."
        actions={
          canEdit && (
            <Button onClick={openEditor}>
              <Pencil size={16} />
              {plan ? "Cập nhật kế hoạch" : "Lập kế hoạch"}
            </Button>
          )
        }
      />
      <GuidanceSelector context={context} />
      {student && (
        <>
          {!approved && (
            <div className="mb-5">
              <Notice tone="warning">
                Chưa thể giao nhiệm vụ: đề cương phải được nhóm duyệt/Khoa phê
                duyệt. GVHD thống nhất đề tài và nhóm duyệt đề cương là hai bước
                riêng.
              </Notice>
            </div>
          )}
          <div className="grid sm:grid-cols-3 gap-4 mb-6">
            <Stat
              label="Nhiệm vụ đã giao"
              value={tasks.length}
              icon={<ClipboardList size={18} />}
            />
            <Stat
              label="Tuần đạt yêu cầu"
              value={
                tasks.filter((t) => latestSubmission(t)?.status === "PASS")
                  .length
              }
            />
            <Stat
              label="Tiến độ trung bình"
              value={`${tasks.length ? Math.round(tasks.reduce((s, t) => s + t.progress, 0) / tasks.length) : 0}%`}
              icon={<CalendarDays size={18} />}
            />
          </div>
          <div className="grid xl:grid-cols-2 gap-6 mb-6">
            <Card
              title="Nội dung và phương thức hướng dẫn"
              description={
                plan ? `Cập nhật ${date(plan.updatedAt)}` : undefined
              }
              action={
                canEdit && plan ? (
                  <Button
                    variant="ghost"
                    onClick={() => setDeleting(true)}
                    aria-label="Xóa kế hoạch"
                  >
                    <Trash2 size={16} />
                  </Button>
                ) : undefined
              }
            >
              {plan ? (
                <p className="whitespace-pre-wrap leading-7">{plan.content}</p>
              ) : (
                <Empty
                  title="Chưa lập kế hoạch"
                  description="GVHD bổ sung cách thức làm việc, lịch gặp và yêu cầu báo cáo."
                  action={
                    canEdit ? (
                      <Button onClick={openEditor}>Lập kế hoạch</Button>
                    ) : undefined
                  }
                />
              )}
            </Card>
            <Card title="Các mốc và sản phẩm bàn giao">
              {plan ? (
                <p className="whitespace-pre-wrap leading-7">
                  {plan.milestones}
                </p>
              ) : (
                <p className="muted">
                  Các mốc được lưu cùng kế hoạch hướng dẫn.
                </p>
              )}
            </Card>
          </div>
          <Card
            title="Kế hoạch công việc theo tuần"
            description="Mỗi sinh viên có một nhiệm vụ tổng hợp trong từng tuần. Báo cáo và mã nguồn được lưu theo các lần nộp."
            action={
              canEdit && (
                <Button onClick={() => setTaskEditor("new")}>
                  <Plus size={16} />
                  Giao nhiệm vụ
                </Button>
              )
            }
          >
            <DataTable
              rows={tasks}
              searchText={(t) => `${t.week} ${t.title} ${t.description}`}
              columns={[
                {
                  key: "week",
                  title: "Tuần",
                  render: (t) => <strong>Tuần {t.week}</strong>,
                },
                {
                  key: "title",
                  title: "Công việc",
                  render: (t) => (
                    <div>
                      <strong>{t.title}</strong>
                      <p className="muted text-sm mt-1 max-w-md truncate">
                        {t.description}
                      </p>
                    </div>
                  ),
                },
                {
                  key: "deadline",
                  title: "Hạn nộp",
                  render: (t) => date(t.deadline),
                },
                {
                  key: "progress",
                  title: "Tiến độ",
                  render: (t) => (
                    <div className="min-w-28">
                      <Progress value={t.progress} />
                    </div>
                  ),
                },
                {
                  key: "status",
                  title: "Đánh giá",
                  render: (t) => <TaskStatus task={t} />,
                },
                {
                  key: "action",
                  title: "Thao tác",
                  render: (t) =>
                    canEdit ? (
                      <Button
                        variant="secondary"
                        onClick={() => setTaskEditor(t)}
                      >
                        Sửa / gia hạn
                      </Button>
                    ) : (
                      <Link
                        className="text-indigo-600 font-medium"
                        to="/guidance/tasks"
                      >
                        Xem nhiệm vụ
                      </Link>
                    ),
                },
              ]}
            />
          </Card>
        </>
      )}
      {editing && (
        <Modal
          wide
          title={`Kế hoạch hướng dẫn · ${student?.name}`}
          onClose={() => setEditing(false)}
        >
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              action
                .run(() => guidanceService.savePlan(termId, studentId, form))
                .then(() => setEditing(false))
                .catch(() => {});
            }}
          >
            <ActionError error={action.error} />
            <Field label="Nội dung, phương pháp và lịch hướng dẫn">
              <textarea
                rows={5}
                required
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="Hình thức làm việc, thời gian trao đổi, cách báo cáo…"
              />
            </Field>
            <Field label="Mốc thực hiện và sản phẩm bàn giao">
              <textarea
                rows={5}
                required
                value={form.milestones}
                onChange={(e) =>
                  setForm({ ...form, milestones: e.target.value })
                }
                placeholder="Tuần 4: Thiết kế; tuần 8: Bản thử nghiệm; tuần 15: Báo cáo final…"
              />
            </Field>
            <div className="dialog-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditing(false)}
              >
                Hủy
              </Button>
              <Button disabled={action.pending}>Lưu kế hoạch</Button>
            </div>
          </form>
        </Modal>
      )}
      {deleting && plan && (
        <Confirm
          title="Xóa kế hoạch hướng dẫn?"
          description="Chỉ có thể xóa khi kế hoạch chưa phát sinh nhiệm vụ tuần. Lịch sử đã có bài nộp luôn được giữ."
          pending={action.pending}
          onClose={() => setDeleting(false)}
          onConfirm={() =>
            action
              .run(() => guidanceService.deletePlan(plan.id))
              .then(() => setDeleting(false))
              .catch(() => {})
          }
        />
      )}
      {taskEditor && (
        <TaskEditor
          context={context}
          task={taskEditor === "new" ? undefined : taskEditor}
          onClose={() => setTaskEditor(null)}
        />
      )}
    </>
  );
}
export default function GuidancePlanPage() {
  return <DataBoundary>{(db) => <PlanContent db={db} />}</DataBoundary>;
}
