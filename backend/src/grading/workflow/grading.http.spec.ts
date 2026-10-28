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
import { GradingController } from "./grading.controller";
import { GradingService } from "./grading.service";
import { gradingFixture } from "./grading.test-fixtures";
import { OfficialReportController } from "../../report/official/official-report.controller";
import { OfficialReportService } from "../../report/official/official-report.service";
import type { GradingRepository } from "./grading.repository";
import type { AuditService } from "../../common/audit/audit.service";

describe("UC22–24 HTTP, real JWT/permission guards/controller/service with fake transactional repository", () => {
  let app: INestApplication,
    root: string,
    f: Awaited<ReturnType<typeof gradingFixture>>,
    reports: OfficialReportService;
  const jwt = new JwtService({ secret: "package-f-test-only" }),
    users = { findById: vi.fn(), session: vi.fn() },
    rbac = { hasPermission: vi.fn() };
  beforeAll(async () => {
    const methods = [
      "inbox",
      "context",
      "save",
      "history",
      "download",
      "policy",
      "configure",
      "preview",
      "myResults",
      "published",
      "resultCommand",
      "resultHistory",
      "policyHistory",
    ];
    const module = await Test.createTestingModule({
      controllers: [GradingController, OfficialReportController],
      providers: [
        {
          provide: OfficialReportService,
          useValue: {
            export: (...args: Parameters<OfficialReportService["export"]>) =>
              reports.export(...args),
            summary: (...args: Parameters<OfficialReportService["summary"]>) =>
              reports.summary(...args),
          },
        },
        {
          provide: GradingService,
          useValue: Object.fromEntries(
            methods.map((k) => [
              k,
              (...args: unknown[]) =>
                Reflect.apply(Reflect.get(f.service, k), f.service, args),
            ]),
          ),
        },
      ],
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
    root = await app.getUrl();
  });
  afterAll(async () => {
    await app?.close();
  });
  beforeEach(async () => {
    vi.clearAllMocks();
    f = await gradingFixture();
    await f.configure();
    reports = new OfficialReportService(
      f.repo as unknown as GradingRepository,
      f.service,
      f.sources,
      f.base.audit as unknown as AuditService,
    );
    rbac.hasPermission.mockResolvedValue(true);
    users.findById.mockImplementation(async (id: string) => ({
      ...f.actors.get(id),
      lecturer: null,
      student: null,
    }));
    users.session.mockImplementation(async () => ({
      userId: "reviewer-user",
      expiresAt: new Date(Date.now() + 60000),
      revokedAt: null,
    }));
  });
  async function request(
    path: string,
    method = "GET",
    body?: unknown,
    id: string | null = "reviewer-user",
  ) {
    users.session.mockResolvedValue({
      userId: id,
      expiresAt: new Date(Date.now() + 60000),
      revokedAt: null,
    });
    const token = id ? await jwt.signAsync({ sub: id, sid: "test" }) : null;
    return fetch(`${root}/api/terms/term/${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }
  const path = "grading/proposals/proposal/REVIEWER";
  it("401 unauthenticated before any repository query", async () => {
    f.repo.transaction.mockClear();
    expect((await request(path, "GET", undefined, null)).status).toBe(401);
    expect(f.repo.transaction).not.toHaveBeenCalled();
  });
  it("403 missing guard permission before service access", async () => {
    rbac.hasPermission.mockResolvedValue(false);
    f.repo.transaction.mockClear();
    expect((await request(path)).status).toBe(403);
    expect(f.repo.transaction).not.toHaveBeenCalled();
  });
  it("403 wrong official reviewer; role alone is insufficient", async () => {
    expect(
      (await request(path, "GET", undefined, "stranger-user")).status,
    ).toBe(403);
  });
  it("403 inactive account at service even if guard allows request", async () => {
    f.actors.get("reviewer-user")!.lecturer!.isActive = false;
    expect((await request(path)).status).toBe(403);
  });
  it("GET context sanitizes metadata and supplies exact CAS fields", async () => {
    const r = await request(path),
      body = await r.json();
    expect(r.status).toBe(200);
    expect(body.data.expectedContext).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(body)).not.toMatch(/storageKey|filePath|password/);
    expect(r.headers.get("cache-control")).toContain("no-store");
  });
  it("GET context can be sent directly to PUT draft and POST seal", async () => {
    let c = (await (await request(path)).json()).data;
    const b = {
      expectedRevision: c.expectedRevision,
      expectedContext: c.expectedContext,
      requestId: crypto.randomUUID(),
      draft: {
        values: {
          LAYOUT: 2,
          CONTENT: 3,
          RELEVANCE: 1,
          COMPLETENESS: 2,
          MASTERY: 2,
        },
        comment: "Nhận xét",
        questions: ["Q1?", "Q2?"],
      },
    };
    expect((await request(`${path}/draft`, "PUT", b)).status).toBe(200);
    c = (await (await request(path)).json()).data;
    expect(
      (
        await request(`${path}/seal`, "POST", {
          expectedRevision: c.expectedRevision,
          expectedContext: c.expectedContext,
          requestId: crypto.randomUUID(),
        })
      ).status,
    ).toBe(201);
    expect(f.state.sheets[0].state).toBe("SEALED");
  });
  it("400 strict DTO rejects actorId and fake snapshot", async () => {
    expect(
      (
        await request(`${path}/draft`, "PUT", {
          ...(await f.command()),
          actorId: "admin",
          draft: { values: {}, comment: "", questions: [] },
        })
      ).status,
    ).toBe(400);
    expect(f.state.sheets).toHaveLength(0);
  });
  it("422 component outside rubric", async () => {
    expect(
      (
        await request(`${path}/draft`, "PUT", {
          ...(await f.command()),
          draft: { values: { LAYOUT: 3 }, comment: "", questions: [] },
        })
      ).status,
    ).toBe(422);
  });
  it("409 stale context does not write", async () => {
    expect(
      (
        await request(`${path}/draft`, "PUT", {
          ...(await f.command()),
          expectedRevision: 8,
          draft: { values: {}, comment: "", questions: [] },
        })
      ).status,
    ).toBe(409);
    expect(f.state.sheets).toHaveLength(0);
  });
  it("404 absent proposal with current assignment", async () => {
    f.session.proposal.mockResolvedValue(null as never);
    expect((await request(path)).status).toBe(404);
  });
  it("403 Khoa cannot bypass an out-of-term grant", async () => {
    f.grant.termId = "other";
    expect(
      (
        await request(
          "grading/results/preview",
          "GET",
          undefined,
          "faculty-user",
        )
      ).status,
    ).toBe(403);
  });
  it("student receives no unpublished mark or author notes", async () => {
    const r = await request(
        "grading/results/proposal",
        "GET",
        undefined,
        "student-user",
      ),
      body = await r.json();
    expect(r.status).toBe(200);
    expect(body.data.state).toBe("NOT_PUBLISHED");
    expect(body.data.result).toBe(null);
    expect(JSON.stringify(body)).not.toMatch(/draft|questions|comment|scorer/);
  });
  it("409 publication remains blocked with UNKNOWN policy/ports", async () => {
    const c = (await f.service.preview("faculty-user", "term")).items[0];
    const r = await request(
      "grading/results/proposal/publish",
      "POST",
      {
        expectedRevision: c.revision,
        expectedContext: c.expectedContext,
        requestId: crypto.randomUUID(),
      },
      "faculty-user",
    );
    expect(r.status).toBe(409);
    expect(f.state.results).toHaveLength(0);
  });
  it("private PDF headers are safe; old identity returns 409", async () => {
    const c = await f.context(),
      q = new URLSearchParams({
        finalReportId: c.pdf!.finalReportId,
        revision: String(c.pdf!.revision),
        checksum: c.pdf!.checksum,
      });
    const r = await request(`${path}/report?${q}`);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("application/pdf");
    expect(r.headers.get("content-disposition")).not.toMatch(
      /[\r\n]|storageKey/,
    );
    expect(r.headers.get("cache-control")).toContain("no-store");
    expect(
      Buffer.from(await r.arrayBuffer())
        .subarray(0, 5)
        .toString(),
    ).toBe("%PDF-");
    f.base.base.f.f.report.revision++;
    expect((await request(`${path}/report?${q}`)).status).toBe(409);
  });
  it("history pagination limits are validated", async () => {
    expect((await request(`${path}/history?limit=1000`)).status).toBe(400);
  });
  it("official-report XLSX is privately delivered only after grant/auth/audit", async () => {
    const r = await request(
      "official-reports/export?kind=REVIEWERS&format=XLSX",
      "GET",
      undefined,
      "faculty-user",
    );
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("spreadsheetml");
    expect(r.headers.get("cache-control")).toContain("no-store");
    expect(r.headers.get("content-disposition")).not.toMatch(/[\r\n]/);
    expect(
      Buffer.from(await r.arrayBuffer())
        .subarray(0, 2)
        .toString(),
    ).toBe("PK");
    f.grant.termId = "outside";
    expect(
      (
        await request(
          "official-reports/export?kind=REVIEWERS&format=XLSX",
          "GET",
          undefined,
          "faculty-user",
        )
      ).status,
    ).toBe(403);
  });
  it("official summary is scoped and empty export is404", async () => {
    const r = await request(
      "official-reports/summary",
      "GET",
      undefined,
      "faculty-user",
    );
    expect(r.status).toBe(200);
    expect((await r.json()).data.publishedResults).toBe(0);
    expect(
      (
        await request(
          "official-reports/export?kind=RESULTS&format=XLSX",
          "GET",
          undefined,
          "faculty-user",
        )
      ).status,
    ).toBe(404);
  });
  it.each([
    "grading/proposals/proposal/REVIEWER/report?finalReportId=x&revision=1&checksum=" +
      "a".repeat(64),
    "official-reports/export?kind=RESULTS&format=PDF",
  ])(
    "private binary endpoint requires JWT before reading %s",
    async (route) => {
      f.repo.transaction.mockClear();
      expect((await request(route, "GET", undefined, null)).status).toBe(401);
      expect(f.repo.transaction).not.toHaveBeenCalled();
    },
  );
  it("export permission cannot substitute for the results-reading permission", async () => {
    const u = f.actors.get("faculty-user")!;
    u.userRoles[0].role.rolePermissions =
      u.userRoles[0].role.rolePermissions.filter(
        (p) => p.permission.action !== "read-results",
      );
    const r = await request(
      "official-reports/export?kind=RESULTS&format=XLSX",
      "GET",
      undefined,
      "faculty-user",
    );
    expect(r.status).toBe(403);
    expect(await r.text()).not.toMatch(
      /storageKey|filePath|gradeValues|studentName/,
    );
  });
  it("score sheet seal has no permission to publish and no student notification of a mark", async () => {
    await f.save();
    await f.seal();
    const r = await request(
      "grading/results/proposal/publish",
      "POST",
      {
        expectedRevision: 0,
        expectedContext: "a".repeat(64),
        requestId: crypto.randomUUID(),
      },
      "reviewer-user",
    );
    expect(r.status).toBe(403);
    expect(f.state.results).toHaveLength(0);
    expect(
      f.base.state.notifications.some((n) =>
        JSON.stringify(n).includes("student-user"),
      ),
    ).toBe(false);
  });
  it("unsupported signed template returns explicit409 after valid authentication/scope", async () => {
    const r = await request(
      "official-reports/export?kind=REVIEWERS&format=PDF",
      "GET",
      undefined,
      "faculty-user",
    );
    expect(r.status).toBe(409);
    expect((await r.json()).error.code).toBe("REPORT_TEMPLATE_NOT_CONFIGURED");
  });
});
