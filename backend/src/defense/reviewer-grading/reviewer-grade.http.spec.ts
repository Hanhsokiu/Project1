import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { ReviewerGradeController } from "./reviewer-grade.controller";
import { ReviewerGradeService } from "./reviewer-grade.service";
import {
  createReviewerGradeFixture,
  reviewerActor,
} from "../../../test/reviewer-grade.fixture";
import { ids } from "../../../test/final-defense.fixture";
import { memberId } from "../../../test/eligibility.fixture";
import { JwtAuthGuard } from "../../common/security/jwt-auth.guard";
import { PermissionsGuard } from "../../common/security/permissions.guard";
import { RbacService } from "../../auth/service/rbac.service";
import type { UserAccountRepository } from "../../auth/repository/user-account.repository";
import { ScoreController } from "../../grading/controller/score.controller";
import { ScoreService } from "../../grading/service/score.service";
import type { PrismaService } from "../../prisma/prisma.service";
let app: INestApplication,
  root: string,
  f: Awaited<ReturnType<typeof createReviewerGradeFixture>>;
const jwt = new JwtService({ secret: "TEST_ONLY_UC22_LOOPBACK" }),
  headers = (actor = reviewerActor) => ({
    Authorization: `Bearer ${jwt.sign({ sub: actor, sid: actor }, { expiresIn: "1m" })}`,
  });
const get = (path: string, actor = reviewerActor) =>
  fetch(root + "/defense-reviewer-grades" + path, { headers: headers(actor) });
const post = (
  path: string,
  body: unknown,
  key = "key",
  actor = reviewerActor,
) =>
  fetch(root + "/defense-reviewer-grades" + path, {
    method: "POST",
    headers: {
      ...headers(actor),
      "Content-Type": "application/json",
      "Idempotency-Key": key,
    },
    body: JSON.stringify(body),
  });
beforeEach(async () => {
  f = await createReviewerGradeFixture();
  const profiles = f.users;
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
  const scores = new ScoreService({
    scoreEntry: {
      findMany: async ({ where }: { where: { role: { notIn: string[] } } }) =>
        f.state.scores.filter((r) => !where.role.notIn.includes(r.role)),
    },
  } as unknown as PrismaService);
  // Vitest transform does not emit the legacy controller's constructor metadata.
  // Native Nest build is checked separately; no production controller change needed.
  Reflect.defineMetadata("design:paramtypes", [ScoreService], ScoreController);
  const m = await Test.createTestingModule({
    controllers: [ReviewerGradeController, ScoreController],
    providers: [
      { provide: ReviewerGradeService, useValue: f.service },
      { provide: ScoreService, useValue: scores },
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
});
describe("UC22 isolated JWT/session/RBAC/Zod HTTP, no real database", () => {
  it("denies a fully permitted lecturer without the actual reviewer assignment", async () => {
    const b = await f.body();
    const unrelated = structuredClone(f.users.get(reviewerActor)!);
    unrelated.id = ids.outsider;
    unrelated.lecturer!.id = "unassigned-reviewer";
    f.users.set(ids.outsider, unrelated);
    expect(
      (await get(`/${memberId}?termId=${ids.term}`, ids.outsider)).status,
    ).toBe(404);
    for (const action of ["save", "finalize"]) {
      expect(
        (
          await post(
            `/${memberId}/${action}`,
            b,
            `denied-${action}`,
            ids.outsider,
          )
        ).status,
      ).toBe(404);
    }
    expect(f.state.scores).toEqual([]);
    expect(f.state.events).toEqual([]);
    expect(f.state.replays.size).toBe(0);
  });
  it("uses actual prefixed GET/options/list/detail/private PDF, without writes", async () => {
    expect(
      (await fetch(root + "/defense-reviewer-grades/options")).status,
    ).toBe(401);
    for (const p of [
      "/options",
      `?termId=${ids.term}`,
      `/${memberId}?termId=${ids.term}`,
    ])
      expect((await get(p)).status).toBe(200);
    const v = (await (await get(`/${memberId}?termId=${ids.term}`)).json())
      .data;
    const pdf = await get(
      `/${memberId}/versions/${v.report.id}/pdf?termId=${ids.term}`,
    );
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get("cache-control")).toContain("no-store");
    expect(pdf.headers.get("content-type")).toContain("application/pdf");
    expect(
      Buffer.from(await pdf.arrayBuffer())
        .subarray(0, 5)
        .toString(),
    ).toBe("%PDF-");
    expect(f.state.scores).toHaveLength(0);
    expect(f.state.events).toHaveLength(0);
    expect(f.state.replays.size).toBe(0);
  });
  it("draft/save/finalize/retry retains one score and protects legacy score reader", async () => {
    let b = await f.body();
    expect((await post(`/${memberId}/save`, b, "draft")).status).toBe(201);
    expect((await post(`/${memberId}/save`, b, "draft")).status).toBe(201);
    b = await f.body();
    expect((await post(`/${memberId}/finalize`, b, "final")).status).toBe(201);
    expect((await post(`/${memberId}/finalize`, b, "final")).status).toBe(201);
    expect(f.state.scores).toHaveLength(1);
    expect(f.state.events).toHaveLength(2);
    expect((await f.detail()).state).toBe("FINALIZED");
    const legacy = await fetch(`${root}/scores/proposal/${ids.proposal}`, {
      headers: headers(ids.student),
    });
    expect(legacy.status).toBe(200);
    expect(JSON.stringify(await legacy.json())).not.toContain(
      "TEST_ONLY feedback",
    );
  });
  it("returns validation, scope, stale and unauthorized errors without persisting", async () => {
    const b = await f.body();
    expect(
      (await post(`/${memberId}/save`, { ...b, reviewerId: "l5" })).status,
    ).toBe(400);
    expect((await post(`/${memberId}/save`, b, "")).status).toBe(400);
    expect(
      (await post(`/${memberId}/save`, b, "admin", ids.admin)).status,
    ).toBe(403);
    expect((await get(`/missing?termId=${ids.term}`)).status).toBe(404);
    expect(
      (await post(`/${memberId}/save`, { ...b, expectedRevision: 99 }, "stale"))
        .status,
    ).toBe(409);
    expect(
      (await get(`/${memberId}?termId=${ids.term}`, ids.student)).status,
    ).toBe(403);
    expect(f.state.scores).toHaveLength(0);
  });
  it("scope/privacy projections, flag and withdrawn session reject writes", async () => {
    await f.command("finalize");
    const v = (
      await (
        await get(`/${memberId}?termId=${ids.term}&reviewerId=l4`, ids.faculty)
      ).json()
    ).data;
    expect(v.score).toBeNull();
    expect(v.feedback).toBeNull();
    expect(v.history).toEqual([]);
    f.control.writes = false;
    expect(
      (await post(`/${memberId}/finalize`, await f.body(), "disabled")).status,
    ).toBe(409);
    f.users.get(reviewerActor)!.status = "DISABLED" as never;
    expect((await get("/options")).status).toBe(403);
  });
});
