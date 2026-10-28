/** Final PDF submission is independent of the UC17 frontend flag. */
export function finalReportMode(): "DEMO" | "API" | "CONFIGURATION_ERROR" {
  if (import.meta.env.VITE_FINAL_REPORT_API !== "true") return "DEMO";
  return import.meta.env.VITE_AUTH_API === "true"
    ? "API"
    : "CONFIGURATION_ERROR";
}

export const finalReportApiEnabled = () => finalReportMode() !== "DEMO";
