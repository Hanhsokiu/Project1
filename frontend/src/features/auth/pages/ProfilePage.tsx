import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  Badge,
  Button,
  Card,
  Field,
  Notice,
  PageHeader,
  Person,
} from "../../../shared/components/kit";
import { useWorkspace } from "../../../shared/hooks/use-workspace";
import { useAction } from "../../../shared/hooks/use-demo";
import { authService } from "../services/auth-service";
import { formatGpa } from "../../../shared/utils/gpa";
export default function ProfilePage() {
  const { db, user } = useWorkspace();
  const action = useAction();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone);
  const [saved, setSaved] = useState(false);
  const student = db.students.find((s) => s.id === user.studentId);
  const lecturer = db.lecturers.find((l) => l.id === user.lecturerId);
  async function save(e: FormEvent) {
    e.preventDefault();
    setSaved(false);
    try {
      await action.run(() => authService.updateProfile(name, email, phone));
      setSaved(true);
    } catch {
      // useAction displays the failure; keep the current form available for correction.
    }
  }
  return (
    <>
      <PageHeader
        title="Thông tin cá nhân"
        description="Cập nhật liên hệ để nhận thông báo và sử dụng các chức năng đồ án."
        actions={
          <Link to="/change-password" className="btn btn-secondary">
            Đổi mật khẩu
          </Link>
        }
      />
      <div className="section-grid">
        <Card title="Hồ sơ của bạn">
          <form onSubmit={save}>
            <div className="form-grid">
              <Field label="Họ và tên">
                <input
                  required
                  minLength={3}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setSaved(false);
                  }}
                />
              </Field>
              <Field label="Tên đăng nhập">
                <input value={user.username} disabled />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setSaved(false);
                  }}
                />
              </Field>
              <Field label="Số điện thoại" hint="Bắt đầu bằng 0 hoặc +84.">
                <input
                  required
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setSaved(false);
                  }}
                />
              </Field>
              {student && (
                <>
                  <Field label="Mã sinh viên">
                    <input disabled value={student.code} />
                  </Field>
                  <Field label="Lớp">
                    <input disabled value={student.className} />
                  </Field>
                  <Field label="Hệ đào tạo">
                    <input disabled value={student.program} />
                  </Field>
                  <Field label="GPA tích lũy">
                    <input disabled value={`${formatGpa(student.gpa)} / 4`} />
                  </Field>
                </>
              )}
              {lecturer && (
                <>
                  <Field label="Mã giảng viên">
                    <input disabled value={lecturer.code} />
                  </Field>
                  <Field label="Bộ môn">
                    <input
                      disabled
                      value={
                        db.catalogs.find((c) => c.id === lecturer.departmentId)
                          ?.name || "—"
                      }
                    />
                  </Field>
                </>
              )}
            </div>
            {saved && (
              <div className="mt-5">
                <Notice tone="success">
                  Thông tin liên hệ đã được lưu và đồng bộ với danh mục.
                </Notice>
              </div>
            )}
            <div className="form-actions">
              <Button disabled={action.pending}>
                {action.pending ? "Đang lưu…" : "Lưu hồ sơ"}
              </Button>
              {saved && user.studentId && user.profileComplete && (
                <Link to="/registration" className="btn btn-primary">
                  Đăng ký nguyện vọng
                </Link>
              )}
            </div>
          </form>
        </Card>
        <div className="stack">
          <Card title="Thông tin tài khoản">
            <Person name={user.name} sub={user.username} />
            <div className="flex flex-wrap gap-2 mt-5">
              {user.roles.map((role) => (
                <Badge key={role} value={role} />
              ))}
            </div>
          </Card>
          <Notice>
            Email và số điện thoại hợp lệ là điều kiện trước khi đăng ký nguyện
            vọng. Thông tin học vụ do Giáo vụ cập nhật.
          </Notice>
        </div>
      </div>
    </>
  );
}
