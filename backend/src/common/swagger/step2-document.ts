import type { OpenAPIObject } from "@nestjs/swagger";
import type { SchemaObject } from "@nestjs/swagger/dist/interfaces/open-api-spec.interface";

export function describeStep2(document: OpenAPIObject, prefix = "api") {
  const uuid = { type: "string", format: "uuid" } as const;
  const date = { type: "string", format: "date-time" } as const;
  const registration: SchemaObject = {
    type: "object",
    additionalProperties: false,
    required: [
      "id",
      "termId",
      "studentId",
      "directionId",
      "status",
      "legacyStatus",
      "submittedAt",
      "updatedAt",
      "note",
      "preferences",
    ],
    properties: {
      id: uuid,
      termId: uuid,
      studentId: uuid,
      directionId: { ...uuid, nullable: true },
      status: { type: "string", enum: ["DRAFT", "SUBMITTED"] },
      legacyStatus: {
        type: "string",
        nullable: true,
        description:
          "Trạng thái cũ được giữ lại; cần SV xác nhận hướng và nộp lại.",
      },
      note: { type: "string" },
      submittedAt: { ...date, nullable: true },
      updatedAt: date,
      preferences: {
        type: "array",
        maxItems: 3,
        items: {
          type: "object",
          required: ["lecturerId", "preferenceOrder"],
          properties: {
            lecturerId: uuid,
            preferenceOrder: { type: "integer", minimum: 1, maximum: 3 },
          },
        },
      },
    },
  };
  document.components ??= {};
  document.components.schemas ??= {};
  document.components.schemas.RegistrationResponse = registration;
  const ref = { $ref: "#/components/schemas/RegistrationResponse" };
  const list: SchemaObject = {
    type: "object",
    required: ["items", "stats"],
    properties: {
      items: { type: "array", items: ref },
      stats: {
        type: "object",
        required: ["total", "draft", "submitted"],
        properties: {
          total: { type: "integer" },
          draft: { type: "integer" },
          submitted: { type: "integer" },
        },
      },
    },
  };
  const context: SchemaObject = {
    type: "object",
    required: ["registration", "window", "directions", "lecturerIds"],
    properties: {
      registration: { ...registration, nullable: true },
      window: {
        allOf: [{ $ref: "#/components/schemas/OperationWindowResponse" }],
      },
      directions: {
        type: "array",
        items: { $ref: "#/components/schemas/ResearchAreaResponse" },
      },
      lecturerIds: { type: "array", items: uuid },
    },
  };
  for (const [route, method, schema] of [
    ["/registrations", "get", list],
    ["/registrations/term/{termId}", "get", list],
    ["/registrations/term/{termId}/me", "get", context],
    ["/registrations/term/{termId}/me/draft", "put", ref],
    ["/registrations/term/{termId}/me/submit", "post", ref],
  ] as const) {
    const operation = document.paths[`/${prefix}${route}`]?.[method];
    if (!operation) continue;
    operation.responses[method === "post" ? "201" : "200"] = {
      description: "Dữ liệu PostgreSQL; studentId lấy từ phiên đăng nhập.",
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["success", "data", "timestamp"],
            properties: {
              success: { type: "boolean", enum: [true] },
              data: schema,
              timestamp: date,
            },
          },
        },
      },
    };
    for (const status of [400, 401, 403, 404, 409, 422])
      operation.responses[String(status)] = {
        description:
          "Validation, quyền, onboarding hoặc cửa sổ đăng ký không hợp lệ.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ApiError" },
          },
        },
      };
  }
  return document;
}
