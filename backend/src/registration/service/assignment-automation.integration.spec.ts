import "reflect-metadata";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { TermRepository } from "../../term/repository/term.repository";
import { TermWindowService } from "../../term/service/term-window.service";
import { AssignmentRepository } from "../repository/assignment.repository";
import { AssignmentPlanService } from "./assignment-plan.service";
import { UserAccountRepository } from "../../auth/repository/user-account.repository";
import { AccountService } from "../../auth/service/account.service";

describe.runIf(process.env.RUN_AUTOMATION_DB_TESTS === "1")(
  "scheduled assignments and student account programs",
  () => {
    const db = new PrismaClient();
    const prisma = db as PrismaService;
    const repo = new AssignmentRepository(prisma);
    const plans = new AssignmentPlanService(
      repo,
      new TermWindowService(new TermRepository(prisma)),
    );
    const accounts = new AccountService(new UserAccountRepository(prisma));
    const at = new Date("2030-10-28T10:00:00+07:00");
    const tag = randomUUID().slice(0, 8);
    let systemId: string,
      otherSystemId: string,
      lecturerId: string,
      areaId: string,
      actorId: string,
      studentRoleId: string;
    let sequence = 0;
    beforeAll(async () => {
      const target = new URL(process.env.DATABASE_URL!);
      if (
        target.hostname !== "127.0.0.1" ||
        !target.pathname.startsWith("/btl_pr2b_autofix_")
      )
        throw new Error(
          "Dedicated loopback btl_pr2b_autofix_* database required",
        );
      systemId = (
        await db.trainingSystem.create({
          data: { code: `CQ-${tag}`, name: "Chính quy" },
        })
      ).id;
      otherSystemId = (
        await db.trainingSystem.create({
          data: { code: `LT-${tag}`, name: "Liên thông" },
        })
      ).id;
      for (const name of ["ADMIN", "STUDENT", "LECTURER"])
        await db.role.upsert({ where: { name }, create: { name }, update: {} });
      studentRoleId = (
        await db.role.findUniqueOrThrow({ where: { name: "STUDENT" } })
      ).id;
      actorId = (
        await db.userAccount.create({
          data: { username: `actor-${tag}`, passwordHash: "fixture" },
        })
      ).id;
      const department = await db.department.create({
        data: { code: tag, name: "Công nghệ phần mềm" },
      });
      areaId = (
        await db.researchArea.create({ data: { name: `Phần mềm ${tag}` } })
      ).id;
      lecturerId = (
        await db.lecturer.create({
          data: {
            lecturerCode: `gv-${tag}`,
            fullName: "Giảng viên kiểm tra",
            department: { connect: { id: department.id } },
            user: {
              create: {
                username: `gv-${tag}`,
                passwordHash: "fixture",
                status: "ACTIVE",
              },
            },
            researchAreas: { create: { researchAreaId: areaId } },
          },
        })
      ).id;
    });
    afterAll(async () => {
      await db.$disconnect();
    });
    async function fixture(
      options: {
        registrationEnd?: Date;
        assignmentStart?: Date;
        assignmentEnd?: Date;
        locked?: boolean;
        phaseLocked?: boolean;
        quota?: number;
        submitted?: boolean;
        draft?: boolean;
      } = {},
    ) {
      const code = `${tag}-${++sequence}`;
      const student = await db.student.create({
        data: {
          studentCode: `sv-${code}`,
          fullName: "Sinh viên kiểm tra",
          trainingSystem: { connect: { id: systemId } },
          gpa: 3.4,
          user: {
            create: {
              username: `sv-${code}`,
              passwordHash: "fixture",
              status: "ACTIVE",
              userRoles: { create: { roleId: studentRoleId } },
            },
          },
        },
      });
      const term = await db.thesisTerm.create({
        data: {
          code,
          name: "Đợt kiểm tra tự động",
          academicYear: "2030-2031",
          semester: 1,
          trainingSystemId: systemId,
          status: "OPEN_REGISTRATION",
          isLocked: options.locked ?? false,
          startDate: new Date(at.getTime() - 86400000),
          endDate: new Date(at.getTime() + 86400000),
          phases: {
            create: [
              {
                code: "REGISTRATION",
                phaseName: "Đăng ký",
                startDate: new Date(at.getTime() - 86400000),
                endDate: options.registrationEnd ?? at,
              },
              {
                code: "ASSIGNMENT",
                phaseName: "Phân công",
                startDate: options.assignmentStart ?? at,
                endDate:
                  options.assignmentEnd ?? new Date(at.getTime() + 3600000),
                isLocked: options.phaseLocked ?? false,
              },
            ],
          },
          termStudents: { create: { studentId: student.id } },
          termLecturers: { create: { lecturerId, quota: options.quota ?? 1 } },
        },
      });
      const registration = await db.registration.create({
        data: {
          termId: term.id,
          studentId: student.id,
          directionId: areaId,
          status: options.submitted === false ? "DRAFT" : "SUBMITTED",
          submittedAt:
            options.submitted === false ? null : new Date(at.getTime() - 60000),
          preferences: { create: { lecturerId, preferenceOrder: 1 } },
        },
      });
      if (options.draft)
        await db.assignmentPlan.create({
          data: {
            termId: term.id,
            revision: 4,
            advisorAssignments: {
              create: {
                registrationId: registration.id,
                advisorId: lecturerId,
                isManual: true,
                note: "Giữ nguyên thủ công",
              },
            },
          },
        });
      return { term, student, registration };
    }
    it("closes registration and creates one draft exactly at the boundary, including concurrent workers", async () => {
      const { term } = await fixture();
      expect((await repo.scheduledTerms(at)).map((t) => t.id)).toContain(
        term.id,
      );
      await Promise.all([
        plans.scheduledDraft(term.id, at),
        plans.scheduledDraft(term.id, at),
      ]);
      await plans.scheduledDraft(term.id, at);
      expect(
        (await db.thesisTerm.findUniqueOrThrow({ where: { id: term.id } }))
          .status,
      ).toBe("CLOSED_REGISTRATION");
      const saved = await db.assignmentPlan.findMany({
        where: { termId: term.id },
        include: { advisorAssignments: true },
      });
      expect(saved).toHaveLength(1);
      expect(saved[0].status).toBe("DRAFT");
      expect(saved[0].revision).toBe(1);
      expect(saved[0].advisorAssignments).toHaveLength(1);
      expect(saved[0].advisorAssignments[0].advisorId).toBe(lecturerId);
      expect(
        await db.auditLog.count({
          where: {
            action: "ASSIGNMENT_AUTO_DRAFT_SAVED",
            resourceId: saved[0].id,
          },
        }),
      ).toBe(1);
      expect(await db.notification.count({ where: { termId: term.id } })).toBe(
        0,
      );
    });
    it("does not close before the registration deadline", async () => {
      const { term } = await fixture({
        registrationEnd: new Date(at.getTime() + 1),
      });
      await plans.scheduledDraft(term.id, at);
      expect(
        (await db.thesisTerm.findUniqueOrThrow({ where: { id: term.id } }))
          .status,
      ).toBe("OPEN_REGISTRATION");
      expect(
        await db.assignmentPlan.count({ where: { termId: term.id } }),
      ).toBe(0);
    });
    it("closes registration during a gap, then catches up when assignment begins", async () => {
      const begins = new Date(at.getTime() + 60000);
      const { term } = await fixture({ assignmentStart: begins });
      await plans.scheduledDraft(term.id, at);
      expect(
        await db.assignmentPlan.count({ where: { termId: term.id } }),
      ).toBe(0);
      expect(
        (await db.thesisTerm.findUniqueOrThrow({ where: { id: term.id } }))
          .status,
      ).toBe("CLOSED_REGISTRATION");
      await plans.scheduledDraft(term.id, begins);
      expect(
        await db.assignmentPlan.count({ where: { termId: term.id } }),
      ).toBe(1);
    });
    it("respects term locks, assignment locks, and the exclusive assignment deadline", async () => {
      for (const options of [
        { locked: true },
        { phaseLocked: true },
        {
          assignmentEnd: at,
          assignmentStart: new Date(at.getTime() - 60000),
          registrationEnd: new Date(at.getTime() - 60000),
        },
      ]) {
        const { term } = await fixture(options);
        await plans.scheduledDraft(term.id, at);
        expect(
          await db.assignmentPlan.count({ where: { termId: term.id } }),
        ).toBe(0);
      }
    });
    it("preserves manual drafts while closing reopened registration", async () => {
      const { term } = await fixture({ draft: true });
      await plans.scheduledDraft(term.id, at);
      const saved = await db.assignmentPlan.findFirstOrThrow({
        where: { termId: term.id },
        include: { advisorAssignments: true },
      });
      expect(saved.revision).toBe(4);
      expect(saved.advisorAssignments[0].isManual).toBe(true);
      expect(saved.advisorAssignments[0].note).toBe("Giữ nguyên thủ công");
      expect(
        (await db.thesisTerm.findUniqueOrThrow({ where: { id: term.id } }))
          .status,
      ).toBe("CLOSED_REGISTRATION");
    });
    it("can assign after the completed registration phase is locked, and keeps published plans unchanged", async () => {
      const { term } = await fixture();
      await db.termPhase.updateMany({
        where: { termId: term.id, code: "REGISTRATION" },
        data: { isLocked: true },
      });
      await db.thesisTerm.update({
        where: { id: term.id },
        data: { status: "CLOSED_REGISTRATION" },
      });
      await plans.scheduledDraft(term.id, at);
      const saved = await db.assignmentPlan.findFirstOrThrow({
        where: { termId: term.id },
      });
      await db.assignmentPlan.update({
        where: { id: saved.id },
        data: { status: "PUBLISHED", revision: 2 },
      });
      await plans.scheduledDraft(term.id, at);
      expect(
        await db.assignmentPlan.count({ where: { termId: term.id } }),
      ).toBe(1);
      expect(
        (
          await db.assignmentPlan.findUniqueOrThrow({
            where: { id: saved.id },
          })
        ).revision,
      ).toBe(2);
    });
    it("does not invent assignments for unsubmitted registrations and explains exhausted quota", async () => {
      const empty = await fixture({ submitted: false });
      await plans.scheduledDraft(empty.term.id, at);
      expect(
        await db.assignmentPlan.count({ where: { termId: empty.term.id } }),
      ).toBe(0);
      const full = await fixture({ quota: 0 });
      const result = await plans.scheduledDraft(full.term.id, at);
      expect(result?.assignments).toHaveLength(0);
      expect(result?.results[0].reason).toContain("quota");
    });
    it("creates a student profile with the chosen program and supports editing it before joining a term", async () => {
      const user = await accounts.create(
        {
          username: `new-${tag}`,
          name: "Sinh viên mới",
          roles: ["STUDENT"],
          trainingSystemId: otherSystemId,
        },
        actorId,
      );
      expect(user.student?.trainingSystemId).toBe(otherSystemId);
      expect(user.student?.program).toBe("Liên thông");
      const updated = await accounts.update(
        user.id,
        { trainingSystemId: systemId, name: "Tên cập nhật" },
        actorId,
      );
      expect(updated.student?.trainingSystemId).toBe(systemId);
      expect(updated.student?.name).toBe("Tên cập nhật");
      expect(await db.student.count({ where: { userId: user.id } })).toBe(1);
    });
    it("rejects missing/unknown programs without creating partial accounts", async () => {
      for (const trainingSystemId of [undefined, "invalid", randomUUID()]) {
        await expect(
          accounts.create(
            {
              username: `bad-${tag}`,
              name: "Sinh viên thiếu hệ",
              roles: ["STUDENT"],
              trainingSystemId,
            },
            actorId,
          ),
        ).rejects.toThrow();
        expect(
          await db.userAccount.count({ where: { username: `bad-${tag}` } }),
        ).toBe(0);
      }
      const faculty = await accounts.create(
        {
          username: `admin-${tag}`,
          name: "Quản trị viên mới",
          roles: ["ADMIN"],
        },
        actorId,
      );
      expect(faculty.student).toBeUndefined();
    });
    it("creates a profile when adding the student role to an existing account", async () => {
      const user = await accounts.create(
        {
          username: `role-${tag}`,
          name: "Tài khoản thêm vai trò",
          roles: ["ADMIN"],
        },
        actorId,
      );
      await expect(
        accounts.update(user.id, { roles: ["ADMIN", "STUDENT"] }, actorId),
      ).rejects.toThrow("hệ đào tạo");
      const updated = await accounts.update(
        user.id,
        { roles: ["ADMIN", "STUDENT"], trainingSystemId: systemId },
        actorId,
      );
      expect(updated.student?.trainingSystemId).toBe(systemId);
      expect(updated.roles).toContain("STUDENT");
    });
    it("rejects program changes conflicting with a term and rolls back other account edits", async () => {
      const { student } = await fixture();
      await expect(
        accounts.update(
          student.userId,
          { trainingSystemId: otherSystemId, name: "Không được lưu" },
          actorId,
        ),
      ).rejects.toThrow("khác hệ");
      const unchanged = await db.student.findUniqueOrThrow({
        where: { id: student.id },
      });
      expect(unchanged.trainingSystemId).toBe(systemId);
      expect(unchanged.fullName).toBe("Sinh viên kiểm tra");
    });
  },
);
