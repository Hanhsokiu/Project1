import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, readdirSync, rmdirSync, unlinkSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { policyCommand } from "./policy-cli";

const folders: string[] = [];
function folder() { const dir = mkdtempSync(join(tmpdir(), "datn-policy-cli-")); folders.push(dir); return dir; }
afterEach(() => {
  for (const dir of folders.splice(0)) {
    for (const file of readdirSync(dir)) unlinkSync(join(dir, file));
    rmdirSync(dir);
  }
});

describe("offline policy command", () => {
  it("creates an unapproved nine-policy draft and cannot overwrite existing files", () => {
    const path = join(folder(), "draft.json");
    expect(policyCommand(["draft", path])).toMatchObject({ action: "DRAFT_ONLY", policies: 9, runtimeValid: false });
    const before = readFileSync(path, "utf8"), draft = JSON.parse(before);
    expect(draft.authority.actorId).toBeNull();
    expect(Object.values(draft.policies).every((p) => (p as { status: string }).status === "DRAFT")).toBe(true);
    expect(() => policyCommand(["draft", path])).toThrow();
    expect(readFileSync(path, "utf8")).toBe(before);
  });
  it("emits a blocked preflight without touching the input or connecting to a database", () => {
    const dir = folder(), input = join(dir, "input.json"), facts = join(dir, "facts.json"), output = join(dir, "plan.json");
    writeFileSync(input, "{}");
    writeFileSync(facts, JSON.stringify({ term: { id: "unit-term" } }));
    expect(policyCommand(["preflight", input, facts, output])).toMatchObject({ action: "BLOCKED", ready: false, databaseWrites: 0 });
    expect(JSON.parse(readFileSync(output, "utf8"))).toMatchObject({ kind: "OFFLINE_PREFLIGHT_NOT_APPLIED", rows: [] });
    expect(readFileSync(input, "utf8")).toBe("{}");
  });
  it("requires explicit file paths and an allowed command", () => {
    expect(() => policyCommand(["apply"])).toThrow("Usage:");
    expect(() => policyCommand(["draft"])).toThrow("Usage:");
  });
});
