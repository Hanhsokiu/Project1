import type { OpenAPIObject } from "@nestjs/swagger";
import type { SchemaObject } from "@nestjs/swagger/dist/interfaces/open-api-spec.interface";
const text: SchemaObject = { type: "string" };
const count: SchemaObject = { type: "integer", minimum: 0, maximum: 500 };
const object = (
  properties: Record<string, SchemaObject>,
  required = Object.keys(properties),
): SchemaObject => ({
  type: "object",
  additionalProperties: false,
  properties,
  required,
});
export function describeQuotas(document: OpenAPIObject, prefix: string) {
  const factors = object(
    Object.fromEntries(
      ["MASTER", "DOCTOR", "ASSOCIATE_PROFESSOR", "PROFESSOR"].map((k) => [
        k,
        {
          type: "number",
          exclusiveMinimum: true,
          minimum: 0,
          maximum: 10,
          multipleOf: 0.0001,
        } as SchemaObject,
      ]),
    ),
  );
  const settings = object({
    basis: { ...text, enum: ["ROSTER", "SUBMITTED"] },
    defaultLimit: count,
    factors,
  });
  const member = object({
    lecturerId: text,
    code: text,
    name: text,
    academicDegree: { ...text, nullable: true },
    academicRank: text,
    coefficient: { type: "number" },
    maxQuota: count,
    currentCount: count,
    idealQuota: { type: "number" },
    suggestedQuota: count,
    quota: count,
    reason: text,
  });
  const policy = object({
    version: { type: "integer", enum: [1] },
    revision: { type: "integer", minimum: 0 },
    status: { ...text, enum: ["DRAFT", "APPROVED"] },
    settings,
    members: { type: "array", items: member },
    demandCount: { type: "integer", minimum: 0 },
    demandStudentIds: { type: "array", items: text },
    totalCoefficient: { type: "number" },
    averageCoefficient: { type: "number" },
    shortage: { type: "integer", minimum: 0 },
    warnings: { type: "array", items: text },
    inputSignature: text,
    rosterSignature: text,
    updatedAt: text,
    updatedBy: text,
    approvedAt: { ...text, nullable: true },
  });
  document.components ??= {};
  document.components.schemas ??= {};
  document.components.schemas.QuotaPolicy = policy;
  const inputs = {
    preview: object({
      revision: { type: "integer", minimum: 0 },
      settings,
      limits: {
        type: "array",
        maxItems: 2000,
        items: object({ lecturerId: text, maxQuota: count }),
      },
    }),
    approve: object({
      revision: { type: "integer", minimum: 1 },
      members: {
        type: "array",
        maxItems: 2000,
        items: object(
          {
            lecturerId: text,
            quota: count,
            reason: { ...text, maxLength: 1000 },
          },
          ["lecturerId", "quota"],
        ),
      },
    }),
  };
  for (const command of ["preview", "approve"] as const) {
    const op = document.paths[`/${prefix}/terms/{id}/quotas/${command}`]?.post;
    if (!op) continue;
    op.summary =
      command === "preview"
        ? "Tính và lưu bản đề xuất chỉ tiêu (chưa đổi quota hiệu lực)"
        : "Chốt quota theo phiên bản đề xuất; kiểm tra lại dữ liệu và ghi audit cùng giao dịch";
    op.requestBody = {
      required: true,
      content: { "application/json": { schema: inputs[command] } },
    };
    op.responses["201"] = {
      description: "Chính sách chỉ tiêu đã lưu",
      content: {
        "application/json": {
          schema: object(
            {
              success: { type: "boolean" },
              data: { allOf: [{ $ref: "#/components/schemas/QuotaPolicy" }] },
              message: text,
              timestamp: text,
            },
            ["success", "data"],
          ),
        },
      },
    };
  }
  const termSchema = document.components.schemas.TermResponse as
    SchemaObject | undefined;
  if (termSchema?.properties) {
    termSchema.properties.quotaPolicy = {
      allOf: [{ $ref: "#/components/schemas/QuotaPolicy" }],
      nullable: true,
    };
    termSchema.properties.quotaReady = { type: "boolean" };
  }
  for (const name of ["LecturerInput", "LecturerResponse"]) {
    const schema = document.components.schemas[name] as
      SchemaObject | undefined;
    if (!schema?.properties) continue;
    schema.properties.academicDegree = {
      ...text,
      enum: ["MASTER", "DOCTOR"],
      nullable: true,
    };
    schema.properties.academicRank = {
      ...text,
      enum: ["NONE", "ASSOCIATE_PROFESSOR", "PROFESSOR"],
    };
    schema.properties.maxStudents = count;
  }
  return document;
}
