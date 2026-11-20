import "reflect-metadata";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { StudentDirectoryQuerySchema } from "@doan/shared";
import { CatalogRepository } from "./catalog.repository";
import { StudentController } from "../controller/student.controller";
import { StudentService } from "../service/student.service";
import { JwtAuthGuard } from "../../common/security/jwt-auth.guard";
import { PermissionsGuard } from "../../common/security/permissions.guard";
import { RbacService } from "../../auth/service/rbac.service";
import type { UserAccountRepository } from "../../auth/repository/user-account.repository";

const target = process.env.DIRECTORY_TEST_DATABASE_URL;
if (!target) throw new Error("Run backend/scripts/test-student-directory-postgres.cjs");
const url = new URL(target);
if (url.hostname !== "127.0.0.1" || url.pathname !== "/postgres" || !url.port)
  throw new Error("Owned loopback PostgreSQL fixture required");
const systemA = "11111111-1111-4111-8111-111111111111";
const systemB = "22222222-2222-4222-8222-222222222222";
const termA = "33333333-3333-4333-8333-333333333333";
const termB = "44444444-4444-4444-8444-444444444444";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let prisma: PrismaClient, repo: CatalogRepository, app: INestApplication, base: string;
const jwt = new JwtService({ secret: "isolated-student-directory-http-secret" });
const query = (raw: unknown = {}) => StudentDirectoryQuerySchema.parse(raw);

beforeAll(async () => {
  prisma = new PrismaClient({ datasources: { db: { url: target } } });
  await prisma.$connect();
  // Match the types/nullable GPA of the existing SQL migration chain. These
  // tables exist only in the fresh cluster owned by the dedicated harness.
  for (const sql of [
    `CREATE TABLE "USER_ACCOUNT" (id varchar(36) PRIMARY KEY, email text, password_hash text)`,
    `CREATE TABLE "TRAINING_SYSTEM" (id varchar(36) PRIMARY KEY, code text NOT NULL, name text NOT NULL)`,
    `CREATE TABLE "STUDENT" (id varchar(36) PRIMARY KEY, user_id varchar(36) REFERENCES "USER_ACCOUNT", student_code text UNIQUE, full_name text, class_name text, major_name text, training_system_id varchar(36) REFERENCES "TRAINING_SYSTEM", gpa numeric(4,2), academic_eligible boolean, phone text)`,
    `CREATE TABLE "TERM_STUDENT" (student_id varchar(36) REFERENCES "STUDENT", term_id varchar(36), UNIQUE(student_id,term_id))`,
  ]) await prisma.$executeRawUnsafe(sql);
  await prisma.$executeRaw`INSERT INTO "TRAINING_SYSTEM" (id,code,name) VALUES (${systemA},'CQ','Chính quy'),(${systemB},'CLC','Chất lượng cao')`;
  for (let n = 1; n <= 120; n++) {
    await prisma.$executeRaw`INSERT INTO "USER_ACCOUNT" VALUES (${id(n)},${`sv${n}@example.test`},'never-return-this-fixture-hash')`;
    await prisma.$executeRaw`INSERT INTO "STUDENT" VALUES (${id(n)},${id(n)},${String(n).padStart(6, "0")},${`Sinh viên ${n}`},${n <= 100 ? "CNTT-A" : "LOP CUOI"},'CNTT',${n === 120 ? systemB : systemA},${n === 1 ? null : n === 3 ? 0 : n === 4 ? 4.2 : 3.2},${n !== 2},'0912345678')`;
    if (n <= 3) await prisma.$executeRaw`INSERT INTO "TERM_STUDENT" VALUES (${id(n)},${termA})`;
    if (n > 115) await prisma.$executeRaw`INSERT INTO "TERM_STUDENT" VALUES (${id(n)},${termB})`;
  }
  repo = new CatalogRepository(prisma as never, {} as never);
  const service = new StudentService(repo);
  Reflect.defineMetadata("design:paramtypes", [StudentService], StudentController);
  const module = await Test.createTestingModule({ controllers: [StudentController], providers: [{ provide: StudentService, useValue: service }] }).compile();
  app = module.createNestApplication({ logger: false });
  const users = {
    findById: async (actor: string) => ({ id: actor, username: actor, status: "ACTIVE", mustChangePassword: false,
      userRoles: [{ role: { name: actor === "reader" ? "FACULTY" : "STUDENT", rolePermissions: [] } }] }),
    session: async (actor: string) => ({ id: actor, userId: actor, revokedAt: null, expiresAt: new Date(Date.now() + 60000) }),
    permissions: async (actor: string) => actor === "reader" ? ["student:read"] : [],
  } as unknown as UserAccountRepository;
  const reflector = new Reflector();
  app.useGlobalGuards(new JwtAuthGuard(reflector, jwt, users), new PermissionsGuard(reflector, new RbacService(users)));
  await app.listen(0, "127.0.0.1");
  base = await app.getUrl();
}, 60000);
afterAll(async () => { await app?.close(); await prisma?.$disconnect(); });

describe("student directory with PostgreSQL and HTTP guards", () => {
  it("returns only one stable page while counting the entire matching collection", async () => {
    const first = await repo.studentDirectory(query());
    const last = await repo.studentDirectory(query({ page: 15 }));
    expect(first.total).toBe(120);
    expect(first.items).toHaveLength(8);
    expect(first.items[0].studentCode).toBe("000001");
    expect(last.items).toHaveLength(8);
    expect(last.items[0].studentCode).toBe("000113");
    expect(last.items[7].studentCode).toBe("000120");
    expect(JSON.stringify(first)).not.toMatch(/password|never-return/);
  });
  it("aggregates full statistics and class choices without returning student records", async () => {
    expect(await repo.studentDirectoryOptions()).toEqual({ total: 120, eligible: 117, ineligible: 3, classes: ["CNTT-A", "LOP CUOI"] });
  });
  it("searches late-page class, code, name and email as literal text", async () => {
    expect((await repo.studentDirectory(query({ search: "LOP CUOI" }))).total).toBe(20);
    expect((await repo.studentDirectory(query({ search: "sv120@example.test" }))).items[0].studentCode).toBe("000120");
    expect((await repo.studentDirectory(query({ search: "000120" }))).total).toBe(1);
    expect((await repo.studentDirectory(query({ search: "Sinh viên 120" }))).total).toBe(1);
    expect((await repo.studentDirectory(query({ search: "% ' OR 1=1 --" }))).total).toBe(0);
  });
  it("retains null/out-of-range GPA semantics while accepting GPA zero", async () => {
    const eligible = await repo.studentDirectory(query({ academicCondition: "eligible", sortBy: "gpa" }));
    expect(eligible.total).toBe(117);
    expect(eligible.items[0].gpa).toBe(0);
    const ineligible = await repo.studentDirectory(query({ academicCondition: "ineligible" }));
    expect(ineligible.total).toBe(3);
    expect(ineligible.items.map(row => row.studentCode)).toEqual(["000001", "000002", "000004"]);
  });
  it("combines system, class and term filters without duplicating students or silently falling back", async () => {
    expect((await repo.studentDirectory(query({ termId: termA }))).total).toBe(3);
    expect((await repo.studentDirectory(query({ termId: termA, academicCondition: "eligible" }))).total).toBe(1);
    const last = await repo.studentDirectory(query({ termId: termB, className: "LOP CUOI", trainingSystemId: systemB }));
    expect(last.total).toBe(1);
    expect(last.items[0].studentCode).toBe("000120");
    expect((await repo.studentDirectory(query({ termId: id(999) }))).total).toBe(0);
  });
  it("sorts the whole filtered directory with stable ties and explicit null placement", async () => {
    const asc = await repo.studentDirectory(query({ sortBy: "gpa", sortDirection: "asc" }));
    const desc = await repo.studentDirectory(query({ sortBy: "gpa", sortDirection: "desc" }));
    expect(asc.items[0].gpa).toBeNull();
    expect(asc.items[1].gpa).toBe(0);
    expect(desc.items[0].gpa).toBe(4.2);
    expect(desc.items.slice(1).map(row => row.studentCode)).toEqual(["000002", "000005", "000006", "000007", "000008", "000009", "000010"]);
    expect((await repo.studentDirectory(query({ sortBy: "name" }))).items).toHaveLength(8);
  });
  it("enforces JWT/permission and validates query before serving the new static routes", async () => {
    const get = (route: string, actor = "reader") => fetch(base + route, { headers: actor ? { Authorization: "Bearer " + jwt.sign({ sub: actor, sid: actor }, { expiresIn: "1m" }) } : {} });
    for (const route of ["/students/directory", "/students/directory-options"]) {
      expect((await get(route, "")).status).toBe(401);
      expect((await get(route, "denied")).status).toBe(403);
      expect((await get(route)).status).toBe(200);
    }
    expect((await get("/students/directory?pageSize=101")).status).toBe(400);
    expect((await get("/students/directory?sortBy=DROP%20TABLE")).status).toBe(400);
    expect((await get("/students/directory?termId=not-a-uuid")).status).toBe(400);
    const response = await (await get("/students/directory?page=2")).json();
    expect(response.data).toMatchObject({ page: 2, pageSize: 8, total: 120, totalPages: 15 });
    expect(response.data.items).toHaveLength(8);
  });
});
