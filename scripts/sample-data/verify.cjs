"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  assert = require("node:assert/strict");
const {
  id,
  namespace,
  terms,
  students,
  lecturers,
} = require("./definition.cjs");
async function verify(db, fixture, root, cache) {
  const {
    validatePhasePlan,
  } = require("../../backend/dist/term/validator/term-configuration.validator");
  const report = {
    namespace,
    checkedAt: new Date().toISOString(),
    complete: !!fixture.complete,
    terms: [],
  };
  const accounts = await db.userAccount.findMany({
    where: { id: { in: fixture.accounts.map((a) => a.id) } },
    select: { id: true, username: true },
  });
  assert.equal(accounts.length, 17, "Sample account missing");
  for (const t of terms) {
    const termId = id("term/" + t.key);
    const term = await db.thesisTerm.findUniqueOrThrow({
      where: { id: termId },
      include: { phases: true },
    });
    assert.equal(term.code, t.code);
    assert.equal(
      term.semesterId,
      fixture.semesterId,
      "Sample term must use the shared semester catalogue",
    );
    validatePhasePlan(
      term.phases.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.phaseName,
        start: p.startDate.toISOString(),
        end: p.endDate.toISOString(),
        locked: p.isLocked,
      })),
      term.startDate,
      term.endDate,
    );
    const memberCount = await db.termStudent.count({ where: { termId } });
    assert.equal(memberCount, 12);
    assert.equal(await db.termLecturer.count({ where: { termId } }), 4);
    const proposals = await db.proposal.findMany({
      where: { termId },
      include: { pr2bProposalWorkflowProposalId: true },
    });
    const statuses = {};
    for (const p of proposals)
      statuses[p.status] = (statuses[p.status] || 0) + 1;
    if (!fixture.initialVerifiedAt && t.key === "proposal")
      assert.deepEqual(
        statuses,
        {
          DRAFT: 2,
          SUBMITTED: 4,
          UNDER_REVIEW: 2,
          REVISION_REQUESTED: 2,
          APPROVED: 2,
        },
        "Proposal samples must cover each intended lifecycle state",
      );
    if (t.key !== "registration") {
      assert.equal(proposals.length, 12);
      const official = await db.termWorkflow.findUniqueOrThrow({
        where: { termId },
      });
      assert.equal(
        official.officialAssignmentPlanId,
        id(t.key + "/assignment"),
      );
      assert.equal(
        (
          await db.assignmentPlan.findUniqueOrThrow({
            where: { id: official.officialAssignmentPlanId },
          })
        ).status,
        "FINALIZED",
      );
      assert.equal(
        await db.advisorAssignment.count({
          where: { assignmentPlanId: official.officialAssignmentPlanId },
        }),
        12,
      );
      for (const p of proposals)
        assert(p.pr2bProposalWorkflowProposalId, "Missing proposal workflow");
    }
    report.terms.push({
      code: t.code,
      name: t.name,
      status: term.status,
      students: memberCount,
      proposals: proposals.length,
      proposalStatuses: statuses,
    });
  }
  const termId = id("term/guidance");
  const periods = await db.guidancePeriod.findMany({
    where: { termId },
    orderBy: { ordinal: "asc" },
  });
  assert.equal(periods.length, 4);
  for (const p of periods) {
    const count = await db.weeklyReportObligation.count({
      where: { periodId: p.id },
    });
    assert.equal(
      count,
      p.state === "DRAFT" ? 0 : 12,
      "Incorrect weekly coverage",
    );
  }
  const proposalIds = (
    await db.proposal.findMany({ where: { termId }, select: { id: true } })
  ).map((p) => p.id);
  const plans = await db.guidancePlan.findMany({
    where: { proposalId: { in: proposalIds } },
  });
  assert(plans.length >= 5);
  const tasks = await db.task.findMany({
    where: { guidancePlanId: { in: plans.map((p) => p.id) } },
  });
  const submissions = await db.taskSubmission.findMany({
    where: { taskId: { in: tasks.map((t) => t.id) } },
  });
  const reviews = await db.progressReview.findMany({
    where: { submissionId: { in: submissions.map((s) => s.id) } },
  });
  const assets = await db.submissionAsset.findMany({
    where: { submissionId: { in: submissions.map((s) => s.id) } },
    include: { refFileId: true },
  });
  const storageLine = fs
    .readFileSync(path.join(root, "backend/.env"), "utf8")
    .split(/\r?\n/)
    .find((l) => /^STORAGE_LOCAL_PATH=/.test(l));
  const storagePath =
    process.env.STORAGE_LOCAL_PATH ||
    storageLine
      ?.slice("STORAGE_LOCAL_PATH=".length)
      .replace(/^(["'])(.*)\1$/, "$2") ||
    "./uploads";
  for (const { refFileId: file } of assets) {
    assert(/^guidance\/[0-9a-f-]{36}$/.test(file.storageKey));
    const bytes = fs.readFileSync(
      path.resolve(
        root,
        "backend",
        storagePath,
        ".private-guidance",
        file.storageKey.slice("guidance/".length),
      ),
    );
    assert.equal(
      bytes.length,
      file.sizeBytes,
      "Sample attachment size mismatch",
    );
    assert.equal(
      crypto.createHash("sha256").update(bytes).digest("hex"),
      file.checksum,
      "Sample attachment checksum mismatch",
    );
    if (file.mimeType === "application/pdf")
      assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
  }
  assert(
    assets.length >= submissions.length * 2,
    "Every report must have PDF and ZIP assets",
  );
  assert(submissions.length >= 7, "Missing report version history");
  if (!fixture.initialVerifiedAt) {
    assert.equal(plans.length, 5);
    assert.equal(submissions.length, 7);
    assert.equal(assets.length, 14);
    assert.equal(reviews.length, 6);
    assert.deepEqual(
      fixture.guidance.weeklySummary.metrics,
      {
        NOT_SUBMITTED: 8,
        PENDING: 1,
        PASS: 1,
        FAIL: 1,
        REVISION_REQUIRED: 1,
        LATE: 0,
      },
      "Real weekly API must count draft, pending and reviewed reports correctly",
    );
  }
  for (const decision of ["PASS", "FAIL", "REVISION_REQUIRED"])
    assert(
      reviews.some((r) => r.decision === decision),
      "Missing review decision " + decision,
    );
  report.guidance = {
    verifiedFiles: assets.length,
    plans: plans.length,
    weeks: periods.map((p) => ({ ordinal: p.ordinal, state: p.state })),
    obligations: await db.weeklyReportObligation.count({
      where: { periodId: { in: periods.map((p) => p.id) } },
    }),
    tasks: tasks.length,
    submissions: submissions.length,
    reviews: reviews.length,
    meetings: await db.guidanceMeeting.count({
      where: { guidancePlanId: { in: plans.map((p) => p.id) } },
    }),
  };
  const guide = [
    "# Bộ dữ liệu mẫu bước 1–8",
    "",
    `Tạo lúc: ${fixture.createdAt}. Chỉ dùng dữ liệu giả lập.`,
    "",
    "## Đăng nhập",
    "",
    "Mở frontend đang chạy và đăng xuất tài khoản cũ trước khi đổi vai trò.",
    "",
    `Mật khẩu chung của 17 tài khoản mẫu: **${fixture.password}**`,
    "",
    "Tệp này nằm trong .cache được Git bỏ qua. Không đưa mật khẩu lên Git hoặc nơi công khai.",
    "",
    "| Tài khoản | Vai trò / họ tên | GVHD |",
    "|---|---|---|",
    "| mau18_giaovu | Giáo vụ, có quyền riêng trong cả ba đợt mẫu | — |",
    ...lecturers.map((p) => `| mau18_${p.key} | Giảng viên · ${p.name} | — |`),
    ...students.map(
      (p) => `| mau18_${p.key} | Sinh viên · ${p.name} | mau18_${p.advisor} |`,
    ),
    "",
    "## Chọn đúng đợt ở góc trên bên phải",
    "",
    ...terms.map((t) => `- **${t.code}** — ${t.name}`),
    "",
    "Các liên kết dưới đây dùng frontend mặc định tại http://127.0.0.1:5173. Nếu bạn mở ở cổng khác, giữ nguyên đường dẫn sau tên miền.",
    "",
    `- [Đăng ký / danh sách đăng ký](http://127.0.0.1:5173/registration/list?termId=${id("term/registration")})`,
    `- [Đề cương và xét duyệt](http://127.0.0.1:5173/topic/reviews?termId=${id("term/proposal")})`,
    `- [Bước 8: kế hoạch và báo cáo tuần](http://127.0.0.1:5173/guidance/weeks?termId=${id("term/guidance")})`,
    "",
    "## Kiểm tra bước 1–8",
    "",
    "1. Danh mục & kế hoạch: chọn hệ [MẪU 1–8] Chính quy; xem 4 giảng viên, 12 sinh viên và ba đợt; mỗi GV được phân bổ 3 sinh viên.",
    "2. Đăng ký: chọn MAU18-01-DANGKY. SV01–04 chưa đăng ký; SV05–08 có bản nháp; SV09–12 đã nộp. Có thể đăng nhập SV01 để thử nộp mới.",
    "3. Phân công / thống nhất đề tài: chọn MAU18-02-DECUONG hoặc MAU18-03-BAOCAO; cả hai có quyết định chính thức, 12 đề tài đã được GVHD đồng ý.",
    "4. Nhóm xét duyệt: mỗi đợt có 2 nhóm, mỗi nhóm 2 GV. GVHD không tự xét đề cương sinh viên của mình. GV01/GV02 xét SV có GVHD là GV03/GV04, và ngược lại.",
    "5. Xét duyệt: chọn MAU18-02-DECUONG. SV01–02 bản nháp; SV03–04 đã nộp chờ phân nhóm; SV05–06 đã giao nhóm; SV07–08 đang xét; SV09–10 cần sửa; SV11 được duyệt, SV12 đã chốt hồ sơ. Có nhận xét và quyết định để xem hoặc tiếp tục xử lý.",
    "6. Phiên bản đề cương: mở Đề cương của từng SV để xem nội dung, lịch thực hiện và lịch sử phiên bản. SV01/SV02 có thể lưu rồi nộp; SV09/SV10 có thể phản hồi nhận xét và tạo bản sửa.",
    "7. Chốt/tiếp nhận hồ sơ: chọn MAU18-02-DECUONG. SV11 đã duyệt, có thể thử chốt mới; SV12 đã chốt, có thể thử tiếp nhận ngay trong giai đoạn xét duyệt đang mở. MAU18-03-BAOCAO có 12 hồ sơ đã chốt, SV08–12 đã tiếp nhận; giai đoạn xét duyệt của đợt này đã kết thúc nên các hồ sơ còn lại chỉ xem trạng thái.",
    "8. Hướng dẫn và báo cáo: chọn MAU18-03-BAOCAO; SV08–12 có kế hoạch, nhiệm vụ và biên bản gặp. Tuần 1 đã quá hạn, cho nộp muộn; Tuần 2 đang mở; Tuần 3 đã khóa; Tuần 4 còn nháp. Mỗi tuần công bố có nghĩa vụ cho đủ 12 SV, kể cả SV chưa có kế hoạch.",
    "",
    "### Các tài khoản nên mở ngay để xem bước 8",
    "",
    "| Tài khoản | Tuần 2 | Tuần 1 |",
    "|---|---|---|",
    "| mau18_sv08 | Có bản nháp, chưa nộp | Nhiệm vụ quá hạn chưa nộp |",
    "| mau18_sv09 | Đã nộp, chờ GV đánh giá | Chưa nộp |",
    "| mau18_sv10 | Cần sửa, có hạn nộp lại | Chưa nộp |",
    "| mau18_sv11 | Đạt | Đã nộp muộn v1 → cần sửa → v2 đạt |",
    "| mau18_sv12 | Không đạt | Nộp muộn, không đạt |",
    "",
    "Giáo vụ xem trang Kế hoạch và báo cáo tuần; chọn Tuần 2 để thấy 5 nhóm trạng thái. GVHD tương ứng xem bài nộp, PDF/ZIP và nhận xét. Bản nháp chỉ hiện với chính sinh viên.",
    "",
    "## Lưu ý sử dụng",
    "",
    "- Các tài khoản Giáo vụ đang hoạt động lúc tạo mẫu cũng được cấp quyền xem riêng ba đợt mẫu; thông tin đăng nhập cũ giữ nguyên.",
    "- Ngày mẫu được tính theo lúc tạo. Nếu mở sau hạn, chức năng sẽ áp dụng lịch/hạn như dữ liệu thật. Không tự sửa ngày hoặc đặt lại trạng thái khi chạy lại script.",
    "- Tệp báo cáo nằm trong backend/uploads của máy này. Khi chuyển hosting cần chuyển tệp cùng dữ liệu hoặc cấu hình lưu trữ bền vững.",
    "- Nguồn chung là API/backend và PostgreSQL đang cấu hình trong backend/.env; không cần nhập thêm dữ liệu vào localStorage.",
    "- Script tạo lại không reset các thao tác bạn đã thử. Bộ mẫu dùng cùng 12 sinh viên qua ba đợt để kiểm tra việc đổi phạm vi, không đại diện lịch sử học vụ thật.",
    "",
    "Kiểm tra lại: `pnpm sample:verify`. Tệp chi tiết: `verification.json` cùng thư mục.",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(cache, "HUONG-DAN.md"), guide, { mode: 0o600 });
  fs.writeFileSync(
    path.join(cache, "verification.json"),
    JSON.stringify(report, null, 2),
  );
  fixture.initialVerifiedAt ||= report.checkedAt;
  console.log(
    JSON.stringify(
      {
        ...report,
        guide: path.relative(root, path.join(cache, "HUONG-DAN.md")),
      },
      null,
      2,
    ),
  );
  return report;
}
module.exports = { verify };
