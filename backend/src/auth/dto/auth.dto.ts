import { z } from "zod";
export const LoginSchema = z
  .object({
    username: z.string().trim().min(1).max(100),
    password: z.string().min(1).max(200),
  })
  .strict();
export const ChangePasswordSchema = z
  .object({
    oldPassword: z.string().min(1).max(200),
    newPassword: z.string().min(8).max(128),
  })
  .strict();
export const RefreshSchema = z
  .object({ refreshToken: z.string().min(20) })
  .strict();
export const ProfileSchema = z
  .object({
    name: z.string().trim().min(3).max(200),
    email: z.union([z.string().email(), z.literal(""), z.null()]).optional(),
    phone: z
      .union([z.string().regex(/^(0|\+84)[0-9]{9,10}$/), z.literal("")])
      .optional(),
  })
  .strict();
