import {
  AUTH_API,
  clearApiSession,
  getAccessToken,
  setApiUser,
  setTokens,
} from "../../../shared/api/api-session";
import { httpClient } from "../../../shared/api/http-client";
import type { Account } from "../../../shared/data/types";
import {
  assert,
  currentUser,
  mutate,
  now,
  persist,
  readDb,
  SESSION_KEY,
  uid,
} from "../../../shared/data/store";
import { contactSchema, passwordSchema } from "../../../shared/data/schemas";
const failures = new Map<string, number>();
export type SaveAccountInput = Pick<
  Account,
  "username" | "name" | "email" | "phone" | "roles"
> & {
  id?: string;
  password?: string;
  trainingSystemId?: string;
  majorName?: string;
  className?: string;
  departmentId?: string;
  researchAreaIds?: string[];
  maxStudents?: number;
};
const mockAuthService = {
  login(username: string, password: string) {
    const db = readDb();
    const user = db.accounts.find((a) => a.username === username);
    assert(
      user && user.password === password,
      "Tên đăng nhập hoặc mật khẩu không đúng.",
      "INVALID_CREDENTIALS",
    );
    assert(
      !user.locked,
      "Tài khoản đã bị khóa. Liên hệ quản trị viên.",
      "ACCOUNT_LOCKED",
    );
    failures.delete(username);
    sessionStorage.setItem(SESSION_KEY, user.id);
    db.audits.unshift({
      id: uid("log"),
      at: now(),
      actor: user.name,
      action: "Đăng nhập",
      detail: "Phiên demo",
    });
    persist(db);
    return user;
  },
  demoLogin(id: string) {
    assert(
      import.meta.env.DEV || import.meta.env.VITE_DEMO_MODE === "true",
      "Bộ chọn demo chỉ khả dụng trong môi trường demo.",
    );
    const db = readDb();
    const account = db.accounts.find((a) => a.id === id);
    assert(account && !account.locked, "Tài khoản không khả dụng");
    sessionStorage.setItem(SESSION_KEY, id);
    return account;
  },
  logout() {
    sessionStorage.removeItem(SESSION_KEY);
  },
  changePassword(oldPassword: string, newPassword: string) {
    const db = readDb();
    const user = currentUser(db);
    assert(user, "Vui lòng đăng nhập");
    assert(user.password === oldPassword, "Mật khẩu hiện tại không đúng");
    const result = passwordSchema.safeParse(newPassword);
    assert(
      result.success,
      result.success ? "" : result.error.issues[0].message,
    );
    assert(
      oldPassword !== newPassword,
      "Mật khẩu mới phải khác mật khẩu hiện tại",
    );
    const target = db.accounts.find((a) => a.id === user.id)!;
    target.password = newPassword;
    target.mustChangePassword = false;
    db.audits.unshift({
      id: uid("log"),
      at: now(),
      actor: user.name,
      action: "Đổi mật khẩu",
      detail: "Đã thay mật khẩu; không ghi nội dung mật khẩu vào nhật ký",
    });
    persist(db);
  },
  updateProfile(
    name: string,
    email: string,
    phone: string,
    majorName?: string,
  ) {
    return mutate("Cập nhật hồ sơ", undefined, (db, user) => {
      const p = contactSchema.parse({ email, phone });
      assert(name.trim().length >= 3, "Họ tên ít nhất 3 ký tự");
      Object.assign(
        db.accounts.find((a) => a.id === user.id)!,
        { name, ...p },
      );
      const s = db.students.find((a) => a.id === user.studentId);
      const l = db.lecturers.find((a) => a.id === user.lecturerId);
      if (s)
        Object.assign(s, {
          name,
          ...p,
          ...(majorName !== undefined ? { majorName: majorName.trim() } : {}),
        });
      if (l) Object.assign(l, { name, ...p });
    });
  },
  saveAccount(input: SaveAccountInput) {
    return mutate("Lưu tài khoản", ["ADMIN"], (db) => {
      assert(input.roles.length, "Chọn ít nhất một vai trò");
      assert(input.username.length >= 3, "Tên đăng nhập ít nhất 3 ký tự");
      contactSchema.parse(input);
      assert(
        !db.accounts.some(
          (a) => a.username === input.username && a.id !== input.id,
        ),
        "Tên đăng nhập đã tồn tại",
      );
      const old = db.accounts.find((a) => a.id === input.id);
      const program = db.catalogs.find(
        (c) =>
          c.kind === "program" && c.id === input.trainingSystemId && c.active,
      );
      if (input.roles.includes("STUDENT")) {
        assert(program, "Vui lòng chọn hệ đào tạo cho tài khoản sinh viên.");
        const student = db.students.find((s) => s.id === old?.studentId);
        if (student && student.program !== program.name)
          assert(
            !db.terms.some(
              (t) =>
                t.studentIds.includes(student.id) && t.program !== program.name,
            ),
            "SV đang thuộc đợt khác hệ; cần xử lý danh sách tham gia trước.",
          );
      }
      if (old) {
        if (old.roles.includes("ADMIN") && !input.roles.includes("ADMIN"))
          assert(
            db.accounts.filter(
              (a) => a.roles.includes("ADMIN") && !a.locked && a.id !== old.id,
            ).length,
            "Không thể bỏ vai trò quản trị viên cuối cùng",
          );
        Object.assign(old, {
          username: input.username,
          name: input.name,
          email: input.email,
          phone: input.phone,
          roles: input.roles,
        });
        if (input.password?.trim()) {
          old.password = input.password.trim();
        }
      } else {
        db.accounts.push({
          username: input.username,
          name: input.name,
          email: input.email,
          phone: input.phone,
          roles: input.roles,
          id: uid("acc"),
          password: input.password?.trim() || "Default@2026",
          mustChangePassword: true,
          locked: false,
        });
      }
      if (input.roles.includes("STUDENT") && program) {
        const account = db.accounts.find((a) => a.username === input.username)!;
        let student = db.students.find((s) => s.id === account.studentId);
        if (!student) {
          student = {
            id: uid("sv"),
            code: input.username,
            name: input.name,
            email: input.email,
            phone: input.phone,
            className: input.className?.trim() || "",
            majorName: input.majorName?.trim() || "",
            program: program.name,
            departmentId: "",
            gpa: 0,
            eligible: false,
          };
          db.students.push(student);
          account.studentId = student.id;
        } else
          Object.assign(student, {
            name: input.name,
            email: input.email,
            phone: input.phone,
            program: program.name,
            ...(input.majorName !== undefined
              ? { majorName: input.majorName.trim() }
              : {}),
            ...(input.className !== undefined
              ? { className: input.className.trim() }
              : {}),
          });
      }
      if (input.roles.includes("LECTURER")) {
        assert(
          input.departmentId &&
            db.catalogs.some(
              (c) => c.kind === "department" && c.id === input.departmentId,
            ),
          "Chọn bộ môn hợp lệ",
        );
        assert(
          input.researchAreaIds?.length &&
            new Set(input.researchAreaIds).size ===
              input.researchAreaIds.length &&
            input.researchAreaIds.every((id) =>
              db.catalogs.some((c) => c.kind === "direction" && c.id === id),
            ),
          "Chọn hướng chuyên môn hợp lệ",
        );
        const account = db.accounts.find((a) => a.username === input.username)!;
        let lecturer = db.lecturers.find((l) => l.id === account.lecturerId);
        const fields = {
          name: input.name,
          email: input.email,
          phone: input.phone,
          departmentId: input.departmentId,
          directionIds: input.researchAreaIds,
          quota: input.maxStudents ?? 5,
        };
        if (lecturer) Object.assign(lecturer, fields);
        else {
          lecturer = {
            ...fields,
            id: uid("gv"),
            code: input.username,
            isActive: true,
          };
          db.lecturers.push(lecturer);
          account.lecturerId = lecturer.id;
        }
      }
    });
  },
  lock(id: string) {
    return mutate("Khóa/mở tài khoản", ["ADMIN"], (db, user) => {
      const a = db.accounts.find((x) => x.id === id);
      assert(a, "Không tìm thấy tài khoản");
      assert(id !== user.id, "Không thể khóa tài khoản đang sử dụng");
      if (!a.locked && a.roles.includes("ADMIN"))
        assert(
          db.accounts.filter(
            (x) => x.roles.includes("ADMIN") && !x.locked && x.id !== id,
          ).length,
          "Không thể khóa quản trị viên cuối cùng",
        );
      a.locked = !a.locked;
    });
  },
  resetPassword(id: string) {
    return mutate("Đặt lại mật khẩu", ["ADMIN"], (db) => {
      const a = db.accounts.find((x) => x.id === id);
      assert(a, "Không tìm thấy tài khoản");
      a.password = a.studentId ? a.username : "Default@2026";
      a.mustChangePassword = true;
    });
  },
};
export const authService = {
  ...mockAuthService,
  login(username: string, password: string) {
    if (!AUTH_API) return mockAuthService.login(username, password);
    return httpClient
      .post("/auth/login", { username, password })
      .then((response) => {
        const value = response.data.data;
        setTokens(value.accessToken, value.refreshToken);
        return setApiUser(value.user);
      });
  },
  demoLogin(id: string) {
    if (AUTH_API)
      throw new Error(
        "Đăng nhập bằng tài khoản thật để sử dụng dữ liệu máy chủ.",
      );
    return mockAuthService.demoLogin(id);
  },
  async logout() {
    if (!AUTH_API) {
      mockAuthService.logout();
      return;
    }
    try {
      if (getAccessToken()) await httpClient.post("/auth/logout");
    } finally {
      clearApiSession();
    }
  },
  changePassword(oldPassword: string, newPassword: string) {
    if (!AUTH_API)
      return mockAuthService.changePassword(oldPassword, newPassword);
    return httpClient
      .post("/auth/change-password", { oldPassword, newPassword })
      .then((r) => setApiUser(r.data.data));
  },
  updateProfile(
    name: string,
    email: string,
    phone: string,
    majorName?: string,
  ) {
    if (!AUTH_API)
      return mockAuthService.updateProfile(name, email, phone, majorName);
    return httpClient
      .patch("/auth/profile", {
        name,
        email,
        phone,
        ...(majorName !== undefined ? { majorName: majorName.trim() } : {}),
      })
      .then((r) => setApiUser(r.data.data));
  },
  saveAccount(input: SaveAccountInput) {
    if (!AUTH_API) return mockAuthService.saveAccount(input);
    return httpClient
      .request<{ data: Account }>({
        method: input.id ? "PATCH" : "POST",
        url: input.id ? `/accounts/${input.id}` : "/accounts",
        data: {
          ...input,
          majorName: input.roles.includes("STUDENT")
            ? input.majorName?.trim() || undefined
            : undefined,
          className: input.roles.includes("STUDENT")
            ? input.className?.trim() || undefined
            : undefined,
          departmentId: input.roles.includes("LECTURER")
            ? input.departmentId
            : undefined,
          researchAreaIds: input.roles.includes("LECTURER")
            ? input.researchAreaIds
            : undefined,
          maxStudents: input.roles.includes("LECTURER")
            ? input.maxStudents
            : undefined,
        },
      })
      .then((res) => res.data.data);
  },
  lock(id: string) {
    if (!AUTH_API) return mockAuthService.lock(id);
    return httpClient
      .patch<{ data: Account }>(`/accounts/${id}/status`)
      .then((res) => res.data.data);
  },
  resetPassword(id: string) {
    if (!AUTH_API) return mockAuthService.resetPassword(id);
    return httpClient
      .post<{ data: Account }>(`/accounts/${id}/reset-password`)
      .then((res) => res.data.data);
  },
};
export type AuthService = typeof authService;
