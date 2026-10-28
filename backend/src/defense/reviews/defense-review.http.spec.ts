import "reflect-metadata";
import {
  afterAll,
  beforeAll,
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
import type { UserAccountRepository } from "../../auth/repository/user-account.repository";
import type { RbacService } from "../../auth/service/rbac.service";
import { GlobalExceptionHandler } from "../../common/exception/global-exception.handler";
import { DefenseReviewService } from "./defense-review.service";
import { DefenseReviewController } from "./defense-review.controller";
import { reviewFixture } from "./defense-review.test-fixtures";

describe("UC17 inbox / UC18 preview HTTP with mock repository (no database)", () => {
  let f: ReturnType<typeof reviewFixture>;
  let app: INestApplication;
  let url: string;
  const jwt = new JwtService({ secret: "uc17-uc18-http-unit-only" });
  const users = { findById: vi.fn(), session: vi.fn() };
  const rbac = { hasPermission: vi.fn() };
  beforeAll(async () => {
    const service = {
      terms: (...args: Parameters<DefenseReviewService["terms"]>) =>
        f.service.terms(...args),
      inbox: (...args: Parameters<DefenseReviewService["inbox"]>) =>
        f.service.inbox(...args),
      preview: (...args: Parameters<DefenseReviewService["preview"]>) =>
        f.service.preview(...args),
    };
    const module = await Test.createTestingModule({
      controllers: [DefenseReviewController],
      providers: [{ provide: DefenseReviewService, useValue: service }],
    }).compile();
    app = module.createNestApplication({ logger: false });
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
    url = await app.getUrl();
  });
  afterAll(async () => {
    await app?.close();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    f = reviewFixture();
    users.findById.mockImplementation(async () => ({
      ...f.data.user,
      student: null,
      lecturer: null,
    }));
    users.session.mockResolvedValue({
      userId: "advisor-user",
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60000),
    });
    rbac.hasPermission.mockResolvedValue(true);
  });
  async function get(path: string, authenticated = true) {
    const token = authenticated
      ? await jwt.signAsync({ sub: "advisor-user", sid: "unit-session" })
      : null;
    const response = await fetch(`${url}/api/${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return { status: response.status, body: await response.json() };
  }
  it("returns 401 before service/repository when not authenticated", async () => {
    expect(
      (await get("defense-confirmations/inbox?termId=term", false)).status,
    ).toBe(401);
    expect(f.repo.read).not.toHaveBeenCalled();
  });
  it("returns 403 before repository when endpoint permission is missing", async () => {
    rbac.hasPermission.mockResolvedValue(false);
    expect((await get("defense-confirmations/inbox?termId=term")).status).toBe(
      403,
    );
    expect(f.repo.read).not.toHaveBeenCalled();
  });
  it("returns the official inbox through the actual controller, guard and DTO", async () => {
    const response = await get(
      "defense-confirmations/inbox?termId=term&status=CONFIRMED",
    );
    expect(response).toMatchObject({
      status: 200,
      body: { success: true, data: { total: 1, view: "ADVISOR" } },
    });
    expect(JSON.stringify(response.body)).not.toMatch(
      /storageKey|filePath|checksum|decisionContext/,
    );
  });
  it("rejects invalid query/spoofed studentId with 400", async () => {
    expect(
      (await get("defense-confirmations/inbox?termId=term&studentId=other"))
        .status,
    ).toBe(400);
    expect(
      (await get("terms/term/defense-list/preview?limit=1000")).status,
    ).toBe(400);
    expect(f.repo.read).not.toHaveBeenCalled();
  });
  it("faculty preview requires a real matching grant even with permission", async () => {
    f.faculty();
    f.grant.termId = "other-term";
    expect((await get("terms/term/defense-list/preview")).status).toBe(403);
  });
  it("full-term preview preserves incomplete students and never writes eligibility", async () => {
    f.faculty();
    f.data.proposals = [];
    const response = await get("terms/term/defense-list/preview");
    expect(response).toMatchObject({
      status: 200,
      body: {
        data: { rosterCount: 1, admittedCount: 0, rosterCompleteForTerm: true },
      },
    });
    expect(response.body.data.items[0].proposalId).toBeNull();
    expect(Object.keys(f.s)).not.toEqual(
      expect.arrayContaining(["update", "create", "upsert"]),
    );
  });
  it("term options use current actor scopes, not client identifiers", async () => {
    const response = await get("defense-confirmations/terms");
    expect(response.status).toBe(200);
    expect(f.s.advisorTerms).toHaveBeenCalledWith("advisor");
    expect((await get("defense-lists/terms")).status).toBe(403);
  });
});
