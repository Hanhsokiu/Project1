"use strict";
const crypto = require("node:crypto");
const manifest = require("../../docs/demo-data-v3/demo-manifest.json");
const namespace = "UTC_PROJECT1_DEMO_V3";
function id(key) {
  const bytes = crypto
    .createHash("sha256")
    .update(`${namespace}/${manifest.seed}/${key}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 15) | 80;
  bytes[8] = (bytes[8] & 63) | 128;
  return bytes
    .toString("hex")
    .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
}
const date = (value) =>
  value instanceof Date
    ? new Date(value)
    : new Date(value.includes("T") ? value : value + "T08:00:00+07:00");
const plus = (value, days) => new Date(date(value).getTime() + days * 86400000);
const areas = ["Phần mềm", "Game", "Kiểm thử", "Học máy", "Mạng"];
const students = Array.from({ length: 84 }, (_, i) => ({
  n: i + 1,
  id: id(`student/${i + 1}`),
  userId: id(`user/sv/${i + 1}`),
  username: `demo3_sv${String(i + 1).padStart(3, "0")}`,
  name: `Sinh viên mô phỏng ${String(i + 1).padStart(3, "0")}`,
  gpa: (2.1 + ((i * 17) % 190) / 100).toFixed(2),
}));
const lecturers = Array.from({ length: 18 }, (_, i) => ({
  n: i + 1,
  id: id(`lecturer/${i + 1}`),
  userId: id(`user/gv/${i + 1}`),
  username: `demo3_gv${String(i + 1).padStart(2, "0")}`,
  name: `Giảng viên mô phỏng ${String(i + 1).padStart(2, "0")}`,
}));
const terms = [
  {
    key: "march",
    code: "DEMO-2026-03",
    start: "2026-03-01",
    end: "2026-08-01",
    year: "2025-2026",
    semester: 2,
    registration: ["2026-03-01", "2026-03-08"],
    assignment: ["2026-03-08", "2026-03-10"],
    proposal: ["2026-03-10", "2026-03-30"],
    guidance: ["2026-03-30", "2026-06-23"],
    final: ["2026-06-23", "2026-07-01"],
    defense: ["2026-07-01", "2026-08-01"],
    studentNumbers: Array.from({ length: 76 }, (_, i) => i + 1),
    weeks: 12,
  },
  {
    key: "october",
    code: "DEMO-2026-10",
    start: "2026-09-21",
    end: "2027-02-01",
    year: "2026-2027",
    semester: 1,
    registration: ["2026-09-21", "2026-09-28"],
    assignment: ["2026-09-28", "2026-09-30"],
    proposal: ["2026-09-30", "2026-10-12"],
    guidance: ["2026-10-12", "2027-01-05"],
    final: ["2027-01-05", "2027-01-15"],
    defense: ["2027-01-15", "2027-02-01"],
    studentNumbers: [74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84],
    weeks: 6,
  },
].map((t) => ({ ...t, id: id(`term/${t.key}`) }));
function participants(term) {
  return term.studentNumbers.map((n, index) => ({
    student: students[n - 1],
    index,
    key: `${term.key}/${n}`,
    term,
    advisor: lecturers[index % 18],
    areaIndex: index % 5,
    repeat: n >= 74 && n <= 76,
    latest:
      term.key === "october"
        ? [
            "PASS",
            "PASS",
            "PASS",
            "PASS",
            "PASS",
            "REVISION_REQUIRED",
            "REVISION_REQUIRED",
            "REVISION_REQUIRED",
            "OVERDUE",
            "OVERDUE",
            "PENDING_REVIEW",
          ][index]
        : "PASS",
    // Early/late deferral is a requested scenario, not an asserted producer decision.
    requestedOutcome:
      term.key === "march"
        ? index < 60
          ? "SCORED"
          : index < 71
            ? "DEFER_BEFORE_SCHEDULE"
            : "DEFER_AFTER_SCHEDULE"
        : "IN_PROGRESS",
  }));
}
const canonical = (value) =>
  JSON.stringify(value, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, v[k]]),
        )
      : v,
  );
const hash = (value) =>
  crypto
    .createHash("sha256")
    .update(
      typeof value === "string" || Buffer.isBuffer(value)
        ? value
        : canonical(value),
    )
    .digest("hex");
module.exports = {
  namespace,
  manifest,
  id,
  date,
  plus,
  areas,
  students,
  lecturers,
  terms,
  participants,
  canonical,
  hash,
};
