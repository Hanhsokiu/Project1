import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Reflector } from "@nestjs/core";
import { ReportController } from "./report.controller";
import { ReportService } from "./report.service";
import { createReportingFixture } from "../../../test/reporting.fixture";
import { ids } from "../../../test/final-defense.fixture";
import { JwtAuthGuard } from "../../common/security/jwt-auth.guard";
import { PermissionsGuard } from "../../common/security/permissions.guard";
import { RbacService } from "../../auth/service/rbac.service";
import type { UserAccountRepository } from "../../auth/repository/user-account.repository";
let app: INestApplication,
  root: string,
  f: Awaited<ReturnType<typeof createReportingFixture>>;
const jwt = new JwtService({ secret: "TEST_ONLY_UC25_LOOPBACK" }),
  headers = (actor = ids.faculty) => ({
    Authorization: `Bearer ${jwt.sign({ sub: actor, sid: actor }, { expiresIn: "5m" })}`,
  });
const get = (path: string, actor = ids.faculty) =>
  fetch(root + path, { headers: headers(actor) });
const post = (path: string, b: unknown, key = "key", actor = ids.faculty) =>
  fetch(root + path, {
    method: "POST",
    headers: {
      ...headers(actor),
      "Content-Type": "application/json",
      "Idempotency-Key": key,
    },
    body: JSON.stringify(b),
  });
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime("2030-11-07T01:05:00Z");
  f = await createReportingFixture();
  const users = {
    findById: async (id: string) => f.users.get(id) ?? null,
    session: async (id: string) =>
      f.users.has(id)
        ? {
            id,
            userId: id,
            revokedAt: null,
            expiresAt: new Date(Date.now() + 300000),
          }
        : null,
    permissions: async (id: string) =>
      f.users
        .get(id)
        ?.userRoles.flatMap((r) =>
          r.role.rolePermissions.map(
            (p) => `${p.permission.resource}:${p.permission.action}`,
          ),
        ) ?? [],
  } as unknown as UserAccountRepository;
  const m = await Test.createTestingModule({
    controllers: [ReportController],
    providers: [{ provide: ReportService, useValue: f.service }],
  }).compile();
  app = m.createNestApplication({ logger: false });
  app.setGlobalPrefix("api");
  const reflector = new Reflector();
  app.useGlobalGuards(
    new JwtAuthGuard(reflector, jwt, users),
    new PermissionsGuard(reflector, new RbacService(users)),
  );
  await app.listen(0, "127.0.0.1");
  root = (await app.getUrl()) + "/api/defense-reports";
});
afterEach(async () => {
  await app?.close();
  vi.useRealTimers();
});
describe("UC25 isolated HTTP JWT/session/RBAC, real XLSX/PDF bytes", () => {
  it("requires auth and all GET/preview are readonly/no-store", async () => {
    expect((await fetch(root + "/options")).status).toBe(401);
    for (const path of [
      "/options",
      `/options?termId=${ids.term}`,
      `/templates?termId=${ids.term}`,
      `/statistics?termId=${ids.term}`,
      `/exports?termId=${ids.term}`,
    ]) {
      const r = await get(path);
      expect(r.status).toBe(200);
      expect(r.headers.get("cache-control")).toContain("no-store");
    }
    const preview = await post("/exports/preview", f.request());
    expect(preview.status).toBe(200);
    expect((await preview.json()).data.count).toBe(1);
    expect(f.state.events).toHaveLength(0);
    expect(f.state.keys.size).toBe(0);
  });
  it("separates creation and authenticated audited download with safe headers and exact replay", async () => {
    const b = await f.body(),
      made = await post("/exports", b);
    expect(made.status).toBe(201);
    const m = (await made.json()).data;
    expect((await post("/exports", b)).status).toBe(201);
    expect((await get(`/exports/${m.id}`)).status).toBe(200);
    expect((await get(`/exports/${m.id}/download`)).status).toBe(404);
    const downloaded = await post(`/exports/${m.id}/download`, {}, "download");
    expect(downloaded.status).toBe(200);
    expect(downloaded.headers.get("content-type")).toContain("spreadsheetml");
    expect(downloaded.headers.get("content-disposition")).toMatch(
      /^attachment; filename="uc25-/,
    );
    expect(downloaded.headers.get("cache-control")).toContain("no-store");
    expect(downloaded.headers.get("x-content-type-options")).toBe("nosniff");
    expect(
      Buffer.from(await downloaded.arrayBuffer())
        .subarray(0, 2)
        .toString(),
    ).toBe("PK");
    expect(
      (await post(`/exports/${m.id}/download`, {}, "download")).status,
    ).toBe(200);
    expect(f.state.events.map((e) => e.action)).toEqual([
      "EXPORT_GENERATED",
      "DELIVERY_PREPARED",
    ]);
  });
  it("rejects cross-scope/student/admin and strict path/body injection", async () => {
    const b = await f.body();
    for (const actor of [ids.student, ids.admin])
      expect((await post("/exports", b, "no", actor)).status).toBe(403);
    for (const extra of [
      { filePath: "../uploads" },
      { actorId: ids.admin },
      { signatureStatus: "SIGNED" },
    ])
      expect((await post("/exports", { ...b, ...extra })).status).toBe(400);
    expect((await post("/exports/not-a-uuid/download", {})).status).toBe(400);
    expect((await get("/statistics?termId=other")).status).toBe(404);
  });
  it("render error is safely redacted and never delivered as successful PDF", async () => {
    f.control.renderFailure = true;
    const r = await post("/exports", await f.body(f.request("PDF_RESULTS")));
    expect(r.status).toBe(409);
    expect(await r.text()).not.toContain("private details");
    expect(f.state.events[0].action).toBe("GENERATION_FAILED");
  });
});
