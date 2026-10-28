import { z } from "zod";
import type { ConfirmationContext, DecisionInput } from "./types";

const id = z.string().trim().min(1).max(36);
const revision = z.number().int().min(0).max(2147483647);
export const pdfIdentitySchema = z
  .object({
    finalReportId: id,
    revision: revision.min(1),
    checksum: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict();
export const decisionInputSchema = z
  .object({
    status: z.enum(["CONFIRMED", "REJECTED"]),
    note: z.string().trim().max(10000).nullable().optional(),
    expectedRevision: revision.max(2147483646),
    expectedContext: z
      .object({
        revision,
        assignment: z.object({ assignmentId: id, revision }).strict(),
        pdf: pdfIdentitySchema.extend({ revision }).nullable(),
      })
      .strict(),
    changeReason: z.string().trim().min(1).max(10000).optional(),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (input.status === "REJECTED" && !input.note?.trim())
      ctx.addIssue({
        code: "custom",
        path: ["note"],
        message: "Từ chối phải có lý do.",
      });
    if (input.expectedRevision !== input.expectedContext.revision)
      ctx.addIssue({
        code: "custom",
        path: ["expectedContext"],
        message: "Revision context không khớp.",
      });
  });

export type DecisionForm = {
  status: DecisionInput["status"];
  note: string;
  changeReason: string;
  reviewed: boolean;
};
export function buildDecisionInput(
  context: ConfirmationContext,
  form: DecisionForm,
): DecisionInput {
  if (!form.reviewed)
    throw new Error(
      "Hãy xem lại hồ sơ và PDF hiện hành trước khi gửi quyết định.",
    );
  const gate =
    form.status === "CONFIRMED"
      ? context.readiness.confirm
      : context.readiness.reject;
  if (!context.permissions.canDecide || !gate.allowed)
    throw new Error(
      gate.blockers.map((b) => b.message).join(" ") ||
        "Bạn không thể ghi quyết định trong context hiện tại.",
    );
  if (context.changeReasonRequiredForChanges && !form.changeReason.trim())
    throw new Error("Thay đổi quyết định đã có phải nhập lý do thay đổi.");
  const result = decisionInputSchema.safeParse({
    status: form.status,
    note: form.note,
    expectedRevision: context.expectedRevision,
    // Copy the backend assertion directly. Never derive it from demo/assignment/PDF fields.
    expectedContext: context.expectedContext,
    ...(form.changeReason.trim() ? { changeReason: form.changeReason } : {}),
  });
  if (!result.success)
    throw new Error(result.error.issues.map((i) => i.message).join(" "));
  return result.data;
}

/** A UI review marker only, never sent as expectedContext or an authority token. */
export const contextReviewKey = (context: ConfirmationContext) =>
  JSON.stringify([
    context.proposal.id,
    context.asOf,
    context.expectedRevision,
    context.expectedContext,
    context.window,
    context.uc18,
    context.permissions,
    context.readiness,
  ]);
