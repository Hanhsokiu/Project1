import type { LecturerImportRow } from "../dto/catalog.dto";
interface Context {
  lecturers: { id: string; userId: string; lecturerCode: string }[];
  accounts: { id: string; username: string; email: string | null }[];
  departments: { code: string }[];
  areas: { name: string }[];
}
export class LecturerImportValidator {
  static normalize(
    raw: Record<string, unknown>,
    rowNumber: number,
  ): LecturerImportRow {
    const value = (...keys: string[]) =>
      keys.map((k) => raw[k]).find((v) => v !== undefined && v !== null) ?? "";
    const text = (...keys: string[]) => String(value(...keys)).trim();
    const code = value("lecturerCode", "code", "Mã GV");
    const quota = text("maxStudents", "quota", "Chỉ tiêu");
    return {
      rowNumber,
      action: "CREATE",
      status: "VALID",
      errors: [],
      numericCode: typeof code === "number",
      values: {
        lecturerCode: String(code).trim(),
        fullName: text("fullName", "name", "Họ và tên"),
        departmentCode: text("departmentCode", "Bộ môn"),
        researchAreas: text("researchAreas", "Hướng chuyên môn")
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean),
        maxStudents: quota ? Number(quota) : null,
        email: text("email", "Email").toLowerCase() || null,
        phone: text("phone", "SĐT") || null,
      },
    };
  }
  static validate(
    input: LecturerImportRow[],
    context: Context,
  ): LecturerImportRow[] {
    return input.map((original) => {
      const row: LecturerImportRow = {
        ...original,
        errors: [],
        status: "VALID",
        action: "CREATE",
        lecturerId: undefined,
      };
      const v = row.values;
      const error = (field: string, code: string, message: string) =>
        row.errors.push({ field, code, message });
      if (v.lecturerCode.length < 2 || v.lecturerCode.length > 50)
        error("lecturerCode", "CODE_INVALID", "Mã GV phải từ 2 đến 50 ký tự");
      if (row.numericCode)
        error(
          "lecturerCode",
          "CODE_MUST_BE_TEXT",
          "Mã GV trong Excel phải là văn bản để giữ số 0 đầu",
        );
      if (
        input.filter((r) => r.values.lecturerCode === v.lecturerCode).length > 1
      )
        error("lecturerCode", "DUPLICATE_IN_FILE", "Mã GV bị trùng trong tệp");
      if (v.fullName.length < 3 || v.fullName.length > 200)
        error("fullName", "NAME_INVALID", "Họ tên phải từ 3 đến 200 ký tự");
      if (!context.departments.some((d) => d.code === v.departmentCode))
        error(
          "departmentCode",
          "DEPARTMENT_NOT_FOUND",
          "Mã bộ môn không tồn tại",
        );
      if (
        !v.researchAreas.length ||
        v.researchAreas.some(
          (name) => !context.areas.some((a) => a.name === name),
        ) ||
        new Set(v.researchAreas).size !== v.researchAreas.length
      )
        error(
          "researchAreas",
          "AREAS_INVALID",
          "Chọn hướng chuyên môn đang hoạt động, không trùng; phân cách bằng dấu chấm phẩy",
        );
      if (
        v.maxStudents === null ||
        !Number.isInteger(v.maxStudents) ||
        v.maxStudents < 0 ||
        v.maxStudents > 100
      )
        error(
          "maxStudents",
          "QUOTA_INVALID",
          "Chỉ tiêu phải là số nguyên từ 0 đến 100",
        );
      if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email))
        error("email", "EMAIL_INVALID", "Email không hợp lệ");
      if (v.phone && !/^(0|\+84)[0-9]{9,10}$/.test(v.phone))
        error("phone", "PHONE_INVALID", "Số điện thoại không hợp lệ");
      if (v.email && input.filter((r) => r.values.email === v.email).length > 1)
        error("email", "EMAIL_DUPLICATE_IN_FILE", "Email bị trùng trong tệp");
      const existing = context.lecturers.find(
        (l) => l.lecturerCode === v.lecturerCode,
      );
      if (existing) {
        row.action = "UPDATE";
        row.lecturerId = existing.id;
      }
      if (
        context.accounts.some(
          (a) => a.username === v.lecturerCode && a.id !== existing?.userId,
        )
      )
        error(
          "lecturerCode",
          "ACCOUNT_CONFLICT",
          "Tên đăng nhập đã thuộc tài khoản khác",
        );
      if (
        v.email &&
        context.accounts.some(
          (a) => a.email === v.email && a.id !== existing?.userId,
        )
      )
        error("email", "EMAIL_TAKEN", "Email đã thuộc tài khoản khác");
      if (row.errors.length) {
        row.action = "ERROR";
        row.status = "ERROR";
      }
      return row;
    });
  }
}
