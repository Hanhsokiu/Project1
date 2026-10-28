import { describe, expect, it } from "vitest";
import {
  gradingParameterKeys,
  readGradingParameters,
  parametersMatchPolicy,
  verifyGradingParameters,
} from "./grading-parameters";
import { calculationForTest, gradingFixture } from "./grading.test-fixtures";
import { hashJson } from "./grading.policy";
const at = new Date("2026-11-02T02:10:00Z");
const rows = () =>
  gradingParameterKeys.map((key, i) => ({
    id: `p-${i}`,
    termId: "term",
    key,
    value: ["0.5", "0.5", "0.4", "0.6", "5"][i],
    updatedAt: new Date("2026-09-01T00:00:00Z"),
  }));
describe("ADR-0003 TermParameter bridge; no defaults or writes", () => {
  it("validates the documented profile without making it a calculation approval", () => {
    const a = readGradingParameters("term", rows(), at);
    expect(a.state).toBe("VERIFIED");
    expect(parametersMatchPolicy(a, calculationForTest)).toBe(true);
    expect(readGradingParameters("term", [], at)).toEqual({ state: "UNKNOWN" });
  });
  it.each([
    "missing",
    "duplicate-key",
    "duplicate-id",
    "wrong-term",
    "empty",
    "NaN",
    "negative",
    "range",
    "sum",
    "future",
    "invalid-date",
  ])("rejects %s", (fault) => {
    const r = rows();
    if (fault === "missing") r.pop();
    if (fault === "duplicate-key") r[0].key = r[1].key;
    if (fault === "duplicate-id") r[0].id = r[1].id;
    if (fault === "wrong-term") r[0].termId = "other";
    if (fault === "empty") r[0].value = "";
    if (fault === "NaN") r[0].value = "NaN";
    if (fault === "negative") r[0].value = "-0.5";
    if (fault === "range") r[0].value = "2";
    if (fault === "sum") r[0].value = "0.1";
    if (fault === "future") r[0].updatedAt = new Date("2027-01-01Z");
    if (fault === "invalid-date") r[0].updatedAt = new Date(NaN);
    expect(readGradingParameters("term", r, at)).toEqual({ state: "UNKNOWN" });
  });
  it("detects a valid different weight profile instead of ignoring it", () => {
    const r = rows();
    r[2].value = "0.3";
    r[3].value = "0.7";
    const a = readGradingParameters("term", r, at);
    expect(a.state).toBe("VERIFIED");
    expect(parametersMatchPolicy(a, calculationForTest)).toBe(false);
  });
  it("a wrong pass threshold cannot be hidden by an approved-looking policy", () => {
    const p = structuredClone(calculationForTest);
    p.minimum.process = 0;
    expect(
      parametersMatchPolicy(readGradingParameters("term", rows(), at), p),
    ).toBe(false);
  });
  it("historical parameter evidence is canonical and immutable, not read from current values", () => {
    const a = readGradingParameters("term", rows(), at);
    if (a.state !== "VERIFIED") throw new Error("fixture");
    const b = structuredClone(a.evidence);
    b.snapshot.entries[0].value = "0";
    expect(verifyGradingParameters(b, "term", at).state).toBe("UNKNOWN");
    b.hash = hashJson(b.snapshot);
    expect(verifyGradingParameters(b, "term", at).state).toBe("UNKNOWN"); // invalid total
    expect(verifyGradingParameters(a.evidence, "term", at).state).toBe(
      "VERIFIED",
    );
  });
  it("missing parameters keep totals null and reject seal, even with TEST-only approved ports", async () => {
    const f = await gradingFixture();
    await f.configure();
    f.approveForTest();
    await f.allScores();
    f.session.gradingParameters.mockResolvedValue([]);
    const preview = (await f.service.preview("faculty-user", "term")).items[0];
    expect(preview).toMatchObject({ final: null, canSeal: false });
    expect(preview.blockers).toContain("GRADING_PARAMETERS_UNVERIFIED");
    await expect(f.resultCommand()).rejects.toMatchObject({ status: 409 });
    expect(f.state.results).toHaveLength(0);
  });
  it("a parameter change invalidates an already-read command context", async () => {
    const f = await gradingFixture();
    await f.configure();
    f.approveForTest();
    await f.allScores();
    const previous = (await f.service.preview("faculty-user", "term")).items[0];
    f.session.gradingParameters.mockResolvedValue(
      rows().map((r) => ({
        ...r,
        updatedAt: new Date("2026-11-01T00:00:00Z"),
      })),
    );
    await expect(
      f.service.resultCommand(
        "faculty-user",
        "term",
        "proposal",
        {
          expectedRevision: previous.revision,
          expectedContext: previous.expectedContext,
          requestId: crypto.randomUUID(),
        },
        false,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(f.state.results).toHaveLength(0);
  });
  it("changing current parameters after publication does not rewrite verified historical marks", async () => {
    const f = await gradingFixture();
    await f.configure();
    f.approveForTest();
    await f.allScores();
    await f.resultCommand();
    await f.resultCommand(true);
    f.session.gradingParameters.mockResolvedValue([]);
    expect(
      (await f.service.published("student-user", "term", "proposal")).state,
    ).toBe("PUBLISHED");
  });
});
