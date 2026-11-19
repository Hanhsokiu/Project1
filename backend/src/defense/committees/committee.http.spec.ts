import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { CommitteeWorkflowController } from "./committee-workflow.controller";
import { CommitteeController } from "../controller/committee.controller";
import { CommitteeService } from "../service/committee.service";
import { CommitteeWorkflowService } from "./committee-workflow.service";
import { createCommitteeFixture } from "../../../test/committee.fixture";
import { ids } from "../../../test/final-defense.fixture";
import { JwtAuthGuard } from "../../common/security/jwt-auth.guard";
import { PermissionsGuard } from "../../common/security/permissions.guard";
import { RbacService } from "../../auth/service/rbac.service";
import type { UserAccountRepository } from "../../auth/repository/user-account.repository";
let app: INestApplication,
  root: string,
  f: Awaited<ReturnType<typeof createCommitteeFixture>>;
const jwt = new JwtService({ secret: "synthetic-uc19-http-secret-only" }),
  legacy = vi.fn(async () => []);
const headers = (id = ids.faculty) => ({
  Authorization: `Bearer ${jwt.sign({ sub: id, sid: id }, { expiresIn: "1m" })}`,
});
const get = (path: string, actor = ids.faculty) =>
  fetch(root + path, { headers: headers(actor) });
const post = (path: string, body: unknown, key = "key", actor = ids.faculty) =>
  fetch(root + path, {
    method: "POST",
    headers: {
      ...headers(actor),
      "Content-Type": "application/json",
      "Idempotency-Key": key,
    },
    body: JSON.stringify(body),
  });
beforeEach(async () => {
  f = await createCommitteeFixture();
  legacy.mockClear();
  const users = {
    findById: async (id: string) => f.eligibility.f.users.get(id) ?? null,
    session: async (id: string) =>
      f.eligibility.f.users.has(id)
        ? {
            id,
            userId: id,
            revokedAt: null,
            expiresAt: new Date(Date.now() + 60000),
          }
        : null,
    permissions: async (id: string) =>
      f.eligibility.f.users
        .get(id)
        ?.userRoles.flatMap((r) =>
          r.role.rolePermissions.map(
            (p) => `${p.permission.resource}:${p.permission.action}`,
          ),
        ) ?? [],
  } as unknown as UserAccountRepository;
  const module = await Test.createTestingModule({
    controllers: [CommitteeWorkflowController, CommitteeController],
    providers: [
      { provide: CommitteeWorkflowService, useValue: f.service },
      { provide: CommitteeService, useValue: { findByTerm: legacy } },
    ],
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
describe("UC19 synthetic loopback HTTP through JWT/RBAC/Zod/controllers/service", () => {
  it("serves options/workspace/list/detail/allocation without creating data", async () => {
    expect((await fetch(root + "/defense-committees/options")).status).toBe(
      401,
    );
    expect((await get("/defense-committees/options")).status).toBe(200);
    expect(
      (await get(`/defense-committees/workspace?termId=${ids.term}`)).status,
    ).toBe(200);
    expect(
      (
        await get(
          `/defense-committees?termId=${ids.term}&search=missing&page=1&limit=20`,
        )
      ).status,
    ).toBe(200);
    expect(f.state.rows.size).toBe(0);
    expect(f.state.events).toHaveLength(0);
  });
  it("performs create -> GET proposal -> apply assignments -> finalize -> current downstream", async () => {
    const b = await f.createBody(),
      create = await post("/defense-committees", b, "create");
    expect(create.status).toBe(201);
    const id = (await create.json()).data.id;
    expect((await post("/defense-committees", b, "create")).status).toBe(201);
    expect(f.state.rows.size).toBe(1);
    const proposal = await get(
        `/defense-committees/allocation?termId=${ids.term}`,
      ),
      p = (await proposal.json()).data;
    expect(p.status).toBe("FEASIBLE");
    expect(f.state.assignments.size).toBe(0);
    const assigned = await post(
      "/defense-committees/assignments",
      {
        termId: ids.term,
        rosterHash: p.rosterHash,
        reason: "Synthetic apply",
        committees: p.committees,
        placements: p.placements,
      },
      "assign",
    );
    expect(assigned.status).toBe(201);
    const finalize = await post(
      `/defense-committees/${id}/finalize`,
      await f.finalizeBody(id),
      "final",
    );
    expect(finalize.status).toBe(201);
    const detail = await (
      await get(`/defense-committees/${id}?termId=${ids.term}`)
    ).json();
    expect(detail.data.committee.downstream).toMatchObject({
      committeeId: id,
      effectiveStatus: "CURRENT",
    });
    expect(JSON.stringify(detail)).not.toContain("Synthetic advisor review");
    expect(JSON.stringify(detail)).not.toContain("totalScore");
  });
  it("returns 400/403/404/409 for forged data, role/scope and disabled writes", async () => {
    const b = await f.createBody();
    expect(
      (await post("/defense-committees", b, "student", ids.student)).status,
    ).toBe(403);
    expect(
      (
        await post(
          "/defense-committees",
          { ...b, createdBy: ids.admin },
          "forged",
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await post(
          "/defense-committees",
          { ...b, departmentId: "other" },
          "scope",
        )
      ).status,
    ).toBe(404);
    f.control.writes = false;
    expect((await post("/defense-committees", b, "off")).status).toBe(409);
    expect(f.state.rows.size).toBe(0);
  });
  it("protects the legacy committee route with the same scope instead of a read bypass", async () => {
    const id = await f.create();
    expect(
      (await get(`/committees/term/${ids.term}`, ids.student)).status,
    ).toBe(403);
    expect((await get(`/committees/term/${ids.term}`)).status).toBe(200);
    expect(legacy).toHaveBeenCalledWith(ids.term, [id]);
    f.eligibility.f.control.facultyDepartment = "other";
    expect((await get(`/committees/term/${ids.term}`)).status).toBe(200);
    expect(legacy).toHaveBeenLastCalledWith(ids.term, []);
  });
});
