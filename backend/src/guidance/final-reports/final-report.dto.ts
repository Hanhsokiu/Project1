import { z } from "zod";
import { HttpException } from "@nestjs/common";

export function reportError(
  status: number,
  code: string,
  message: string,
): never {
  throw new HttpException({ error: { code, message } }, status);
}
export const finalReportIdSchema = z.string().trim().min(1).max(100);
export const finalReportMultipartSchema = z
  .object({
    expectedRevision: z.preprocess(
      (value) =>
        typeof value === "string" && /^(0|[1-9]\d*)$/.test(value)
          ? Number(value)
          : value,
      z.number().int().min(0).max(2147483646),
    ),
  })
  .strict();
export const FINAL_REPORT_KEY =
  /^final-reports\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export type FinalReportAction = "read" | "create" | "download";
