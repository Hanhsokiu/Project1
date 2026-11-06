import { z } from "zod";

export const RegistrationWriteSchema = z
  .object({
    directionId: z.string().uuid().nullable().optional().default(null),
    preferences: z
      .array(
        z
          .object({
            lecturerId: z.string().uuid(),
            preferenceOrder: z.number().int().min(1).max(3),
          })
          .strict(),
      )
      .max(3)
      .default([]),
    note: z.string().trim().max(3000).default(""),
    email: z.string().trim().email().max(254).optional(),
    phone: z
      .string()
      .trim()
      .regex(/^(0|\+84)[0-9]{9,10}$/)
      .optional(),
  })
  .strict();
export type RegistrationWrite = z.infer<typeof RegistrationWriteSchema>;
