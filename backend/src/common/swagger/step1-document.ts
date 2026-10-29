import type { OpenAPIObject } from "@nestjs/swagger";
import type { OperationObject, ReferenceObject, SchemaObject } from "@nestjs/swagger/dist/interfaces/open-api-spec.interface";
import { describeStep1Responses } from "./step1-responses";
import { describeStep2 } from "./step2-document";
const string = { type: "string" as const };
const date = { type: "string" as const, format: "date-time" };
const uuid = { type: "string" as const, format: "uuid" };
const object = (
  properties: Record<string, SchemaObject | ReferenceObject>,
  required: string[] = [],
): SchemaObject => ({ type: "object", additionalProperties: false, properties, required });
/** Zod validates requests at runtime; describe those same request shapes for Swagger consumers. */
export function describeStep1(document: OpenAPIObject, prefix = "api") {
  const schemas: Record<string, SchemaObject> = {
    LoginInput: object(
      { username: string, password: { ...string, format: "password" } },
      ["username", "password"],
    ),
    ChangePasswordInput: object(
      {
        oldPassword: { ...string, format: "password" },
        newPassword: {
          ...string,
          format: "password",
          minLength: 8,
          maxLength: 128,
        },
      },
      ["oldPassword", "newPassword"],
    ),
    ProfileInput: object(
      {
        name: { ...string, minLength: 3 },
        majorName: { ...string, minLength: 1, maxLength: 200 },
        email: {
          nullable: true,
          oneOf: [
            { ...string, format: "email" },
            { ...string, enum: [""] },
          ],
          description: "Trống/null giữ liên hệ hiện có.",
        },
        phone: string,
      },
      ["name"],
    ),
    SemesterInput: object(
      {
        academicYear: {
          ...string,
          pattern: "^\\d{4}-\\d{4}$",
          example: "2026-2027",
        },
        semester: { type: "integer", minimum: 1, maximum: 3 },
        name: string,
        startDate: date,
        endDate: date,
      },
      ["academicYear", "semester", "startDate", "endDate"],
    ),
    TermInput: object(
      {
        code: { ...string, minLength: 3, maxLength: 80 },
        name: { ...string, minLength: 5, maxLength: 250 },
        semesterId: uuid,
        trainingSystemId: uuid,
        startDate: date,
        endDate: date,
        registrationStart: date,
        registrationEnd: date,
      },
      [
        "code",
        "name",
        "semesterId",
        "trainingSystemId",
        "startDate",
        "endDate",
      ],
    ),
    TermPhaseInput: object(
      {
        id: uuid,
        code: {
          type: "string",
          enum: [
            "REGISTRATION",
            "ASSIGNMENT",
            "PROPOSAL",
            "PROPOSAL_REVIEW",
            "WEEKLY",
            "FINAL",
            "DEFENSE",
          ],
        },
        name: string,
        start: date,
        end: date,
        locked: { type: "boolean" },
      },
      ["code", "name", "start", "end", "locked"],
    ),
    TermRosterInput: object(
      {
        studentIds: { type: "array", items: uuid },
        lecturers: {
          type: "array",
          items: object(
            {
              lecturerId: uuid,
              quota: { type: "integer", minimum: 0, maximum: 500 },
            },
            ["lecturerId", "quota"],
          ),
        },
      },
      ["studentIds", "lecturers"],
    ),
    StudentInput: object(
      {
        studentCode: { ...string, example: "001234567" },
        fullName: string,
        className: string,
        majorName: { ...string, minLength: 1, maxLength: 200 },
        cohort: string,
        trainingSystemId: uuid,
        gpa: { type: "number", minimum: 0, maximum: 4 },
        academicEligible: { type: "boolean" },
        email: { ...string, format: "email", nullable: true },
        phone: { ...string, nullable: true },
        isActive: { type: "boolean" },
      },
      ["studentCode", "fullName", "className", "trainingSystemId", "gpa"],
    ),
    LecturerInput: object(
      {
        lecturerCode: string,
        fullName: string,
        departmentId: uuid,
        titleId: { ...uuid, nullable: true },
        email: { ...string, format: "email", nullable: true },
        phone: { ...string, nullable: true },
        maxStudents: { type: "integer", minimum: 0, maximum: 100 },
        researchAreaIds: { type: "array", items: uuid, minItems: 1 },
        isActive: { type: "boolean" },
      },
      ["lecturerCode", "fullName", "departmentId", "researchAreaIds"],
    ),
    ImportConfirmInput: object(
      { mode: { type: "string", enum: ["STRICT", "VALID_ONLY"] } },
      ["mode"],
    ),
    ApiError: object(
      {
        success: { type: "boolean", enum: [false] },
        data: { nullable: true },
        error: object(
          {
            code: string,
            message: string,
            fields: {
              type: "array",
              items: object({ path: string, message: string }),
            },
            details: { type: "object", additionalProperties: true },
          },
          ["code", "message"],
        ),
        message: string,
        timestamp: date,
        path: string,
      },
      ["success", "error", "timestamp"],
    ),
    ApiResult: {
      type: "object",
      properties: {
        success: { type: "boolean", enum: [true] },
        data: {},
        message: string,
        timestamp: date,
      },
      required: ["success", "data", "timestamp"],
    },
  };
  schemas.TermPatch = { ...schemas.TermInput, required: [] };
  schemas.StudentPatch = { ...schemas.StudentInput, required: [] };
  schemas.LecturerPatch = { ...schemas.LecturerInput, required: [] };
  // Catalog Zod objects strip unknown properties; auth and term objects reject them.
  for (const name of [
    "StudentInput",
    "StudentPatch",
    "LecturerInput",
    "LecturerPatch",
  ])
    schemas[name].additionalProperties = true;
  document.components ??= {};
  document.components.schemas = { ...document.components.schemas, ...schemas };
  const ref = (name: string) => ({ $ref: "#/components/schemas/" + name });
  const operation = (path: string, method: string) =>
    (document.paths[`/${prefix}${path}`] as Record<string, OperationObject> | undefined)?.[method];
  const body = (
    path: string,
    method: string,
    schema: string | SchemaObject | ReferenceObject,
    contentType = "application/json",
  ) => {
    const op = operation(path, method);
    if (op)
      op.requestBody = {
        required: true,
        content: {
          [contentType]: {
            schema: typeof schema === "string" ? ref(schema) : schema,
          },
        },
      };
  };
  const query = (
    path: string,
    fields: {
      name: string;
      type?: string;
      required?: boolean;
      enum?: string[];
    }[],
  ) => {
    const op = operation(path, "get");
    if (op)
      op.parameters = [
        ...(op.parameters || []).filter((p) => !("in" in p) || p.in !== "query"),
        ...fields.map((f) => ({
          name: f.name,
          in: "query" as const,
          required: !!f.required,
          schema: {
            type: f.type || "string",
            ...(f.enum ? { enum: f.enum } : {}),
          },
        })),
      ];
  };
  body("/auth/login", "post", "LoginInput");
  body("/auth/change-password", "post", "ChangePasswordInput");
  body("/auth/profile", "patch", "ProfileInput");
  body(
    "/auth/refresh",
    "post",
    object({ refreshToken: string }, ["refreshToken"]),
  );
  body("/semesters", "post", "SemesterInput");
  body("/terms", "post", "TermInput");
  body("/terms/{id}", "patch", "TermPatch");
  body(
    "/terms/{id}/status",
    "patch",
    object(
      {
        status: {
          type: "string",
          enum: [
            "DRAFT",
            "OPEN_REGISTRATION",
            "CLOSED_REGISTRATION",
            "IN_PROGRESS",
            "DEFENDING",
            "COMPLETED",
            "CANCELLED",
          ],
        },
      },
      ["status"],
    ),
  );
  body(
    "/terms/{id}/lock",
    "patch",
    object({ locked: { type: "boolean" } }, ["locked"]),
  );
  body("/terms/{id}/roster", "put", "TermRosterInput");
  body(
    "/terms/{id}/phases",
    "put",
    object(
      {
        phases: {
          type: "array",
          minItems: 6,
          maxItems: 7,
          items: ref("TermPhaseInput"),
        },
      },
      ["phases"],
    ),
  );
  body(
    "/terms/{id}/parameters",
    "put",
    object(
      {
        parameters: {
          type: "object",
          additionalProperties: { type: "number" },
        },
      },
      ["parameters"],
    ),
  );
  body("/students", "post", "StudentInput");
  body("/students/{id}", "patch", "StudentPatch");
  body("/lecturers", "post", "LecturerInput");
  body("/lecturers/{id}", "patch", "LecturerPatch");
  for (const path of ["/departments", "/training-systems", "/research-areas"]) {
    const schema =
      path === "/research-areas"
        ? object({ name: string, description: { ...string, nullable: true } }, [
            "name",
          ])
        : object({ code: string, name: string }, ["code", "name"]);
    body(path, "post", { ...schema, additionalProperties: true });
    body(path + "/{id}", "patch", {
      ...schema,
      additionalProperties: true,
      required: [],
    });
  }
  body(
    "/imports/students/preview",
    "post",
    object({ termId: uuid, file: { type: "string", format: "binary" } }, [
      "termId",
      "file",
    ]),
    "multipart/form-data",
  );
  body("/imports/{id}/confirm", "post", "ImportConfirmInput");
  query("/terms", [
    { name: "page", type: "integer" },
    { name: "pageSize", type: "integer" },
    { name: "limit", type: "integer" },
    { name: "search" },
    { name: "status" },
    { name: "semesterId" },
    { name: "trainingSystemId" },
    { name: "academicYear" },
  ]);
  query("/terms/latest", [
    { name: "semesterId", required: true },
    { name: "trainingSystemId", required: true },
  ]);
  query("/terms/{id}/operation-window", [
    {
      name: "phaseCode",
      required: true,
      enum: [
        "REGISTRATION",
        "ASSIGNMENT",
        "PROPOSAL",
        "PROPOSAL_REVIEW",
        "WEEKLY",
        "FINAL",
        "DEFENSE",
      ],
    },
  ]);
  query("/semesters", [{ name: "academicYear" }, { name: "search" }]);
  for (const path of ["/students", "/lecturers"])
    query(path, [
      { name: "page", type: "integer" },
      { name: "pageSize", type: "integer" },
      { name: "limit", type: "integer" },
      { name: "search" },
      { name: "termId" },
      { name: path === "/students" ? "trainingSystemId" : "departmentId" },
      { name: path === "/students" ? "academicEligible" : "researchAreaId" },
      { name: "isActive", enum: ["true", "false"] },
      ...(path === "/students" ? [{ name: "className" }] : []),
    ]);
  for (const item of Object.values(document.paths))
    for (const method of ["get", "post", "put", "patch"]) {
      const op = (item as Record<string, OperationObject>)[method];
      if (!op) continue;
      const status = method === "post" ? "201" : "200";
      op.responses = {
        ...op.responses,
        [status]: {
          description: "ApiResponse thành công; data theo hợp đồng Bước 1.",
          content: { "application/json": { schema: ref("ApiResult") } },
        },
        ...Object.fromEntries(
          [400, 401, 403, 404, 409, 413, 422].map((code) => [
            code,
            {
              description:
                code === 403
                  ? "Không đủ quyền / bắt buộc đổi mật khẩu"
                  : "Lỗi validation hoặc nghiệp vụ",
              content: { "application/json": { schema: ref("ApiError") } },
            },
          ]),
        ),
      };
    }
  const template = operation("/imports/students/template", "get");
  if (template) {
    template.parameters = [
      {
        in: "query",
        name: "format",
        schema: { type: "string", enum: ["csv", "xlsx"], default: "csv" },
      },
    ];
    template.responses["200"] = {
      description: "Tệp mẫu mở được bằng Excel; mã SV định dạng text.",
      content: {
        "text/csv": { schema: { type: "string", format: "binary" } },
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
          schema: { type: "string", format: "binary" },
        },
      },
    };
  }
  return describeStep2(describeStep1Responses(document, prefix), prefix);
}
