import type { toTermResponse } from "../dto/term.mapper";
import type { operationWindow } from "./term-window.service";
type TermResponse = ReturnType<typeof toTermResponse>;
type OperationWindowResponse = ReturnType<typeof operationWindow>;
type SemesterResponse = { id: string };
type PageResponse<T> = { items: T[]; total: number; page: number; pageSize: number };
import "reflect-metadata";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import * as bcrypt from "bcryptjs";

/** Opt-in local PostgreSQL/API integration. Every write uses uniquely owned fixtures. */
describe.runIf(process.env.RUN_TERM_DB_TESTS === "1")(
  "term API with PostgreSQL, permissions and atomic audit",
  () => {
    let prisma: PrismaClient;
    const base = process.env.TERM_TEST_API_URL ?? "http://127.0.0.1:3010/api";
    const suffix = randomUUID().replace(/-/g, "").slice(0, 12);
    const owned = {
      users: [] as string[],
      systems: [] as string[],
      terms: [] as string[],
      semester: "",
      department: "",
      area: "",
      student: "",
      lecturer: "",
    };
    const tokens: Record<string, string> = {};
    let year = 2090,
      termId = "",
      secondTermId = "",
      semesterId = "",
      studentId = "",
      lecturerId = "";
    async function request<T = TermResponse>(
      path: string,
      method = "GET",
      body?: unknown,
      role = "ADMIN",
    ) {
      const response = await fetch(base + path, {
        method,
        headers: {
          ...(role ? { Authorization: `Bearer ${tokens[role]}` } : {}),
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const data = (await response.json()) as {
        success: boolean;
        data: T;
        error?: { code: string; message: string };
      };
      return { status: response.status, ...data };
    }
    beforeAll(async () => {
      if (!process.env.DATABASE_URL) {
        const text = readFileSync(resolve(process.cwd(), ".env"), "utf8");
        const found = text.match(/^DATABASE_URL=(.*)$/m);
        if (found)
          process.env.DATABASE_URL = found[1].trim().replace(/^"|"$/g, "");
      }
      prisma = new PrismaClient();
      await prisma.$connect();
      while (
        await prisma.academicSemester.findUnique({
          where: {
            academicYear_semester: {
              academicYear: `${year}-${year + 1}`,
              semester: 3,
            },
          },
        })
      )
        year++;
      if (year > 2199)
        throw new Error("Không còn năm học dành cho test fixtures.");
      const hash = await bcrypt.hash("TermTest@2026", 4);
      for (const role of ["ADMIN", "LECTURER", "STUDENT", "COMMITTEE"]) {
        const row = await prisma.role.findUniqueOrThrow({
          where: { name: role },
        });
        const account = await prisma.userAccount.create({
          data: {
            username: `term_it_${role.toLowerCase()}_${suffix}`,
            passwordHash: hash,
            displayName: `Kiểm thử ${role}`,
            status: "ACTIVE",
            mustChangePassword: false,
            userRoles: { create: { roleId: row.id } },
          },
        });
        owned.users.push(account.id);
        const result = await request<{ accessToken: string }>(
          "/auth/login",
          "POST",
          { username: account.username, password: "TermTest@2026" },
          "",
        );
        expect(result.status).toBe(201);
        tokens[role] = result.data.accessToken;
      }
      for (const code of ["CQ", "LT"]) {
        const system = await prisma.trainingSystem.create({
          data: {
            code: `IT_${code}_${suffix}`,
            name: `Hệ kiểm thử ${code} ${suffix}`,
          },
        });
        owned.systems.push(system.id);
      }
      const department = await prisma.department.create({
        data: { code: `IT_${suffix}`, name: `Bộ môn kiểm thử ${suffix}` },
      });
      owned.department = department.id;
      const area = await prisma.researchArea.create({
        data: { name: `Hướng kiểm thử ${suffix}` },
      });
      owned.area = area.id;
      const student = await prisma.student.create({
        data: {
          userId: owned.users[2],
          studentCode: `IT_S_${suffix}`,
          fullName: "Nguyễn Ánh Đào",
          trainingSystemId: owned.systems[0],
          gpa: 3.2,
          academicEligible: true,
          isActive: true,
        },
      });
      owned.student = student.id;
      studentId = student.id;
      const lecturer = await prisma.lecturer.create({
        data: {
          userId: owned.users[1],
          lecturerCode: `IT_L_${suffix}`,
          fullName: "Giảng viên kiểm thử",
          departmentId: department.id,
          isActive: true,
          researchAreas: { create: { researchAreaId: area.id } },
        },
      });
      owned.lecturer = lecturer.id;
      lecturerId = lecturer.id;
    }, 30000);
    afterAll(async () => {
      if (!prisma) return;
      try {
        if (owned.terms.length) {
          await prisma.advisorAssignment.deleteMany({
            where: { assignmentPlan: { termId: { in: owned.terms } } },
          });
          await prisma.assignmentPlan.deleteMany({
            where: { termId: { in: owned.terms } },
          });
          await prisma.registrationPref.deleteMany({
            where: { registration: { termId: { in: owned.terms } } },
          });
          await prisma.registration.deleteMany({
            where: { termId: { in: owned.terms } },
          });
          await prisma.thesisTerm.deleteMany({
            where: { id: { in: owned.terms } },
          });
        }
        await prisma.auditLog.deleteMany({
          where: {
            OR: [
              { userId: { in: owned.users } },
              {
                resourceId: {
                  in: [...owned.terms, owned.semester].filter(Boolean),
                },
              },
            ],
          },
        });
        if (owned.semester)
          await prisma.academicSemester.deleteMany({
            where: { id: owned.semester },
          });
        if (owned.student)
          await prisma.student.deleteMany({ where: { id: owned.student } });
        if (owned.lecturer)
          await prisma.lecturer.deleteMany({ where: { id: owned.lecturer } });
        await prisma.loginSession.deleteMany({
          where: { userId: { in: owned.users } },
        });
        await prisma.userRole.deleteMany({
          where: { userId: { in: owned.users } },
        });
        await prisma.userAccount.deleteMany({
          where: { id: { in: owned.users } },
        });
        if (owned.department)
          await prisma.department.deleteMany({
            where: { id: owned.department },
          });
        if (owned.area)
          await prisma.researchArea.deleteMany({ where: { id: owned.area } });
        await prisma.trainingSystem.deleteMany({
          where: { id: { in: owned.systems } },
        });
      } finally {
        await prisma.$disconnect();
      }
    }, 30000);

    it("creates semester and scoped terms with six timestamped phases, rejects duplicate and unauthorized creation", async () => {
      const semester = await request<SemesterResponse>("/semesters", "POST", {
        academicYear: `${year}-${year + 1}`,
        semester: 3,
        name: `Kỳ kiểm thử ${suffix}`,
        startDate: `${year}-09-01T00:00:00+07:00`,
        endDate: `${year + 1}-08-01T00:00:00+07:00`,
      });
      expect(semester.status, JSON.stringify(semester)).toBe(201);
      semesterId = semester.data.id;
      owned.semester = semesterId;
      const body = {
        code: `IT_TERM_${suffix}`,
        name: "Đợt đồ án kiểm thử tích hợp",
        semesterId,
        trainingSystemId: owned.systems[0],
        startDate: `${year}-10-01T00:00:00+07:00`,
        endDate: `${year + 1}-03-31T23:59:59+07:00`,
      };
      const forbidden = await request("/terms", "POST", body, "LECTURER");
      expect(forbidden.status).toBe(403);
      const created = await request("/terms", "POST", body);
      expect(created.status, JSON.stringify(created)).toBe(201);
      termId = created.data.id;
      owned.terms.push(termId);
      expect(created.data.phases).toHaveLength(6);
      expect(created.data.start).toBe(`${year}-10-01`);
      expect(
        created.data.phases.every(
          (phase: { start: string; end: string }) =>
            phase.start.endsWith("Z") && phase.end.endsWith("Z"),
        ),
      ).toBe(true);
      expect((await request("/terms", "POST", body)).status).toBe(409);
      const second = await request("/terms", "POST", {
        ...body,
        code: `IT_OTHER_${suffix}`,
        trainingSystemId: owned.systems[1],
      });
      expect(second.status).toBe(201);
      secondTermId = second.data.id;
      owned.terms.push(secondTermId);
    });
    it("enforces authenticated reads, scoped latest and items pagination for every role", async () => {
      expect(
        (await request(`/terms/${termId}`, "GET", undefined, "")).status,
      ).toBe(401);
      for (const role of ["ADMIN", "LECTURER", "STUDENT", "COMMITTEE"])
        expect(
          (await request(`/terms/${termId}`, "GET", undefined, role)).status,
        ).toBe(200);
      const latest = await request(
        `/terms/latest?trainingSystemId=${owned.systems[0]}&semesterId=${semesterId}`,
      );
      expect(latest.status).toBe(200);
      expect(latest.data.id).toBe(termId);
      expect(latest.data.id).not.toBe(secondTermId);
      expect(
        (await request("/terms/latest?trainingSystemId=" + owned.systems[0]))
          .status,
      ).toBe(400);
      const list = await request<PageResponse<TermResponse>>(
        `/terms?semesterId=${semesterId}&trainingSystemId=${owned.systems[0]}&search=IT_TERM_${suffix}&page=1&pageSize=1`,
      );
      expect(list.data).toMatchObject({ total: 1, page: 1, pageSize: 1 });
      expect(list.data.items).toHaveLength(1);
      expect(list.data.items[0].id).toBe(termId);
    });
    it("enforces six-phase ordering, roster prerequisites, role restrictions and atomic failure audit", async () => {
      const opening = await request(`/terms/${termId}/status`, "PATCH", {
        status: "OPEN_REGISTRATION",
      });
      expect(opening.status).toBe(422);
      const roster = {
        studentIds: [studentId],
        lecturers: [{ lecturerId, quota: 2 }],
      };
      expect(
        (await request(`/terms/${termId}/roster`, "PUT", roster, "STUDENT"))
          .status,
      ).toBe(403);
      const saved = await request(`/terms/${termId}/roster`, "PUT", roster);
      expect(saved.status, JSON.stringify(saved)).toBe(200);
      expect(saved.data.studentIds).toEqual([studentId]);
      const phases = saved.data.phases.map(
        (p: {
          id: string;
          code: string;
          name: string;
          start: string;
          end: string;
          locked: boolean;
        }) => ({ ...p }),
      );
      phases[1].start = phases[0].start;
      const before = await prisma.auditLog.count({
        where: { resourceId: termId },
      });
      const invalid = await request(`/terms/${termId}/phases`, "PUT", {
        phases,
      });
      expect(invalid.status).toBe(422);
      expect(invalid.error?.code).toBe("TERM_002");
      expect(
        await prisma.auditLog.count({ where: { resourceId: termId } }),
      ).toBe(before);
      const opened = await request(`/terms/${termId}/status`, "PATCH", {
        status: "OPEN_REGISTRATION",
      });
      expect(opened.status, JSON.stringify(opened)).toBe(200);
      expect(opened.data.status).toBe("OPEN_REGISTRATION");
      expect(
        await prisma.auditLog.count({
          where: { resourceId: termId, action: "TRANSITION_TERM" },
        }),
      ).toBe(1);
      const window = await request<OperationWindowResponse>(
        `/terms/${termId}/operation-window?phaseCode=REGISTRATION`,
        "GET",
        undefined,
        "STUDENT",
      );
      expect(window.status).toBe(200);
      expect(window.data.canWrite).toBe(false);
      expect(window.data.reason).toContain("Chưa đến");
      expect(
        Math.abs(Date.now() - Date.parse(window.data.serverNow)),
      ).toBeLessThan(10000);
    });
    it("blocks writes under term locks and prevents quota below persisted official assignments", async () => {
      expect(
        (await request(`/terms/${termId}/lock`, "PATCH", { locked: true }))
          .status,
      ).toBe(200);
      const locked = await request(`/terms/${termId}/parameters`, "PUT", {
        parameters: { process_weight: 0.5, committee_weight: 0.5 },
      });
      expect(locked.status).toBe(409);
      expect(locked.error?.code).toBe("TERM_003");
      expect(
        (await request(`/terms/${termId}/lock`, "PATCH", { locked: false }))
          .status,
      ).toBe(200);
      const registration = await prisma.registration.create({
        data: { termId, studentId, status: "APPROVED" },
      });
      const plan = await prisma.assignmentPlan.create({
        data: { termId, status: "PUBLISHED", publishedAt: new Date() },
      });
      await prisma.advisorAssignment.create({
        data: {
          assignmentPlanId: plan.id,
          registrationId: registration.id,
          advisorId: lecturerId,
        },
      });
      const quota = await request(`/terms/${termId}/roster`, "PUT", {
        studentIds: [studentId],
        lecturers: [{ lecturerId, quota: 0 }],
      });
      expect(quota.status, JSON.stringify(quota)).toBe(409);
      expect(quota.error?.code).toBe("REG_003");
      const detail = await request(`/terms/${termId}`);
      expect(detail.data.assignmentPublished).toBe(true);
      expect(detail.data.lecturers[0]).toMatchObject({
        quota: 2,
        officialCount: 1,
      });
      const persisted = await prisma.termLecturer.findUniqueOrThrow({
        where: { termId_lecturerId: { termId, lecturerId } },
      });
      expect(persisted.quota).toBe(2);
    });
  },
);
