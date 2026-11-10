import { z } from "zod";
import { ScheduleSaveSchema } from "./defense-scheduling";
export const SchedulePreviewSchema = z
  .object({
    sessionId: z.string().trim().min(1).max(36).nullable(),
    body: ScheduleSaveSchema,
  })
  .strict();
