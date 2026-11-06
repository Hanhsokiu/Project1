import { studentSchema, lecturerSchema } from "../../../shared/data/schemas";
import { assert, mutate, readDb, uid } from "../../../shared/data/store";
import type {
  CatalogItem,
  ImportRow,
  Lecturer,
  Student,
} from "../../../shared/data/types";
import { step1Api } from "../../../shared/data/snapshot-api";
import { catalogApi, type CatalogApiInput } from "./catalog-api";
const managers = ["ADMIN", "FACULTY"] as const;
export const mockCatalogService = {
  saveStudent(input: Omit<Student, "id"> & { id?: string }) {
    return mutate("Lưu sinh viên", [...managers], (db) => {
      const parsed = studentSchema.safeParse(input);
      assert(
        parsed.success,
        parsed.success
          ? ""
          : parsed.error.issues.map((i) => i.message).join("; "),
      );
      assert(
        db.catalogs.some(
          (c) => c.kind === "department" && c.id === input.departmentId,
        ),
        "Bộ môn không tồn tại",
      );
      assert(
        db.catalogs.some(
          (c) => c.kind === "program" && c.name === input.program,
        ),
        "Hệ đào tạo không tồn tại",
      );
      const old = db.students.find((s) =>
        input.id ? s.id === input.id : s.code === input.code,
      );
      assert(
        old && db.accounts.some((a) => a.studentId === old.id),
        "Sinh viên không tồn tại. Vui lòng liên hệ Admin tạo tài khoản sinh viên trước.",
      );
      assert(
        !db.students.some((s) => s.code === input.code && s.id !== old.id),
        "Mã sinh viên đã tồn tại",
      );
      assert(
        !db.terms.some(
          (t) => t.studentIds.includes(old.id) && t.program !== input.program,
        ),
        "Sinh viên đang tham gia đợt khác hệ; cần xử lý danh sách tham gia trước",
      );
      Object.assign(old, parsed.data);
      const a = db.accounts.find((x) => x.studentId === old.id);
      if (a) {
        assert(
          !db.accounts.some((x) => x.username === input.code && x.id !== a.id),
          "Tên đăng nhập mới đã tồn tại",
        );
        Object.assign(a, {
          username: old.code,
          name: old.name,
          email: old.email,
          phone: old.phone,
        });
      }
    });
  },
  saveLecturer(input: Omit<Lecturer, "id"> & { id?: string }) {
    return mutate("Lưu giảng viên", [...managers], (db) => {
      const parsed = lecturerSchema.safeParse(input);
      assert(
        parsed.success,
        parsed.success
          ? ""
          : parsed.error.issues.map((i) => i.message).join("; "),
      );
      assert(
        db.catalogs.some(
          (c) => c.kind === "department" && c.id === input.departmentId,
        ),
        "Bộ môn không tồn tại",
      );
      assert(
        input.directionIds.every((id) =>
          db.catalogs.some((c) => c.kind === "direction" && c.id === id),
        ),
        "Hướng chuyên môn không hợp lệ",
      );
      const old = db.lecturers.find((l) =>
        input.id ? l.id === input.id : l.code === input.code,
      );
      assert(
        old && db.accounts.some((a) => a.lecturerId === old.id),
        "Giảng viên không tồn tại. Vui lòng liên hệ Admin tạo tài khoản giảng viên trước.",
      );
      assert(
        !db.lecturers.some((l) => l.code === input.code && l.id !== old.id),
        "Mã giảng viên đã tồn tại",
      );
      Object.assign(old, parsed.data);
      const a = db.accounts.find((x) => x.lecturerId === old.id);
      if (a)
        Object.assign(a, {
          name: old.name,
          email: old.email,
          phone: old.phone,
        });
    });
  },
  saveItem(input: Omit<CatalogItem, "id"> & { id?: string }) {
    return mutate("Lưu danh mục", [...managers], (db) => {
      assert(
        input.name.trim().length >= 2 && input.code.trim(),
        "Nhập đầy đủ mã và tên danh mục",
      );
      assert(
        !db.catalogs.some(
          (x) =>
            x.kind === input.kind &&
            (x.code === input.code ||
              x.name.toLocaleLowerCase("vi") ===
                input.name.toLocaleLowerCase("vi")) &&
            x.id !== input.id,
        ),
        "Mã hoặc tên danh mục đã tồn tại",
      );
      const old = db.catalogs.find((x) => x.id === input.id);
      if (old) {
        if (old.kind === "program" && old.name !== input.name) {
          db.students
            .filter((s) => s.program === old.name)
            .forEach((s) => (s.program = input.name));
          db.terms
            .filter((t) => t.program === old.name)
            .forEach((t) => (t.program = input.name));
        }
        if (old.kind === "semester" && old.name !== input.name)
          db.terms
            .filter((t) => t.semester === old.name)
            .forEach((t) => (t.semester = input.name));
        Object.assign(old, input);
      } else db.catalogs.push({ ...input, id: uid("dm") });
    });
  },
  validateImport(
    rows: Record<string, string>[],
    kind: "student" | "lecturer",
    existingCodes: string[],
  ): ImportRow[] {
    const db = readDb();
    const seen = new Set<string>();
    return rows.map((values, i) => {
      const errors: string[] = [];
      if (!values.code || !values.name) errors.push("Thiếu mã hoặc họ tên");
      if (seen.has(values.code)) errors.push("Mã bị trùng trong tệp");
      seen.add(values.code);
      const existing = (kind === "student" ? db.students : db.lecturers).find(
        (record) => record.code === values.code,
      );
      if (!existingCodes.includes(values.code) || !existing)
        errors.push(
          `${kind === "student" ? "Sinh viên" : "Giảng viên"} không tồn tại. Vui lòng liên hệ Admin tạo tài khoản trước.`,
        );
      if (values.name?.trim().length < 3) errors.push("Họ tên ít nhất 3 ký tự");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email || ""))
        errors.push("Email không hợp lệ");
      if (!/^(0|\+84)[0-9]{9,10}$/.test(values.phone || ""))
        errors.push("Số điện thoại không hợp lệ");
      if (kind === "student") {
        if (
          !values.gpa?.trim() ||
          !Number.isFinite(Number(values.gpa)) ||
          Number(values.gpa) < 0 ||
          Number(values.gpa) > 4
        )
          errors.push("GPA bắt buộc từ 0 đến 4");
        if (!values.className) errors.push("Thiếu lớp");
        if (
          !db.catalogs.some(
            (c) =>
              c.kind === "program" && c.name === values.program && c.active,
          )
        )
          errors.push("Hệ đào tạo không tồn tại hoặc ngừng sử dụng");
      } else if (
        !values.quota?.trim() ||
        !Number.isInteger(Number(values.quota)) ||
        Number(values.quota) < 0 ||
        Number(values.quota) > 500
      )
        errors.push("Quota phải là số nguyên từ 0 đến 500");
      if (
        values.departmentCode &&
        !db.catalogs.some(
          (c) =>
            c.kind === "department" &&
            c.code === values.departmentCode &&
            c.active,
        )
      )
        errors.push("Mã bộ môn không tồn tại");
      return { row: i + 2, values, errors };
    });
  },
  importRows(rows: ImportRow[], kind: "student" | "lecturer", termId?: string) {
    return mutate("Import danh mục", [...managers], (db) => {
      assert(rows.length, "Chưa có dữ liệu import");
      assert(
        !rows.some((r) => r.errors.length),
        "Vui lòng sửa hết lỗi trước khi import",
      );
      const checked = catalogService.validateImport(
        rows.map((r) => r.values),
        kind,
        (kind === "student" ? db.students : db.lecturers).map((s) => s.code),
      );
      assert(
        !checked.some((r) => r.errors.length),
        "Dữ liệu đã thay đổi hoặc mã đã được nhập. Hãy kiểm tra lại tệp.",
      );
      const target = termId ? db.terms.find((t) => t.id === termId) : undefined;
      if (termId)
        assert(
          target &&
            !target.locked &&
            !["COMPLETED", "CANCELLED"].includes(target.status),
          "Đợt không tồn tại, đã khóa hoặc kết thúc",
        );
      const department = db.catalogs.find(
        (c) => c.kind === "department" && c.active,
      );
      assert(department, "Cần có ít nhất một bộ môn hoạt động");
      const direction = db.catalogs.find(
        (c) => c.kind === "direction" && c.active,
      );
      if (kind === "lecturer")
        assert(direction, "Cần có hướng chuyên môn hoạt động");
      for (const { values: v } of rows) {
        if (target && kind === "student") {
          assert(
            v.program === target.program,
            "Hệ đào tạo trong tệp không khớp đợt",
          );
          assert(
            Number(v.gpa) >= target.parameters.passing_gpa_threshold,
            "Có sinh viên chưa đạt ngưỡng GPA của đợt",
          );
        }
        const departmentId =
          db.catalogs.find(
            (c) => c.kind === "department" && c.code === v.departmentCode,
          )?.id || department.id;
        if (kind === "student") {
          const student = studentSchema.parse({
            code: v.code,
            name: v.name,
            email: v.email,
            phone: v.phone,
            className: v.className,
            program: v.program,
            departmentId,
            gpa: Number(v.gpa),
            eligible: Number(v.gpa) >= 2,
          });
          const existing = db.students.find((s) => s.code === v.code)!;
          Object.assign(existing, student);
          if (target && !target.studentIds.includes(existing.id))
            target.studentIds.push(existing.id);
        } else {
          const existing = db.lecturers.find((l) => l.code === v.code)!;
          Object.assign(
            existing,
            lecturerSchema.parse({
              code: v.code,
              name: v.name,
              email: v.email,
              phone: v.phone,
              departmentId,
              directionIds: existing.directionIds,
              quota: Number(v.quota),
            }),
          );
        }
      }
      return `Đã nhập ${rows.length} ${kind === "student" ? "sinh viên" : "giảng viên"}${target ? ` vào ${target.code}` : ""}`;
    });
  },
};
export const catalogService = {
  ...mockCatalogService,
  saveStudent: (input: Omit<Student, "id"> & { id?: string }) =>
    step1Api.catalog
      ? catalogApi.saveStudent(input)
      : mockCatalogService.saveStudent(input),
  saveLecturer: (input: Omit<Lecturer, "id"> & { id?: string }) =>
    step1Api.catalog
      ? catalogApi.saveLecturer(input)
      : mockCatalogService.saveLecturer(input),
  saveItem: (input: CatalogApiInput) =>
    (input.kind === "semester" ? step1Api.term : step1Api.catalog)
      ? catalogApi.saveItem(input)
      : mockCatalogService.saveItem(input),
};
export type CatalogService = typeof catalogService;
