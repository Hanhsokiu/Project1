import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSeed } from "./seed";
const f = vi.hoisted(() => ({
  request: vi.fn(),
  role: "FACULTY",
  token: "token-a",
}));
vi.mock("../api/http-client", () => ({ httpClient: { request: f.request } }));
vi.mock("../api/api-session", () => ({
  AUTH_API: true,
  getAccessToken: () => f.token,
  getApiUser: () => ({
    id: "user",
    roles: [f.role],
    studentId: f.role === "STUDENT" ? "student" : undefined,
    profileComplete: true,
  }),
}));
const termId = "11111111-1111-4111-8111-111111111111";
const lecturerId = "22222222-2222-4222-8222-222222222222";
const directionId = "33333333-3333-4333-8333-333333333333";
const row = {
  id: "registration-real",
  termId,
  studentId: "student",
  directionId,
  status: "SUBMITTED",
  preferences: [{ lecturerId, preferenceOrder: 1 }],
  note: "DB",
  submittedAt: "2026-10-25T01:00:00Z",
  updatedAt: "2026-10-25T01:00:00Z",
};
beforeEach(() => {
  vi.resetModules();
  f.role = "FACULTY";
  f.token = "token-a";
  f.request.mockReset();
  for (const name of [
    "VITE_REGISTRATION_API",
    "VITE_TERM_API",
    "VITE_CATALOG_API",
  ])
    vi.stubEnv(name, "true");
  f.request.mockImplementation(async ({ url }: { url: string }) => {
    const route = url.split("?")[0];
    const records: Record<string, unknown> = {
      "/terms": {
        items: [
          { ...createSeed().terms[0], id: termId, studentIds: ["student"] },
        ],
        total: 1,
      },
      "/semesters": [],
      "/training-systems": [],
      "/departments": [],
      "/research-areas": [],
      "/notifications/me": [],
      "/students": { items: [], total: 0 },
      "/lecturers": { items: [], total: 0 },
      "/registrations": { items: [row] },
      [`/registrations/term/${termId}/me`]: { registration: row },
      [`/assignments/term/${termId}/plan`]: {
        plan: null,
        assignments: [],
        results: [],
        missingSubmissions: [],
      },
      [`/assignments/term/${termId}/results`]: {
        plan: { status: "PUBLISHED" },
        assignments: [],
        results: [],
        missingSubmissions: [],
      },
      [`/topics/term/${termId}`]: [],
      [`/notifications/outbox/term/${termId}`]: [],
    };
    return { data: { data: records[route] } };
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("API registration ownership", () => {
  it("loads independent workflow requests before a slow registration request finishes", async () => {
    const original = f.request.getMockImplementation()!;
    let release!: () => void;
    const blocked = new Promise<void>(resolve => { release = resolve; });
    f.request.mockImplementation(async (config) => {
      if (config.url.split("?")[0] === "/registrations") await blocked;
      return original(config);
    });
    const { hydrateStep1Snapshot } = await import("./snapshot-api");
    const loading = hydrateStep1Snapshot(createSeed());
    try {
      await vi.waitFor(() => {
        const routes = f.request.mock.calls.map(([config]) => config.url.split("?")[0]);
        expect(routes).toContain(`/assignments/term/${termId}/plan`);
        expect(routes).toContain(`/notifications/outbox/term/${termId}`);
        expect(routes).toContain("/notifications/me");
      });
    } finally {
      release();
      await loading;
    }
  });

  it("rejects mixed registration API with mock catalogs instead of using mock IDs", async () => {
    vi.stubEnv("VITE_CATALOG_API", "false");
    const { hydrateStep1Snapshot } = await import("./snapshot-api");
    await expect(hydrateStep1Snapshot(createSeed())).rejects.toThrow(
      "VITE_CATALOG_API",
    );
  });
  it("replaces local registrations with DB records and isolates account tokens", async () => {
    const { hydrateStep1Snapshot, mergeStep1Snapshot } =
      await import("./snapshot-api");
    const mock = createSeed();
    const hydrated = await hydrateStep1Snapshot(mock);
    expect(hydrated.assignments).toEqual([]);
    expect(hydrated.topics).toEqual([]);
    expect(hydrated.notifications).toEqual([]);
    expect(hydrated.registrations).toEqual([
      { ...row, preferences: [lecturerId] },
    ]);
    expect(mergeStep1Snapshot(createSeed()).registrations[0].id).toBe(row.id);
    f.token = "other-user";
    expect(mergeStep1Snapshot(createSeed()).registrations).toEqual([]);
  });
  it("requests only the student's own registration endpoint", async () => {
    f.role = "STUDENT";
    const { hydrateStep1Snapshot } = await import("./snapshot-api");
    expect(
      (await hydrateStep1Snapshot(createSeed())).registrations.map((r) => r.id),
    ).toEqual([row.id]);
    expect(f.request.mock.calls.some(([r]) => r.url === "/registrations")).toBe(
      false,
    );
    expect(f.request.mock.calls.some(([r]) => r.url.includes("/me"))).toBe(
      true,
    );
  });
  it("assignment API failures propagate and never fall back to localStorage", async () => {
    const setItem = vi.fn();
    vi.stubGlobal("localStorage", { getItem: () => null, setItem });
    const { assignmentApi } =
      await import("../../features/registration/services/assignment-api");
    f.request.mockRejectedValue(new Error("API offline"));
    await expect(
      assignmentApi.adjust(termId, "student", lecturerId, "Lý do kiểm thử"),
    ).rejects.toThrow("API offline");
    await expect(assignmentApi.publish(termId)).rejects.toThrow("API offline");
    expect(setItem).not.toHaveBeenCalled();
  });
  it("proposal API failures propagate with no local document write", async () => {
    const setItem = vi.fn();
    vi.stubGlobal("localStorage", { getItem: () => null, setItem });
    const { topicApi } =
      await import("../../features/topic/services/topic-api");
    f.request.mockRejectedValue(new Error("API offline"));
    await expect(
      topicApi.save(
        termId,
        "student",
        {
          title: "Đề tài",
          objectives: "",
          scope: "",
          technology: "",
          expected: "",
          plan: [],
        },
        0,
        false,
      ),
    ).rejects.toThrow("API offline");
    expect(setItem).not.toHaveBeenCalled();
  });
  it("submits with ordered preferences through HTTP and never writes localStorage", async () => {
    const setItem = vi.fn();
    vi.stubGlobal("localStorage", { getItem: () => null, setItem });
    f.request.mockResolvedValue({ data: { data: row } });
    const { registrationService } =
      await import("../../features/registration/services/registration-service");
    await registrationService.save(
      termId,
      { directionId, preferences: [lecturerId], note: "DB" },
      true,
      "sv@example.test",
      "0912345678",
    );
    expect(f.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        url: `/registrations/term/${termId}/me/submit`,
        data: expect.objectContaining({
          preferences: [{ lecturerId, preferenceOrder: 1 }],
        }),
      }),
    );
    expect(setItem).not.toHaveBeenCalled();
    f.request.mockRejectedValue(new Error("API offline"));
    await expect(
      registrationService.save(
        termId,
        { directionId, preferences: [lecturerId], note: "" },
        true,
        "sv@example.test",
        "0912345678",
      ),
    ).rejects.toThrow("API offline");
    expect(setItem).not.toHaveBeenCalled();
  });
  it("surfaces registration read errors and never falls back to mock success", async () => {
    const previous = f.request.getMockImplementation()!;
    f.request.mockImplementation((r) =>
      r.url === "/registrations"
        ? Promise.reject(new Error("registration DB unavailable"))
        : previous(r),
    );
    const { hydrateStep1Snapshot } = await import("./snapshot-api");
    await expect(hydrateStep1Snapshot(createSeed())).rejects.toThrow(
      "registration DB unavailable",
    );
  });
});
