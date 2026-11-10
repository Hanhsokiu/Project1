import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { FinalResultController } from "./final-result.controller";
import { FinalResultService } from "./final-result.service";
import { createFinalResultFixture } from "../../../test/final-result.fixture";
import { ids } from "../../../test/final-defense.fixture";
import { memberId } from "../../../test/eligibility.fixture";
import { JwtAuthGuard } from "../../common/security/jwt-auth.guard";
import { PermissionsGuard } from "../../common/security/permissions.guard";
import { RbacService } from "../../auth/service/rbac.service";
import type { UserAccountRepository } from "../../auth/repository/user-account.repository";
let app: INestApplication,
  root: string,
  f: Awaited<ReturnType<typeof createFinalResultFixture>>;
const jwt = new JwtService({ secret: "TEST_ONLY_UC24_LOOPBACK" }),
  headers = (actor: string) => ({
    Authorization: `Bearer ${jwt.sign({ sub: actor, sid: actor }, { expiresIn: "1m" })}`,
  });
const get = (path: string, actor = ids.faculty) =>
  fetch(root + path, { headers: headers(actor) });
const post = (
  action: string,
  body: unknown,
  actor = ids.faculty,
  key = "key",
) =>
  fetch(root + `/${memberId}/${action}`, {
    method: "POST",
    headers: {
      ...headers(actor),
      "Content-Type": "application/json",
      "Idempotency-Key": key,
    },
    body: JSON.stringify(body),
  });
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime("2030-11-07T01:05:00Z");
  f = await createFinalResultFixture();
  const users = {
    findById: async (id: string) => f.users.get(id) ?? null,
    session: async (id: string) =>
      f.users.has(id)
        ? {
            id,
            userId: id,
            revokedAt: null,
            expiresAt: new Date(Date.now() + 60000),
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
    controllers: [FinalResultController],
    providers: [{ provide: FinalResultService, useValue: f.service }],
  }).compile();
  app = m.createNestApplication({ logger: false });
  app.setGlobalPrefix("api");
  const reflector = new Reflector();
  app.useGlobalGuards(
    new JwtAuthGuard(reflector, jwt, users),
    new PermissionsGuard(reflector, new RbacService(users)),
  );
  await app.listen(0, "127.0.0.1");
  root = (await app.getUrl()) + "/api/defense-results";
});
afterEach(async () => {
  await app?.close();
  vi.useRealTimers();
});
describe("UC24 isolated HTTP with real JWT/session/RBAC/Zod", () => {
  it("requires auth; GET/options/list/POST-preview are readonly and no-store", async () => {
    expect((await fetch(root + "/options")).status).toBe(401);
    for (const path of [
      "/options",
      `?termId=${ids.term}`,
      `/${memberId}?termId=${ids.term}`,
    ]) {
      const r = await get(path);
      expect(r.status).toBe(200);
      expect(r.headers.get("cache-control")).toContain("no-store");
    }
    expect((await post("preview", { termId: ids.term })).status).toBe(201);
    expect(f.state.row).toBeNull();
    expect(f.state.replay.size).toBe(0);
  });
  it("rejects forged fields and bad query scope", async () => {
    const b = await f.body();
    for (const extra of [
      { actorId: ids.faculty },
      { finalScore: "10" },
      { state: "PUBLISHED" },
    ])
      expect((await post("finalize", { ...b, ...extra })).status).toBe(400);
    expect((await get(`/${memberId}?termId=other`)).status).toBe(404);
    expect((await get(`?termId=${ids.term}&limit=1000`)).status).toBe(400);
    expect((await post("finalize", b, ids.admin)).status).toBe(403);
  });
  it("confirms, finalizes, publishes separately and retries once", async () => {
    for (const m of ["l1", "l2"]) {
      const actor = f.cg.actor(m);
      expect(
        (await post("confirm", await f.body(actor), actor, m)).status,
      ).toBe(201);
    }
    const b = await f.body();
    expect((await post("finalize", b)).status).toBe(201);
    expect((await post("finalize", b)).status).toBe(201);
    expect((await post("finalize", { ...b, reason: "changed" })).status).toBe(
      409,
    );
    const before = await (
      await get(`/${memberId}?termId=${ids.term}`, ids.student)
    ).json();
    expect(before.data.calculation).toBeNull();
    expect((await post("publish", await f.body())).status).toBe(201);
    const after = await (
      await get(`/${memberId}?termId=${ids.term}`, ids.student)
    ).json();
    expect(after.data.state).toBe("PUBLISHED");
    expect(after.data.calculation.finalScore).toBeDefined();
    expect(after.data.sources).toEqual([]);
    expect(after.data.history).toEqual([]);
    expect(f.state.events).toHaveLength(4);
  });
  it("stale publication is withheld without deleting history", async () => {
    await f.confirm();
    await f.command("finalize");
    await f.command("publish");
    f.policy.version += "new";
    const result = await (
      await get(`/${memberId}?termId=${ids.term}`, ids.student)
    ).json();
    expect(result.data.calculation).toBeNull();
    expect(result.data.state).toBe("STALE");
    expect(f.state.events).toHaveLength(4);
  });
});
