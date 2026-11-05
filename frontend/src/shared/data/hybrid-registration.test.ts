import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyDb } from "./empty-db";
const fixture = vi.hoisted(() => ({
  request: vi.fn(),
  enrolled: true,
  gpa: 3.2 as number | null,
  threshold: 2,
}));
vi.mock("../api/http-client", () => ({
  httpClient: { request: fixture.request },
}));
vi.mock("../api/api-session", () => ({
  AUTH_API: true,
  getAccessToken: () => "server-token",
  setApiUser: (user: unknown) => user,
  getApiUser: () => ({
    id: "account-real",
    studentId: "student-real",
    profileComplete: true,
    username: "000123",
    name: "Sinh viên thật",
    roles: ["STUDENT"],
    password: "",
    student: {
      id: "student-real",
      code: "000123",
      name: "Sinh viên thật",
      gpa: fixture.gpa,
      eligible: true,
    },
  }),
}));
const direction = "11111111-1111-4111-8111-111111111111";
const lecturer = "22222222-2222-4222-8222-222222222222";
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
  fixture.enrolled = true;
  fixture.gpa = 3.2;
  fixture.threshold = 2;
  fixture.request.mockReset();
  vi.stubGlobal("localStorage", storage());
  vi.stubGlobal("sessionStorage", storage());
  vi.stubEnv("VITE_REGISTRATION_API", "false");
  fixture.request.mockImplementation(
    async ({ url, method }: { url: string; method: string }) => {
      if (method === "POST") {
        if (!fixture.enrolled)
          throw new Error("Sinh viên chưa có trong danh sách của đợt");
        if (fixture.gpa === null) throw new Error("Chưa cập nhật GPA");
        return {
          data: {
            data: {
              id: "server-registration",
              termId: "term-real",
              status: "SUBMITTED",
            },
          },
        };
      }
      const records: Record<string, unknown> = {
        "/terms": {
          items: [
            {
              id: "term-real",
              status: "OPEN_REGISTRATION",
              locked: false,
              assignmentPublished: false,
              parameters: { passing_gpa_threshold: fixture.threshold },
              studentIds: fixture.enrolled ? ["student-real"] : [],
              lecturers: [{ lecturerId: lecturer, quota: 2 }],
              phases: [],
            },
          ],
          total: 1,
        },
        "/semesters": [],
        "/training-systems": [],
        "/departments": [],
        "/research-areas": [{ id: direction, name: "Phần mềm" }],
        "/lecturers": {
          items: [
            {
              id: lecturer,
              lecturerCode: "GV1",
              fullName: "Giảng viên thật",
              maxStudents: 2,
              researchAreas: [{ id: direction }],
            },
          ],
          total: 1,
        },
        "/notifications/me": [],
        "/registrations/term/term-real/me": { registration: null },
      };
      return { data: { data: records[url.split("?")[0]] } };
    },
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function submit() {
  const { registrationService } =
    await import("../../features/registration/services/registration-service");
  return registrationService.save(
    "term-real",
    { directionId: direction, preferences: [lecturer], note: "" },
    true,
    "student@example.com",
    "0912345678",
  );
}
describe("server registration with API authentication", () => {
  it("submits through the API even when the older per-module flag is off, without saving a browser registration", async () => {
    const { hydrateStep1Snapshot } = await import("./snapshot-api");
    await hydrateStep1Snapshot(emptyDb());
    await expect(submit()).resolves.toMatchObject({
      id: "server-registration",
      status: "SUBMITTED",
    });
    expect(fixture.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        url: "/registrations/term/term-real/me/submit",
      }),
    );
    const store = await import("./store");
    expect(store.readDb().registrations).toEqual([]);
    expect(localStorage.getItem(store.DATA_KEY)).toBeNull();
  });
  it("propagates the server's roster rejection and never creates a local success", async () => {
    fixture.enrolled = false;
    await expect(submit()).rejects.toThrow("danh sách");
    const store = await import("./store");
    expect(store.readDb().registrations).toEqual([]);
    expect(localStorage.getItem(store.DATA_KEY)).toBeNull();
  });
  it("keeps missing GPA ineligible at zero threshold and propagates server validation", async () => {
    fixture.gpa = null;
    fixture.threshold = 0;
    const { hydrateStep1Snapshot } = await import("./snapshot-api");
    const db = await hydrateStep1Snapshot(emptyDb());
    expect(db.students[0].gpa).toBeNull();
    await expect(submit()).rejects.toThrow("GPA");
    const { registrationIssue, buildAssignment } =
      await import("../../features/registration/services/registration-service");
    const stale = {
      id: "stale",
      termId: "term-real",
      studentId: "student-real",
      status: "SUBMITTED" as const,
      updatedAt: "2026-10-22T03:00:00Z",
      directionId: direction,
      preferences: [lecturer],
      note: "",
    };
    db.registrations.push(stale);
    expect(registrationIssue(db, "term-real", stale)).toContain("GPA");
    expect(buildAssignment(db, "term-real")).toHaveLength(0);
  });
});
