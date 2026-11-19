"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const d = require("./definition.cjs"),
  { safeTarget, database } = require("./local.cjs");
test("84 identities, 87 participations, exactly three shared students", () => {
  const a = d.participants(d.terms[0]),
    b = d.participants(d.terms[1]);
  assert.equal(d.students.length, 84);
  assert.equal(a.length + b.length, 87);
  assert.deepEqual(
    b
      .filter((x) => a.some((y) => x.student.id === y.student.id))
      .map((x) => x.student.n),
    [74, 75, 76],
  );
  assert.equal(new Set([...a, ...b].map((p) => p.student.id)).size, 84);
});
test("IDs deterministic and valid UUID with no identity collisions", () => {
  const ids = [...d.students, ...d.lecturers].flatMap((s) => [s.id, s.userId]);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(d.id("example"), d.id("example"));
  assert.match(
    d.id("example"),
    /^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,
  );
});
test("quota and requested weekly distribution", () => {
  for (const t of d.terms) {
    for (const l of d.lecturers)
      assert(
        d.participants(t).filter((p) => p.advisor.id === l.id).length <= 5,
      );
  }
  const statuses = d.participants(d.terms[1]).map((p) => p.latest);
  assert.deepEqual(
    Object.fromEntries(
      [...new Set(statuses)].map((s) => [
        s,
        statuses.filter((x) => x === s).length,
      ]),
    ),
    { PASS: 5, REVISION_REQUIRED: 3, OVERDUE: 2, PENDING_REVIEW: 1 },
  );
});
test("reject shared, production, wrong DB, wrong port and connection overrides", () => {
  const valid = `postgresql://utc_demo_v3:synthetic@127.0.0.1:55463/${database}`;
  assert.equal(safeTarget(valid).hostname, "127.0.0.1");
  for (const invalid of [
    valid.replace("127.0.0.1", "db.project.supabase.co"),
    valid.replace(database, "production"),
    valid.replace("55463", "5432"),
    valid + "?host=db.external",
    valid.replace("utc_demo_v3:", "postgres:"),
  ])
    assert.throws(() => safeTarget(invalid));
});
test("all phase boundaries ordered, proposal and guidance fit each term", () => {
  for (const t of d.terms) {
    let end = d.date(t.start);
    for (const key of [
      "registration",
      "assignment",
      "proposal",
      "guidance",
      "final",
      "defense",
    ]) {
      assert(d.date(t[key][0]) >= end);
      assert(d.date(t[key][1]) > d.date(t[key][0]));
      end = d.date(t[key][1]);
    }
    assert(end <= d.date(t.end));
  }
});
