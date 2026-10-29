import { useState } from "react";
import {
  Undo2,
  Eye,
  X,
  CheckCircle2,
  CircleX,
  FileCheck2,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  Badge,
  Button,
  Card,
  DataBoundary,
  DataTable,
  Field,
  FileLink,
  Modal,
  Notice,
  PageHeader,
  Person,
  Progress,
} from "../../../shared/components/kit";
import type { DemoDb } from "../../../shared/data/types";
import { useAction } from "../../../shared/hooks/use-demo";
import {
  defenseReadiness,
  guidanceService,
} from "../services/guidance-service";
import {
  ActionError,
  GuidanceSelector,
  useGuidance,
} from "../components/guidance-kit";

function ConfirmContent({ db }: { db: DemoDb }) {
  const context = useGuidance(db);
  const {
    termId,
    studentId,
    students,
    student,
    advisor,
    locked,
    setStudentId,
  } = context;
  const action = useAction();
  const [dialog, setDialog] = useState<"confirm" | "withdraw" | null>(null);
  const [comment, setComment] = useState("");
  const readiness = defenseReadiness(db, termId, studentId);
  const canEdit = advisor && !locked;
  const open = (mode: "confirm" | "withdraw") => {
    setComment(readiness.final?.comment || "");
    setDialog(mode);
  };
  return (
    <>
      <PageHeader
        eyebrow="HƯỚNG DẪN ĐỒ ÁN / XÁC NHẬN BẢO VỆ"
        title="GVHD xác nhận điều kiện bảo vệ"
        description="GVHD kiểm tra đề cương, tiến độ và PDF hoàn chỉnh trước khi đồng ý cho sinh viên bảo vệ."
        actions={
          canEdit && readiness.final?.confirmed ? (
            <Button variant="secondary" onClick={() => open("withdraw")}>
              <Undo2 size={16} aria-hidden="true" />
              Thu hồi xác nhận
            </Button>
          ) : (
            canEdit && (
              <Button
                disabled={!readiness.eligible}
                onClick={() => open("confirm")}
              >
                <ShieldCheck size={16} />
                Đồng ý cho bảo vệ
              </Button>
            )
          )
        }
      />
      <GuidanceSelector context={context} />
      {student && (
        <>
          <div className="grid xl:grid-cols-[1.2fr_1fr] gap-6 mb-6">
            <Card
              title="Điều kiện tự động kiểm tra"
              description="Mọi nhiệm vụ phải hoàn thành 100% và đã có đánh giá cuối (Đạt/Không đạt); tỷ lệ Đạt theo tham số đợt."
            >
              <div className="space-y-4">
                {readiness.checks.map((check) => (
                  <div
                    key={check.label}
                    className="flex gap-3 items-start border-b border-slate-100 pb-4 last:border-0 last:pb-0"
                  >
                    {check.ok ? (
                      <CheckCircle2
                        className="text-emerald-600 shrink-0"
                        size={20}
                      />
                    ) : (
                      <CircleX className="text-red-500 shrink-0" size={20} />
                    )}
                    <span>{check.label}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5">
                <Notice tone={readiness.eligible ? "success" : "warning"}>
                  {readiness.eligible
                    ? "Hồ sơ thỏa các điều kiện tự động. Cần GVHD kiểm tra chất lượng và xác nhận."
                    : "Hồ sơ còn điều kiện chưa đạt. Hoàn thiện các mục trên trước khi GVHD xác nhận."}
                </Notice>
              </div>
            </Card>
            <div className="space-y-6">
              <Card
                title="Trạng thái xác nhận"
                action={
                  <Badge
                    value={readiness.final?.confirmed ? "APPROVED" : "PENDING"}
                  >
                    {readiness.final?.confirmed
                      ? "GVHD đã đồng ý"
                      : "Chưa xác nhận"}
                  </Badge>
                }
              >
                <div className="space-y-4">
                  <div className="rounded-xl bg-indigo-50 p-4 flex items-center gap-3">
                    <FileCheck2
                      className="text-indigo-600 shrink-0"
                      size={30}
                    />
                    <div>
                      <strong>
                        {readiness.pass}/{readiness.tasks.length} tuần đạt
                      </strong>
                      <p className="muted text-sm mt-1">
                        Yêu cầu tối thiểu {Math.round(readiness.minimum * 100)}%
                      </p>
                    </div>
                  </div>
                  <Progress
                    value={
                      readiness.tasks.length
                        ? Math.round(
                            (readiness.pass / readiness.tasks.length) * 100,
                          )
                        : 0
                    }
                  />
                  {readiness.final ? (
                    <FileLink file={readiness.final.file} />
                  ) : (
                    <Link
                      className="text-indigo-600 font-medium"
                      to="/guidance/final-report"
                    >
                      Mở hồ sơ PDF hoàn chỉnh →
                    </Link>
                  )}
                  {readiness.final?.comment && (
                    <div>
                      <h3 className="font-semibold mb-2">Ý kiến GVHD</h3>
                      <p className="whitespace-pre-wrap">
                        {readiness.final.comment}
                      </p>
                    </div>
                  )}
                  <p className="text-sm muted">
                    Xác nhận của GVHD được Khoa sử dụng để xét danh sách bảo vệ.
                    Khoa tiếp tục kiểm tra điều kiện hành chính và lập lịch.
                  </p>
                </div>
              </Card>
            </div>
          </div>
          <Card title="Theo dõi hồ sơ trong phạm vi được phân quyền">
            <DataTable
              rows={students}
              searchText={(s) => `${s.code} ${s.name}`}
              columns={[
                {
                  key: "student",
                  title: "Sinh viên",
                  render: (s) => <Person name={s.name} sub={s.code} />,
                },
                {
                  key: "weekly",
                  title: "Tuần đạt",
                  render: (s) => {
                    const r = defenseReadiness(db, termId, s.id);
                    return `${r.pass}/${r.tasks.length}`;
                  },
                },
                {
                  key: "final",
                  title: "Báo cáo PDF",
                  render: (s) => (
                    <Badge
                      value={
                        defenseReadiness(db, termId, s.id).final
                          ? "SUBMITTED"
                          : "PENDING"
                      }
                    >
                      {defenseReadiness(db, termId, s.id).final
                        ? "Đã nộp"
                        : "Chưa nộp"}
                    </Badge>
                  ),
                },
                {
                  key: "state",
                  title: "Điều kiện",
                  render: (s) => {
                    const r = defenseReadiness(db, termId, s.id);
                    return (
                      <Badge
                        value={
                          r.final?.confirmed
                            ? "APPROVED"
                            : r.eligible
                              ? "PASS"
                              : "REVISION"
                        }
                      >
                        {r.final?.confirmed
                          ? "GVHD đồng ý"
                          : r.eligible
                            ? "Chờ GVHD xác nhận"
                            : "Cần hoàn thiện"}
                      </Badge>
                    );
                  },
                },
                {
                  key: "action",
                  title: "Thao tác",
                  render: (s) => (
                    <Button
                      variant={s.id === studentId ? "ghost" : "secondary"}
                      disabled={s.id === studentId}
                      onClick={() => setStudentId(s.id)}
                    >
                      <Eye size={16} aria-hidden="true" />
                      {s.id === studentId ? "Đang xem" : "Kiểm tra hồ sơ"}
                    </Button>
                  ),
                },
              ]}
            />
          </Card>
        </>
      )}
      {dialog && (
        <Modal
          title={
            dialog === "confirm"
              ? "Xác nhận đồng ý cho bảo vệ"
              : "Thu hồi xác nhận bảo vệ"
          }
          onClose={() => setDialog(null)}
        >
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              action
                .run(() =>
                  guidanceService.confirmDefense(
                    termId,
                    studentId,
                    dialog === "confirm",
                    comment,
                  ),
                )
                .then(() => setDialog(null))
                .catch(() => {});
            }}
          >
            <Notice tone={dialog === "confirm" ? "info" : "warning"}>
              {dialog === "confirm"
                ? `Xác nhận hồ sơ của ${student?.name} đạt chất lượng để bảo vệ. Sinh viên sẽ không được đổi PDF khi hồ sơ đã xác nhận.`
                : "Sau khi thu hồi, sinh viên có thể cập nhật PDF. Hồ sơ đã có lịch bảo vệ cần được Giáo vụ xử lý trước."}
            </Notice>
            <ActionError error={action.error} />
            <Field
              label={
                dialog === "confirm"
                  ? "Nhận xét về kết quả thực hiện và chất lượng đồ án"
                  : "Lý do thu hồi / yêu cầu chỉnh sửa"
              }
            >
              <textarea
                required
                rows={5}
                minLength={10}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </Field>
            <div className="dialog-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDialog(null)}
              >
                <X size={16} aria-hidden="true" />
                Hủy
              </Button>
              <Button disabled={action.pending}>
                <Undo2 size={16} aria-hidden="true" />
                {dialog === "confirm" ? "Xác nhận đồng ý" : "Thu hồi xác nhận"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
export default function DefenseConfirmPage() {
  return <DataBoundary>{(db) => <ConfirmContent db={db} />}</DataBoundary>;
}
