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
  it("UC25 requires actual academic role and explicit ingress; keeps one API report menu", () => {
    const r=route("/defense/reports");
    for(const role of ["FACULTY","LECTURER"] as const) expect(canAccessRoute(r,user(role,["defense-report:read"]),true)).toBe(true);
    for(const role of ["ADMIN","STUDENT"] as const) expect(canAccessRoute(r,user(role,["defense-report:read"]),true)).toBe(false);
    const apiPaths=navigationRoutes(user("FACULTY",["defense-report:read"]),true).map(r=>r.path);
    expect(apiPaths).toContain("/defense/reports");expect(apiPaths).not.toContain("/report/export");
    expect(navigationRoutes(user("FACULTY"),false).map(r=>r.path)).toContain("/report/export");
  });
  it("UC24 has explicit scoped ingress for Faculty/member/student and no admin bypass", () => {
    const r = route("/defense/results");
    for (const role of ["FACULTY", "LECTURER", "STUDENT"] as const) { expect(canAccessRoute(r, user(role, ["defense-result:read"]), true)).toBe(true); expect(canAccessRoute(r, user(role), true)).toBe(false); }
    expect(canAccessRoute(r, user("ADMIN", ["defense-result:read"]), true)).toBe(false);
  });
  it("UC23 requires actual academic role and explicit ingress read permission", () => {
    const r = route("/defense/committee-grading");
    for (const role of ["LECTURER", "FACULTY"] as const) {
      expect(
        canAccessRoute(r, user(role, ["defense-committee-grade:read"]), true),
      ).toBe(true);
      expect(canAccessRoute(r, user(role), true)).toBe(false);
    }
    for (const role of ["ADMIN", "STUDENT"] as const)
      expect(
        canAccessRoute(r, user(role, ["defense-committee-grade:read"]), true),
      ).toBe(false);
  });
  it("UC22 route/menu requires academic role and grading read; student/admin cannot read unpublished grades", () => {
    const r = route("/defense/reviewer-grading");
    for (const role of ["FACULTY", "LECTURER"] as const) {
      expect(
        canAccessRoute(r, user(role, ["defense-reviewer-grade:read"]), true),
      ).toBe(true);
      expect(canAccessRoute(r, user(role), true)).toBe(false);
    }
    for (const role of ["STUDENT", "ADMIN"] as const)
      expect(
        canAccessRoute(r, user(role, ["defense-reviewer-grade:read"]), true),
      ).toBe(false);
  });
  it("allows UC21 scoped faculty/student/lecturer read and requires explicit permission", () => {
    const r = route("/defense/schedule");
    for (const role of ["FACULTY", "STUDENT", "LECTURER"] as const) {
      expect(
        canAccessRoute(r, user(role, ["defense-schedule:read"]), true),
      ).toBe(true);
      expect(canAccessRoute(r, user(role), true)).toBe(false);
    }
    expect(
      canAccessRoute(r, user("ADMIN", ["defense-schedule:read"]), true),
    ).toBe(false);
  });
  it("requires faculty and explicit read permission for UC20 route/menu", () => {
    const r = route("/defense/reviewers");
    expect(
      canAccessRoute(r, user("FACULTY", ["defense-reviewer:read"]), true),
    ).toBe(true);
    expect(canAccessRoute(r, user("FACULTY"), true)).toBe(false);
    for (const role of ["ADMIN", "LECTURER", "STUDENT"] as const)
      expect(
        canAccessRoute(r, user(role, ["defense-reviewer:read"]), true),
      ).toBe(false);
    expect(
      navigationRoutes(user("FACULTY", ["defense-reviewer:read"]), true).map(
        (r) => r.path,
      ),
    ).toContain(r.path);
  });
  it("requires faculty-bound UC19 navigation with explicit read permission", () => {
    const r = route("/defense/committees");
    expect(
      canAccessRoute(r, user("FACULTY", ["defense-committee:read"]), true),
    ).toBe(true);
    for (const role of ["ADMIN", "LECTURER", "STUDENT"] as const)
      expect(
        canAccessRoute(r, user(role, ["defense-committee:read"]), true),
      ).toBe(false);
    expect(canAccessRoute(r, user("FACULTY", ["guidance:read"]), true)).toBe(
      false,
    );
  });
  it("requires UC18 read rights and never gives ADMIN an eligibility route bypass", () => {
    const r = route("/defense/eligibility");
    expect(canAccessRoute(r, user("FACULTY", ["guidance:read"]), true)).toBe(
      false,
    );
    expect(
      canAccessRoute(r, user("FACULTY", ["defense-eligibility:read"]), true),
    ).toBe(true);
    expect(
      canAccessRoute(r, user("ADMIN", ["defense-eligibility:read"]), true),
    ).toBe(false);
    expect(
      navigationRoutes(
        user("FACULTY", ["defense-eligibility:read"]),
        true,
      ).some((r) => r.path === "/defense/eligibility"),
    ).toBe(true);
  });
  it("opens UC17 only with its explicit API rights and gives each role its relevant menu", () => {
    expect(
      canAccessRoute(
        route("/guidance/defense-confirm"),
        user("LECTURER", ["guidance:read"]),
        true,
      ),
    ).toBe(false);
    expect(
      canAccessRoute(
        route("/guidance/defense-confirm"),
        user("LECTURER", ["defense-confirmation:read"]),
        true,
      ),
    ).toBe(true);
    expect(
      navigationRoutes(
        user("STUDENT", ["final-report:read", "defense-confirmation:read"]),
        true,
      ).map((r) => r.path),
    ).toContain("/guidance/final-report");
    expect(
      navigationRoutes(
        user("FACULTY", ["final-report:read", "defense-confirmation:read"]),
        true,
      ).map((r) => r.path),
    ).toContain("/guidance/defense-confirm");
  });
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
