import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Test } from "@nestjs/testing";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { INestApplication } from "@nestjs/common";
import {
  FinalDefenseController,
  FinalPdfInterceptor,
} from "./final-defense.controller";
import { FinalDefenseService } from "./final-defense.service";
import { JwtAuthGuard } from "../../common/security/jwt-auth.guard";
import { PermissionsGuard } from "../../common/security/permissions.guard";
import { RbacService } from "../../auth/service/rbac.service";
import type { UserAccountRepository } from "../../auth/repository/user-account.repository";
import {
  createFinalDefenseFixture,
  ids,
  syntheticFile,
} from "../../../test/final-defense.fixture";

let app: INestApplication,
  f: ReturnType<typeof createFinalDefenseFixture>,
  root: string;
const jwt = new JwtService({ secret: "synthetic-only-uc17-http-secret" });
const headers = (userId: string) => ({
  Authorization: `Bearer ${jwt.sign({ sub: userId, sid: userId }, { expiresIn: "1m" })}`,
});
const endpoint = `/proposals/${ids.proposal}/final-report`;
async function post(path: string, actor: string, body: unknown, key: string) {
  return fetch(root + path, {
    method: "POST",
    headers: {
      ...headers(actor),
      "Content-Type": "application/json",
      "Idempotency-Key": key,
    },
    body: JSON.stringify(body),
  });
}
async function upload() {
  const form = new FormData(),
    file = syntheticFile();
  form.append("expectedRevision", "0");
  form.append(
    "file",
    new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }),
    file.originalname,
  );
  return fetch(root + endpoint + "/pdf", {
    method: "POST",
    headers: { ...headers(ids.student), "Idempotency-Key": "http-pdf" },
    body: form,
  });
}
beforeEach(async () => {
  f = createFinalDefenseFixture();
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
  const module = await Test.createTestingModule({
    controllers: [FinalDefenseController],
    providers: [
      { provide: FinalDefenseService, useValue: f.service },
      FinalPdfInterceptor,
    ],
  }).compile();
  app = module.createNestApplication({ logger: false });
  const reflector = new Reflector();
  app.useGlobalGuards(
    new JwtAuthGuard(reflector, jwt, users),
    new PermissionsGuard(reflector, new RbacService(users)),
  );
  // Loopback-only synthetic HTTP harness. AppModule and PrismaService are never instantiated.
  await app.listen(0, "127.0.0.1");
  root = await app.getUrl();
});
afterEach(async () => {
  await app?.close();
});

describe("UC17 HTTP integration: real JWT/RBAC, Zod, multipart, service; in-memory persistence", () => {
  it("denies another student's dossier and private PDF even with the same student permissions", async () => {
    const uploaded = await upload();
    expect(uploaded.status).toBe(201);
    const version = (await uploaded.json()).data.versionId;
    const before = structuredClone(f.state);
    f.users.get(ids.student)!.student!.id = "another-student-profile";
    for (const path of [endpoint, `${endpoint}/versions/${version}/pdf`]) {
      const response = await fetch(root + path, {
        headers: headers(ids.student),
      });
      expect(response.status).toBe(404);
      expect(await response.text()).not.toContain("%PDF-");
    }
    expect(f.state).toEqual(before);
  });
  it("serves the frontend term-options URL on the controller and keeps GET read-only", async () => {
    expect((await fetch(root + "/final-defense/options")).status).toBe(401);
    const response = await fetch(root + "/final-defense/options", {
      headers: headers(ids.student),
    });
    expect(response.status).toBe(200);
    expect((await response.json()).data[0]).toMatchObject({
      id: ids.term,
      code: "SYN",
    });
    expect(f.state.events).toHaveLength(0);
    expect(f.state.report).toBeNull();
  });
  it("returns 401 unauthenticated, 403 without write permission and 404 outside advisor scope", async () => {
    expect((await fetch(root + endpoint)).status).toBe(401);
    expect(
      (await post(endpoint + "/review", ids.student, {}, "forbidden")).status,
    ).toBe(403);
    expect(
      (await fetch(root + endpoint, { headers: headers(ids.outsider) })).status,
    ).toBe(404);
    const r = await fetch(root + "/final-defense?termId=" + ids.term, {
      headers: headers(ids.student),
    });
    expect(r.status).toBe(200);
    expect((await r.json()).data.total).toBe(1);
    expect(f.state.events).toHaveLength(0);
  });
  it("performs multipart upload, summary, rejection, reload and authorized binary download", async () => {
    const uploaded = await upload();
    expect(uploaded.status).toBe(201);
    const version = (await uploaded.json()).data.versionId;
    const review = await post(
      endpoint + "/review",
      ids.lecturer,
      {
        expectedRevision: 1,
        reportVersionId: version,
        comment: "Nhận xét HTTP",
        score: 8,
        criterionScores: {},
      },
      "http-review",
    );
    expect(review.status).toBe(201);
    const decision = await post(
      endpoint + "/decide",
      ids.lecturer,
      {
        expectedRevision: 2,
        reportVersionId: version,
        status: "REJECTED",
        reason: "Cần hoàn thiện",
      },
      "http-decision",
    );
    expect(decision.status).toBe(201);
    const reload = await fetch(root + endpoint, {
      headers: headers(ids.lecturer),
    });
    expect((await reload.json()).data).toMatchObject({
      revision: 3,
      status: "REJECTED",
      summary: { score: 8, comment: "Nhận xét HTTP" },
      decision: { reason: "Cần hoàn thiện" },
    });
    const student = await fetch(root + endpoint, {
      headers: headers(ids.student),
    });
    const publicView = (await student.json()).data;
    expect(publicView.summary).toBeNull();
    expect(publicView.decision).not.toHaveProperty("reason");
    const download = await fetch(`${root}${endpoint}/versions/${version}/pdf`, {
      headers: headers(ids.student),
    });
    expect(download.status).toBe(200);
    expect(download.headers.get("content-type")).toContain("application/pdf");
    expect(download.headers.get("cache-control")).toContain("no-store");
    expect(Buffer.from(await download.arrayBuffer())).toEqual(
      syntheticFile().buffer,
    );
    expect(
      (
        await fetch(`${root}${endpoint}/versions/${version}/pdf`, {
          headers: headers(ids.outsider),
        })
      ).status,
    ).toBe(404);
  });
  it("returns 400 for invalid decisions/score and 409 for a stale write, without false success", async () => {
    const uploaded = await upload(),
      version = (await uploaded.json()).data.versionId;
    expect(
      (
        await post(
          endpoint + "/decide",
          ids.lecturer,
          { expectedRevision: 1, reportVersionId: version, status: "REJECTED" },
          "reason-missing",
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await post(
          endpoint + "/review",
          ids.lecturer,
          {
            expectedRevision: 1,
            reportVersionId: version,
            score: 11,
            comment: "X",
          },
          "invalid-score",
        )
      ).status,
    ).toBe(400);
    const body = {
      expectedRevision: 1,
      reportVersionId: version,
      score: 8,
      comment: "X",
    };
    expect(
      (await post(endpoint + "/review", ids.lecturer, body, "first-review"))
        .status,
    ).toBe(201);
    expect(
      (await post(endpoint + "/review", ids.lecturer, body, "first-review"))
        .status,
    ).toBe(201);
    expect(
      (await post(endpoint + "/review", ids.lecturer, body, "stale-review"))
        .status,
    ).toBe(409);
    expect(f.state.report?.revision).toBe(2);
  });
  it("rejects before buffering/persistence when writes are disabled or migration is absent", async () => {
    f.control.writes = false;
    expect((await upload()).status).toBe(409);
    f.control.writes = true;
    f.control.schemaReady = false;
    expect((await upload()).status).toBe(409);
    expect(f.state.report).toBeNull();
    expect(f.bytes.size).toBe(0);
  });
});
