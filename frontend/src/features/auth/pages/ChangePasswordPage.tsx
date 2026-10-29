import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Save, Check, Circle } from "lucide-react";
import {
  Button,
  Card,
  Field,
  Notice,
  PageHeader,
} from "../../../shared/components/kit";
import { useWorkspace } from "../../../shared/hooks/use-workspace";
import { useAction } from "../../../shared/hooks/use-demo";
import { authService } from "../services/auth-service";
export default function ChangePasswordPage() {
  const { user } = useWorkspace();
  const action = useAction();
  const navigate = useNavigate();
  const [old, setOld] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const rules: [string, boolean][] = [
    ["Ít nhất 8 ký tự", password.length >= 8],
    [
      "Có chữ hoa và chữ thường",
      /[A-Z]/.test(password) && /[a-z]/.test(password),
    ],
    [
      "Có chữ số và ký tự đặc biệt",
      /[0-9]/.test(password) && /[^a-zA-Z0-9]/.test(password),
    ],
  ];
  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }
    try {
      await action.run(() => authService.changePassword(old, password));
      navigate(user.studentId ? "/profile" : "/", { replace: true });
    } catch {
      // useAction displays the failure; keep the current form available for correction.
    }
  }
  return (
    <>
      <PageHeader
        title={
          user.mustChangePassword ? "Đổi mật khẩu lần đầu" : "Đổi mật khẩu"
        }
        description="Thiết lập mật khẩu riêng để bảo vệ tài khoản và hồ sơ đồ án."
      />
      <div className="max-w-2xl">
        <Card title="Mật khẩu tài khoản">
          {user.mustChangePassword && (
            <div className="mb-6">
              <Notice tone="warning">
                Bạn cần đổi mật khẩu mặc định trước khi sử dụng chức năng nghiệp
                vụ. Sau đó kiểm tra Email/SĐT trong hồ sơ cá nhân.
              </Notice>
            </div>
          )}
          <form onSubmit={save} className="stack">
            <Field label="Mật khẩu hiện tại">
              <input
                required
                type="password"
                autoComplete="current-password"
                value={old}
                onChange={(e) => setOld(e.target.value)}
              />
            </Field>
            <Field label="Mật khẩu mới">
              <input
                required
                minLength={8}
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <Field label="Xác nhận mật khẩu mới" error={error}>
              <input
                required
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </Field>
            <ul className="space-y-2 text-sm">
              {rules.map(([label, passed]) => (
                <li
                  key={label}
                  className={`flex gap-2 items-center ${passed ? "text-green-600" : "muted"}`}
                >
                  {passed ? <Check size={15} /> : <Circle size={13} />} {label}
                </li>
              ))}
            </ul>
            <div className="form-actions">
              <Button disabled={action.pending}>
                <Save size={16} aria-hidden="true" />
                {action.pending ? "Đang cập nhật…" : "Lưu mật khẩu mới"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
