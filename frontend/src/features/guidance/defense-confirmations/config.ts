/** Independent opt-in. Authentication must also use the real JWT API. */
export function defenseConfirmationMode():
  "DEMO" | "API" | "CONFIGURATION_ERROR" {
  if (import.meta.env.VITE_DEFENSE_CONFIRMATION_API !== "true") return "DEMO";
  return import.meta.env.VITE_AUTH_API === "true"
    ? "API"
    : "CONFIGURATION_ERROR";
}

export const defenseConfirmationApiEnabled = () =>
  defenseConfirmationMode() !== "DEMO";
