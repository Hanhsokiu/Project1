"use strict";
const {
  id,
  date,
  plus,
  areas,
  lecturers,
  terms,
  participants,
} = require("./definition.cjs");
async function seedRegistration(ctx) {
  for (const t of terms)
    await ctx.phase("registration-assignment-" + t.key, async (tx) => {
      const createdAt = plus(t.start, -1),
        stamp = { createdAt, updatedAt: createdAt },
        facultyId = id("user/faculty/1");
      await ctx.put(tx, "academicSemester", {
        id: id("semester/" + t.key),
        academicYear: t.year,
        semester: t.semester,
        name: `Học kỳ DEMO ${t.code}`,
        startDate: date(t.start),
        endDate: date(t.end),
        ...stamp,
      });
      // The old term stays IN_PROGRESS until the real defense/result producers are verified.
      await ctx.put(tx, "thesisTerm", {
        id: t.id,
        code: t.code,
        name: `${t.code} · Đồ án CNTT (mô phỏng)`,
        academicYear: t.year,
        semester: t.semester,
        semesterId: id("semester/" + t.key),
        trainingSystemId: id("training"),
        status: "IN_PROGRESS",
        startDate: date(t.start),
        endDate: date(t.end),
        ...stamp,
      });
      const phases = [
        ["REGISTRATION", t.registration, null],
        ["ASSIGNMENT", t.assignment, null],
        ["PROPOSAL", t.proposal, "PROPOSAL_EDIT"],
        ["PROPOSAL_REVIEW", t.proposal, "PROPOSAL_REVIEW"],
        ["WEEKLY", t.guidance, "GUIDANCE"],
        ["FINAL", t.final, null],
        ["DEFENSE", t.defense, null],
      ];
      for (const [code, range, key] of phases) {
        await ctx.put(tx, "termPhase", {
          id: id(`phase/${t.key}/${code}`),
          termId: t.id,
          code,
          phaseName: code,
          startDate: date(range[0]),
          endDate: date(range[1]),
          createdAt,
        });
        if (key)
          await ctx.put(tx, "termPhaseWorkflow", {
            id: id(`phase-workflow/${t.key}/${code}`),
            phaseId: id(`phase/${t.key}/${code}`),
            termId: t.id,
            key,
            ...stamp,
          });
      }
      for (const [key, value] of Object.entries(
        ctx.local.req("./dist/term/validator/term-configuration.validator")
          .defaultTermParameters,
      ))
        await ctx.put(tx, "termParameter", {
          id: id(`parameter/${t.key}/${key}`),
          termId: t.id,
          key,
          value: String(value),
          ...stamp,
        });
      for (let i = 1; i <= 2; i++)
        await ctx.put(tx, "academicTermGrant", {
          id: id(`grant/${t.key}/${i}`),
          userId: id("user/faculty/" + i),
          termId: t.id,
          allDepartments: true,
          ...stamp,
        });
      for (let i = 1; i <= 2; i++)
        await ctx.put(tx, "grantDepartment", {
          id: id(`grant-department/${t.key}/${i}`),
          grantId: id(`grant/${t.key}/${i}`),
          departmentId: id("department"),
          ...stamp,
        });
      for (const l of lecturers)
        await tx.termLecturer.create({
          data: { termId: t.id, lecturerId: l.id, quota: 5 },
        });
      const planId = id("assignment-plan/" + t.key),
        finalizedAt = plus(t.assignment[0], 1);
      await ctx.put(tx, "assignmentPlan", {
        id: planId,
        termId: t.id,
        status: "FINALIZED",
        revision: 1,
        publishedAt: date(t.assignment[0]),
        inputSnapshot: {
          synthetic: true,
          quota: 5,
          participants: t.studentNumbers.length,
        },
        outcome: {
          synthetic: true,
          assigned: t.studentNumbers.length,
          unassigned: 0,
        },
        createdAt: date(t.assignment[0]),
        updatedAt: finalizedAt,
      });
      await ctx.put(tx, "assignmentPlanWorkflow", {
        id: id("assignment-workflow/" + t.key),
        planId,
        revision: 1,
        finalizedAt,
        finalizedByUserId: facultyId,
        createdAt: finalizedAt,
        updatedAt: finalizedAt,
      });
      await ctx.put(tx, "termWorkflow", {
        id: id("term-workflow/" + t.key),
        termId: t.id,
        officialAssignmentPlanId: planId,
        revision: 1,
        createdAt: finalizedAt,
        updatedAt: finalizedAt,
      });
      for (const p of participants(t)) {
        const { student: s, advisor: a, key } = p,
          area = areas[(a.n - 1) % 5],
          memberId = id("member/" + key),
          reg = id("registration/" + key),
          submittedAt = plus(t.registration[0], 1 + (p.index % 5)),
          topicAt = date(t.proposal[0]);
        await ctx.put(tx, "termStudent", {
          id: memberId,
          termId: t.id,
          studentId: s.id,
          createdAt,
        });
        await tx.dossierStudentProfile.create({
          data: {
            termStudentId: memberId,
            className: "DEMO-CNTT-K64-" + (1 + (s.n % 3)),
            majorName: "Công nghệ thông tin",
            revision: 1,
          },
        });
        await ctx.put(tx, "registration", {
          id: reg,
          termId: t.id,
          studentId: s.id,
          directionId: id("area/" + area),
          status: "SUBMITTED",
          submittedAt,
          note: "Dữ liệu tổng hợp DEMO V3; không phải hồ sơ cá nhân thật.",
          createdAt: date(t.registration[0]),
          updatedAt: submittedAt,
        });
        const candidates = lecturers.filter(
            (l) => (l.n - 1) % 5 === (a.n - 1) % 5,
          ),
          count = 1 + (p.index % 3),
          position = candidates.findIndex((l) => l.id === a.id);
        // Rotate the same-area preference list; advisor may be NV1/NV2/NV3.
        const ordered = Array.from(
          { length: count },
          (_, i) => candidates[(position + i + count - 1) % candidates.length],
        );
        for (let i = 0; i < count; i++)
          await ctx.put(tx, "registrationPref", {
            id: id(`preference/${key}/${i + 1}`),
            registrationId: reg,
            lecturerId: ordered[i].id,
            preferenceOrder: i + 1,
          });
        await ctx.put(tx, "advisorAssignment", {
          id: id("assignment/" + key),
          assignmentPlanId: planId,
          registrationId: reg,
          advisorId: a.id,
          isManual: false,
          note: "Fixture tổng hợp; không khẳng định là kết quả chạy thuật toán",
          createdAt: date(t.assignment[0]),
        });
        const title = `${area}: Xây dựng ứng dụng hỗ trợ học tập ${t.code}-${String(s.n).padStart(3, "0")} (DEMO)`;
        await ctx.put(tx, "topic", {
          id: id("topic/" + key),
          termId: t.id,
          researchAreaId: id("area/" + area),
          title,
          description:
            "Phân tích, thiết kế, xây dựng và kiểm thử sản phẩm minh họa bằng dữ liệu tổng hợp.",
          advisorAgreed: true,
          studentAgreed: true,
          agreedAt: topicAt,
          createdAt: topicAt,
          updatedAt: topicAt,
        });
        await ctx.put(tx, "topicWorkflow", {
          id: id("topic-workflow/" + key),
          topicId: id("topic/" + key),
          termId: t.id,
          termStudentId: memberId,
          revision: 1,
          confirmedTopicRevision: 1,
          confirmedAssignmentRevision: 0,
          confirmedAt: topicAt,
          confirmedByAdvisorId: a.id,
          createdAt: topicAt,
          updatedAt: topicAt,
        });
        await ctx.put(tx, "topicHistory", {
          id: id("topic-history/" + key),
          topicId: id("topic/" + key),
          changedBy: s.userId,
          oldValue: { synthetic: true, state: "UNSET" },
          newValue: { synthetic: true, title, advisorId: a.id, agreed: true },
          createdAt: topicAt,
        });
        await ctx.put(tx, "notification", {
          id: id("notification/" + key),
          userId: s.userId,
          termId: t.id,
          title: "[DEMO] Đã công bố phân công GVHD",
          body: `Giảng viên phụ trách: ${a.name}. Đây là thông báo trong bộ dữ liệu tổng hợp.`,
          link: "/assignment-result",
          createdAt: finalizedAt,
        });
      }
    });
  // Names are presentation data, while stable codes/workflow keys retain business meaning.
  // A separate owned phase repairs earlier V3 seeds without rewriting any manual label.
  await ctx.phase("localized-term-phase-labels", async (tx) => {
    const names = {
      REGISTRATION: "Đăng ký nguyện vọng",
      ASSIGNMENT: "Phân công GVHD",
      PROPOSAL: "Lập và nộp đề cương",
      PROPOSAL_REVIEW: "Xét duyệt đề cương",
      WEEKLY: "Hướng dẫn và báo cáo tuần",
      FINAL: "Nộp báo cáo cuối kỳ",
      DEFENSE: "Bảo vệ đồ án",
    };
    for (const t of terms)
      for (const [code, phaseName] of Object.entries(names)) {
        await tx.termPhase.updateMany({
          where: {
            id: id(`phase/${t.key}/${code}`),
            termId: t.id,
            code,
            phaseName: code,
          },
          data: { phaseName },
        });
      }
  });
}
module.exports = { seedRegistration };
