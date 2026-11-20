import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSeed } from "./seed";
import { emptyDb } from "./empty-db";
import { snapshotScopeForPath, type SnapshotScope } from "./snapshot-scope";

const fixture = vi.hoisted(() => ({
  token: "token-a",
  role: "ADMIN",
  request: vi.fn(),
}));
vi.mock("../api/api-data", () => ({ apiData: fixture.request }));
vi.mock("../api/api-session", () => ({
  AUTH_API: true,
  getAccessToken: () => fixture.token,
  getApiUser: () => ({
    id: "actor",
    roles: [fixture.role],
    permissions: ["audit:read"],
    studentId: fixture.role === "STUDENT" ? "own-student" : undefined,
    lecturerId: fixture.role === "LECTURER" ? "own-lecturer" : undefined,
    profileComplete: true,
    student:
      fixture.role === "STUDENT"
        ? { id: "own-student", code: "OWN", name: "My profile", gpa: null }
        : undefined,
    lecturer:
      fixture.role === "LECTURER"
        ? {
            id: "own-lecturer",
            name: "My lecturer profile",
            departmentId: "department",
          }
        : undefined,
  }),
}));

beforeEach(() => {
  vi.resetModules();
  fixture.token = "token-a";
  fixture.role = "ADMIN";
  fixture.request.mockReset();
  const term = createSeed().terms[0];
  fixture.request.mockImplementation(async (_method: string, url: string) => {
    const path = url.split("?")[0];
    if (path === "/terms")
      return {
        items: ["term-a", "term-b"].map((id) => ({
          ...term,
          id,
          studentIds: ["own-student"],
          assignmentPublished: true,
        })),
        total: 2,
      };
    if (
      [
        "/semesters",
        "/training-systems",
        "/departments",
        "/research-areas",
        "/notifications/me",
      ].includes(path)
    )
      return [];
    if (["/students", "/lecturers", "/accounts", "/audit-logs"].includes(path))
      return { items: [], total: 0 };
    if (/^\/assignments\/term\/.+\/(plan|results)$/.test(path))
      return {
        plan: null,
        assignments: [],
        results: [],
        missingSubmissions: [],
      };
    if (path.startsWith("/registrations"))
      return {
        items: [
          {
            id: "registration",
            termId: path.split("/").at(-1),
            preferences: [],
          },
        ],
      };
    if (
      path.startsWith("/topics/term/") ||
      path.startsWith("/notifications/outbox/term/")
    )
      return [];
    throw new Error("Unexpected API " + path);
  });
});
const paths = () =>
  fixture.request.mock.calls.map(([, path]) => String(path).split("?")[0]);

describe("screen-owned snapshot reads with real API mode", () => {
  it.each<[string, SnapshotScope, string[]]>([
    ["/profile", "profile", []],
    ["/change-password", "shell", []],
    ["/admin/roles", "roles", ["/accounts"]],
    ["/admin/audit-logs", "audit", ["/audit-logs"]],
    ["/admin/accounts", "accounts", ["/accounts", "/students", "/lecturers"]],
    ["/catalog/reference", "reference", ["/students", "/lecturers"]],
    ["/terms", "terms", []],
    ["/terms/term-a/phases", "terms", []],
    ["/terms/term-a/parameters", "terms", []],
    ["/defense/results", "shell", []],
    ["/guidance/final-report", "shell", []],
    ["/catalog/import", "shell", []],
  ])(
    "%s loads its required lists without unrelated bulk resources",
    async (path, scope, expected) => {
      expect(snapshotScopeForPath(path)).toBe(scope);
      const { hydrateStep1Snapshot } = await import("./snapshot-api");
      await hydrateStep1Snapshot(emptyDb(), scope);
      expect(paths()).toContain("/terms");
      expect(paths()).toContain("/notifications/me");
      for (const resource of [
        "/students",
        "/lecturers",
        "/accounts",
        "/audit-logs",
      ])
        expect(paths().includes(resource)).toBe(expected.includes(resource));
      expect(
        paths().some((path) =>
          /assignments|registrations|topics|outbox/.test(path),
        ),
      ).toBe(false);
    },
  );

  it("keeps lecturer import's duplicate checks without loading student lists", async () => {
    const scope = snapshotScopeForPath("/catalog/import", "?type=lecturer");
    const { hydrateStep1Snapshot } = await import("./snapshot-api");
    await hydrateStep1Snapshot(emptyDb(), scope);
    expect(paths()).toContain("/lecturers");
    expect(paths()).not.toContain("/students");
  });

  it.each<SnapshotScope>(["dashboard", "assignment", "term-detail", "topic"])(
    "%s only fetches the requested term's workflow, preserving the complete term picker",
    async (scope) => {
      fixture.role = "FACULTY";
      const { hydrateStep1Snapshot } = await import("./snapshot-api");
      const db = await hydrateStep1Snapshot(emptyDb(), scope, "term-b");
      expect(db.terms.map((term) => term.id)).toEqual(["term-a", "term-b"]);
      expect(paths().some((path) => path.includes("/term/term-b"))).toBe(true);
      expect(paths().some((path) => path.includes("/term/term-a"))).toBe(false);
      expect(paths()).not.toContain("/registrations");
      expect(db.registrations.every((row) => row.termId === "term-b")).toBe(
        true,
      );
    },
  );

  it("keeps all admin dashboard account/audit totals without fetching academic workflows", async () => {
    const { hydrateStep1Snapshot } = await import("./snapshot-api");
    await hydrateStep1Snapshot(emptyDb(), "dashboard", "term-a");
    expect(paths()).toContain("/accounts");
    expect(paths()).toContain("/audit-logs");
    expect(paths()).not.toContain("/students");
    expect(paths()).not.toContain("/lecturers");
    expect(
      paths().some((path) =>
        /assignments|registrations|topics|outbox/.test(path),
      ),
    ).toBe(false);
  });

  it("does not fall back to another term when the explicit term is unavailable", async () => {
    const { hydrateStep1Snapshot } = await import("./snapshot-api");
    const db = await hydrateStep1Snapshot(
      emptyDb(),
      "assignment",
      "missing-term",
    );
    expect(db.assignments).toEqual([]);
    expect(db.registrations).toEqual([]);
    expect(paths().some((path) => path.includes("/term/"))).toBe(false);
  });

  it("uses the saved term preference and falls back only when that preference is no longer available", async () => {
    const { hydrateStep1Snapshot } = await import("./snapshot-api");
    await hydrateStep1Snapshot(emptyDb(), "assignment", undefined, "term-b");
    expect(paths()).toContain("/assignments/term/term-b/plan");
    expect(paths()).not.toContain("/assignments/term/term-a/plan");
    fixture.request.mockClear();
    await hydrateStep1Snapshot(emptyDb(), "assignment", undefined, "old-term");
    expect(paths()).toContain("/assignments/term/term-a/plan");
    expect(paths()).not.toContain("/assignments/term/term-b/plan");
  });

  it.each(["STUDENT", "LECTURER"])(
    "uses the %s's own profile without privileged directory reads",
    async (role) => {
      fixture.role = role;
      const { hydrateStep1Snapshot } = await import("./snapshot-api");
      const db = await hydrateStep1Snapshot(emptyDb(), "profile");
      expect(
        role === "STUDENT" ? db.students[0]?.id : db.lecturers[0]?.id,
      ).toBe(role === "STUDENT" ? "own-student" : "own-lecturer");
      expect(paths()).not.toContain("/students");
      expect(paths()).not.toContain("/lecturers");
      expect(paths()).not.toContain("/accounts");
    },
  );

  it("surfaces scoped API failure and does not populate a successful empty cache", async () => {
    const { hydrateStep1Snapshot } = await import("./snapshot-api");
    fixture.request.mockRejectedValue(new Error("API unavailable"));
    await expect(hydrateStep1Snapshot(emptyDb(), "roles")).rejects.toThrow(
      "API unavailable",
    );
  });

  it("preserves API proposal versions for synchronous actions after a lighter scope completes", async () => {
    const respond = fixture.request.getMockImplementation()!;
    fixture.request.mockImplementation(async (method: string, url: string) => {
      if (url === "/topics/term/term-b")
        return [
          {
            id: "topic-b",
            termId: "term-b",
            studentId: "own-student",
            versions: [{ version: 4 }],
          },
        ];
      if (url === "/topics/topic-b/agree") return {};
      return respond(method, url);
    });
    const { hydrateStep1Snapshot, mergeActionSnapshot } =
      await import("./snapshot-api");
    await hydrateStep1Snapshot(emptyDb(), "topic", "term-b");
    await hydrateStep1Snapshot(emptyDb(), "shell");
    expect(mergeActionSnapshot(emptyDb()).topics[0].id).toBe("topic-b");
    const { topicService } =
      await import("../../features/topic/services/topic-service");
    await topicService.agree("topic-b", true);
    expect(fixture.request).toHaveBeenLastCalledWith(
      "POST",
      "/topics/topic-b/agree",
      { agreed: true, expectedVersion: 4 },
    );
  });
});
