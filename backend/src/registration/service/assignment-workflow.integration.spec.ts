import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import * as bcrypt from "bcryptjs";

describe.runIf(process.env.RUN_TERM_DB_TESTS === "1")(
  "step 3 to step 4-8 workflow handoff",
  () => {
    const db = new PrismaClient();
    const base = process.env.TERM_TEST_API_URL ?? "http://127.0.0.1:3010/api";
    const tag = randomUUID().slice(0, 8);
    let termId: string,
      studentId: string,
      lecturerId: string,
      facultyId: string;
    let faculty: string, student: string, lecturer: string;
    const password = "MergeCheck@2026";
    async function request(
      method: string,
      path: string,
      token?: string,
      body?: unknown,
    ) {
      const response = await fetch(base + path, {
        method,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "Content-Type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: response.status, body: await response.json() };
    }
    beforeAll(async () => {
      const target = new URL(process.env.DATABASE_URL!);
      if (
        target.hostname !== "127.0.0.1" ||
        !target.pathname.startsWith("/btl_pr2b_")
      )
        throw new Error("Dedicated loopback btl_pr2b_* test database required");
      const hash = await bcrypt.hash(password, 4);
      const accounts = [];
      for (const name of ["FACULTY", "STUDENT", "LECTURER"]) {
        const role = await db.role.findUniqueOrThrow({ where: { name } });
        const user = await db.userAccount.create({
          data: {
            username: `merge_${name}_${tag}`,
            passwordHash: hash,
            email: `${name.toLowerCase()}_${tag}@example.test`,
            phone: "0912345678",
            status: "ACTIVE",
            mustChangePassword: false,
            userRoles: { create: { roleId: role.id } },
          },
        });
        const login = await request("POST", "/auth/login", undefined, {
          username: user.username,
          password,
        });
        expect(login.status).toBe(201);
        accounts.push({
          id: user.id,
          token: login.body.data.accessToken as string,
        });
      }
      facultyId = accounts[0].id;
      faculty = accounts[0].token;
      student = accounts[1].token;
      lecturer = accounts[2].token;
      const system = await db.trainingSystem.findFirstOrThrow();
      const department = await db.department.findFirstOrThrow();
      const area = await db.researchArea.create({
        data: {
          name: `Merge ${tag}`,
          pr2bResearchAreaWorkflowResearchAreaId: {
            create: { departmentId: department.id },
          },
        },
      });
      const startDate = new Date(Date.now() - 86400000),
        endDate = new Date(Date.now() + 864000000);
      const term = await db.thesisTerm.create({
        data: {
          code: `MERGE-${tag}`,
          name: `Merge ${tag}`,
          academicYear: "2026-2027",
          semester: 1,
          trainingSystemId: system.id,
          status: "CLOSED_REGISTRATION",
          startDate,
          endDate,
          phases: {
            create: ["ASSIGNMENT", "PROPOSAL"].map((code) => ({
              code,
              phaseName: code,
              startDate,
              endDate,
            })),
          },
        },
      });
      termId = term.id;
      const s = await db.student.create({
        data: {
          userId: accounts[1].id,
          studentCode: `MS${tag}`,
          fullName: "Merge student",
          trainingSystemId: system.id,
          gpa: 3.2,
          termStudents: { create: { termId } },
        },
      });
      studentId = s.id;
      const l = await db.lecturer.create({
        data: {
          userId: accounts[2].id,
          lecturerCode: `ML${tag}`,
          fullName: "Merge advisor",
          departmentId: department.id,
          researchAreas: { create: { researchAreaId: area.id } },
          termLecturers: { create: { termId, quota: 5 } },
        },
      });
      lecturerId = l.id;
      const registration = await db.registration.create({
        data: {
          termId,
          studentId,
          directionId: area.id,
          status: "SUBMITTED",
          submittedAt: new Date(),
          preferences: { create: { lecturerId, preferenceOrder: 1 } },
        },
      });
      await db.assignmentPlan.create({
        data: {
          termId,
          revision: 1,
          advisorAssignments: {
            create: { registrationId: registration.id, advisorId: lecturerId },
          },
        },
      });
    });
    afterAll(async () => {
      await db.$disconnect();
    });

    it("keeps publication separate, records finalization once and preserves draft history on handoff", async () => {
      expect(
        (
          await request(
            "POST",
            `/assignments/term/${termId}/finalize`,
            faculty,
            { revision: 1 },
          )
        ).status,
      ).toBe(422);
      const published = await request(
        "POST",
        `/assignments/term/${termId}/publish`,
        faculty,
        { revision: 1 },
      );
      expect(published.status).toBe(201);
      expect(published.body.data.plan.status).toBe("PUBLISHED");
      expect(
        await db.assignmentPlanWorkflow.count({
          where: { planId: published.body.data.plan.id },
        }),
      ).toBe(0);
      expect(
        (
          await request(
            "POST",
            `/assignments/term/${termId}/finalize`,
            student,
            { revision: 2 },
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await request(
            "POST",
            `/assignments/term/${termId}/finalize`,
            faculty,
            { revision: 1 },
          )
        ).status,
      ).toBe(409);
      const finalized = await request(
        "POST",
        `/assignments/term/${termId}/finalize`,
        faculty,
        { revision: 2 },
      );
      expect(finalized.status).toBe(201);
      expect(finalized.body.data.plan.status).toBe("FINALIZED");
      const metadata = await db.assignmentPlanWorkflow.findUniqueOrThrow({
        where: { planId: finalized.body.data.plan.id },
      });
      expect(metadata.finalizedByUserId).toBe(facultyId);
      expect(metadata.finalizedAt).toBeInstanceOf(Date);
      await request("POST", `/assignments/term/${termId}/finalize`, faculty, {
        revision: 2,
      });
      expect(
        await db.auditLog.count({
          where: {
            resourceId: finalized.body.data.plan.id,
            action: "ASSIGNMENT_FINALIZED",
          },
        }),
      ).toBe(1);
      const content = {
        title: "A thesis integration example",
        objectives: "Detailed integration objectives",
        scope: "Detailed system integration scope",
        technology: "NestJS",
        expected: "Working tested system",
        plan: [{ week: "1-3", content: "Analyze and implement" }],
      };
      const saved = await request(
        "PUT",
        `/topics/term/${termId}/student/${studentId}/draft`,
        student,
        { content, expectedVersion: 0 },
      );
      expect(saved.status).toBe(200);
      const id = saved.body.data.id;
      expect(
        (
          await request("POST", `/topics/${id}/agree`, lecturer, {
            agreed: true,
            expectedVersion: 1,
          })
        ).status,
      ).toBe(201);
      const source = await db.proposalVersion.findFirstOrThrow({
        where: { proposalId: id },
      });
      expect(
        (await request("POST", `/topics/${id}/prepare-workflow`, faculty))
          .status,
      ).toBe(403);
      const handoff = await request(
        "POST",
        `/topics/${id}/prepare-workflow`,
        student,
      );
      expect(handoff.status).toBe(201);
      expect(
        await db.proposalVersion.findUnique({ where: { id: source.id } }),
      ).toEqual(source);
      const workflow = await db.proposalWorkflow.findUniqueOrThrow({
        where: { proposalId: id },
      });
      expect(workflow.submittedVersionId).toBeNull();
      const draft = await db.proposalVersion.findUniqueOrThrow({
        where: { id: workflow.workingVersionId! },
        include: { pr2bProposalVersionWorkflowVersionId: true },
      });
      expect(draft.pr2bProposalVersionWorkflowVersionId?.state).toBe("DRAFT");
      expect(draft.content).toMatchObject({
        schemaVersion: 1,
        objectives: content.objectives,
        startsAt: "",
        schedule: [],
      });
      await request("POST", `/topics/${id}/prepare-workflow`, student);
      expect(
        await db.proposalVersion.count({ where: { proposalId: id } }),
      ).toBe(2);
      expect(
        (
          await request(
            "PUT",
            `/topics/term/${termId}/student/${studentId}/draft`,
            student,
            { content, expectedVersion: 2 },
          )
        ).status,
      ).toBe(409);
    });
  },
);
