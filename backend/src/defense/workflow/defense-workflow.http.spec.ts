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
import { DefenseWorkflowController } from "./defense-workflow.controller";
import { DefenseWorkflowService } from "./defense-workflow.service";
import {
  approvedPolicy,
  workflowFixture,
} from "./defense-workflow.test-fixtures";

describe("UC18–21 HTTP with real guards/controllers and transactional repository fixture, no DB", () => {
  let app: INestApplication,
    base: string,
    f: ReturnType<typeof workflowFixture>;
  const jwt = new JwtService({ secret: "official-workflow-http-test-only" });
  const users = { findById: vi.fn(), session: vi.fn() },
    rbac = { hasPermission: vi.fn() };
  beforeAll(async () => {
    const forward =
      <K extends keyof DefenseWorkflowService>(key: K) =>
      (...args: Parameters<DefenseWorkflowService[K]>) =>
        Reflect.apply(f.service[key], f.service, args);
    const m = await Test.createTestingModule({
      controllers: [DefenseWorkflowController],
      providers: [
        {
          provide: DefenseWorkflowService,
          useValue: {
            context: forward("context"),
            configure: forward("configure"),
            academic: forward("academic"),
            academicHistory: forward("academicHistory"),
            finalizeList: forward("finalizeList"),
            reopenList: forward("reopenList"),
            saveStage: forward("saveStage"),
            sealStage: forward("sealStage"),
            published: forward("published"),
            history: forward("history"),
          },
        },
      ],
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
    f = workflowFixture();
    rbac.hasPermission.mockResolvedValue(true);
    users.findById.mockImplementation(async () => ({
      ...f.base.f.f.user,
      student: null,
      lecturer: null,
    }));
    users.session.mockResolvedValue({
      userId: f.userId,
      expiresAt: new Date(Date.now() + 60000),
      revokedAt: null,
    });
  });
  async function request(
    path: string,
    method = "GET",
    body?: unknown,
    auth = true,
  ) {
    const token = auth
      ? await jwt.signAsync({ sub: f.userId, sid: "unit-session" })
      : null;
    const response = await fetch(`${base}/api/terms/term/${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  }
  it("401 before any repository access", async () => {
    expect(
      (await request("defense-workflow", "GET", undefined, false)).status,
    ).toBe(401);
    expect(f.repo.transaction).not.toHaveBeenCalled();
  });
  it("403 missing controller permission before repository", async () => {
    rbac.hasPermission.mockResolvedValue(false);
    expect((await request("defense-workflow")).status).toBe(403);
    expect(f.repo.transaction).not.toHaveBeenCalled();
  });
  it.each(["grant", "inactive", "admin", "service-permission"])(
    "403 service %s even if endpoint guard is permitted",
    async (kind) => {
      if (kind === "grant") f.base.f.grant.termId = "outside-term";
      if (kind === "inactive") f.base.f.f.user.mustChangePassword = true;
      if (kind === "admin") {
        f.base.f.f.user.userRoles[0].role.name = "ADMIN";
        f.base.f.grant.allDepartments = false;
      }
      if (kind === "service-permission")
        f.base.f.f.user.userRoles[0].role.rolePermissions = [];
      expect((await request("defense-workflow")).status).toBe(403);
    },
  );
  it("GET is read-only and contains no private storage identities", async () => {
    const r = await request("defense-workflow");
    expect(r.status).toBe(200);
    expect(JSON.stringify(r.body)).not.toMatch(
      /storageKey|filePath|decisionContext/,
    );
    expect(f.state.audit).toEqual([]);
    expect(f.state.evidence).toEqual([]);
  });
  it("strict DTO rejects actor and fake snapshot fields", async () => {
    const b = {
      ...(await f.command(0)),
      policy: approvedPolicy,
      actorId: "admin",
    };
    expect(
      (await request("defense-list/workflow-policy", "PUT", b)).status,
    ).toBe(400);
    expect(f.state.list.workflowPolicyRevision).toBe(0);
  });
  it("strict reason and stage validation", async () => {
    expect(
      (
        await request("defense-list/reopen", "POST", {
          ...(await f.command(1)),
          reason: "  ",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await request("defense-workflow/UNKNOWN/draft", "PUT", {
          ...(await f.command(0)),
          draft: { slots: [] },
        })
      ).status,
    ).toBe(400);
  });
  it("HTTP config → academic → full roster finalization uses server snapshot V2", async () => {
    expect(
      (
        await request("defense-list/workflow-policy", "PUT", {
          ...(await f.command(0)),
          policy: approvedPolicy,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await request("defense-list/academic-evidence", "POST", {
          ...(await f.command(0)),
          termStudentId: "member",
          verdict: "SATISFIED",
          sourceReference: "TEST source",
          note: "",
        })
      ).status,
    ).toBe(201);
    const final = await request(
      "defense-list/finalize",
      "POST",
      await f.command(1),
    );
    expect(final.status).toBe(201);
    expect(f.state.finalizations[0].snapshotSchemaVersion).toBe(2);
    expect(
      (await request("defense-list/academic-evidence/member")).body,
    ).toMatchObject({
      data: {
        items: [
          expect.objectContaining({ revision: 1, integrity: "VERIFIED" }),
        ],
      },
    });
  });
  it("HTTP source change is 409 and does not create a draft", async () => {
    await f.finalized();
    const b = {
      ...(await f.command(0)),
      draft: { committees: [f.base.committee] },
    };
    f.base.f.data.proposals[0].finalReport.revision++;
    expect(
      (await request("defense-workflow/COMMITTEES/draft", "PUT", b)).status,
    ).toBe(409);
    expect(f.state.stages).toEqual([]);
  });
  it("HTTP cannot publish before finalized or sneak a source snapshot in", async () => {
    await f.through("COMMITTEES");
    expect(
      (
        await request(
          "defense-workflow/SCHEDULE/publish",
          "POST",
          await f.command(0),
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await request("defense-workflow/REVIEWERS/draft", "PUT", {
          ...(await f.command(0)),
          draft: { reviewers: f.base.reviewers },
          sourceFinalizationId: "forged",
        })
      ).status,
    ).toBe(400);
  });
  it("HTTP published route filters an unrelated reader", async () => {
    await f.through("SCHEDULE");
    await f.service.sealStage(
      f.userId,
      "term",
      "SCHEDULE",
      "publish",
      await f.command(2),
    );
    f.base.f.f.user.lecturer = null;
    f.base.f.f.user.student = null;
    f.base.f.data.grants = [];
    expect((await request("defense-schedule/published")).body).toMatchObject({
      data: { state: "PUBLISHED", items: [] },
    });
  });
});
