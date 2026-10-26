import { useState, type FormEvent } from "react";
import { Plus, Pencil, KeyRound, LockKeyhole, Unlock } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Confirm,
  DataTable,
  Field,
  Modal,
  Notice,
  PageHeader,
  Person,
  Stat,
  labels,
} from "../../../shared/components/kit";
import { useWorkspace } from "../../../shared/hooks/use-workspace";
import { useAction } from "../../../shared/hooks/use-demo";
import type { Account, Role } from "../../../shared/data/types";
import { authService } from "../services/auth-service";
const roles: Role[] = ["ADMIN", "FACULTY", "LECTURER", "STUDENT", "COMMITTEE"];
type AccountForm = Pick<
  Account,
  "username" | "name" | "email" | "phone" | "roles"
> & { id?: string; password?: string };
const blank: AccountForm = {
  username: "",
  name: "",
  email: "",
  phone: "",
  password: "",
  roles: ["FACULTY"],
};
export default function AccountsPage() {
  const { db, user } = useWorkspace();
  const action = useAction();
  const [form, setForm] = useState<AccountForm | null>(null);
  const [role, setRole] = useState("");
  const [state, setState] = useState("");
  const [confirm, setConfirm] = useState<{
    account: Account;
    kind: "lock" | "reset";
  } | null>(null);
  const rows = db.accounts.filter(
    (a) =>
      (!role || a.roles.includes(role as Role)) &&
      (!state || (state === "LOCKED" ? a.locked : !a.locked)),
  );
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    try {
      await action.run(() => authService.saveAccount(form));
      setForm(null);
    } catch {
      // useAction displays the failure; keep the current form available for correction.
    }
  }
  async function execute() {
    if (!confirm) return;
    try {
      await action.run(() =>
        confirm.kind === "lock"
          ? authService.lock(confirm.account.id)
          : authService.resetPassword(confirm.account.id),
      );
      setConfirm(null);
    } catch {
      // useAction displays the failure; keep the current form available for correction.
    }
  }
  return (
    <>
      <PageHeader
        title="Tài khoản người dùng"
        description="Cấp vai trò, kiểm soát truy cập và hỗ trợ tài khoản trong toàn hệ thống."
        actions={
          <Button
            onClick={() => setForm({ ...blank, roles: [...blank.roles] })}
          >
            <Plus size={16} />
            Thêm tài khoản
          </Button>
        }
      />
      <div className="stat-grid">
        <Stat label="Tổng tài khoản" value={db.accounts.length} />
        <Stat
          label="Đang hoạt động"
          value={db.accounts.filter((a) => !a.locked).length}
        />
        <Stat
          label="Đã khóa"
          value={db.accounts.filter((a) => a.locked).length}
        />
        <Stat
          label="Cần đổi mật khẩu"
          value={db.accounts.filter((a) => a.mustChangePassword).length}
        />
      </div>
      <Card
        title="Danh sách tài khoản"
        description="SV/GV mới được tạo cùng danh mục; một người có thể giữ nhiều vai trò."
      >
        <DataTable
          rows={rows}
          searchText={(a) => `${a.name} ${a.username} ${a.email}`}
          filters={
            <>
              <select
                aria-label="Lọc vai trò"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="">Mọi vai trò</option>
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {labels[r]}
                  </option>
                ))}
              </select>
              <select
                aria-label="Lọc trạng thái tài khoản"
                value={state}
                onChange={(e) => setState(e.target.value)}
              >
                <option value="">Mọi trạng thái</option>
                <option value="ACTIVE">Hoạt động</option>
                <option value="LOCKED">Đã khóa</option>
              </select>
            </>
          }
          columns={[
            {
              key: "person",
              title: "Người dùng",
              render: (a) => <Person name={a.name} sub={a.username} />,
            },
            {
              key: "contact",
              title: "Liên hệ",
              render: (a) => (
                <div>
                  {a.email}
                  <small className="block muted mt-1">{a.phone}</small>
                </div>
              ),
            },
            {
              key: "roles",
              title: "Vai trò",
              render: (a) => (
                <div className="flex gap-1 flex-wrap">
                  {a.roles.map((r) => (
                    <Badge key={r} value={r} />
                  ))}
                </div>
              ),
            },
            {
              key: "status",
              title: "Trạng thái",
              render: (a) => (
                <div>
                  <Badge value={a.locked ? "REJECTED" : "APPROVED"}>
                    {a.locked ? "Đã khóa" : "Hoạt động"}
                  </Badge>
                  {a.mustChangePassword && (
                    <small className="block muted mt-2">
                      Đổi mật khẩu lần đầu
                    </small>
                  )}
                </div>
              ),
            },
            {
              key: "actions",
              title: "Thao tác",
              render: (a) => (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    aria-label={`Sửa ${a.username}`}
                    onClick={() =>
                      setForm({
                        id: a.id,
                        username: a.username,
                        name: a.name,
                        email: a.email,
                        phone: a.phone,
                        password: "",
                        roles: [...a.roles],
                      })
                    }
                  >
                    <Pencil size={15} />
                  </Button>
                  <Button
                    variant="ghost"
                    aria-label={`Đặt lại mật khẩu ${a.username}`}
                    onClick={() => setConfirm({ account: a, kind: "reset" })}
                  >
                    <KeyRound size={15} />
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={a.id === user.id}
                    aria-label={`${a.locked ? "Mở khóa" : "Khóa"} ${a.username}`}
                    onClick={() => setConfirm({ account: a, kind: "lock" })}
                  >
                    {a.locked ? (
                      <Unlock size={15} />
                    ) : (
                      <LockKeyhole size={15} />
                    )}
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </Card>
      {form && (
        <Modal
          title={form.id ? "Cập nhật tài khoản" : "Tạo tài khoản"}
          onClose={() => setForm(null)}
          wide
        >
          <form onSubmit={save}>
            <div className="form-grid">
              <Field label="Tên đăng nhập">
                <input
                  required
                  minLength={3}
                  value={form.username}
                  onChange={(e) =>
                    setForm({ ...form, username: e.target.value })
                  }
                />
              </Field>
              <Field label="Họ và tên">
                <input
                  required
                  minLength={3}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </Field>
              <Field label="Số điện thoại">
                <input
                  required
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </Field>
              <Field
                label={
                  form.id
                    ? "Mật khẩu mới (bỏ trống nếu giữ nguyên)"
                    : "Mật khẩu khởi tạo (bỏ trống dùng Default@2026)"
                }
              >
                <input
                  type="password"
                  placeholder={
                    form.id
                      ? "Giữ nguyên mật khẩu hiện tại"
                      : "Mặc định: Default@2026"
                  }
                  value={form.password || ""}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                />
              </Field>
              <fieldset className="full">
                <legend className="mb-2 text-sm">Vai trò được cấp</legend>
                {roles.map((r) => (
                  <label className="checkbox-row" key={r}>
                    <input
                      type="checkbox"
                      checked={form.roles.includes(r)}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          roles: e.target.checked
                            ? [...form.roles, r]
                            : form.roles.filter((x) => x !== r),
                        })
                      }
                    />
                    {labels[r]}
                  </label>
                ))}
              </fieldset>
            </div>
            <Notice>
              Tài khoản mới có thể tự đặt mật khẩu hoặc để trống để dùng mật khẩu
              mặc định Default@2026. Người dùng sẽ được yêu cầu đổi mật khẩu ở lần
              đăng nhập đầu tiên.
            </Notice>
            <div className="form-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setForm(null)}
              >
                Hủy
              </Button>
              <Button disabled={action.pending}>Lưu tài khoản</Button>
            </div>
          </form>
        </Modal>
      )}
      {confirm && (
        <Confirm
          title={
            confirm.kind === "reset"
              ? "Đặt lại mật khẩu?"
              : confirm.account.locked
                ? "Mở khóa tài khoản?"
                : "Khóa tài khoản?"
          }
          description={
            confirm.kind === "reset"
              ? `Đặt mật khẩu ${confirm.account.username} về ${confirm.account.studentId ? "mã sinh viên" : "Default@2026"} và yêu cầu đổi ở lần đăng nhập tiếp theo.`
              : `${confirm.account.name}: ${confirm.account.locked ? "cho phép đăng nhập lại" : "ngừng quyền truy cập"}. Nếu người dùng đang giữ nhiệm vụ trong đợt, hãy bố trí người thay thế. Thao tác được ghi nhật ký.`
          }
          onClose={() => setConfirm(null)}
          onConfirm={execute}
          pending={action.pending}
        />
      )}
    </>
  );
}
