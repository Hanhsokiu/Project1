import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { ScheduleController } from "./schedule.controller";
import { ScheduleService } from "./schedule.service";
import { createScheduleFixture } from "../../../test/schedule.fixture";
import { ids } from "../../../test/final-defense.fixture";
import { JwtAuthGuard } from "../../common/security/jwt-auth.guard";
import { PermissionsGuard } from "../../common/security/permissions.guard";
import { RbacService } from "../../auth/service/rbac.service";
import type { UserAccountRepository } from "../../auth/repository/user-account.repository";
let app: INestApplication,
  root: string,
  f: Awaited<ReturnType<typeof createScheduleFixture>>;
const jwt = new JwtService({ secret: "TEST_ONLY_UC21_LOOPBACK" }),
  headers = (id = ids.faculty) => ({
    Authorization: `Bearer ${jwt.sign({ sub: id, sid: id }, { expiresIn: "1m" })}`,
  });
const get = (path: string, actor = ids.faculty) =>
  fetch(root + "/defense-schedules" + path, { headers: headers(actor) });
const post = (path: string, body: unknown, key = "key", actor = ids.faculty) =>
  fetch(root + "/defense-schedules" + path, {
    method: "POST",
    headers: {
      ...headers(actor),
      "Content-Type": "application/json",
      "Idempotency-Key": key,
    },
    body: JSON.stringify(body),
  });
beforeEach(async () => {
  f = await createScheduleFixture();
  const profiles = f.rw.cc.eligibility.f.users;
  const users = {
    findById: async (id: string) => profiles.get(id) ?? null,
    session: async (id: string) =>
      profiles.has(id)
        ? {
            id,
            userId: id,
            revokedAt: null,
            expiresAt: new Date(Date.now() + 60000),
          }
        : null,
    permissions: async (id: string) =>
      profiles
        .get(id)
        ?.userRoles.flatMap((r) =>
          r.role.rolePermissions.map(
            (p) => `${p.permission.resource}:${p.permission.action}`,
          ),
        ) ?? [],
  } as unknown as UserAccountRepository;
  const module = await Test.createTestingModule({
    controllers: [ScheduleController],
    providers: [{ provide: ScheduleService, useValue: f.service }],
  }).compile();
  app = module.createNestApplication({ logger: false });
  const reflector = new Reflector();
  app.useGlobalGuards(
    new JwtAuthGuard(reflector, jwt, users),
    new PermissionsGuard(reflector, new RbacService(users)),
  );
  await app.listen(0, "127.0.0.1");
  root = await app.getUrl();
});
afterEach(async () => {
  await app?.close();
});
describe("UC21 JWT/RBAC/Zod HTTP with synthetic storage", () => {
  it("GETs and manual/automatic preview do not persist data", async () => {
    expect((await fetch(root + "/defense-schedules/options")).status).toBe(401);
    for (const path of [
      "/options",
      `/workspace?termId=${ids.term}`,
      `?termId=${ids.term}`,
      `/proposal?termId=${ids.term}`,
    ])
      expect((await get(path)).status).toBe(200);
    expect(
      (await post("/preview", { sessionId: null, body: await f.saveBody() }))
        .status,
    ).toBe(201);
    expect(f.state.rows).toHaveLength(0);
    expect(f.state.events).toHaveLength(0);
    expect(f.state.replays.size).toBe(0);
  });
  it("preview -> apply -> update -> finalize -> publish -> personal read", async () => {
    const p = (await (await get(`/proposal?termId=${ids.term}`)).json()).data;
    expect(p.status).toBe("FEASIBLE");
    const b = {
      termId: ids.term,
      rosterHash: p.rosterHash,
      reason: "TEST_ONLY apply",
      sessions: p.sessions.map((body: unknown) => ({ id: null, body })),
    };
    const result = await post("/assignments", b, "apply");
    expect(result.status).toBe(201);
    const id = (await result.json()).data.sessions[0].id;
    expect((await post("/assignments", b, "apply")).status).toBe(201);
    const edit = await f.saveBody(id);
    edit.roomId = "r2";
    expect((await post(`/${id}/update`, edit, "edit")).status).toBe(201);
    expect((await post("/finalize", await f.command(id), "final")).status).toBe(
      201,
    );
    expect(
      (await (await get(`/workspace?termId=${ids.term}`, ids.student)).json())
        .data.schedules,
    ).toEqual([]);
    expect(
      (await post("/publish", await f.command(id), "publish")).status,
    ).toBe(201);
    const own = (
      await (await get(`/workspace?termId=${ids.term}`, ids.student)).json()
    ).data;
    expect(own.mode).toBe("PERSONAL");
    expect(own.schedules).toHaveLength(1);
    expect(own.sources).toEqual([]);
    expect(JSON.stringify(own)).not.toContain("totalScore");
    expect((await get(`/${id}?termId=${ids.term}`)).status).toBe(200);
  });
  it("returns 400/403/404/409 for invalid, forbidden, stale and conflicting requests", async () => {
    const b = await f.saveBody();
    expect((await post("", { ...b, actor: ids.faculty })).status).toBe(400);
    expect((await post("", b, "")).status).toBe(400);
    for (const actor of [ids.student, ids.lecturer, ids.admin])
      expect((await post("", b, "role", actor)).status).toBe(403);
    expect((await get(`/missing?termId=${ids.term}`)).status).toBe(404);
    expect((await get(`/workspace?termId=other`)).status).toBe(404);
    expect(
      (await post("", { ...b, startTime: "11:20" }, "overflow")).status,
    ).toBe(409);
    expect((await post("", b, "same")).status).toBe(201);
    expect((await post("", { ...b, reason: "different" }, "same")).status).toBe(
      409,
    );
    expect((await post("", b, "stale")).status).toBe(409);
  });
  it("keeps production writes disabled and does not expose unpublished personal details", async () => {
    f.control.writes = false;
    expect((await post("", await f.saveBody())).status).toBe(409);
    expect(f.state.rows).toHaveLength(0);
    const own = (
      await (await get(`/workspace?termId=${ids.term}`, ids.student)).json()
    ).data;
    expect(own.schedules).toEqual([]);
    expect(own.sources).toEqual([]);
    expect(own.rooms).toEqual([]);
  });
});
