import { z } from "zod";
export const reviewTermSchema = z
  .object({ termId: z.string().trim().min(1).max(36) })
  .strict();
export const reviewQuerySchema = z
  .object({
    termId: z.string().trim().min(1).max(36),
    view: z.enum(["ADVISOR", "STUDENT", "FACULTY"]).default("ADVISOR"),
    status: z
      .enum(["ALL", "PENDING", "CONFIRMED", "REJECTED", "UNKNOWN"])
      .default("ALL"),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();
export const previewQuerySchema = reviewQuerySchema
  .pick({ page: true, limit: true })
  .extend({
    result: z
      .enum([
        "ALL",
        "NOT_APPROVED",
        "WAITING_ADVISOR",
        "REVIEW_REQUIRED",
        "ACADEMIC_UNVERIFIED",
      ])
      .default("ALL"),
  })
  .strict();
export type ReviewQuery = z.infer<typeof reviewQuerySchema>;
export type PreviewQuery = z.infer<typeof previewQuerySchema>;
export const UC18_BLOCKERS = [
  {
    code: "METADATA_PREVIEW_ONLY",
    message:
      "Endpoint này chỉ đối soát metadata, không xét chứng cứ học vụ thủ công. Dùng workflow chính thức để xem eligibility đã xác minh, policy, capability và chốt/mở lại.",
  },
] as const;
