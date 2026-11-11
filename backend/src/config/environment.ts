import { z } from "zod";
import { readSubmissionPolicy } from "../guidance/submissions/submission-policy";

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
    STORAGE_GUIDANCE_DRIVER: z.enum(["local", "supabase"]).default("local"),
    STORAGE_SUPABASE_URL: z.string().optional(),
    STORAGE_SUPABASE_BUCKET: z.string().optional(),
    STORAGE_SUPABASE_SERVICE_KEY: z.string().optional(),
    GUIDANCE_UPLOAD_ENABLED: z.enum(["true", "false"]).default("true"),
    UC17_WRITES_ENABLED: z.enum(["true", "false"]).default("false"),
    UC18_WRITES_ENABLED: z.enum(["true", "false"]).default("false"),
    UC19_WRITES_ENABLED: z.enum(["true", "false"]).default("false"),
    UC20_WRITES_ENABLED: z.enum(["true", "false"]).default("false"),
    UC21_WRITES_ENABLED: z.enum(["true", "false"]).default("false"),
    UC22_WRITES_ENABLED: z.enum(["true", "false"]).default("false"),
    UC23_WRITES_ENABLED: z.enum(["true", "false"]).default("false"),
    UC24_WRITES_ENABLED: z.enum(["true", "false"]).default("false"),
    UC25_WRITES_ENABLED: z.enum(["true", "false"]).default("false"),
    UC25_MAX_ROWS: z.coerce.number().int().min(1).max(500).default(100),
    UC25_MAX_TEXT_CHARS: z.coerce
      .number()
      .int()
      .min(1000)
      .max(1000000)
      .default(200000),
    UC25_MAX_CANDIDATES: z.coerce.number().int().min(1).max(5000).default(1000),
    UC25_MAX_BYTES: z.coerce
      .number()
      .int()
      .min(1024)
      .max(50 * 1024 * 1024)
      .default(10 * 1024 * 1024),
    UC25_MAX_ACTIVE_RENDERS: z.coerce.number().int().min(1).max(4).default(2),
    UC25_RENDER_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1000)
      .max(120000)
      .default(30000),
    GUIDANCE_UPLOAD_POLICY_JSON: z
      .string()
      .optional()
      .refine((value) => {
        try {
          readSubmissionPolicy(value);
          return true;
        } catch {
          return false;
        }
      }, "Invalid guidance file policy"),
  })
  .passthrough()
  .superRefine((env, context) => {
    if (env.STORAGE_GUIDANCE_DRIVER !== "supabase") return;
    let validOrigin = false;
    try {
      const url = new URL(env.STORAGE_SUPABASE_URL ?? "");
      validOrigin =
        url.protocol === "https:" &&
        !!url.hostname &&
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash &&
        (url.pathname === "/" || url.pathname === "");
    } catch {
      /* Report the key only, never its supplied value. */
    }
    for (const [key, valid] of [
      ["STORAGE_SUPABASE_URL", validOrigin],
      [
        "STORAGE_SUPABASE_BUCKET",
        /^[a-z0-9][a-z0-9_-]{0,62}$/.test(env.STORAGE_SUPABASE_BUCKET ?? ""),
      ],
      [
        "STORAGE_SUPABASE_SERVICE_KEY",
        !!env.STORAGE_SUPABASE_SERVICE_KEY?.trim() &&
          !/^(REPLACE_|GENERATE_|YOUR_)/.test(env.STORAGE_SUPABASE_SERVICE_KEY),
      ],
    ] as const) {
      if (!valid)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: "Private storage configuration is incomplete",
        });
    }
  });

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
