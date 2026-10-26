import type { OpenAPIObject } from "@nestjs/swagger";
import type { SchemaObject } from "@nestjs/swagger/dist/interfaces/open-api-spec.interface";
export function describeStep3(document: OpenAPIObject, prefix = "api") {
  const revision: SchemaObject = { type: "integer", minimum: 0 };
  const content: SchemaObject = {
    type: "object",
    additionalProperties: false,
    required: [
      "title",
      "objectives",
      "scope",
      "technology",
      "expected",
      "plan",
    ],
    properties: {
      title: { type: "string", minLength: 5, maxLength: 500 },
      objectives: { type: "string", maxLength: 15000 },
      scope: { type: "string", maxLength: 20000 },
      technology: { type: "string", maxLength: 10000 },
      expected: { type: "string", maxLength: 15000 },
      plan: {
        type: "array",
        maxItems: 100,
        items: {
          type: "object",
          required: ["week", "content"],
          properties: {
            week: { type: "string", maxLength: 100 },
            content: { type: "string", maxLength: 3000 },
          },
        },
      },
    },
  };
  const run: SchemaObject = {
    type: "object",
    additionalProperties: false,
    required: ["revision"],
    properties: {
      revision,
      mode: {
        type: "string",
        enum: ["remaining", "all"],
        default: "remaining",
      },
      confirmed: { type: "boolean", default: false },
      inputHash: {
        type: "string",
        description: "SHA256 from preview; required to save draft",
      },
    },
  };
  document.components ??= {};
  document.components.schemas ??= {};
  Object.assign(document.components.schemas, {
    Step3ProposalContent: content,
    Step3Run: run,
  });
  for (const [url, path] of Object.entries(document.paths)) {
    if (
      !url.startsWith(`/${prefix}/assignments/`) &&
      !url.startsWith(`/${prefix}/topics/`) &&
      !url.startsWith(`/${prefix}/notifications/`)
    )
      continue;
    for (const method of ["get", "post", "put", "patch"] as const) {
      const op = path?.[method];
      if (!op) continue;
      op.responses = {
        ...op.responses,
        "401": { description: "Authentication/password onboarding required" },
        "403": {
          description:
            "Insufficient permission, unpublished result or wrong owner",
        },
        "409": {
          description:
            "Closed/locked phase, stale revision, immutable record or concurrent update",
        },
        "422": {
          description:
            "Invalid registration, direction, quota or incomplete proposal",
        },
      };
      let schema: SchemaObject | undefined;
      if (
        url.endsWith("/preview") ||
        (url.endsWith("/draft") && url.includes("/assignments/"))
      )
        schema = run;
      else if (url.endsWith("/manual"))
        schema = {
          type: "object",
          additionalProperties: false,
          required: ["studentId", "lecturerId", "reason", "revision"],
          properties: {
            studentId: { type: "string", format: "uuid" },
            lecturerId: { type: "string", format: "uuid" },
            reason: { type: "string", minLength: 10, maxLength: 3000 },
            revision,
          },
        };
      else if (url.endsWith("/publish"))
        schema = {
          type: "object",
          required: ["revision"],
          properties: { revision },
        };
      else if (url.endsWith("/agree"))
        schema = {
          type: "object",
          required: ["agreed", "expectedVersion"],
          properties: {
            agreed: { type: "boolean" },
            expectedVersion: revision,
          },
        };
      else if (
        url.includes("/topics/") &&
        (url.endsWith("/draft") || url.endsWith("/submit"))
      )
        schema = {
          type: "object",
          additionalProperties: false,
          required: ["content", "expectedVersion"],
          properties: {
            content: { $ref: "#/components/schemas/Step3ProposalContent" },
            expectedVersion: revision,
          },
        };
      if (schema)
        op.requestBody = {
          required: true,
          content: { "application/json": { schema } },
        };
      if (url.endsWith("/pdf"))
        op.responses["200"] = {
          description:
            "A saved immutable version, Vietnamese fonts, draft/official label",
          content: {
            "application/pdf": { schema: { type: "string", format: "binary" } },
          },
        };
    }
  }
  return document;
}
