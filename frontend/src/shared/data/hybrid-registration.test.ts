import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSeed } from "./seed";
const fixture = vi.hoisted(() => ({ request: vi.fn(), enrolled: true, gpa: 3.2 as number | null, threshold: 2 }));
vi.mock("../api/http-client", () => ({
  httpClient: { request: fixture.request },
}));
vi.mock("../api/api-session", () => ({
  AUTH_API: true,
  getAccessToken: () => "hybrid-token",
  setApiUser: (user: unknown) => user,
  getApiUser: () => ({
    id: "account-real",
    studentId: "student-real",
    username: "000123",
    name: "Sinh viên thật",
    email: "student@example.com",
    phone: "0912345678",
    roles: ["STUDENT"],
    password: "",
    mustChangePassword: false,
    locked: false,
    student: {
      id: "student-real",
      code: "000123",
      name: "Sinh viên thật",
      email: "student@example.com",
      phone: "0912345678",
      className: "CNTT",
      program: "Chính quy",
      gpa: fixture.gpa,
      eligible: true,
      departmentId: "",
    },
  }),
}));
function storage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => items.set(key, String(value)),
    removeItem: (key: string) => items.delete(key),
  };
}
beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-22T03:00:00Z"));
  fixture.enrolled = true;
  fixture.gpa = 3.2;
  fixture.threshold = 2;
  fixture.request.mockReset();
  vi.stubGlobal("localStorage", storage());
  vi.stubGlobal("sessionStorage", storage());
  vi.stubEnv("VITE_TERM_API", "true");
  vi.stubEnv("VITE_CATALOG_API", "true");
  fixture.request.mockImplementation(async ({ url }: { url: string }) => {
    const records: Record<string, unknown> = {
      "/terms": {
        items: [
          {
            ...createSeed().terms[0],
            id: "term-real",
            status: "OPEN_REGISTRATION",
            locked: false,
            assignmentPublished: false,
            parameters: {...createSeed().terms[0].parameters, passing_gpa_threshold: fixture.threshold},
            studentIds: fixture.enrolled ? ["student-real"] : [],
            lecturers: [{ lecturerId: "lecturer-real", quota: 2 }],
            registrationStart: "2026-10-01T00:00:00+07:00",
            registrationEnd: "2026-11-30T23:59:00+07:00",
            phases: [
              {
                id: "phase-real",
                code: "REGISTRATION",
                name: "Đăng ký",
                start: "2026-10-01T00:00:00+07:00",
                end: "2026-11-30T23:59:00+07:00",
                locked: false,
              },
            ],
          },
        ],
        total: 1,
      },
      "/semesters": [],
      "/training-systems": [
        { id: "program-real", code: "CQ", name: "Chính quy" },
      ],
      "/departments": [],
      "/research-areas": [{ id: "direction-real", name: "Phần mềm" }],
      "/lecturers": {
        items: [
          {
            id: "lecturer-real",
            lecturerCode: "GV1",
            fullName: "Giảng viên thật",
            departmentId: "",
            maxStudents: 2,
            researchAreas: [{ id: "direction-real", name: "Phần mềm" }],
          },
        ],
        total: 1,
      },
    };
    return { data: { data: records[url.split("?")[0]] } };
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("actual Step 1 data and mock Step 2 isolation", () => {
  it("lets a real student submit a mock registration with actual roster and lecturer UUIDs without issuing an API mutation", async () => {
    const { hydrateStep1Snapshot } = await import("./snapshot-api");
    await hydrateStep1Snapshot(createSeed());
    const store = await import("./store");
    store.resetDemo();
    const { registrationService } =
      await import("../../features/registration/services/registration-service");
    const requestsBefore = fixture.request.mock.calls.length;
    registrationService.save(
      "term-real",
      {
        directionId: "direction-real",
        preferences: ["lecturer-real"],
        note: "Đăng ký thử",
      },
      true,
      "student@example.com",
      "0912345678",
    );
    const saved = store
      .readDb()
      .registrations.find(
        (r) => r.termId === "term-real" && r.studentId === "student-real",
      );
    expect(saved).toMatchObject({
      status: "SUBMITTED",
      preferences: ["lecturer-real"],
      directionId: "direction-real",
    });
    expect(fixture.request.mock.calls).toHaveLength(requestsBefore);
    expect(
      JSON.parse(localStorage.getItem(store.DATA_KEY)!).registrations.some(
        (r: { termId: string; studentId: string }) =>
          r.termId === "term-real" && r.studentId === "student-real",
      ),
    ).toBe(true);
  });
  it("blocks the real student when the API roster does not contain their ID", async () => {
    fixture.enrolled = false;
    const { hydrateStep1Snapshot } = await import("./snapshot-api");
    await hydrateStep1Snapshot(createSeed());
    const store = await import("./store");
    store.resetDemo();
    const { registrationService } =
      await import("../../features/registration/services/registration-service");
    expect(() =>
      registrationService.save(
        "term-real",
        {
          directionId: "direction-real",
          preferences: ["lecturer-real"],
          note: "",
        },
        true,
        "student@example.com",
        "0912345678",
      ),
    ).toThrow("danh sách");
  });
  it("blocks submission and automatic assignment for missing GPA even when the API threshold is zero", async () => {
    fixture.gpa = null;
    fixture.threshold = 0;
    const { hydrateStep1Snapshot } = await import("./snapshot-api");
    await hydrateStep1Snapshot(createSeed());
    const store = await import("./store");
    store.resetDemo();
    const { registrationService, buildAssignment, registrationIssue } = await import("../../features/registration/services/registration-service");
    const db = store.readDb();
    expect(db.students.find(s => s.id === 'student-real')?.gpa).toBeNull();
    expect(db.terms.find(t => t.id === 'term-real')?.parameters.passing_gpa_threshold).toBe(0);
    const input = {directionId: 'direction-real', preferences: ['lecturer-real'], note: ''};
    const before = fixture.request.mock.calls.length;
    expect(() => registrationService.save('term-real', input, true, 'student@example.com', '0912345678')).toThrow('GPA');
    expect(store.readDb().registrations.some(r => r.termId === 'term-real')).toBe(false);
    const stale = {id: 'stale-registration', termId: 'term-real', studentId: 'student-real', status: 'SUBMITTED' as const, updatedAt: '2026-10-22T03:00:00Z', ...input};
    db.registrations.push(stale);
    expect(registrationIssue(db, 'term-real', stale)).toContain('GPA');
    expect(buildAssignment(db, 'term-real')).toHaveLength(0);
    expect(fixture.request.mock.calls).toHaveLength(before);
  });
});
