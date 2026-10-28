import { AUTH_API } from "../../../shared/api/api-session";
import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Users,
} from "lucide-react";
import { authService } from "../services/auth-service";
import { useSession } from "../../../shared/hooks/use-demo";
import { useApiSession } from "../../../shared/hooks/use-api-session";
import type { Account } from "../../../shared/data/types";
import { Button, Field, Modal, Notice } from "../../../shared/components/kit";
export default function LoginPage() {
  const user = useApiSession();
  return AUTH_API ? <LoginForm user={user} /> : <DemoLoginPage />;
}
function DemoLoginPage() {
  const { user } = useSession();
  return <LoginForm user={user} />;
}
function LoginForm({ user }: { user?: Account }) {
  const navigate = useNavigate(),
    cache = useQueryClient(),
    location = useLocation();
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [visible, setVisible] = useState(false),
    [help, setHelp] = useState(false),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  const isDemo =
    !AUTH_API &&
    (import.meta.env.DEV || import.meta.env.VITE_DEMO_MODE === "true");
  async function login(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      const account = await authService.login(username, password);
      await cache.invalidateQueries({ queryKey: ["demo"] });
      navigate(
        account.mustChangePassword
          ? "/change-password"
          : location.state?.from || "/",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }
  async function demo(id: string) {
    try {
      const account = await authService.demoLogin(id);
      await cache.invalidateQueries({ queryKey: ["demo"] });
      navigate(account.mustChangePassword ? "/change-password" : "/");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (user)
    return (
      <Navigate
        to={
          user.mustChangePassword
            ? "/change-password"
            : location.state?.from || "/"
        }
        replace
      />
    );
  return (
    <div className="login-shell">
      <section className="login-branding">
        <div className="relative">
          <div className="brand">
            <span className="brand-mark">UTC</span>
            <div>
              <strong>KHOA CÔNG NGHỆ THÔNG TIN</strong>
              <small>
                Trường Đại học Giao thông vận tải
                <br />
                University of Transport and Communications
              </small>
            </div>
          </div>
          <div className="badge bg-white mt-6">
            ● &nbsp; GPMS · HỆ THỐNG QUẢN LÝ ĐỒ ÁN TỐT NGHIỆP
          </div>
        </div>
        <div className="relative">
          <h1>Quản lý đồ án tốt nghiệp</h1>
          <p>
            Nền tảng quản lý, hướng dẫn và đăng ký đồ án trực tuyến dành cho
            sinh viên, giảng viên và Giáo vụ Khoa CNTT – UTC.
          </p>
          <div className="login-showcase">
            {[
              [
                CalendarDays,
                "Kỳ học & đợt đồ án",
                "Thiết lập kế hoạch, danh sách sinh viên đủ điều kiện và chỉ tiêu giảng viên theo từng hệ đào tạo.",
              ],
              [
                CheckCircle2,
                "Đăng ký nguyện vọng rõ ràng",
                "Một hướng đồ án, tối đa ba nguyện vọng GVHD. Theo dõi kết quả phân công sau khi Khoa công bố.",
              ],
              [
                Users,
                "Kết nối sinh viên & giảng viên",
                "Thống nhất đề tài, cập nhật đề cương và xuất biểu mẫu PDF từ cùng một hồ sơ.",
              ],
            ].map(([Icon, title, desc]) => {
              const ImageIcon = Icon as typeof Users;
              return (
                <div key={String(title)}>
                  <span className="stat-icon">
                    <ImageIcon size={20} />
                  </span>
                  <div>
                    <h3>{String(title)}</h3>
                    <p>{String(desc)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <footer className="institutional-footer">
          © 2026 Khoa Công nghệ Thông tin · Trường Đại học Giao thông vận tải
          <br />
          <small>GPMS Portal · Không gian quản lý đồ án tốt nghiệp</small>
        </footer>
      </section>
      <section className="login-form-wrap">
        <div className="login-form">
          <span className="badge">
            <LockKeyhole size={13} />
            Cổng xác thực nội bộ UTC
          </span>
          <h1>Chào mừng trở lại!</h1>
          <p>
            Đăng nhập để theo dõi đăng ký đồ án, kết quả phân công và đề cương
            của bạn.
          </p>
          <div className="mb-6">
            <Notice>
              <b>Tự động phân luồng tài khoản</b>
              <br />
              Chức năng hiển thị theo vai trò được cấp cho tài khoản của bạn.
            </Notice>
          </div>
          {error && (
            <div className="mb-5">
              <Notice tone="danger">{error}</Notice>
            </div>
          )}
          <form onSubmit={login}>
            <Field label="Tên đăng nhập / Mã định danh *">
              <input
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="Ví dụ: 221230001 hoặc gv001"
              />
            </Field>
            <Field label="Mật khẩu *">
              <div className="password-field">
                <input
                  type={visible ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Nhập mật khẩu"
                />
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </Field>
            <button
              type="button"
              className="link-button self-end"
              onClick={() => setHelp(true)}
            >
              Quên mật khẩu?
            </button>
            <Button type="submit" disabled={pending}>
              {pending ? "Đang đăng nhập…" : "Đăng nhập hệ thống"}
              <ArrowRight size={17} />
            </Button>
          </form>
          <div className="mt-6">
            <Notice>
              Tài khoản được cấp lần đầu phải đổi mật khẩu mặc định và cập nhật
              Email/SĐT trước khi đăng ký.
            </Notice>
          </div>
          {isDemo && (
            <div className="login-demo">
              <p>KHÔNG GIAN DEMO · BƯỚC 1–3</p>
              <div className="grid grid-cols-1 gap-2">
                {[["admin", "Quản trị viên"]].map(([id, label]) => (
                  <Button variant="secondary" key={id} onClick={() => demo(id)}>
                    {label}
                  </Button>
                ))}
              </div>
              <p className="mt-4 leading-6">
                Tài khoản: <b>admin</b> · Mật khẩu: <b>Demo@2026</b>
              </p>
            </div>
          )}
        </div>
      </section>
      {help && (
        <Modal title="Hỗ trợ đặt lại mật khẩu" onClose={() => setHelp(false)}>
          <div className="stack">
            <Notice>
              Liên hệ quản trị viên để đặt lại mật khẩu. Sau khi đặt lại, tài
              khoản bắt buộc đổi mật khẩu trong lần đăng nhập kế tiếp.
            </Notice>
            <p className="text-sm leading-7 muted">
              Trong bản demo, chọn Quản trị viên → Tài khoản → Đặt lại mật khẩu.
              SV dùng lại mã sinh viên; cán bộ dùng Default@2026.
            </p>
            <Button variant="secondary" onClick={() => setHelp(false)}>
              Đã hiểu
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
