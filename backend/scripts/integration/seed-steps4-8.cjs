"use strict";
// Synthetic producer inputs only. Never load .env; never update/reset existing data.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const { testTarget } = require("../rehearse-pr2b.cjs");

async function seedSteps48(db, rawUrl) {
  const url = testTarget(rawUrl);
  const [identity] = await db.$queryRaw`SELECT current_database() AS name`;
  assert.equal(identity.name, url.pathname.slice(1));
  for (const model of ["userAccount", "thesisTerm", "department", "proposal", "role"])
    assert.equal(await db[model].count(), 0, "Seed refuses existing " + model);
  const password = "Qa!" + crypto.randomBytes(18).toString("hex");
  const hash = await bcrypt.hash(password, 10);
  const now = Date.now(), start = new Date(now - 86400000), end = new Date(now + 7 * 86400000);
  const roles = ["FACULTY", "LECTURER", "STUDENT", "ADMIN"];
  for (const name of roles) await db.role.create({ data: { id: name, name } });
  // Match the step 1-3 seed's faculty read grants for the legacy API regressions.
  for (const resource of ['registration', 'topic']) {
    const permission = await db.permission.upsert({
      where: { resource_action: { resource, action: 'read' } },
      create: { resource, action: 'read' }, update: {},
    });
    await db.rolePermission.create({ data: { roleId: 'FACULTY', permissionId: permission.id } });
  }
  // Match reviewed migration grants. Roles deliberately did not exist at migrate time.
  const allow = {
    FACULTY: ["review-group:read", "review-group:manage", "proposal:read", "proposal:assign", "proposal:finalize", "proposal:export", "dossier:receive", "guidance:read", "guidance:monitor", "submission:read", "submission:download"],
    LECTURER: ["review-group:read", "proposal:read", "proposal:comment", "proposal:review", "proposal:edit", "proposal:export", "guidance:read", "guidance:manage", "task:manage", "task:ensure-weekly", "task:review", "submission:read", "submission:download"],
    STUDENT: ["proposal:read", "proposal:edit", "proposal:submit", "proposal:export", "guidance:read", "task:progress", "task:ensure-weekly", "submission:read", "submission:create", "submission:download"],
    ADMIN: [],
  };
  for (const p of await db.permission.findMany())
    for (const roleId of roles)
      if (allow[roleId].includes(p.resource + ":" + p.action))
        await db.rolePermission.upsert({
          where: { roleId_permissionId: { roleId, permissionId: p.id } },
          create: { roleId, permissionId: p.id }, update: {},
        });
  const actors = { faculty: "FACULTY", faculty2: "FACULTY", reviewer: "LECTURER", advisor: "LECTURER", outsider: "LECTURER", foreign: "LECTURER", student: "STUDENT", student2: "STUDENT", student3: "STUDENT", admin: "ADMIN" };
  for (const [id, roleId] of Object.entries(actors))
    await db.userAccount.create({ data: { id, username: "qa-" + id, email: id + "@example.invalid", phone: "0912345678", passwordHash: hash, status: "ACTIVE", mustChangePassword: false, userRoles: { create: { roleId } } } });
  await db.userAccount.create({ data: { id: "unprivileged", username: "qa-unprivileged", email: "unprivileged@example.invalid", passwordHash: hash, status: "ACTIVE", mustChangePassword: false } });
  for (const resource of ["student", "lecturer", "term"]) {
    const permission = await db.permission.upsert({ where: { resource_action: { resource, action: "read" } }, create: { resource, action: "read", description: "Synthetic compatibility read permission" }, update: {} });
    await db.rolePermission.create({ data: { roleId: "FACULTY", permissionId: permission.id } });
  }
  await db.department.create({ data: { id: "qa-d", code: "QA", name: "Bộ môn kiểm thử tổng hợp" } });
  await db.trainingSystem.create({ data: { id: "qa-training", code: "QA", name: "Đại học — dữ liệu kiểm thử" } });
  await db.researchArea.create({ data: { id: "qa-area", name: "Kỹ nghệ phần mềm", pr2bResearchAreaWorkflowResearchAreaId: { create: { departmentId: "qa-d" } } } });
  for (const id of ["qa-t1", "qa-t2"]) {
    await db.thesisTerm.create({ data: { id, code: id, name: "Đợt kiểm thử " + id, academicYear: "2026-2027", semester: 1, status: "IN_PROGRESS", startDate: start, endDate: end } });
    for (const key of ["PROPOSAL_EDIT", "PROPOSAL_REVIEW", "GUIDANCE"])
      await db.termPhase.create({ data: { id: id + "-" + key, termId: id, phaseName: "Synthetic " + key, startDate: start, endDate: end, pr2bTermPhaseWorkflowPhaseId: { create: { termId: id, key } } } });
    await db.academicTermGrant.create({ data: { userId: id === "qa-t1" ? "faculty" : "faculty2", termId: id, pr2bGrantDepartmentGrantId: { create: { departmentId: "qa-d" } } } });
  }
  for (const [id, name] of [["reviewer", "Nguyễn Thị Duyệt"], ["advisor", "Trần Văn Hướng Dẫn"], ["outsider", "Giảng viên nhóm khác"], ["foreign", "Giảng viên đợt khác"]])
    await db.lecturer.create({ data: { id, userId: id, lecturerCode: "QA-" + id, fullName: name, departmentId: "qa-d", termLecturers: { create: { termId: id === "foreign" ? "qa-t2" : "qa-t1" } } } });
  await db.termLecturer.create({ data: { lecturerId: "advisor", termId: "qa-t2" } });
  await db.lecturerArea.create({ data: { lecturerId: "reviewer", researchAreaId: "qa-area" } });
  for (const termId of ["qa-t1", "qa-t2"]) {
    await db.assignmentPlan.create({ data: { id: termId + "-assign", termId, status: "FINALIZED", pr2bAssignmentPlanWorkflowPlanId: { create: { finalizedAt: new Date(now - 10000), finalizedByUserId: termId === "qa-t1" ? "faculty" : "faculty2" } } } });
    await db.termWorkflow.create({ data: { termId, officialAssignmentPlanId: termId + "-assign" } });
  }
  const content = { schemaVersion: 1, objectives: "Mục tiêu ban đầu cần bổ sung kiểm thử", scope: "Phạm vi hệ thống quản lý đồ án", mainContents: "Phân tích, thiết kế, phát triển và kiểm thử hệ thống", tools: "NestJS, Prisma, React và PostgreSQL", expectedResults: "Phần mềm và báo cáo tiến độ", startsAt: start.toISOString(), endsAt: end.toISOString(), schedule: [{ label: "Phân tích và kiểm thử", startsAt: start.toISOString(), endsAt: end.toISOString(), deliverables: "Báo cáo PDF và source ZIP" }] };
  const canonical = v => JSON.stringify(v, (_, x) => x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(k => [k, x[k]])) : x);
  for (const [id, name, termId] of [["student", "Nguyễn Văn Sinh", "qa-t1"], ["student2", "Sinh viên khác", "qa-t1"], ["student3", "Sinh viên đợt khác", "qa-t2"]]) {
    await db.student.create({ data: { id, userId: id, studentCode: "QA-" + id, fullName: name, trainingSystemId: "qa-training" } });
    await db.termStudent.create({ data: { id: "ts-" + id, studentId: id, termId } });
    await db.dossierStudentProfile.create({ data: { termStudentId: "ts-" + id, className: "Công nghệ thông tin K63", majorName: "Khoa học máy tính" } });
    await db.registration.create({ data: { id: "reg-" + id, studentId: id, termId, advisorAssignments: { create: { advisorId: "advisor", assignmentPlanId: termId + "-assign" } } } });
    await db.topic.create({ data: { id: "topic-" + id, termId, researchAreaId: "qa-area", title: "Hệ thống quản lý đồ án — " + name, pr2bTopicWorkflowTopicId: { create: { termId, termStudentId: "ts-" + id, confirmedTopicRevision: 0, confirmedAssignmentRevision: 0, confirmedByAdvisorId: "advisor", confirmedAt: new Date(now - 8000) } } } });
    await db.proposal.create({ data: { id: "p-" + id, termId, studentId: id, topicId: "topic-" + id, status: "SUBMITTED" } });
    await db.proposalVersion.create({ data: { id: "v1-" + id, proposalId: "p-" + id, version: 1, content, pr2bProposalVersionWorkflowVersionId: { create: { state: "SEALED", contentSchemaVersion: 1, contentHash: crypto.createHash("sha256").update(canonical(content)).digest("hex"), createdByUserId: id, submittedByUserId: id, submittedAt: new Date(now - 5000) } } } });
    await db.proposalWorkflow.create({ data: { proposalId: "p-" + id, workingVersionId: "v1-" + id, submittedVersionId: "v1-" + id, submissionKind: "INITIAL", nextReviewRound: 1, nextVersionNumber: 2 } });
  }
  await db.guidancePeriod.create({ data: { id: "qa-m1", termId: "qa-t1", ordinal: 1, type: "MILESTONE", label: "Mốc kiểm thử tích hợp", startsAt: start, endsAt: end } });
  const dueDate = new Date(now + 3600000);
  await db.guidancePeriod.create({ data: { id: "qa-w1", termId: "qa-t1", ordinal: 2, type: "WEEK", label: "Tuần bắt buộc chưa tạo task", startsAt: start, endsAt: end, reportDueAt: dueDate } });
  await db.periodRequiredStudent.create({ data: { termId: "qa-t1", termStudentId: "ts-student", periodId: "qa-w1" } });
  await db.weeklyReportObligation.create({ data: { id: "qa-obligation", periodId: "qa-w1", termStudentId: "ts-student", configRevision: 0, configSnapshot: { schemaVersion: 1, termId: "qa-t1", periodId: "qa-w1", termStudentId: "ts-student", periodRevision: 0, startsAt: start.toISOString(), reportDueAt: dueDate.toISOString(), expectedDeliverables: "Báo cáo tuần và source" } } });
  return { password, actors: Object.keys(actors), startDate: new Date(now - 3600000).toISOString(), dueDate: dueDate.toISOString(), content };
}
module.exports = { seedSteps48 };
