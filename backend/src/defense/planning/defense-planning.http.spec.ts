import "reflect-metadata";
import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { JwtAuthGuard } from "../../common/security/jwt-auth.guard";
import { PermissionsGuard } from "../../common/security/permissions.guard";
import { GlobalExceptionHandler } from "../../common/exception/global-exception.handler";
import type { UserAccountRepository } from "../../auth/repository/user-account.repository";
import type { RbacService } from "../../auth/service/rbac.service";
import { DefensePlanningController } from "./defense-planning.controller";
import { DefensePlanningService } from "./defense-planning.service";
import { planningFixture } from "./defense-planning.test-fixtures";

describe("UC19–21 HTTP guards/DTO/preview with mock repository, no database", () => {
  let f: ReturnType<typeof planningFixture>,
    app: INestApplication,
    base: string;
  const jwt = new JwtService({ secret: "planning-http-test-secret" });
  const users = { findById: vi.fn(), session: vi.fn() },
    rbac = { hasPermission: vi.fn() };
  beforeAll(async () => {
    const service = {
      terms: (...a: Parameters<DefensePlanningService["terms"]>) =>
        f.service.terms(...a),
      context: (...a: Parameters<DefensePlanningService["context"]>) =>
        f.service.context(...a),
      records: (...a: Parameters<DefensePlanningService["records"]>) =>
        f.service.records(...a),
      preview: (...a: Parameters<DefensePlanningService["preview"]>) =>
        f.service.preview(...a),
    };
    const m = await Test.createTestingModule({
      controllers: [DefensePlanningController],
      providers: [{ provide: DefensePlanningService, useValue: service }],
    }).compile();
    app = m.createNestApplication({ logger: false });
    app.setGlobalPrefix("api");
    const reflector = new Reflector();
    app.useGlobalGuards(
      new JwtAuthGuard(
        reflector,
        jwt,
        users as unknown as UserAccountRepository,
      ),
      new PermissionsGuard(reflector, rbac as unknown as RbacService),
    );
    app.useGlobalFilters(new GlobalExceptionHandler());
    await app.listen(0, "127.0.0.1");
    base = await app.getUrl();
  });
  afterAll(async () => {
    await app?.close();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    f = planningFixture();
    rbac.hasPermission.mockResolvedValue(true);
    users.findById.mockImplementation(async () => ({
      ...f.f.data.user,
      student: null,
      lecturer: null,
    }));
    users.session.mockResolvedValue({
      userId: "advisor-user",
      expiresAt: new Date(Date.now() + 60000),
      revokedAt: null,
    });
  });
  async function request(path: string, body?: object, authenticated = true) {
    const token = authenticated
      ? await jwt.signAsync({ sub: "advisor-user", sid: "unit-session" })
      : null;
    const response = await fetch(`${base}/api/${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  }
  it("401 precedes repository access", async () => {
    expect(
      (await request("defense-planning/terms", undefined, false)).status,
    ).toBe(401);
    expect(f.repo.read).not.toHaveBeenCalled();
  });
  it("403 permission precedes repository access", async () => {
    rbac.hasPermission.mockResolvedValue(false);
    expect((await request("terms/term/defense-planning/context")).status).toBe(
      403,
    );
    expect(f.repo.read).not.toHaveBeenCalled();
  });
  it("403 for wrong grant, even with endpoint permission", async () => {
    f.f.grant.termId = "other-term";
    expect((await request("terms/term/defense-planning/context")).status).toBe(
      403,
    );
    expect(f.s.members).not.toHaveBeenCalled();
  });
  it("GET returns real-source context with no internal file paths", async () => {
    const response = await request("terms/term/defense-planning/context");
    expect(response).toMatchObject({
      status: 200,
      body: {
        data: {
          source: { kind: "ROSTER_PREVIEW" },
          capabilities: { canCreateOfficial: false },
        },
      },
    });
    expect(JSON.stringify(response.body)).not.toMatch(
      /storageKey|filePath|checksum|decisionContext/,
    );
  });
  it("POST is a read-only nonpersistent preview when UC18 OPEN", async () => {
    const i = await f.input();
    const response = await request(
      "terms/term/defense-planning/committees/preview",
      { expectedContext: i.expectedContext, committees: i.committees },
    );
    expect(response).toMatchObject({
      status: 200,
      body: {
        data: { mode: "PREVIEW_ONLY", persisted: false, officialReady: false },
      },
    });
  });
  it("POST reviewer conflict is explained, no assignment is saved", async () => {
    const i = await f.input();
    const response = await request(
      "terms/term/defense-planning/reviewers/preview",
      {
        expectedContext: i.expectedContext,
        committees: i.committees,
        reviewers: [{ proposalId: "proposal", reviewerIds: ["advisor"] }],
      },
    );
    expect(response.status).toBe(200);
    expect(response.body.data.validForPreview).toBe(false);
    expect(
      response.body.data.issues.some(
        (i: { code: string }) => i.code === "ADVISOR_REVIEWER_CONFLICT",
      ),
    ).toBe(true);
  });
  it("POST schedule preview reports missing slots without claiming an official save", async () => {
    const i = await f.input();
    const response = await request(
      "terms/term/defense-planning/schedule/preview",
      { ...i, slots: [] },
    );
    expect(response).toMatchObject({
      status: 200,
      body: {
        data: {
          validForPreview: true,
          persisted: false,
          officialReady: false,
          warnings: expect.arrayContaining([
            expect.objectContaining({ code: "SCHEDULE_STUDENTS_UNSCHEDULED" }),
          ]),
        },
      },
    });
    expect(f.s.busySessions).not.toHaveBeenCalled();
  });
  it("POST rejects fabricated actor/snapshot fields with 400", async () => {
    const i = await f.input();
    expect(
      (
        await request("terms/term/defense-planning/schedule/preview", {
          ...i,
          actorId: "admin",
        })
      ).status,
    ).toBe(400);
  });
  it("POST rejects stale context with 409", async () => {
    const i = await f.input();
    i.expectedContext = "0".repeat(64);
    expect(
      (await request("terms/term/defense-planning/schedule/preview", i)).status,
    ).toBe(409);
  });
  it("no official create/finalize/publish route is silently enabled", async () => {
    expect(
      (await request("terms/term/defense-planning/committees", {})).status,
    ).toBe(404);
    expect(
      (await request("terms/term/defense-planning/schedule/publish", {}))
        .status,
    ).toBe(404);
    expect(
      (await request("terms/term/defense-planning/reviewers/finalize", {}))
        .status,
    ).toBe(404);
  });
});
