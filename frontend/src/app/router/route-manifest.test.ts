import { describe, expect, it } from "vitest";
import {
  canAccessRoute,
  navigationRoutes,
  routeManifest,
  routeTitle,
} from "./route-manifest";
import type { Role } from "../../shared/data/types";

const user = (role: Role, permissions: string[] = []) => ({
  roles: [role],
  permissions,
});
const route = (path: string) => routeManifest.find((r) => r.path === path)!;

describe("workflow navigation and route access", () => {
  it("does not turn ADMIN into an academic role even with workflow permissions", () => {
    const admin = user("ADMIN", [
      "proposal:read",
      "guidance:read",
      "task:review",
    ]);
    expect(canAccessRoute(route("/topic/proposal"), admin, true)).toBe(false);
    expect(navigationRoutes(admin, true).filter((r) => r.permission)).toEqual(
      [],
    );
  });
  it("requires explicit API permission for a direct URL as well as its menu", () => {
    expect(
      canAccessRoute(route("/guidance/review"), user("LECTURER"), true),
    ).toBe(false);
    expect(
      canAccessRoute(
        route("/guidance/review"),
        user("LECTURER", ["task:review"]),
        true,
      ),
    ).toBe(true);
    expect(
      canAccessRoute(
        route("/topic/review-groups/new"),
        user("FACULTY", ["review-group:read"]),
        true,
      ),
    ).toBe(false);
  });
  it("keeps student navigation focused without removing scoped read access", () => {
    const student = user("STUDENT", [
      "proposal:read",
      "guidance:read",
      "submission:read",
    ]);
    const paths = navigationRoutes(student, true).map((r) => r.path);
    expect(paths).toContain("/guidance/tasks");
    expect(paths).not.toContain("/topic/review-groups");
    expect(paths).not.toContain("/guidance/review");
    expect(paths).not.toContain("/guidance/progress");
    expect(paths).not.toContain("/guidance/meetings");
    expect(paths).not.toContain("/guidance/final-report");
    expect(
      canAccessRoute(route("/guidance/review/:submissionId"), student, true),
    ).toBe(true);
    expect(routeTitle(route("/topic/dossier"), student)).toBe("Hồ sơ & bản in");
  });
  it("gives faculty monitoring while keeping contextual plan pages accessible", () => {
    const faculty = user("FACULTY", ["guidance:read", "guidance:monitor"]);
    const paths = navigationRoutes(faculty, true).map((r) => r.path);
    expect(paths).toContain("/guidance/progress");
    expect(paths).not.toContain("/guidance/plan");
    expect(
      canAccessRoute(route("/guidance/plan/:proposalId"), faculty, true),
    ).toBe(true);
  });
  it("preserves demo mode and combines actual roles for multi-role accounts", () => {
    expect(
      canAccessRoute(route("/topic/proposal"), user("STUDENT"), false),
    ).toBe(true);
    const multi = {
      roles: ["FACULTY", "LECTURER"] as Role[],
      permissions: ["guidance:read", "guidance:monitor", "task:review"],
    };
    const paths = navigationRoutes(multi, true).map((r) => r.path);
    expect(paths).toContain("/guidance/review");
    expect(paths).toContain("/guidance/progress");
    expect(paths).toContain("/guidance/plan");
  });
});
