"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  id,
  students,
  lecturers,
  phases,
  week,
  day,
} = require("./definition.cjs");
const {
  validatePhasePlan,
} = require("../../backend/dist/term/validator/term-configuration.validator");
const anchor = Date.parse("2026-11-05T03:00:00Z");
test("sample stages obey the actual canonical phase validator", () => {
  for (const stage of ["REGISTRATION", "ASSIGNMENT", "PROPOSAL", "WEEKLY"]) {
    const plan = phases(anchor, stage);
    validatePhasePlan(
      plan,
      new Date(anchor - 61 * day),
      new Date(anchor + 131 * day),
    );
    const current = plan.find((p) => p.code === stage);
    assert(
      new Date(current.start).getTime() < anchor &&
        new Date(current.end).getTime() > anchor,
    );
  }
});
test("identifiers are stable and people have balanced valid advisors", () => {
  const keys = [...students, ...lecturers].flatMap((p) => [
    p.key,
    "user/" + p.key,
  ]);
  assert.equal(new Set(keys.map(id)).size, keys.length);
  assert.equal(id("sv01"), id("sv01"));
  assert.notEqual(id("sv01"), id("user/sv01"));
  for (const lecturer of lecturers)
    assert.equal(students.filter((s) => s.advisor === lecturer.key).length, 3);
});
test("weekly periods have ordered dates and are within guidance", () => {
  const guidance = phases(anchor, "WEEKLY").find((p) => p.code === "WEEKLY");
  for (let n = 1; n <= 4; n++) {
    const w = week(anchor, n);
    assert(new Date(w.startsAt) >= new Date(guidance.start));
    assert(new Date(w.startsAt) < new Date(w.reportDueAt));
    assert(new Date(w.reportDueAt) < new Date(w.endsAt));
    assert(new Date(w.endsAt) < new Date(guidance.end));
    if (n > 1) assert.equal(week(anchor, n - 1).endsAt, w.startsAt);
  }
  assert(new Date(week(anchor, 1).reportDueAt).getTime() < anchor);
  assert(new Date(week(anchor, 2).reportDueAt).getTime() > anchor);
});
