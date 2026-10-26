import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCheck, Play, Send, Users } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Confirm,
  DataTable,
  Notice,
  PageHeader,
  Person,
  Progress,
  Stat,
} from "../../../shared/components/kit";
import { useWorkspace } from "../../../shared/hooks/use-workspace";
import { useAction } from "../../../shared/hooks/use-demo";
import { registrationService } from "../services/registration-service";
import { formatGpa } from "../../../shared/utils/gpa";
import { STEP3_API } from "../services/assignment-api";
import ApiAssignmentPlanPage from "./ApiAssignmentPlanPage";
export default function AssignmentPlanPage() {
  return STEP3_API ? <ApiAssignmentPlanPage /> : <MockAssignmentPlanPage />;
}
function MockAssignmentPlanPage() {
  const { db, term, termId } = useWorkspace();
  const action = useAction();
  const [confirm, setConfirm] = useState<"trial" | "publish" | null>(null);
  const [direction, setDirection] = useState("");
  const [filter, setFilter] = useState("");
  const regs = db.registrations.filter(
    (r) => r.termId === termId && r.status === "SUBMITTED",
  );
  const assignments = db.assignments.filter((a) => a.termId === termId);
  const unassigned = regs.filter(
    (r) => !assignments.some((a) => a.studentId === r.studentId),
  );
  const notices = db.notifications.filter((n) => n.termId === termId);
  async function execute() {
    try {
      await action.run(() =>
        confirm === "trial"
          ? registrationService.saveTrial(termId)
          : registrationService.publish(termId),
      );
      setConfirm(null);
    } catch {
      setConfirm(null);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="BƯỚC 03 · PHÂN CÔNG GVHD"
        title="Phương án phân công"
        description={`${term.name} · Ưu tiên theo NV1 → NV2 → NV3 → tự phân theo hướng.`}
        actions={
          <>
            <Link className="btn btn-secondary" to="/registration/manual">
              Điều chỉnh thủ công
            </Link>
            <Button
              variant="secondary"
              onClick={() => setConfirm("trial")}
              disabled={
                term.assignmentPublished || term.locked || action.pending
              }
            >
              <Play size={15} />
              Chạy thử phương án
            </Button>
            <Button
              onClick={() => setConfirm("publish")}
              disabled={
                term.assignmentPublished ||
                term.locked ||
                !assignments.length ||
                action.pending
              }
            >
              <Send size={15} />
              {term.assignmentPublished ? "Đã công bố" : "Chốt & công bố"}
            </Button>
          </>
        }
      />
      <div className="mb-6">
        <Notice tone={term.assignmentPublished ? "success" : "info"}>
          {term.assignmentPublished
            ? "Phân công đã công bố. SV/GV xem được kết quả và thông tin liên hệ. Điều chỉnh sau công bố bắt buộc có lý do."
            : "Phương án đang là bản nháp. Chạy thử chỉ thực hiện sau khi đóng đăng ký, chưa gửi thông báo cho SV/GV."}{" "}
          Ưu tiên GPA cao hơn khi vượt quota; cùng GPA dùng thời điểm đăng ký.
        </Notice>
      </div>
      <div className="stat-grid">
        <Stat
          label="Đăng ký đã nộp"
          value={regs.length}
          sub={`${term.studentIds.length} sinh viên trong đợt`}
          icon={<Users />}
        />
        <Stat
          label="Đã phân công"
          value={assignments.length}
          sub={`NV1: ${assignments.filter((a) => a.preference === 1).length} · NV2: ${assignments.filter((a) => a.preference === 2).length} · NV3: ${assignments.filter((a) => a.preference === 3).length}`}
          icon={<CheckCheck />}
        />
        <Stat
          label="Tự phân theo hướng"
          value={assignments.filter((a) => a.preference === 4).length}
          sub={`Điều chỉnh: ${assignments.filter((a) => a.manual).length}`}
        />
        <Stat
          label="Chưa được phân"
          value={unassigned.length}
          sub="Cần xử lý trước khi công bố"
        />
      </div>
      <div className="stack">
        <Card title="Đăng ký & kết quả chạy thử">
          <DataTable
            rows={regs.filter(
              (r) =>
                (!direction || r.directionId === direction) &&
                (!filter ||
                  (filter === "unassigned"
                    ? !assignments.some((a) => a.studentId === r.studentId)
                    : assignments.some(
                        (a) =>
                          a.studentId === r.studentId &&
                          String(a.preference) === filter,
                      ))),
            )}
            searchText={(r) => {
              const s = db.students.find((s) => s.id === r.studentId);
              return `${s?.code} ${s?.name}`;
            }}
            filters={
              <>
                <select
                  aria-label="Lọc hướng đồ án"
                  value={direction}
                  onChange={(e) => setDirection(e.target.value)}
                >
                  <option value="">Tất cả hướng</option>
                  {db.catalogs
                    .filter((c) => c.kind === "direction")
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
                <select
                  aria-label="Lọc kết quả phân công"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="">Tất cả kết quả</option>
                  <option value="unassigned">Chưa được phân</option>
                  <option value="1">Nguyện vọng 1</option>
                  <option value="2">Nguyện vọng 2</option>
                  <option value="3">Nguyện vọng 3</option>
                  <option value="4">Tự phân theo hướng</option>
                </select>
              </>
            }
            columns={[
              {
                key: "student",
                title: "Sinh viên",
                render: (r) => {
                  const s = db.students.find((s) => s.id === r.studentId);
                  return <Person name={s?.name || "—"} sub={s?.code} />;
                },
              },
              {
                key: "gpa",
                title: "GPA",
                render: (r) => (
                  <strong>
                    {formatGpa(
                      db.students.find((s) => s.id === r.studentId)?.gpa,
                    )}
                  </strong>
                ),
              },
              {
                key: "direction",
                title: "Hướng đồ án",
                render: (r) =>
                  db.catalogs.find((c) => c.id === r.directionId)?.name,
              },
              {
                key: "prefs",
                title: "Nguyện vọng",
                render: (r) => (
                  <div className="text-xs leading-6">
                    {r.preferences.map((id, i) => (
                      <div key={id}>
                        NV{i + 1}: {db.lecturers.find((l) => l.id === id)?.name}
                      </div>
                    ))}
                  </div>
                ),
              },
              {
                key: "assigned",
                title: "Kết quả phương án",
                render: (r) => {
                  const a = assignments.find(
                    (a) => a.studentId === r.studentId,
                  );
                  return a ? (
                    <div>
                      <strong>
                        {db.lecturers.find((l) => l.id === a.lecturerId)?.name}
                      </strong>
                      <div className="mt-2">
                        <Badge value={a.manual ? "REVISION" : "APPROVED"}>
                          {a.manual
                            ? "Thủ công"
                            : a.preference <= 3
                              ? `NV${a.preference}`
                              : "Theo hướng"}
                        </Badge>
                      </div>
                    </div>
                  ) : (
                    <Badge value="PENDING">Chưa phân công</Badge>
                  );
                },
              },
            ]}
          />
        </Card>
        <div className="section-grid">
          <Card title="Tải giảng viên & quota">
            <DataTable
              rows={term.lecturers}
              columns={[
                {
                  key: "lecturer",
                  title: "Giảng viên",
                  render: (l) => (
                    <strong>
                      {db.lecturers.find((g) => g.id === l.lecturerId)?.name}
                    </strong>
                  ),
                },
                {
                  key: "quota",
                  title: "Tải / Quota",
                  render: (l) =>
                    `${assignments.filter((a) => a.lecturerId === l.lecturerId).length} / ${l.quota}`,
                },
                {
                  key: "load",
                  title: "Mức sử dụng",
                  render: (l) => (
                    <Progress
                      value={
                        l.quota
                          ? Math.round(
                              (assignments.filter(
                                (a) => a.lecturerId === l.lecturerId,
                              ).length /
                                l.quota) *
                                100,
                            )
                          : 0
                      }
                    />
                  ),
                },
              ]}
            />
          </Card>
          <Card title="Thống kê theo hướng">
            <div className="space-y-5">
              {db.catalogs
                .filter((c) => c.kind === "direction")
                .map((c) => {
                  const ids = regs
                    .filter((r) => r.directionId === c.id)
                    .map((r) => r.studentId);
                  return (
                    <div key={c.id}>
                      <div className="flex justify-between mb-2 text-xs">
                        <strong>{c.name}</strong>
                        <span className="muted">{ids.length} đăng ký</span>
                      </div>
                      <p className="muted text-xs leading-6">
                        {[1, 2, 3, 4]
                          .map(
                            (n) =>
                              `${n === 4 ? "Tự phân" : `NV${n}`}: ${assignments.filter((a) => ids.includes(a.studentId) && a.preference === n).length}`,
                          )
                          .join(" · ")}
                      </p>
                    </div>
                  );
                })}
            </div>
          </Card>
        </div>
        <Card
          title="Thông báo & email"
          description="Mô phỏng gửi qua lớp service; chưa gửi email thực tế."
        >
          <DataTable
            rows={notices}
            columns={[
              {
                key: "to",
                title: "Người nhận",
                render: (n) =>
                  db.accounts.find((a) => a.id === n.userId)?.name || n.userId,
              },
              {
                key: "title",
                title: "Nội dung",
                render: (n) => (
                  <div className="text-wrap">
                    <strong>{n.title}</strong>
                    <p className="mt-1">{n.content}</p>
                  </div>
                ),
              },
              {
                key: "status",
                title: "Trạng thái",
                render: (n) => <Badge value={n.status} />,
              },
              {
                key: "action",
                title: "Thao tác",
                render: (n) =>
                  n.status === "FAILED" && (
                    <Button
                      variant="secondary"
                      disabled={action.pending}
                      onClick={() =>
                        action
                          .run(() =>
                            registrationService.retryNotification(n.id),
                          )
                          .catch(() => {})
                      }
                    >
                      Gửi lại
                    </Button>
                  ),
              },
            ]}
          />
        </Card>
      </div>
      {confirm && (
        <Confirm
          title={
            confirm === "trial"
              ? "Chạy lại phương án phân công?"
              : "Chốt và công bố phân công?"
          }
          description={
            confirm === "trial"
              ? "Phương án nháp hiện tại của đợt sẽ được thay bằng kết quả tính lại theo nguyện vọng và quota."
              : "Sinh viên và giảng viên sẽ được xem kết quả. Thông báo demo được tạo cho từng người."
          }
          onClose={() => setConfirm(null)}
          onConfirm={execute}
          pending={action.pending}
        />
      )}
    </>
  );
}
