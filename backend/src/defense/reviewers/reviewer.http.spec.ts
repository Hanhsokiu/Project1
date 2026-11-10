import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { ReviewerController } from "./reviewer.controller";
import { ReviewerService } from "./reviewer.service";
import { createReviewerFixture } from "../../../test/reviewer.fixture";
import { ids } from "../../../test/final-defense.fixture";
import { memberId } from "../../../test/eligibility.fixture";
import { JwtAuthGuard } from "../../common/security/jwt-auth.guard";
import { PermissionsGuard } from "../../common/security/permissions.guard";
import { RbacService } from "../../auth/service/rbac.service";
import type { UserAccountRepository } from "../../auth/repository/user-account.repository";
let app: INestApplication,
  root: string,
  f: Awaited<ReturnType<typeof createReviewerFixture>>;
const jwt = new JwtService({ secret: "synthetic-uc20-only-http-secret" });
const headers = (id = ids.faculty) => ({
  Authorization: `Bearer ${jwt.sign({ sub: id, sid: id }, { expiresIn: "1m" })}`,
});
const get = (path: string, actor = ids.faculty) =>
  fetch(root + "/defense-reviewers" + path, { headers: headers(actor) });
const post = (path: string, body: unknown, key = "key", actor = ids.faculty) =>
  fetch(root + "/defense-reviewers" + path, {
    method: "POST",
    headers: {
      ...headers(actor),
      "Content-Type": "application/json",
      "Idempotency-Key": key,
    },
    body: JSON.stringify(body),
  });
beforeEach(async () => {
  f = await createReviewerFixture();
  const users = {
    findById: async (id: string) => f.cc.eligibility.f.users.get(id) ?? null,
    session: async (id: string) =>
      f.cc.eligibility.f.users.has(id)
        ? {
            id,
            userId: id,
            revokedAt: null,
            expiresAt: new Date(Date.now() + 60000),
          }
        : null,
    permissions: async (id: string) =>
      f.cc.eligibility.f.users
        .get(id)
        ?.userRoles.flatMap((r) =>
          r.role.rolePermissions.map(
            (p) => `${p.permission.resource}:${p.permission.action}`,
          ),
        ) ?? [],
  } as unknown as UserAccountRepository;
  const module = await Test.createTestingModule({
    controllers: [ReviewerController],
    providers: [{ provide: ReviewerService, useValue: f.service }],
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
describe("UC20 JWT/RBAC/Zod loopback HTTP with synthetic persistence", () => {
  it("GET is readonly and unauthenticated requests are rejected", async () => {
    expect((await fetch(root + "/defense-reviewers/options")).status).toBe(401);
    for (const path of [
      "/options",
      `/workspace?termId=${ids.term}`,
      `?termId=${ids.term}&search=none`,
      `/${memberId}?termId=${ids.term}`,
      `/allocation?termId=${ids.term}`,
    ])
      expect((await get(path)).status).toBe(200);
    expect(f.state.rows).toHaveLength(0);
    expect(f.state.events).toHaveLength(0);
  });
  it("preview -> save -> replace -> finalize -> effective downstream, no grade/comment writes", async () => {
    const proposal = (
      await (await get(`/allocation?termId=${ids.term}`)).json()
    ).data;
    expect(proposal.status).toBe("FEASIBLE");
    const b = {
      termId: ids.term,
      rosterHash: proposal.rosterHash,
      reason: "Synthetic HTTP apply",
      placements: proposal.placements,
    };
    expect((await post("/assignments", b, "apply")).status).toBe(201);
    expect((await post("/assignments", b, "apply")).status).toBe(201);
    expect(f.state.events).toHaveLength(1);
    expect(
      (await post(`/${memberId}/update`, await f.assignBody(["l5"]), "replace"))
        .status,
    ).toBe(201);
    expect(
      (await post("/finalize", await f.finalizeBody(), "final")).status,
    ).toBe(201);
    const view = (await (await get(`/${memberId}?termId=${ids.term}`)).json())
      .data;
    expect(view.state).toBe("FINALIZED");
    expect(view.downstream[0].lecturerId).toBe("l5");
    expect(JSON.stringify(view)).not.toContain("totalScore");
    expect(JSON.stringify(view)).not.toContain("Synthetic advisor review");
    expect(f.cc.state.rows.get(f.committeeId)!.state).toBe("FINALIZED");
  });
  it("rejects forged/duplicate data, missing key, role bypass and cross-scope ids", async () => {
    const b = await f.assignBody();
    expect(
      (await post("/assignments", { ...b, actor: ids.faculty })).status,
    ).toBe(400);
    expect(
      (await post("/assignments", await f.assignBody(["l4", "l4"]))).status,
    ).toBe(400);
    expect((await post("/assignments", b, "")).status).toBe(400);
    for (const actor of [ids.student, ids.lecturer, ids.admin])
      expect((await post("/assignments", b, "key", actor)).status).toBe(403);
    expect((await get(`/unknown?termId=${ids.term}`)).status).toBe(404);
    expect((await get(`/workspace?termId=other-term`)).status).toBe(404);
    expect((await post("/wrong-id/update", b)).status).toBe(400);
  });
  it("returns 409 for current advisor, changed body, stale source and disabled writes", async () => {
    expect(
      (
        await post(
          "/assignments",
          await f.assignBody(["official-advisor"]),
          "advisor",
        )
      ).status,
    ).toBe(409);
    const b = await f.assignBody();
    expect((await post("/assignments", b, "same")).status).toBe(201);
    expect(
      (await post("/assignments", { ...b, reason: "different" }, "same"))
        .status,
    ).toBe(409);
    const final = await f.finalizeBody();
    f.control.history.hash = "0".repeat(64);
    expect((await post("/finalize", final, "stale")).status).toBe(409);
    f.control.writes = false;
    expect(
      (await post("/assignments", await f.assignBody(), "disabled")).status,
    ).toBe(409);
  });
});
