export function vietnamInstant(value: string, end = false) {
  if (value.length === 10)
    return `${value}T${end ? "23:59:59.999" : "00:00:00"}+07:00`;
  return /[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}+07:00`;
}

/** datetime-local value in Vietnam time, preserving seconds and milliseconds. */
export function vietnamDateTime(value: string) {
  if (value.length === 10) return `${value}T00:00`;
  if (!/[zZ]|[+-]\d\d:\d\d$/.test(value)) return value;
  const instant = new Date(value);
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone:"Asia/Ho_Chi_Minh", year:"numeric",month:"2-digit",day:"2-digit",
    hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23",
  }).formatToParts(instant);
  const p = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)!.value;
  const local = `${p("year")}-${p("month")}-${p("day")}T${p("hour")}:${p("minute")}`;
  const ms = instant.getUTCMilliseconds();
  return p("second") === "00" && !ms ? local : `${local}:${p("second")}${ms ? "."+String(ms).padStart(3,"0") : ""}`;
}
