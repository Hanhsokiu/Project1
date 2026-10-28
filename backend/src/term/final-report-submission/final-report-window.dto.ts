import { z } from "zod";
import type { FinalReportSubmissionWindow } from "@prisma/client";

export const FINAL_REPORT_SUBMISSION = "FINAL_REPORT_SUBMISSION";
export const finalReportWindowParamsSchema = z
  .object({ termId: z.string().trim().min(1).max(100) })
  .strict();
const instant = z
  .string()
  .datetime({ offset: true })
  .refine(
    (value) => Number.isFinite(new Date(value).getTime()),
    "Thời điểm không hợp lệ.",
  );
export const finalReportWindowPutSchema = z
  .object({
    opensAt: instant,
    closesAt: instant,
    locked: z.boolean(),
    expectedRevision: z.number().int().min(0).max(2147483646),
  })
  .strict();
export type FinalReportWindowPut = z.infer<typeof finalReportWindowPutSchema>;
export type FinalReportWindowParams = z.infer<
  typeof finalReportWindowParamsSchema
>;
export type FinalReportWindowResponse = {
  code: typeof FINAL_REPORT_SUBMISSION;
  termId: string;
  configured: boolean;
  revision: number;
  window: {
    opensAt: string;
    closesAt: string;
    locked: boolean;
    createdAt: string;
    updatedAt: string;
  } | null;
};
export function finalReportWindowResponse(
  termId: string,
  row: FinalReportSubmissionWindow | null,
): FinalReportWindowResponse {
  return {
    code: FINAL_REPORT_SUBMISSION,
    termId,
    configured: row !== null,
    revision: row?.revision ?? 0,
    window: row
      ? {
          opensAt: row.opensAt.toISOString(),
          closesAt: row.closesAt.toISOString(),
          locked: row.isLocked,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        }
      : null,
  };
}
