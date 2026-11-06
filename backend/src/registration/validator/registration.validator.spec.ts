import { describe, it, expect } from "vitest";
import { RegistrationValidator as V } from "./registration.validator";
import { RegistrationWriteSchema } from "../dto/registration.dto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ContactValidator } from "../../auth/validator/contact.validator";
import { operationWindow } from "../../term/service/term-window.service";
import type { LoadedTerm } from "../../term/repository/term.repository";
import { randomUUID } from "node:crypto";

const area = randomUUID(),
  lecturer = randomUUID();
function term() {
  return {
    id: "term",
    status: "OPEN_REGISTRATION",
    isLocked: false,
    startDate: new Date("2026-01-01Z"),
    endDate: new Date("2027-01-01Z"),
    phases: [
      {
        id: "phase",
        code: "REGISTRATION",
        isLocked: false,
        startDate: new Date("2026-10-01T00:00:00Z"),
        endDate: new Date("2026-11-01T00:00:00Z"),
      },
    ],
    parameters: [
      { key: "max_preferences", value: "3" },
      { key: "passing_gpa_threshold", value: "2" },
    ],
    trainingSystemId: "cq",
    termStudents: [{ studentId: "sv" }],
    termLecturers: [
      {
        lecturerId: lecturer,
        quota: 0,
        lecturer: { isActive: true, researchAreas: [{ researchAreaId: area }] },
      },
    ],
  } as unknown as LoadedTerm;
}
const student = {
  id: "sv",
  trainingSystemId: "cq",
  isActive: true,
  academicEligible: true,
  gpa: 3,
};
const input = () =>
  RegistrationWriteSchema.parse({
    directionId: area,
    preferences: [{ lecturerId: lecturer, preferenceOrder: 1 }],
  });
describe("UC01 onboarding", () => {
  it.each([
    ["sv@example.test", "0912345678", true],
    [null, "0912345678", false],
    ["sv@example.test", "", false],
    ["invalid", "123", false],
  ])("validates contact %s/%s", (email, phone, valid) =>
    expect(ContactValidator.complete(email, phone)).toBe(valid),
  );
  it("allows complete server contact", () =>
    expect(() =>
      V.contact({
        mustChangePassword: false,
        email: "sv@example.test",
        phone: "0912345678",
      }),
    ).not.toThrow());
  it("rejects default passwords and incomplete contact", () => {
    expect(() =>
      V.contact({
        mustChangePassword: true,
        email: "sv@example.test",
        phone: "0912345678",
      }),
    ).toThrow();
    expect(() =>
      V.contact({ mustChangePassword: false, email: null, phone: null }),
    ).toThrow();
  });
});
describe("UC09 server business rules", () => {
  it("accepts eligible roster and quota zero does not reserve a seat", () => {
    expect(() => V.eligibility(student, term())).not.toThrow();
    expect(() => V.preferences(input(), true, term(), [area])).not.toThrow();
  });
  it.each([
    { id: "outside" },
    { trainingSystemId: "tx" },
    { academicEligible: false },
    { isActive: false },
    { gpa: null },
    { gpa: 1.99 },
    { gpa: NaN },
  ])("rejects current ineligible data %j", (change) =>
    expect(() => V.eligibility({ ...student, ...change }, term())).toThrow(),
  );
  it("allows an empty draft but requires direction and preferences on submission", () => {
    const empty = RegistrationWriteSchema.parse({});
    expect(() => V.preferences(empty, false, term(), [area])).not.toThrow();
    expect(() => V.preferences(empty, true, term(), [area])).toThrow();
  });
  it("rejects duplicate lecturers, gaps, reverse order, wrong area and outside term", () => {
    const a = input();
    for (const preferences of [
      [...a.preferences, { lecturerId: lecturer, preferenceOrder: 2 }],
      [{ lecturerId: lecturer, preferenceOrder: 2 }],
      [{ lecturerId: randomUUID(), preferenceOrder: 1 }],
    ])
      expect(() =>
        V.preferences({ ...a, preferences }, true, term(), [area]),
      ).toThrow();
    expect(() => V.preferences(a, true, term(), [])).toThrow();
    const inactive = term();
    inactive.termLecturers[0].lecturer.isActive = false;
    expect(() => V.preferences(a, true, inactive, [area])).toThrow();
    const different = term();
    different.termLecturers[0].lecturer.researchAreas[0].researchAreaId =
      randomUUID();
    expect(() => V.preferences(a, true, different, [area])).toThrow();
  });
  it("honors the smaller term limit", () => {
    const t = term();
    t.parameters[0].value = "1";
    const second = randomUUID();
    t.termLecturers.push({ ...t.termLecturers[0], lecturerId: second });
    expect(() =>
      V.preferences(
        {
          ...input(),
          preferences: [
            { lecturerId: lecturer, preferenceOrder: 1 },
            { lecturerId: second, preferenceOrder: 2 },
          ],
        },
        true,
        t,
        [area],
      ),
    ).toThrow();
  });
  it("uses half-open server windows and phase/term locks", () => {
    const t = term();
    expect(
      operationWindow(t, "REGISTRATION", new Date("2026-09-30T23:59:59.999Z"))
        .canWrite,
    ).toBe(false);
    expect(
      operationWindow(t, "REGISTRATION", new Date("2026-10-01T00:00:00Z"))
        .canWrite,
    ).toBe(true);
    expect(
      operationWindow(t, "REGISTRATION", new Date("2026-11-01T00:00:00Z"))
        .canWrite,
    ).toBe(false);
    t.phases[0].isLocked = true;
    expect(
      operationWindow(t, "REGISTRATION", new Date("2026-10-25T00:00:00Z"))
        .canWrite,
    ).toBe(false);
    t.phases[0].isLocked = false;
    t.isLocked = true;
    expect(
      operationWindow(t, "REGISTRATION", new Date("2026-10-25T00:00:00Z"))
        .canWrite,
    ).toBe(false);
  });
  it("keeps backend and shared request contracts aligned and rejects identity injection", () => {
    const schemaSource = (path: string) =>
      readFileSync(resolve(process.cwd(), path), "utf8")
        .split("export const RegistrationWriteSchema = ")[1]
        .split("export type RegistrationWrite")[0]
        .replace(/\s/g, "");
    expect(schemaSource("src/registration/dto/registration.dto.ts")).toBe(
      schemaSource("../shared/src/step2.ts"),
    );
    const cases = [
      {},
      input(),
      { ...input(), studentId: randomUUID() },
      { ...input(), directionId: [area, randomUUID()] },
      { ...input(), preferences: Array(4).fill(input().preferences[0]) },
      {
        ...input(),
        preferences: [{ lecturerId: lecturer, preferenceOrder: 4 }],
      },
      { ...input(), email: "bad" },
    ];
    cases.forEach((value, index) => {
      expect(RegistrationWriteSchema.safeParse(value).success).toBe(index < 2);
    });
  });
});
