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
      assert(
        !db.students.some((s) => s.code === input.code && s.id !== input.id),
        "Mã sinh viên đã tồn tại",
      );
      if (input.id) {
        const old = db.students.find((s) => s.id === input.id);
        assert(old, "Không tìm thấy sinh viên");
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
            !db.accounts.some(
              (x) => x.username === input.code && x.id !== a.id,
            ),
            "Tên đăng nhập mới đã tồn tại",
          );
          Object.assign(a, {
            username: old.code,
            name: old.name,
            email: old.email,
            phone: old.phone,
          });
        }
      } else {
        assert(
          !db.accounts.some((a) => a.username === input.code),
          "Tên đăng nhập đã tồn tại",
        );
        const id = uid("sv");
        db.students.push({ id, ...parsed.data });
        db.accounts.push({
          id,
          studentId: id,
          username: input.code,
          name: input.name,
          email: input.email,
          phone: input.phone,
          roles: ["STUDENT"],
          password: input.code,
          mustChangePassword: true,
          locked: false,
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
      assert(
        !db.lecturers.some((s) => s.code === input.code && s.id !== input.id),
        "Mã giảng viên đã tồn tại",
      );
      if (input.id) {
        const old = db.lecturers.find((s) => s.id === input.id);
        assert(old, "Không tìm thấy giảng viên");
        Object.assign(old, parsed.data);
        const a = db.accounts.find((x) => x.lecturerId === old.id);
        if (a)
          Object.assign(a, {
            name: old.name,
            email: old.email,
            phone: old.phone,
          });
      } else {
        assert(
          !db.accounts.some((a) => a.username === input.code.toLowerCase()),
          "Tên đăng nhập đã tồn tại",
        );
        const id = uid("gv");
        db.lecturers.push({ id, ...parsed.data });
        db.accounts.push({
          id,
          lecturerId: id,
          username: input.code.toLowerCase(),
          name: input.name,
          email: input.email,
          phone: input.phone,
          roles: ["LECTURER"],
          password: "Default@2026",
          mustChangePassword: true,
          locked: false,
        });
      }
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
    const seen = new Set(existingCodes);
    return rows.map((values, i) => {
      const errors: string[] = [];
      if (!values.code || !values.name) errors.push("Thiếu mã hoặc họ tên");
      if (seen.has(values.code))
        errors.push("Mã đã tồn tại hoặc trùng trong tệp");
      seen.add(values.code);
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
        Number(values.quota) > 100
      )
        errors.push("Quota phải là số nguyên từ 0 đến 100");
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
      const username =
        kind === "student" ? values.code : values.code.toLowerCase();
      if (
        db.accounts.some((a) => a.username === username) &&
        !existingCodes.includes(values.code)
      )
        errors.push("Tên đăng nhập đã tồn tại");
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
        const id = uid(kind === "student" ? "sv" : "gv");
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
          db.students.push({ id, ...student });
          if (target) target.studentIds.push(id);
        } else
          db.lecturers.push({
            id,
            ...lecturerSchema.parse({
              code: v.code,
              name: v.name,
              email: v.email,
              phone: v.phone,
              departmentId,
              directionIds: [direction!.id],
              quota: Number(v.quota),
            }),
          });
        db.accounts.push({
          id,
          username: kind === "student" ? v.code : v.code.toLowerCase(),
          name: v.name,
          email: v.email,
          phone: v.phone,
          roles: [kind === "student" ? "STUDENT" : "LECTURER"],
          ...(kind === "student" ? { studentId: id } : { lecturerId: id }),
          password: kind === "student" ? v.code : "Default@2026",
          locked: false,
          mustChangePassword: true,
        });
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
