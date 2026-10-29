import type { ImportValues, StudentImportRow } from "../dto/catalog.dto";
export interface ImportValidationContext {
  trainingSystem: { id: string; code: string; name: string };
  threshold: number;
  students: Array<{
    id: string;
    studentCode: string;
    trainingSystemId: string;
    userId: string;
    inTerm: boolean;
  }>;
  accounts: Array<{ id: string; username: string; email: string | null }>;
}
export class ImportRowValidator {
  static normalize(
    raw: Record<string, unknown>,
    rowNumber: number,
    targetCode: string,
  ): StudentImportRow {
    const value = (...keys: string[]) => {
      for (const key of keys)
        if (raw[key] !== undefined && raw[key] !== null) return raw[key];
      return "";
    };
    const text = (...keys: string[]) => String(value(...keys)).trim();
    const rawCode = value("studentCode", "code", "Mã SV", "MSSV");
    const rawGpa = value("gpa", "GPA");
    const academic = text("academicEligible", "eligible");
    const values: ImportValues = {
      studentCode: String(rawCode).trim(),
      fullName: text("fullName", "name", "Họ và tên"),
      className: text("className", "Lớp"),
      ...(text("majorName", "Ngành học", "Ngành")
        ? { majorName: text("majorName", "Ngành học", "Ngành") }
        : {}),
      cohort: text("cohort", "Khóa"),
      trainingSystemCode:
        text("trainingSystemCode", "program", "Hệ đào tạo") || targetCode,
      gpa: String(rawGpa).trim() === "" ? null : Number(rawGpa),
      email: text("email", "Email").toLowerCase() || null,
      phone: text("phone", "SĐT") || null,
      academicEligible: !["false", "0", "không"].includes(
        academic.toLowerCase(),
      ),
    };
    return {
      rowNumber,
      values,
      action: "CREATE",
      status: "VALID",
      errors: [],
      ...(typeof rawCode === "number" ? { numericCode: true } : {}),
      ...(academic &&
      !["true", "false", "1", "0", "có", "không"].includes(
        academic.toLowerCase(),
      )
        ? { invalidAcademicFlag: true }
        : {}),
    };
  }
  static validate(
    input: StudentImportRow[],
    context: ImportValidationContext,
  ): StudentImportRow[] {
    const counts = new Map<string, number>();
    const emails = new Map<string, number>();
    input.forEach((row) => {
      counts.set(
        row.values.studentCode,
        (counts.get(row.values.studentCode) || 0) + 1,
      );
      if (row.values.email)
        emails.set(row.values.email, (emails.get(row.values.email) || 0) + 1);
    });
    return input.map((original) => {
      const row: StudentImportRow = {
        ...original,
        values: { ...original.values },
        errors: [],
        status: "VALID",
        action: "CREATE",
      };
      const v = row.values;
      const error = (field: string, code: string, message: string) =>
        row.errors.push({ field, code, message });
      if (v.studentCode.length < 3 || v.studentCode.length > 50)
        error("studentCode", "CODE_REQUIRED", "Mã SV phải từ 3 đến 50 ký tự");
      if (row.numericCode)
        error(
          "studentCode",
          "CODE_MUST_BE_TEXT",
          "Cột mã SV trong Excel phải là văn bản để giữ số 0 đầu",
        );
      if ((counts.get(v.studentCode) || 0) > 1)
        error("studentCode", "DUPLICATE_IN_FILE", "Mã SV bị trùng trong tệp");
      if (v.fullName.length < 3)
        error("fullName", "NAME_REQUIRED", "Họ tên ít nhất 3 ký tự");
      if (!v.className) error("className", "CLASS_REQUIRED", "Thiếu lớp");
      if (v.majorName && v.majorName.length > 200)
        error("majorName", "MAJOR_INVALID", "Ngành học tối đa 200 ký tự");
      if (v.gpa === null || !Number.isFinite(v.gpa) || v.gpa < 0 || v.gpa > 4)
        error("gpa", "GPA_INVALID", "GPA bắt buộc từ 0 đến 4");
      if (v.gpa !== null && Number.isFinite(v.gpa) && v.gpa < context.threshold)
        error(
          "gpa",
          "GPA_INELIGIBLE",
          `GPA chưa đạt ngưỡng ${context.threshold} của đợt`,
        );
      if (row.invalidAcademicFlag)
        error(
          "academicEligible",
          "ACADEMIC_FLAG_INVALID",
          "Điều kiện học vụ phải là true hoặc false",
        );
      if (!v.academicEligible)
        error(
          "academicEligible",
          "ACADEMIC_INELIGIBLE",
          "Sinh viên chưa đủ điều kiện học vụ",
        );
      if (
        ![context.trainingSystem.code, context.trainingSystem.name].includes(
          v.trainingSystemCode,
        )
      )
        error(
          "trainingSystemCode",
          "PROGRAM_MISMATCH",
          "Hệ đào tạo không khớp với đợt đích",
        );
      if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email))
        error("email", "EMAIL_INVALID", "Email không hợp lệ");
      if (v.phone && !/^(0|\+84)[0-9]{9,10}$/.test(v.phone))
        error("phone", "PHONE_INVALID", "Số điện thoại không hợp lệ");
      if (v.email && (emails.get(v.email) || 0) > 1)
        error(
          "email",
          "EMAIL_DUPLICATE_IN_FILE",
          "Email bị trùng giữa các dòng trong tệp",
        );
      const existing = context.students.find(
        (s) => s.studentCode === v.studentCode,
      );
      if (existing) {
        row.studentId = existing.id;
        row.action = existing.inTerm ? "SKIP" : "UPDATE";
        if (existing.trainingSystemId !== context.trainingSystem.id)
          error(
            "trainingSystemCode",
            "STUDENT_PROGRAM_CONFLICT",
            "SV hiện có thuộc hệ khác; cần xử lý hồ sơ trước khi nhập",
          );
      }
      const usernameOwner = context.accounts.find(
        (a) => a.username === v.studentCode,
      );
      if (usernameOwner && usernameOwner.id !== existing?.userId)
        error(
          "studentCode",
          "ACCOUNT_CONFLICT",
          "Tên đăng nhập đã thuộc tài khoản khác",
        );
      const emailOwner = v.email
        ? context.accounts.find((a) => a.email === v.email)
        : undefined;
      if (emailOwner && emailOwner.id !== existing?.userId)
        error("email", "EMAIL_TAKEN", "Email đã thuộc tài khoản khác");
      if (row.errors.length) {
        row.action = "ERROR";
        row.status = "ERROR";
      }
      return row;
    });
  }
}
