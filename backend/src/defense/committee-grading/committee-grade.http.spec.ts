import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { CommitteeGradeController } from "./committee-grade.controller";
import { CommitteeGradeService } from "./committee-grade.service";
import { createCommitteeGradeFixture } from "../../../test/committee-grade.fixture";
import { ids } from "../../../test/final-defense.fixture";
import { memberId } from "../../../test/eligibility.fixture";
import { JwtAuthGuard } from "../../common/security/jwt-auth.guard";
import { PermissionsGuard } from "../../common/security/permissions.guard";
import { RbacService } from "../../auth/service/rbac.service";
import type { UserAccountRepository } from "../../auth/repository/user-account.repository";
import { ScoreService } from "../../grading/service/score.service";
import { ScoreController } from "../../grading/controller/score.controller";
import type { PrismaService } from "../../prisma/prisma.service";
let app: INestApplication,
  root: string,
  f: Awaited<ReturnType<typeof createCommitteeGradeFixture>>;
const jwt = new JwtService({ secret: "TEST_ONLY_UC23_LOOPBACK" }),
  headers = (actor = f.actor()) => ({
    Authorization: `Bearer ${jwt.sign({ sub: actor, sid: actor }, { expiresIn: "1m" })}`,
  });
const get = (path: string, actor = f.actor()) =>
  fetch(root + "/defense-committee-grades" + path, { headers: headers(actor) });
const post = (path: string, body: unknown, key = "key", actor = f.actor()) =>
  fetch(root + "/defense-committee-grades" + path, {
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
  f = await createCommitteeGradeFixture();
  const profiles = f.users,
    users = {
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
  const legacy = new ScoreService({
    scoreEntry: {
      findMany: async ({ where }: { where: { role: { notIn: string[] } } }) =>
        f.state.scores.filter((r) => !where.role.notIn.includes(r.role)),
    },
  } as unknown as PrismaService);
  Reflect.defineMetadata("design:paramtypes", [ScoreService], ScoreController);
  const m = await Test.createTestingModule({
    controllers: [CommitteeGradeController, ScoreController],
    providers: [
      { provide: CommitteeGradeService, useValue: f.service },
      { provide: ScoreService, useValue: legacy },
    ],
  }).compile();
  app = m.createNestApplication({ logger: false });
  app.setGlobalPrefix("api");
  const reflector = new Reflector();
  app.useGlobalGuards(
    new JwtAuthGuard(reflector, jwt, users),
    new PermissionsGuard(reflector, new RbacService(users)),
  );
  await app.listen(0, "127.0.0.1");
  root = (await app.getUrl()) + "/api";
});
afterEach(async () => {
  await app?.close();
  vi.useRealTimers();
});
const detailPath = () =>
  `/${memberId}?termId=${ids.term}&committeeId=${f.committeeId}`;
describe("UC23 prefixed HTTP JWT/session/RBAC/Zod with isolated transactional adapters", () => {
  it("GET/options/own sheet/private PDF never create score/audit/idempotency", async () => {
    expect(
      (await fetch(root + "/defense-committee-grades/options")).status,
    ).toBe(401);
    for (const p of ["/options", `?termId=${ids.term}`, detailPath()])
      expect((await get(p)).status).toBe(200);
    const v = (await (await get(detailPath())).json()).data;
    const pdf = await get(
      `/${memberId}/versions/${v.report.id}/pdf?termId=${ids.term}&committeeId=${f.committeeId}`,
    );
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get("cache-control")).toContain("no-store");
    expect(
      Buffer.from(await pdf.arrayBuffer())
        .subarray(0, 5)
        .toString(),
    ).toBe("%PDF-");
    expect(f.state.scores).toEqual([]);
    expect(f.state.events).toEqual([]);
    expect(f.state.replays.size).toBe(0);
  });
  it("independent chair/secretary drafts/finals retry once and legacy endpoint discloses neither committee role", async () => {
    const b = await f.body();
    expect((await post(`/${memberId}/save`, b, "draft")).status).toBe(201);
    expect((await post(`/${memberId}/save`, b, "draft")).status).toBe(201);
    expect(
      (await post(`/${memberId}/finalize`, await f.body(), "final")).status,
    ).toBe(201);
    expect(
      (
        await post(
          `/${memberId}/finalize`,
          await f.body(f.actor("l2")),
          "secretary",
          f.actor("l2"),
        )
      ).status,
    ).toBe(201);
    expect(f.state.scores).toHaveLength(2);
    f.state.scores.push({
      ...f.state.scores[0],
      id: "legacy-chair",
      scorerId: "l9",
      role: "COMMITTEE_CHAIR",
    });
    const result = await fetch(`${root}/scores/proposal/${ids.proposal}`, {
      headers: headers(ids.student),
    });
    expect(result.status).toBe(200);
    const payload = JSON.stringify(await result.json());
    expect(payload).not.toContain("TEST_ONLY own committee");
    expect(payload).not.toContain("legacy-chair");
  });
  it("returns 400/403/404/409 without accepting actor/duplicate/missing/stale inputs", async () => {
    const b = await f.body();
    expect(
      (await post(`/${memberId}/save`, { ...b, scorerId: "l2" })).status,
    ).toBe(400);
    expect(
      (
        await post(`/${memberId}/save`, {
          ...b,
          criterionScores: [b.criterionScores[0], b.criterionScores[0]],
        })
      ).status,
    ).toBe(400);
    expect((await post(`/${memberId}/save`, b, "")).status).toBe(400);
    expect(
      (await post(`/${memberId}/save`, b, "admin", ids.admin)).status,
    ).toBe(403);
    expect((await get(detailPath() + "&lecturerId=l2")).status).toBe(404);
    expect(
      (await post(`/${memberId}/save`, { ...b, expectedRevision: 99 }, "stale"))
        .status,
    ).toBe(409);
    expect((await get(detailPath(), ids.student)).status).toBe(403);
    expect(f.state.scores).toEqual([]);
  });
  it("faculty progress and content permissions are independent; writes remain gated", async () => {
    await f.command("finalize");
    const q = detailPath() + "&lecturerId=l1",
      v = (await (await get(q, ids.faculty)).json()).data;
    expect(v.score).toBeNull();
    expect(v.comment).toBeNull();
    expect(v.history).toEqual([]);
    const p = await get(`/progress?termId=${ids.term}`, ids.faculty);
    expect(p.status).toBe(200);
    expect((await p.json()).data.items[0].missingRequired).toBe(2);
    f.control.writes = false;
    expect(
      (
        await post(
          `/${memberId}/save`,
          await f.body(f.actor("l2")),
          "disabled",
          f.actor("l2"),
        )
      ).status,
    ).toBe(409);
    f.users.get(f.actor())!.status = "DISABLED" as never;
    expect((await get("/options")).status).toBe(403);
  });
});
