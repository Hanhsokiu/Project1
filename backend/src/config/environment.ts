import { z } from "zod";

const postgresUrl = z.string().refine((value) => {
  try {
    const url = new URL(value);
    return (
      ["postgres:", "postgresql:"].includes(url.protocol) &&
      !!url.hostname &&
      url.pathname.length > 1 &&
      ((!url.hostname.endsWith(".supabase.co") &&
        !url.hostname.endsWith(".supabase.com")) ||
        url.searchParams.get("sslmode") === "require")
    );
  } catch {
    return false;
  }
}, "Expected PostgreSQL URL; Supabase requires sslmode=require");

const schema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    ACCOUNT_PASSWORD_ENCRYPTION_KEY: z
      .string()
      .regex(/^[a-f0-9]{64}$/i)
      .optional(),
    DATABASE_URL: postgresUrl,
    DIRECT_URL: postgresUrl,
    JWT_SECRET: z
      .string()
      .min(16)
      .refine((v) => !/^(REPLACE_|GENERATE_)/.test(v)),
    JWT_REFRESH_SECRET: z
      .string()
      .min(16)
      .refine((v) => !/^(REPLACE_|GENERATE_)/.test(v)),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    API_PREFIX: z
      .string()
      .regex(/^[a-zA-Z0-9/_-]+$/)
      .default("api"),
    FRONTEND_URL: z
      .string()
      .refine(
        (value) =>
          value.split(",").every((origin) => {
            try {
              const url = new URL(origin.trim());
              return (
                ["http:", "https:"].includes(url.protocol) &&
                !url.username &&
                !url.password
              );
            } catch {
              return false;
            }
          }),
        "Expected comma-separated HTTP(S) origins",
      )
      .default("http://localhost:5173"),
    MAIL_PORT: z.coerce.number().int().min(1).max(65535).default(1025),
    STORAGE_MAX_SIZE_MB: z.coerce.number().positive().default(50),
    ASSIGNMENT_WORKER_ENABLED: z.enum(["true", "false"]).optional(),
  })
  .passthrough();

export function validateEnvironment(input: Record<string, unknown>) {
  const result = schema.safeParse(input);
  if (!result.success) {
    // Never include raw env values, URL credentials or secret keys in errors.
    throw new Error(
      `Invalid backend configuration: ${result.error.issues.map((i) => i.path.join(".")).join(", ")}`,
    );
  }
  return result.data;
}
