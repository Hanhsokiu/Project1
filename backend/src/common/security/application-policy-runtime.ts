import { validateFinalResultPolicy } from "@doan/shared";

const acceptanceMarker = /PROJECT_ACCEPTANCE_ONLY|PROJECT_ACCEPTANCE_TEST|DATN-E2E-B1B10-TEST|^TEST_ONLY(?:$|[_; ,])/i;

function hasAcceptanceMetadata(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasAcceptanceMetadata);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, field]) =>
    (["version", "reference", "status", "owner"].includes(key) &&
      typeof field === "string" && acceptanceMarker.test(field)) ||
    (field !== null && typeof field === "object" && hasAcceptanceMetadata(field)),
  );
}

/** TEST policy approval never authorizes use against a shared database. */
export function applicationPolicyRuntimeAllowed(
  policy: unknown,
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  try {
    if (!hasAcceptanceMetadata(policy)) return true;
    if (environment.NODE_ENV !== "test") return false;
    const target = new URL(environment.DATABASE_URL ?? "");
    return (
      ["postgres:", "postgresql:"].includes(target.protocol) &&
      target.hostname === "127.0.0.1" &&
      /^\/btl_pr2b_acceptance_[a-z0-9_]+$/.test(target.pathname)
    );
  } catch {
    return false;
  }
}

/** UC24 uses the shared calculation validator rather than a validator class. */
export function readRuntimeFinalResultPolicy(raw: unknown) {
  if (!applicationPolicyRuntimeAllowed(raw))
    throw new Error("TEST_POLICY_OUTSIDE_ISOLATED_STAGING");
  return validateFinalResultPolicy(raw);
}
