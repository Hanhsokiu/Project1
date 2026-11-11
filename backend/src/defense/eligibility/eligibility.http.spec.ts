import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { EligibilityController } from "./eligibility.controller";
import { EligibilityService } from "./eligibility.service";
import {
  createEligibilityFixture,
  academicInput,
  memberId,
} from "../../../test/eligibility.fixture";
import { ids } from "../../../test/final-defense.fixture";
import { JwtAuthGuard } from "../../common/security/jwt-auth.guard";
import { PermissionsGuard } from "../../common/security/permissions.guard";
import { RbacService } from "../../auth/service/rbac.service";
import type { UserAccountRepository } from "../../auth/repository/user-account.repository";

let app: INestApplication,
  root: string,
  f: Awaited<ReturnType<typeof createEligibilityFixture>>;
const jwt = new JwtService({ secret: "synthetic-uc18-only-http-secret" });
const headers = (id: string) => ({
  Authorization: `Bearer ${jwt.sign({ sub: id, sid: id }, { expiresIn: "1m" })}`,
});
const url = `/defense-eligibility/${memberId}`;
const get = (path: string, user = ids.faculty) =>
  fetch(root + path, { headers: headers(user) });
const post = (path: string, body: unknown, key: string, user = ids.faculty) =>
  fetch(root + path, {
    method: "POST",
    headers: {
      ...headers(user),
      "Content-Type": "application/json",
      "Idempotency-Key": key,
    },
    body: JSON.stringify(body),
  });
beforeEach(async () => {
  f = await createEligibilityFixture();
  const users = {
    findById: async (id: string) => f.f.users.get(id) ?? null,
    session: async (id: string) =>
      f.f.users.has(id)
        ? {
            id,
            userId: id,
            revokedAt: null,
            expiresAt: new Date(Date.now() + 60000),
          }
        : null,
    permissions: async (id: string) =>
      f.f.users
        .get(id)
        ?.userRoles.flatMap((r) =>
          r.role.rolePermissions.map(
            (p) => `${p.permission.resource}:${p.permission.action}`,
          ),
        ) ?? [],
  } as unknown as UserAccountRepository;
  const module = await Test.createTestingModule({
    controllers: [EligibilityController],
    providers: [{ provide: EligibilityService, useValue: f.service }],
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
describe("UC18 loopback HTTP: real JWT/RBAC/Zod/controller/service, synthetic persistence", () => {
  it("exposes options/list/detail at the frontend URLs without creating records", async () => {
    expect((await fetch(root + "/defense-eligibility/options")).status).toBe(
      401,
    );
    expect((await get("/defense-eligibility/options")).status).toBe(200);
    const list = await get(
      `/defense-eligibility?termId=${ids.term}&search=SYNTHETIC01&preview=UNVERIFIED&page=1&limit=20`,
    );
    expect(list.status).toBe(200);
    expect((await list.json()).data.total).toBe(1);
    const detail = await get(`${url}?termId=${ids.term}`);
    expect(detail.status).toBe(200);
    expect((await detail.json()).data.official.state).toBe("NONE");
    expect(f.state.row).toBeNull();
    expect(f.state.events).toHaveLength(0);
  });
  it("reviews, decides, finalizes and reloads a real UC17-produced PDF/confirmation", async () => {
    let v = (await (await get(`${url}?termId=${ids.term}`)).json()).data;
    const review = {
      termId: ids.term,
      expectedRevision: v.revision,
      evidenceHash: v.evidenceHash,
      reason: "Synthetic review",
      academic: academicInput,
    };
    expect((await post(url + "/review", review, "http-review")).status).toBe(
      201,
    );
    expect((await post(url + "/review", review, "http-review")).status).toBe(
      201,
    );
    expect(f.state.events).toHaveLength(1);
    v = (await (await get(`${url}?termId=${ids.term}`)).json()).data;
    expect(v.preview).toBe("QUALIFIED");
    expect(v.downstream).toBeNull();
    expect(
      (
        await post(
          url + "/decide",
          {
            termId: ids.term,
            expectedRevision: v.revision,
            evidenceHash: v.evidenceHash,
            status: "ELIGIBLE",
            reason: "Synthetic decision",
          },
          "http-decide",
        )
      ).status,
    ).toBe(201);
    v = (await (await get(`${url}?termId=${ids.term}`)).json()).data;
    const final = {
      termId: ids.term,
      reason: "Synthetic batch",
      members: [
        {
          termStudentId: memberId,
          expectedRevision: v.revision,
          evidenceHash: v.evidenceHash,
        },
      ],
    };
    const response = await post(
      "/defense-eligibility/finalize",
      final,
      "http-finalize",
    );
    expect(response.status).toBe(201);
    expect(
      (await post("/defense-eligibility/finalize", final, "http-finalize"))
        .status,
    ).toBe(201);
    v = (await (await get(`${url}?termId=${ids.term}`)).json()).data;
    expect(v.downstream).toMatchObject({
      decision: "ELIGIBLE",
      effectiveStatus: "CURRENT",
      revision: 3,
    });
    expect(f.state.events).toHaveLength(3);
  });
  it("returns 400/403/404/409 for forged payloads, permissions, scope and stale evidence", async () => {
    expect(
      (await post(url + "/review", {}, "no-right", ids.student)).status,
    ).toBe(403);
    expect(
      (await post(url + "/review", { approvedBy: ids.admin }, "forged")).status,
    ).toBe(400);
    expect((await get(`${url}?termId=other-term`)).status).toBe(404);
    expect((await get(`${url}?termId=${ids.term}`, ids.outsider)).status).toBe(
      404,
    );
    const v = await f.detail();
    const body = {
      termId: ids.term,
      expectedRevision: 0,
      evidenceHash: v.evidenceHash,
      reason: "r",
      academic: academicInput,
    };
    f.control.writes = false;
    expect((await post(url + "/review", body, "disabled")).status).toBe(409);
    expect(f.state.row).toBeNull();
    f.control.writes = true;
    expect(
      (
        await post(
          url + "/review",
          { ...body, evidenceHash: "0".repeat(64) },
          "hash",
        )
      ).status,
    ).toBe(409);
  });
  it("hides grade/comment/academic references/reasons/history from the student response", async () => {
    await f.review();
    await f.decide();
    const result = await (
      await get(`${url}?termId=${ids.term}`, ids.student)
    ).json();
    expect(result.data.academic).toBeNull();
    expect(result.data.history).toEqual([]);
    expect(result.data.advisorSummary).toEqual({});
    expect(result.data.official.reason).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain(academicInput.reference);
  });
});
