import { z } from "zod";
import { ScheduleSourceBindingSchema } from "@doan/shared";
import type { ScheduleSlot } from "@doan/shared";
import type { Booking } from "./schedule-engine";
const id = z.string().min(1).max(36),
  hash = z.string().regex(/^[a-f0-9]{64}$/),
  instant = z.string().datetime();
const slot = z
  .object({
    termStudentId: id,
    proposalId: id,
    studentId: id,
    studentCode: z.string(),
    studentName: z.string(),
    advisorId: id,
    order: z.number().int().positive(),
    startAt: instant,
    endAt: instant,
    reviewerIds: z.array(id),
  })
  .strict();
const context = z
  .object({
    origin: z.literal("UC21"),
    source: ScheduleSourceBindingSchema,
    policyVersion: z.string().min(1),
    policyHash: hash,
    evidenceHash: hash,
    roomFactHash: hash,
    slots: z.array(slot).min(1).max(200),
    automaticOrder: z.array(id),
    manualOrder: z.boolean(),
    memberIds: z.array(id).min(3).max(5),
    booking: z
      .object({
        id,
        committeeId: id,
        roomId: id,
        start: z.number().finite(),
        end: z.number().finite(),
        lecturers: z.array(
          z
            .object({
              lecturerId: id,
              start: z.number().finite(),
              end: z.number().finite(),
            })
            .strict(),
        ),
        students: z.array(
          z
            .object({
              proposalId: id,
              studentId: id,
              start: z.number().finite(),
              end: z.number().finite(),
            })
            .strict(),
        ),
      })
      .strict(),
  })
  .strict();
export type ScheduleContext = {
  origin: "UC21";
  source: z.infer<typeof ScheduleSourceBindingSchema>;
  policyVersion: string;
  policyHash: string;
  evidenceHash: string;
  roomFactHash: string;
  slots: ScheduleSlot[];
  automaticOrder: string[];
  manualOrder: boolean;
  memberIds: string[];
  booking: Booking;
};
export function scheduleContext(raw: unknown): ScheduleContext | null {
  const parsed = context.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
