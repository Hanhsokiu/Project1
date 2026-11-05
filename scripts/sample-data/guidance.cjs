"use strict";
const assert = require("node:assert/strict"),
  path = require("node:path");
const { id, day, week } = require("./definition.cjs");
function zip(text) {
  const name = Buffer.from("src/main.ts"),
    bytes = Buffer.from(text);
  let crc = 0xffffffff;
  for (const b of bytes) {
    crc ^= b;
    for (let i = 0; i < 8; i++)
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  crc = (crc ^ 0xffffffff) >>> 0;
  const l = Buffer.alloc(30),
    c = Buffer.alloc(46),
    e = Buffer.alloc(22);
  l.writeUInt32LE(0x04034b50);
  l.writeUInt16LE(20, 4);
  l.writeUInt32LE(crc, 14);
  l.writeUInt32LE(bytes.length, 18);
  l.writeUInt32LE(bytes.length, 22);
  l.writeUInt16LE(name.length, 26);
  c.writeUInt32LE(0x02014b50);
  c.writeUInt16LE(20, 6);
  c.writeUInt32LE(crc, 16);
  c.writeUInt32LE(bytes.length, 20);
  c.writeUInt32LE(bytes.length, 24);
  c.writeUInt16LE(name.length, 28);
  e.writeUInt32LE(0x06054b50);
  e.writeUInt16LE(1, 8);
  e.writeUInt16LE(1, 10);
  e.writeUInt32LE(c.length + name.length, 12);
  e.writeUInt32LE(l.length + name.length + bytes.length, 16);
  return Buffer.concat([l, name, bytes, c, name, e]);
}
async function guidance({
  db,
  fixture,
  request,
  action,
  save,
  people,
  req,
  backend,
}) {
  // Leave one live step-7 receipt exercise in the proposal/review term. The
  // guidance term's review window has already closed, as it would in real use.
  const receiptExample = fixture.stages.proposal[11];
  const receiptKey = "proposal/sv12/receipt-example-finalize";
  if (!fixture.actions[receiptKey]?.done) {
    const dossier = await request(
      "giaovu",
      "GET",
      `/proposals/${receiptExample.proposalId}/dossier`,
    );
    await action(
      receiptKey,
      "giaovu",
      "POST",
      `/proposals/${receiptExample.proposalId}/finalize`,
      {
        expectedProposalRevision: dossier.proposalRevision,
        expectedDossierRevision: dossier.revision,
        approvedVersionId: receiptExample.versionId,
        templateVersion: "project1-docx-individual-v1",
      },
    );
  }
  const termId = id("term/guidance"),
    periods = [];
  for (let n = 1; n <= 4; n++) {
    const period = await action(
      `week/${n}/create`,
      "giaovu",
      "POST",
      `/terms/${termId}/weekly-plans`,
      {
        ...week(fixture.anchor, n),
        label: `Tuần ${n} · ${["Phân tích yêu cầu", "Thiết kế dữ liệu và giao diện", "Phát triển chức năng", "Kiểm thử và hoàn thiện"][n - 1]}`,
        description:
          "Kế hoạch mẫu chung của đợt. Sinh viên báo cáo kết quả, khó khăn và công việc tiếp theo.",
        expectedDeliverables:
          "Báo cáo PDF, mã nguồn ZIP và bằng chứng kết quả thực hiện.",
        allowLate: true,
      },
    );
    if (n < 4) {
      await action(
        `week/${n}/open`,
        "giaovu",
        "POST",
        `/terms/${termId}/weekly-plans/${period.id}/state`,
        {
          expectedRevision: period.revision,
          state: "OPEN",
          reason: "Công bố kế hoạch mẫu và sinh nghĩa vụ cho đủ 12 sinh viên.",
        },
      );
      if (n === 3) {
        const current = await db.guidancePeriod.findUniqueOrThrow({
          where: { id: period.id },
        });
        await action(
          `week/${n}/lock`,
          "giaovu",
          "POST",
          `/terms/${termId}/weekly-plans/${period.id}/state`,
          {
            expectedRevision: current.revision,
            state: "LOCKED",
            reason:
              "Minh họa tuần đã khóa: xem được kế hoạch nhưng chưa nhận báo cáo.",
          },
        );
      }
    }
    periods.push(period);
  }
  const PDFDocument = req("pdfkit");
  async function pdf(p, number) {
    return new Promise((resolve, reject) => {
      const chunks = [],
        doc = new PDFDocument({ size: "A4", margin: 48 });
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
      doc.font(path.join(backend, "assets/fonts/NotoSerif-Regular.ttf"));
      doc.fontSize(18).text("BÁO CÁO TIẾN ĐỘ ĐỒ ÁN", { align: "center" });
      doc
        .moveDown()
        .fontSize(12)
        .text(`DỮ LIỆU MẪU · ${p.name} · ${p.code} · Phiên bản ${number}`);
      const labels = {
        assignedWork: "Công việc được giao",
        completedWork: "Công việc đã hoàn thành",
        results: "Kết quả đạt được",
        unfinishedWork: "Công việc chưa hoàn thành",
        unfinishedReason: "Nguyên nhân",
        difficulties: "Khó khăn",
        solutions: "Giải pháp",
        nextWork: "Kế hoạch tiếp theo",
        notes: "Ghi chú",
      };
      for (const [label, text] of Object.entries(report(p, number)))
        doc.moveDown().text(`${labels[label]}: ${text || "Không có"}`);
      doc.end();
    });
  }
  function report(p, number) {
    return {
      assignedWork:
        "Phân tích yêu cầu, thiết kế cơ sở dữ liệu và hiện thực chức năng quản lý chính.",
      completedWork:
        number > 1
          ? "Đã hoàn thiện sơ đồ quan hệ, bổ sung ràng buộc và kiểm thử theo nhận xét GVHD."
          : "Đã khảo sát quy trình, viết đặc tả và dựng giao diện danh sách.",
      results:
        "Đặc tả gồm 12 yêu cầu, 8 bảng dữ liệu, 5 màn hình và 15 tình huống kiểm thử.",
      unfinishedWork: "",
      unfinishedReason: "",
      difficulties: "Cần thống nhất quy tắc phân quyền giữa các vai trò.",
      solutions: "Trao đổi với GVHD; lập bảng quyền và kiểm tra truy cập chéo.",
      nextWork:
        "Hoàn thiện API, tích hợp giao diện và kiểm thử luồng nghiệp vụ.",
      notes: `Bộ mẫu bước 1–8 · ${p.code} · phiên bản ${number}.`,
    };
  }
  async function submit(p, taskId, key, number = 1) {
    if (fixture.actions[key + "/submit"]?.done)
      return fixture.actions[key + "/submit"].result;
    const fileIds = [];
    for (const kind of ["REPORT", "SOURCE"]) {
      const saved = fixture.actions[key + "/upload/" + kind];
      if (saved?.done) {
        fileIds.push(saved.result.id);
        continue;
      }
      const form = new FormData();
      form.append("kind", kind);
      form.append(
        "file",
        new Blob(
          [
            kind === "REPORT"
              ? await pdf(p, number)
              : zip(
                  `// Mã nguồn minh họa của ${p.code}, phiên bản ${number}.\n// Dùng để kiểm tra tệp ZIP trong hệ thống quản lý đồ án.\nexport type Role = 'STUDENT' | 'LECTURER' | 'FACULTY';\nexport function canReadReport(role: Role, isOwner: boolean, isAdvisor: boolean): boolean {\n  return role === 'FACULTY' || (role === 'STUDENT' && isOwner) || (role === 'LECTURER' && isAdvisor);\n}\n`,
                ),
          ],
          { type: kind === "REPORT" ? "application/pdf" : "application/zip" },
        ),
        kind === "REPORT"
          ? `bao-cao-${p.key}-v${number}.pdf`
          : `ma-nguon-${p.key}-v${number}.zip`,
      );
      const upload = await request(
        p.key,
        "POST",
        `/tasks/${taskId}/submission-uploads`,
        form,
      );
      fixture.actions[key + "/upload/" + kind] = { done: true, result: upload };
      save();
      fileIds.push(upload.id);
    }
    const context = await request(
      p.key,
      "GET",
      `/tasks/${taskId}/submission-context`,
    );
    return action(
      key + "/submit",
      p.key,
      "POST",
      `/tasks/${taskId}/submissions`,
      {
        expectedTaskRevision: context.taskRevision,
        uploadIds: fileIds,
        report: report(p, number),
        content:
          "Báo cáo mẫu có PDF và ZIP; xem nhận xét và lịch sử phiên bản tại đây.",
        ...(number > 1
          ? {
              changeExplanation:
                "Đã sửa mô hình dữ liệu, bổ sung ràng buộc và kết quả kiểm thử theo góp ý GVHD.",
            }
          : {}),
      },
    );
  }
  async function decision(p, submission, key, decision) {
    const context = await request(
      p.advisor,
      "GET",
      `/task-submissions/${submission.id}/review-context`,
    );
    return action(
      key,
      p.advisor,
      "POST",
      `/task-submissions/${submission.id}/reviews`,
      {
        expectedTaskRevision: context.taskRevision,
        expectedSubmissionRevision: context.submission.revision,
        decision,
        comment: {
          PASS: "Hoàn thành mục tiêu, có minh chứng và kiểm thử. Tiếp tục triển khai theo kế hoạch tuần sau.",
          FAIL: "Chưa đạt yêu cầu: thiếu chức năng cốt lõi và bằng chứng kết quả chạy thử. Cần trao đổi để lập lại kế hoạch.",
          REVISION_REQUIRED:
            "Bổ sung khóa ngoại, sơ đồ quan hệ và kiểm thử phân quyền; nộp lại trước hạn sửa.",
        }[decision],
        ...(decision === "REVISION_REQUIRED"
          ? { revisionDueAt: new Date(fixture.anchor + 5 * day).toISOString() }
          : {}),
      },
    );
  }
  async function ensure(p, period, key) {
    const coverage = await request(
      p.key,
      "GET",
      `/terms/${termId}/weekly-report-coverage?periodId=${period.id}&limit=100`,
    );
    const row = coverage.data.find(
      (r) => r.termStudentId === id(`guidance/member/${p.key}`),
    );
    assert(row, "Missing obligation for " + p.key);
    return action(
      key,
      p.key,
      "POST",
      `/weekly-report-obligations/${row.obligationId}/task`,
      {
        expectedObligationRevision: row.obligationRevision,
        expectedPlanRevision: row.planRevision,
      },
    );
  }
  fixture.guidance = fixture.guidance || {};
  fixture.guidance.periodIds = periods.map((p) => p.id);
  save();
  for (let i = 7; i < 12; i++) {
    const p = people[i],
      key = "guidance/" + p.key;
    const context = await request(
      p.advisor,
      "GET",
      `/proposals/${p.proposalId}/guidance-context`,
    );
    const plan = await action(
      key + "/plan",
      p.advisor,
      "POST",
      `/proposals/${p.proposalId}/guidance-plan`,
      {
        expectedDossierRevision: context.dossierRevision,
        finalizationId: context.currentFinalizationId,
        description:
          "Kế hoạch thực hiện đồ án: phân tích yêu cầu → thiết kế → phát triển → kiểm thử → hoàn thiện tài liệu.",
      },
    );
    const task = await ensure(p, periods[1], key + "/current-task");
    if (i === 7)
      await action(key + "/draft", p.key, "PUT", `/tasks/${task.id}/draft`, {
        expectedDraftRevision: 0,
        report: {
          completedWork:
            "Đang hoàn thiện mô hình dữ liệu; đây là bản nháp chưa nộp chính thức.",
          nextWork: "Bổ sung kết quả chạy thử và tệp PDF/ZIP.",
        },
      });
    else {
      const submission = await submit(p, task.id, key + "/v1");
      if (i >= 9)
        await decision(
          p,
          submission,
          key + "/review-v1",
          ["REVISION_REQUIRED", "PASS", "FAIL"][i - 9],
        );
    }
    if (i === 10) {
      const pastTask = await ensure(p, periods[0], key + "/past-task");
      const first = await submit(p, pastTask.id, key + "/past-v1");
      await decision(p, first, key + "/past-review-v1", "REVISION_REQUIRED");
      const second = await submit(p, pastTask.id, key + "/past-v2", 2);
      await decision(p, second, key + "/past-review-v2", "PASS");
    }
    if (i === 7) await ensure(p, periods[0], key + "/overdue-task");
    if (i === 11) {
      const pastTask = await ensure(p, periods[0], key + "/late-task");
      const late = await submit(p, pastTask.id, key + "/late-v1");
      await decision(p, late, key + "/late-review", "FAIL");
    }
    if (i === 7 || i === 10) {
      const current = await request(
        p.advisor,
        "GET",
        `/proposals/${p.proposalId}/guidance-plan`,
      );
      await action(
        key + "/meeting",
        p.advisor,
        "POST",
        `/guidance-plans/${plan.id}/meetings`,
        {
          expectedPlanRevision: current.revision,
          occurredAt: new Date(fixture.anchor - 3600000).toISOString(),
          mode: i === 7 ? "IN_PERSON" : "ONLINE",
          location:
            i === 7
              ? "Phòng thực hành A501 (mẫu)"
              : "Phòng họp trực tuyến (mẫu)",
          discussion:
            "Rà soát mô hình dữ liệu, phân quyền và tiến độ thực hiện các chức năng.",
          conclusion:
            "Chốt phạm vi chức năng; bổ sung kiểm thử và nộp báo cáo tiến độ theo tuần.",
        },
      );
    }
    if (i === 7) {
      for (const cancelled of [false, true]) {
        const current = await request(
          p.advisor,
          "GET",
          `/proposals/${p.proposalId}/guidance-plan`,
        );
        const extra = await action(
          key + (cancelled ? "/cancelled-task" : "/adhoc-task"),
          p.advisor,
          "POST",
          `/guidance-plans/${plan.id}/tasks`,
          {
            expectedPlanRevision: current.revision,
            title: cancelled
              ? "Khảo sát giải pháp cũ (đã hủy)"
              : "Bổ sung sơ đồ dữ liệu và ma trận phân quyền",
            description:
              "Nhiệm vụ bổ sung ngoài báo cáo tuần; minh họa việc giao việc và cập nhật tiến độ.",
            expectedDeliverables: "Sơ đồ ERD và bảng quyền theo vai trò.",
            completionCriteria:
              "Mô tả đủ quan hệ, ràng buộc và các trường hợp truy cập chéo.",
            priority: 2,
            periodId: periods[1].id,
            startDate: periods[1].startsAt,
            dueDate: periods[1].reportDueAt,
          },
        );
        await action(
          key + (cancelled ? "/cancel-task" : "/progress-task"),
          cancelled ? p.advisor : p.key,
          "POST",
          `/tasks/${extra.id}/${cancelled ? "cancel" : "progress"}`,
          cancelled
            ? {
                expectedRevision: extra.revision,
                reason:
                  "Đã thống nhất phương án mới; hủy khảo sát cũ và giữ lịch sử.",
              }
            : {
                expectedRevision: extra.revision,
                note: "Đã vẽ 8 thực thể và các quan hệ chính; đang bổ sung ma trận quyền và ràng buộc dữ liệu.",
              },
        );
      }
    }
    fixture.guidance[p.key] = { planId: plan.id, taskId: task.id };
    save();
    console.log(`Weekly sample ${p.code}: ready (${i - 6}/5).`);
  }
  // Deliver in-app notifications for OWNED synthetic terms only. Never invoke the
  // global worker, and never send email or process another term's outbox.
  const { reviewHash } = req(
    "./dist/topic/proposal-reviews/proposal-review.validator",
  );
  const events = await db.outboxEvent.findMany({
    where: { type: "GUIDANCE_NOTIFICATION", state: "PENDING" },
  });
  for (const event of events) {
    const p = event.payload;
    if (
      p?.termId !== termId ||
      !fixture.accounts.some((a) => a.id === p.userId)
    )
      continue;
    await db.$transaction(async (tx) => {
      const eventId = p.id || reviewHash(event.eventId).slice(0, 32);
      await tx.notification.upsert({
        where: { id: eventId },
        create: {
          id: eventId,
          userId: p.userId,
          termId: p.termId,
          title: p.title,
          body: p.body,
          link: p.link,
        },
        update: {},
      });
      await tx.outboxEvent.updateMany({
        where: { id: event.id, state: "PENDING" },
        data: { state: "DELIVERED", attempts: { increment: 1 } },
      });
    });
  }
  fixture.guidance.weeklySummary = await request(
    "giaovu",
    "GET",
    `/terms/${termId}/weekly-progress?periodId=${periods[1].id}&limit=100`,
  );
  save();
}
module.exports = { guidance };
