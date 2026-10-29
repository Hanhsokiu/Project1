import type { OpenAPIObject } from "@nestjs/swagger";
import type {
  OperationObject,
  ReferenceObject,
  SchemaObject,
} from "@nestjs/swagger/dist/interfaces/open-api-spec.interface";

type Schema = SchemaObject | ReferenceObject;
const text: SchemaObject = { type: "string" };
const uuid: SchemaObject = { type: "string", format: "uuid" };
const dateTime: SchemaObject = { type: "string", format: "date-time" };
const boolean: SchemaObject = { type: "boolean" };
const count: SchemaObject = { type: "integer", minimum: 0 };
const roles = ["ADMIN", "FACULTY", "LECTURER", "STUDENT", "COMMITTEE"];
const termStatuses = [
  "DRAFT",
  "OPEN_REGISTRATION",
  "CLOSED_REGISTRATION",
  "IN_PROGRESS",
  "DEFENDING",
  "COMPLETED",
  "CANCELLED",
];
const phaseCodes = [
  "REGISTRATION",
  "ASSIGNMENT",
  "PROPOSAL",
  "PROPOSAL_REVIEW",
  "WEEKLY",
  "FINAL",
  "DEFENSE",
];
const ref = (name: string): ReferenceObject => ({
  $ref: `#/components/schemas/${name}`,
});
const array = (items: Schema): SchemaObject => ({ type: "array", items });
const object = (
  properties: Record<string, Schema>,
  required = Object.keys(properties),
): SchemaObject => ({
  type: "object",
  additionalProperties: false,
  properties,
  required,
});
const page = (item: string): SchemaObject =>
  object({
    items: array(ref(item)),
    total: count,
    page: { type: "integer", minimum: 1 },
    pageSize: { type: "integer", minimum: 1, maximum: 100 },
    totalPages: count,
  });

/** Response-only documentation matching the public mappers; never documents persistence account hashes. */
export function describeStep1Responses(
  document: OpenAPIObject,
  prefix = "api",
): OpenAPIObject {
  const schemas: Record<string, SchemaObject> = {
    SafeStudentSummary: object({
      id: uuid,
      code: { ...text, description: "Mã sinh viên là chuỗi, giữ số 0 đầu." },
      name: text,
      className: text,
      majorName: text,
      cohort: text,
      program: text,
      trainingSystemId: uuid,
      gpa: { type: "number", minimum: 0, maximum: 4, nullable: true },
      phone: text,
      email: text,
      eligible: boolean,
    }),
    SafeLecturerSummary: object({
      id: uuid,
      code: text,
      name: text,
      departmentId: uuid,
      directionIds: array(uuid),
      quota: count,
      email: text,
      phone: text,
    }),
    SafeAccount: {
      ...object(
        {
          id: uuid,
          username: text,
          name: text,
          email: { ...text, format: "email", nullable: true },
          phone: text,
          roles: array({ type: "string", enum: roles }),
          permissions: array({ ...text, example: "term:read" }),
          mustChangePassword: boolean,
          profileComplete: boolean,
          locked: boolean,
          studentId: uuid,
          lecturerId: uuid,
          student: ref("SafeStudentSummary"),
          lecturer: ref("SafeLecturerSummary"),
        },
        [
          "id",
          "username",
          "name",
          "email",
          "phone",
          "roles",
          "permissions",
          "mustChangePassword",
          "locked",
        ],
      ),
      description:
        "Tài khoản công khai từ accountDto. Không chứa password, passwordHash, refresh-token hash hoặc dữ liệu phiên nội bộ. Các liên kết student/lecturer chỉ có khi tài khoản có hồ sơ tương ứng.",
    },
    LoginResponse: object({
      accessToken: text,
      refreshToken: text,
      user: ref("SafeAccount"),
    }),
    RefreshResponse: object({ accessToken: text, user: ref("SafeAccount") }),
    LogoutResponse: object({ loggedOut: { type: "boolean", enum: [true] } }),
    CatalogLookupResponse: object(
      {
        id: uuid,
        code: text,
        name: text,
        createdAt: dateTime,
        updatedAt: dateTime,
      },
      ["id", "code", "name", "createdAt"],
    ),
    DepartmentResponse: object({
      id: uuid,
      code: text,
      name: text,
      createdAt: dateTime,
      updatedAt: dateTime,
    }),
    TrainingSystemResponse: object({
      id: uuid,
      code: text,
      name: text,
      createdAt: dateTime,
    }),
    ResearchAreaResponse: object({
      isActive: boolean,
      id: uuid,
      name: text,
      description: { ...text, nullable: true },
      createdAt: dateTime,
    }),
    TitleResponse: object({
      id: uuid,
      name: text,
      abbreviation: text,
      createdAt: dateTime,
    }),
    SemesterResponse: object({
      id: uuid,
      academicYear: {
        ...text,
        pattern: "^\\d{4}-\\d{4}$",
        example: "2026-2027",
      },
      semester: { type: "integer", minimum: 1, maximum: 3 },
      name: text,
      startDate: dateTime,
      endDate: dateTime,
      createdAt: dateTime,
      updatedAt: dateTime,
    }),
    TermPhaseResponse: object({
      id: uuid,
      code: { type: "string", enum: phaseCodes },
      name: text,
      start: dateTime,
      end: dateTime,
      locked: boolean,
    }),
    TermLecturerResponse: object({
      lecturerId: uuid,
      quota: count,
      officialCount: count,
    }),
    TermResponse: object({
      id: uuid,
      code: text,
      name: text,
      semesterId: { ...uuid, nullable: true },
      academicYear: text,
      semester: {
        ...text,
        description: "Tên kỳ học để hiển thị; không phải số thứ tự kỳ.",
      },
      semesterNumber: { type: "integer", minimum: 1, maximum: 3 },
      trainingSystemId: { ...uuid, nullable: true },
      program: text,
      start: {
        type: "string",
        format: "date",
        description: "Ngày theo Asia/Ho_Chi_Minh.",
      },
      end: {
        type: "string",
        format: "date",
        description: "Ngày theo Asia/Ho_Chi_Minh.",
      },
      startDate: dateTime,
      endDate: dateTime,
      status: { type: "string", enum: termStatuses },
      locked: boolean,
      registrationStart: dateTime,
      registrationEnd: dateTime,
      phases: { ...array(ref("TermPhaseResponse")), minItems: 6, maxItems: 7 },
      parameters: { type: "object", additionalProperties: { type: "number" } },
      studentIds: array(uuid),
      lecturers: array(ref("TermLecturerResponse")),
      assignmentPublished: boolean,
      resultsPublished: boolean,
      createdAt: dateTime,
      updatedAt: dateTime,
    }),
    StudentResponse: object({
      id: uuid,
      userId: uuid,
      studentCode: {
        ...text,
        description: "Mã SV dạng chuỗi; không bỏ số 0 đầu.",
      },
      fullName: text,
      className: text,
      majorName: text,
      cohort: text,
      gpa: { type: "number", minimum: 0, maximum: 4, nullable: true },
      academicEligible: boolean,
      isActive: boolean,
      trainingSystemId: uuid,
      trainingSystem: ref("TrainingSystemResponse"),
      email: { ...text, format: "email", nullable: true },
      phone: { ...text, nullable: true },
      termIds: array(uuid),
      createdAt: dateTime,
      updatedAt: dateTime,
    }),
    LecturerResponse: object({
      id: uuid,
      userId: uuid,
      lecturerCode: text,
      fullName: text,
      departmentId: uuid,
      department: ref("DepartmentResponse"),
      titleId: { ...uuid, nullable: true },
      title: { allOf: [ref("TitleResponse")], nullable: true },
      email: { ...text, format: "email", nullable: true },
      phone: { ...text, nullable: true },
      maxStudents: { type: "integer", minimum: 0, maximum: 100 },
      isActive: boolean,
      researchAreas: array(ref("ResearchAreaResponse")),
      researchAreaIds: array(uuid),
      createdAt: dateTime,
      updatedAt: dateTime,
    }),
    OperationWindowResponse: object({
      phaseCode: { type: "string", enum: phaseCodes },
      status: { type: "string", enum: termStatuses },
      serverNow: dateTime,
      startAt: { ...dateTime, nullable: true },
      endAt: { ...dateTime, nullable: true },
      locked: boolean,
      canWrite: boolean,
      reason: { ...text, nullable: true },
    }),
    ImportValuesResponse: {
      ...object({
        studentCode: text,
        fullName: text,
        className: text,
        cohort: text,
        trainingSystemCode: text,
        gpa: { type: "number", nullable: true },
        email: { ...text, nullable: true },
        phone: { ...text, nullable: true },
        academicEligible: boolean,
      }),
      description:
        "Dữ liệu đã phân tích, kể cả dòng không hợp lệ. GPA có thể ngoài 0–4 hoặc null, email có thể sai định dạng; xem errors của dòng.",
    },
    ImportRowErrorResponse: object({ field: text, code: text, message: text }),
    ImportRowResponse: object(
      {
        rowNumber: { type: "integer", minimum: 2 },
        values: ref("ImportValuesResponse"),
        action: { type: "string", enum: ["CREATE", "UPDATE", "SKIP", "ERROR"] },
        status: {
          type: "string",
          enum: ["VALID", "ERROR", "IMPORTED", "SKIPPED"],
        },
        errors: array(ref("ImportRowErrorResponse")),
        studentId: uuid,
        numericCode: boolean,
        invalidAcademicFlag: boolean,
      },
      ["rowNumber", "values", "action", "status", "errors"],
    ),
    ImportJobResponse: object({
      id: uuid,
      termId: { ...uuid, nullable: true },
      fileName: text,
      status: {
        type: "string",
        enum: [
          "QUEUED",
          "PROCESSING",
          "DONE",
          "FAILED",
          "VALIDATED",
          "PARTIAL",
        ],
      },
      totalRows: count,
      validRows: count,
      invalidRows: count,
      successRows: count,
      errorRows: count,
      skippedRows: count,
      createdAt: dateTime,
      confirmedAt: { ...dateTime, nullable: true },
      mode: { type: "string", enum: ["STRICT", "VALID_ONLY"], nullable: true },
      rows: array(ref("ImportRowResponse")),
      canConfirm: boolean,
    }),
    PageTerm: page("TermResponse"),
    PageStudent: page("StudentResponse"),
    PageLecturer: page("LecturerResponse"),
    HealthResponse: object({
      status: { type: "string", enum: ["ok"] },
      scope: { type: "string", enum: ["step-1"] },
      serverTime: dateTime,
    }),
  };

  document.components ??= {};
  document.components.schemas ??= {};
  // Also usable independently from the request-schema decorator; keep any existing envelope definition.
  if (!document.components.schemas.ApiResult)
    document.components.schemas.ApiResult = object(
      {
        success: { type: "boolean", enum: [true] },
        data: {},
        message: text,
        timestamp: dateTime,
      },
      ["success", "data", "timestamp"],
    );
  Object.assign(document.components.schemas, schemas);

  const base = prefix.replace(/^\/+|\/+$/g, "");
  function response(
    path: string,
    method: "get" | "post" | "put" | "patch",
    data: Schema | string,
  ) {
    const operation = document.paths[`${base ? `/${base}` : ""}${path}`]?.[
      method
    ] as OperationObject | undefined;
    if (!operation) return;
    const status = method === "post" ? "201" : "200";
    const previous = operation.responses[status];
    const existing = previous && !("$ref" in previous) ? previous : undefined;
    operation.responses[status] = {
      ...existing,
      description:
        existing?.description || "ApiResponse thành công với dữ liệu Bước 1.",
      content: {
        ...existing?.content,
        "application/json": {
          schema: {
            allOf: [
              ref("ApiResult"),
              {
                type: "object",
                properties: {
                  data: typeof data === "string" ? ref(data) : data,
                },
              },
            ],
          },
        },
      },
    };
  }

  response("/health", "get", "HealthResponse");
  response("/auth/login", "post", "LoginResponse");
  response("/auth/refresh", "post", "RefreshResponse");
  response("/auth/me", "get", "SafeAccount");
  response("/auth/profile", "patch", "SafeAccount");
  response("/auth/change-password", "post", "SafeAccount");
  response("/auth/logout", "post", "LogoutResponse");
  response("/semesters", "get", array(ref("SemesterResponse")));
  response("/semesters", "post", "SemesterResponse");
  response("/terms", "get", "PageTerm");
  response("/terms", "post", "TermResponse");
  response("/terms/latest", "get", "TermResponse");
  response("/terms/{id}", "get", "TermResponse");
  response("/terms/{id}", "patch", "TermResponse");
  response("/terms/{id}/status", "patch", "TermResponse");
  response("/terms/{id}/lock", "patch", "TermResponse");
  for (const endpoint of ["phases", "parameters", "roster"])
    response(`/terms/{id}/${endpoint}`, "put", "TermResponse");
  response("/terms/{id}/operation-window", "get", "OperationWindowResponse");
  for (const [path, item, pagination] of [
    ["/students", "StudentResponse", "PageStudent"],
    ["/lecturers", "LecturerResponse", "PageLecturer"],
  ]) {
    response(path, "get", pagination);
    response(path, "post", item);
    response(`${path}/{id}`, "get", item);
    response(`${path}/{id}`, "patch", item);
  }
  for (const [path, item] of [
    ["/departments", "DepartmentResponse"],
    ["/training-systems", "TrainingSystemResponse"],
    ["/research-areas", "ResearchAreaResponse"],
  ]) {
    response(path, "get", array(ref(item)));
    response(path, "post", item);
    response(`${path}/{id}`, "patch", item);
  }
  response("/imports/students/preview", "post", "ImportJobResponse");
  response("/imports/{id}", "get", "ImportJobResponse");
  response("/imports/{id}/confirm", "post", "ImportJobResponse");
  // Do not touch error responses or /imports/students/template: those responses describe binary CSV/XLSX.
  return document;
}
