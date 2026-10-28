import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Back,
  Badge,
  Button,
  Card,
  Confirm,
  Field,
  Notice,
  PageHeader,
  Person,
} from "../../../shared/components/kit";
import { useWorkspace } from "../../../shared/hooks/use-workspace";
import { useAction } from "../../../shared/hooks/use-demo";
import { registrationService } from "../services/registration-service";
import { formatGpa } from "../../../shared/utils/gpa";
import { assignmentContext, STEP3_API } from "../services/assignment-api";
import { useAssignmentWindow } from "../hooks/use-assignment-window";
import AssignmentWindowNotice from "../components/AssignmentWindowNotice";
export default function ManualAdjustPage() {
  const { db, termId, term } = useWorkspace();
  const action = useAction();
  const window = useAssignmentWindow(termId);
  const missingDraft = STEP3_API && !assignmentContext(termId)?.plan;
  const blocked =
    term.locked ||
    term.assignmentPublished ||
    (STEP3_API && term.status !== "CLOSED_REGISTRATION") ||
    !!window.blockedReason ||
    missingDraft;
  const regs = db.registrations.filter(
    (r) => r.termId === termId && r.status === "SUBMITTED",
  );
  const [studentId, setStudentId] = useState(regs[0]?.studentId || "");
  const [lecturerId, setLecturerId] = useState("");
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);
  const r = regs.find((r) => r.studentId === studentId);
  const s = db.students.find((s) => s.id === studentId);
  const a = db.assignments.find(
    (a) => a.termId === termId && a.studentId === studentId,
  );
  const options = term.lecturers.filter((l) =>
    db.lecturers
      .find((g) => g.id === l.lecturerId && g.isActive !== false)
      ?.directionIds.includes(r?.directionId || ""),
  );
  async function save() {
    if (blocked) {
      setConfirm(false);
      return;
    }
    try {
      await action.run(() =>
        registrationService.adjust(termId, studentId, lecturerId, reason),
      );
      setConfirm(false);
      setReason("");
      setLecturerId("");
    } catch {
      setConfirm(false);
    }
  }
  return (
    <>
      <Back to="/registration/assignment" />
      <PageHeader
        eyebrow="BƯỚC 03 · ĐIỀU CHỈNH"
        title="Điều chỉnh phân công GVHD"
        description="Xử lý sinh viên chưa được phân công hoặc điều chỉnh giảng viên kèm lý do."
      />
      {STEP3_API && !term.assignmentPublished && (
        <AssignmentWindowNotice termId={termId} window={window} />
      )}
      {term.assignmentPublished ? (
        <Notice tone="warning">
          Phân công đã công bố, không thể điều chỉnh trực tiếp.
        </Notice>
      ) : missingDraft ? (
        <Notice tone="warning">
          Chưa có phương án nháp để điều chỉnh. Khi giai đoạn phân công mở, hệ
          thống tự tạo nháp trong vòng 10 giây nếu backend đang chạy. Bạn cũng
          có thể vào{" "}
          <Link to="/registration/assignment">Phương án phân công</Link>, chọn
          xem trước rồi lưu phương án nháp trước khi điều chỉnh.
        </Notice>
      ) : null}
      <div className="section-grid">
        <Card title="Thông tin điều chỉnh">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!blocked) setConfirm(true);
            }}
            className="stack"
          >
            <Field label="Sinh viên đã đăng ký *">
              <select
                required
                value={studentId}
                onChange={(e) => {
                  setStudentId(e.target.value);
                  setLecturerId("");
                }}
              >
                <option value="">Chọn sinh viên</option>
                {regs.map((r) => (
                  <option key={r.id} value={r.studentId}>
                    {db.students.find((s) => s.id === r.studentId)?.name} ·{" "}
                    {db.students.find((s) => s.id === r.studentId)?.code}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Giảng viên hướng dẫn mới *">
              <select
                required
                value={lecturerId}
                onChange={(e) => setLecturerId(e.target.value)}
              >
                <option value="">Chọn giảng viên cùng hướng</option>
                {options.map((l) => {
                  const load = db.assignments.filter(
                    (a) =>
                      a.termId === termId &&
                      a.lecturerId === l.lecturerId &&
                      a.studentId !== studentId,
                  ).length;
                  return (
                    <option
                      key={l.lecturerId}
                      value={l.lecturerId}
                      disabled={load >= l.quota}
                    >
                      {db.lecturers.find((g) => g.id === l.lecturerId)?.name} ·{" "}
                      {load}/{l.quota} SV
                    </option>
                  );
                })}
              </select>
            </Field>
            <Field
              label="Lý do điều chỉnh *"
              hint="Từ 10 đến 3.000 ký tự. Lý do được lưu trong nhật ký điều chỉnh phương án nháp."
            >
              <textarea
                required
                minLength={10}
                maxLength={3000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ví dụ: Cân bằng tải giảng viên theo hướng chuyên môn"
              />
            </Field>
            <div className="form-actions">
              <Button disabled={action.pending || blocked || !regs.length}>
                Lưu điều chỉnh
              </Button>
            </div>
          </form>
        </Card>
        <div className="stack">
          <Card title="Hồ sơ phân công">
            {s ? (
              <>
                <Person
                  name={s.name}
                  sub={`${s.code} · GPA ${formatGpa(s.gpa)}`}
                />
                <dl className="info-grid mt-6">
                  <div>
                    <dt>Hướng đồ án</dt>
                    <dd>
                      {db.catalogs.find((c) => c.id === r?.directionId)?.name}
                    </dd>
                  </div>
                  <div>
                    <dt>Trạng thái</dt>
                    <dd>
                      <Badge value={a ? "APPROVED" : "PENDING"}>
                        {a ? "Đã phân công" : "Chưa phân công"}
                      </Badge>
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt>GVHD hiện tại</dt>
                    <dd>
                      {db.lecturers.find((l) => l.id === a?.lecturerId)?.name ||
                        "Chưa được phân"}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt>Nguyện vọng</dt>
                    <dd>
                      {r?.preferences.map((id, i) => (
                        <div key={id}>
                          NV{i + 1}:{" "}
                          {db.lecturers.find((l) => l.id === id)?.name}
                        </div>
                      ))}
                    </dd>
                  </div>
                </dl>
              </>
            ) : (
              <p className="muted">Chọn sinh viên để xem hồ sơ.</p>
            )}
          </Card>
          <Notice tone="warning">
            Giảng viên mới phải tham gia đợt, có chuyên môn cùng hướng và còn
            quota. Thay đổi GVHD làm mất xác nhận thống nhất đề tài cũ.
          </Notice>
        </div>
      </div>
      {confirm && (
        <Confirm
          title="Xác nhận điều chỉnh?"
          description="Thông tin phân công và hồ sơ đề tài dùng chung sẽ được cập nhật theo giảng viên mới."
          onClose={() => setConfirm(false)}
          onConfirm={save}
          pending={action.pending}
        />
      )}
    </>
  );
}
