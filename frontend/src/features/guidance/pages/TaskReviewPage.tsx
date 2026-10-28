import { useState } from "react";
import { CheckCircle2, MessageSquare, Send, FilePenLine } from "lucide-react";
import {
  Button,
  Card,
  DataBoundary,
  DataTable,
  Field,
  Modal,
  Notice,
  PageHeader,
  Person,
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
  TaskHistory,
  TaskStatus,
  useGuidance,
} from "../components/guidance-kit";

function ReviewDialog({
  task,
  editable,
  onClose,
}: {
  task: Task;
  editable: boolean;
  onClose: () => void;
}) {
  const action = useAction();
  const [status, setStatus] = useState<"PASS" | "FAIL" | "REVISION">("PASS");
  const [feedback, setFeedback] = useState("");
  const latest = latestSubmission(task);
  return (
    <Modal
      wide
      title={`Đánh giá tuần ${task.week} · ${task.title}`}
      onClose={onClose}
    >
      <div className="space-y-6">
        <TaskHistory task={task} />
        {editable && latest?.status === "SUBMITTED" ? (
          <form
            className="border-t pt-5 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              action
                .run(() =>
                  guidanceService.reviewTask(
                    task.id,
                    latest.id,
                    status,
                    feedback,
                  ),
                )
                .then(onClose)
                .catch(() => {});
            }}
          >
            <h3 className="font-semibold">Nhận xét lần nộp mới nhất</h3>
            <ActionError error={action.error} />
            <Field label="Kết quả đánh giá">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
              >
                <option value="PASS">Đạt</option>
                <option value="FAIL">Không đạt</option>
                <option value="REVISION">Cần sửa và nộp lại</option>
              </select>
            </Field>
            <Field label="Nhận xét và yêu cầu cho sinh viên">
              <textarea
                required
                minLength={5}
                rows={4}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Nhận xét kết quả, vấn đề cần chỉnh sửa, yêu cầu tuần tiếp theo…"
              />
            </Field>
            {status === "REVISION" && (
              <Notice tone="warning">
                Sinh viên cần nộp một phiên bản mới. Nếu đã hết hạn nhiệm vụ,
                GVHD cần gia hạn ở bảng nhiệm vụ.
              </Notice>
            )}
            <div className="dialog-actions">
              <Button type="button" variant="secondary" onClick={onClose}>
                Đóng
              </Button>
              <Button disabled={action.pending}>
                <Send size={16} />
                Gửi đánh giá
              </Button>
            </div>
          </form>
        ) : (
          <Notice>
            {latest
              ? "Lần nộp này đã được đánh giá hoặc tài khoản đang ở chế độ xem. Mỗi lần nộp giữ nguyên nhận xét để bảo toàn lịch sử."
              : "Sinh viên chưa nộp báo cáo và mã nguồn cho nhiệm vụ này."}
          </Notice>
        )}
      </div>
    </Modal>
  );
}

function ReviewContent({ db }: { db: DemoDb }) {
  const context = useGuidance(db);
  const { termId, studentId, student, advisor, locked } = context;
  const [status, setStatus] = useState("ALL");
  const [detailId, setDetailId] = useState("");
  const all = db.tasks
    .filter((t) => t.termId === termId && t.studentId === studentId)
    .sort((a, b) => b.week - a.week);
  const tasks = all.filter(
    (t) =>
      status === "ALL" || (latestSubmission(t)?.status || "PENDING") === status,
  );
  const detail = all.find((t) => t.id === detailId);
  return (
    <>
      <PageHeader
        eyebrow="HƯỚNG DẪN ĐỒ ÁN / ĐÁNH GIÁ"
        title="Đánh giá báo cáo tuần"
        description="GVHD đọc báo cáo, mã nguồn và phản hồi từng lần nộp. Khoa theo dõi kết quả trong cùng hồ sơ."
      />
      <GuidanceSelector context={context} />
      {student && (
        <>
          <div className="grid sm:grid-cols-3 gap-4 mb-6">
            <Stat
              label="Chờ nhận xét"
              value={
                all.filter((t) => latestSubmission(t)?.status === "SUBMITTED")
                  .length
              }
              icon={<MessageSquare size={18} />}
            />
            <Stat
              label="Đạt yêu cầu"
              value={
                all.filter((t) => latestSubmission(t)?.status === "PASS").length
              }
              icon={<CheckCircle2 size={18} />}
            />
            <Stat
              icon={<FilePenLine size={18} />}
              label="Cần sửa / không đạt"
              value={
                all.filter((t) =>
                  ["REVISION", "FAIL"].includes(
                    latestSubmission(t)?.status || "",
                  ),
                ).length
              }
            />
          </div>
          <Card title="Hồ sơ bài nộp">
            <DataTable
              rows={tasks}
              searchText={(t) =>
                `${t.week} ${t.title} ${latestSubmission(t)?.feedback || ""}`
              }
              filters={
                <select
                  aria-label="Lọc đánh giá"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="SUBMITTED">Chờ đánh giá</option>
                  <option value="PASS">Đạt</option>
                  <option value="REVISION">Cần sửa</option>
                  <option value="FAIL">Không đạt</option>
                  <option value="PENDING">Chưa nộp</option>
                </select>
              }
              columns={[
                {
                  key: "student",
                  title: "Sinh viên",
                  render: () => (
                    <Person name={student.name} sub={student.code} />
                  ),
                },
                {
                  key: "title",
                  title: "Nhiệm vụ",
                  render: (t) => (
                    <div>
                      <strong>
                        Tuần {t.week} · {t.title}
                      </strong>
                      <p className="muted text-sm mt-1">
                        {t.submissions.length} lần nộp
                      </p>
                    </div>
                  ),
                },
                {
                  key: "at",
                  title: "Nộp mới nhất",
                  render: (t) =>
                    latestSubmission(t)
                      ? date(latestSubmission(t)!.at)
                      : "Chưa nộp",
                },
                {
                  key: "status",
                  title: "Kết quả",
                  render: (t) => <TaskStatus task={t} />,
                },
                {
                  key: "feedback",
                  title: "Nhận xét gần nhất",
                  render: (t) => (
                    <p className="max-w-xs line-clamp-2">
                      {latestSubmission(t)?.feedback || "—"}
                    </p>
                  ),
                },
                {
                  key: "action",
                  title: "Thao tác",
                  render: (t) => (
                    <Button
                      variant={
                        advisor &&
                        latestSubmission(t)?.status === "SUBMITTED" &&
                        !locked
                          ? "primary"
                          : "secondary"
                      }
                      onClick={() => setDetailId(t.id)}
                    >
                      {advisor &&
                      latestSubmission(t)?.status === "SUBMITTED" &&
                      !locked
                        ? "Đánh giá"
                        : "Xem bài nộp"}
                    </Button>
                  ),
                },
              ]}
            />
          </Card>
        </>
      )}
      {detail && (
        <ReviewDialog
          task={detail}
          editable={advisor && !locked}
          onClose={() => setDetailId("")}
        />
      )}
    </>
  );
}
export default function TaskReviewPage() {
  return <DataBoundary>{(db) => <ReviewContent db={db} />}</DataBoundary>;
}
