"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { context } = require("../demo-v3.cjs"),
  d = require("./definition.cjs");
async function main() {
  assert(process.argv.includes("--target=local-test"));
  const c = await context(),
    dir = path.join(c.local.root, "docs/demo-data-v3");
  const write = (file, text) =>
    fs.writeFileSync(path.join(dir, file), text + "\n");
  try {
    const models = c.local.req("@prisma/client").Prisma.dmmf.datamodel.models;
    const map = models.map((m) => ({
      model: m.name,
      table: m.dbName || m.name,
      primaryKey:
        m.primaryKey?.fields ||
        m.fields.filter((f) => f.isId).map((f) => f.name),
      unique: [
        ...m.fields.filter((f) => f.isUnique).map((f) => [f.name]),
        ...m.uniqueFields,
      ],
      relations: m.fields
        .filter((f) => f.kind === "object" && f.relationFromFields?.length)
        .map((f) => ({
          field: f.name,
          target: f.type,
          from: f.relationFromFields,
          to: f.relationToFields,
        })),
      states: m.fields
        .filter(
          (f) => f.name === "state" || f.name === "status" || f.kind === "enum",
        )
        .map((f) => ({ field: f.name, type: f.type })),
    }));
    c.save("schema-map.json", {
      models: map,
      enums: c.local.req("@prisma/client").Prisma.dmmf.datamodel.enums,
    });
    write(
      "model-map.md",
      `# Mapping implementation hiện tại\n\nCó **${models.length} Prisma models**, khác số 99 trong blueprint cũ. Danh sách đầy đủ FK/PK/unique/enum tại [schema-map.json](evidence/schema-map.json); CHECK/trigger nằm trong 27 migration hiện hành, không được thay đổi bởi seed.\n\nThứ tự seed: danh mục/quyền → học kỳ/đợt/mốc/grant → roster/quota → đăng ký/nguyện vọng → plan/phân công chính thức → topic/đồng thuận → nhóm duyệt/membership → proposal/version/review/decision/comment → finalization/dossier/PDF/receipt/history → plan/period/required-student/obligation → task/submission/upload/asset/review/history → họp/đánh giá → policy TEST/rubric/room → producer UC17–20 → UC21 (BLOCKED) → UC22–25 (chưa thực thi ghi).\n\nBảng workflow bổ sung revision, binding và lịch sử; không suy luận trạng thái chỉ từ bảng legacy. SubmissionFile/TaskReview có 0 bản ghi vì consumer hiện tại đọc SubmissionAsset/ProgressReview. CommitteeStudent có 0 vì chưa có lịch UC21, không thay thế DefenseCommitteeAssignment đã tạo ở UC19.\n\n| Model | Bảng PostgreSQL | PK | Unique ngoài PK | FK trực tiếp | Trường trạng thái |\n|---|---|---|---|---|---|\n` +
        map
          .map(
            (m) =>
              `| ${m.model} | ${m.table} | ${m.primaryKey.join(", ")} | ${m.unique.map((u) => u.join(" + ")).join("; ")} | ${m.relations.map((r) => r.from.join("+") + " → " + r.target).join("; ")} | ${m.states.map((s) => s.field + ":" + s.type).join(", ")} |`,
          )
          .join("\n"),
    );
    const before = JSON.parse(
        fs.readFileSync(path.join(dir, "evidence/counts-before.json"), "utf8"),
      ),
      after = await c.counts(c.db);
    c.save("counts-after.json", after);
    write(
      "seed-diff.md",
      `# Chênh lệch dữ liệu TEST\n\nĐích hiện tại: \`${c.local.database}\`, 127.0.0.1:55463. Thống kê lúc ${new Date().toISOString()}. Before là snapshot khởi tạo TEST (chỉ role bootstrap), không phải DB dùng chung. Số phiên đăng nhập/audit tăng khi kiểm thử.\n\n**PARTIAL**: không diễn giải số hàng là chứng minh producer đã chạy. UC01–16 gồm lịch sử fixture tổng hợp có binding; UC17–20 được tạo qua service/API thật.\n\n| Model | Before | After | Tăng |\n|---|---:|---:|---:|\n` +
        models
          .map(
            (m) =>
              `| ${m.name} | ${before[m.name] || 0} | ${after[m.name]} | ${after[m.name] - (before[m.name] || 0)} |`,
          )
          .join("\n"),
    );
    const users = await c.db.userAccount.findMany({
      select: {
        id: true,
        username: true,
        displayName: true,
        userRoles: { select: { role: { select: { name: true } } } },
      },
      orderBy: { username: "asc" },
    });
    write(
      "demo-users.example.md",
      `# Người dùng tổng hợp TEST\n\nKhông chứa mật khẩu/hash/token. Mật khẩu được tạo ngẫu nhiên cục bộ trong trường \`accountPassword\` của \`.cache/demo-v3/private-v3.json\`; mở tại máy để đăng nhập, không đưa file này vào báo cáo/commit. Đây là cơ chế thuận tiện cho TEST loopback, không phải cơ chế triển khai production.\n\nChọn \`demo3_sv074\` để xem cùng một người ở hai đợt; \`demo3_sv079\`/\`demo3_gv06\` xem yêu cầu sửa tuần 5; \`demo3_sv082\` và \`demo3_sv083\` quá hạn chưa nộp; \`demo3_sv084\` chờ review; \`demo3_giaovu1\` xem tiến độ toàn đợt.\n\n| Username | Vai trò được gán thật | User ID |\n|---|---|---|\n` +
        users
          .map(
            (u) =>
              `| ${u.username} | ${u.userRoles
                .map((r) => r.role.name)
                .sort()
                .join(", ")} | ${u.id} |`,
          )
          .join("\n"),
    );
    const smoke = JSON.parse(
      fs.readFileSync(path.join(dir, "evidence/api-smoke.json"), "utf8"),
    );
    const titles = [
      "Đăng nhập",
      "Tài khoản/RBAC",
      "Audit",
      "Sinh viên/import",
      "Giảng viên/quota",
      "Hướng nghiên cứu",
      "Đợt",
      "Mốc kế hoạch",
      "Nguyện vọng",
      "Phân công",
      "Đề tài",
      "Phiên bản đề cương",
      "Duyệt/hồ sơ/PDF",
      "Kế hoạch/nhiệm vụ",
      "Báo cáo/source",
      "Nhận xét tiến độ",
      "Xác nhận GVHD",
      "Điều kiện bảo vệ",
      "Hội đồng",
      "Phản biện",
      "Lịch bảo vệ",
      "Điểm phản biện",
      "Điểm hội đồng",
      "Tổng hợp/công bố",
      "Xuất báo cáo",
    ];
    const limits = [
      "Chưa test đổi mật khẩu/khóa tạm thời.",
      "Chưa test thay role hoặc khóa admin cuối.",
      "Đã đọc audit, chưa kiểm tra export audit.",
      "Chưa thực hiện import/duplicate rollback.",
      "Quota có assertion; chưa chạy cập nhật giảng viên.",
      "Danh mục 5 hướng; chưa mutate workflow hướng.",
      "Tạo term là fixture; chưa thử đầy đủ lifecycle.",
      "Có 14 mốc; chưa chạy cập nhật/khóa mốc.",
      "Đã chặn nộp khi hết hạn và assert DB bất biến; profile mở đăng ký chưa có.",
      "Phân công là fixture; chưa chạy producer thuật toán/revision.",
      "Đồng thuận là fixture; chưa thao tác sửa/thu hồi.",
      "Chuỗi 133 versions là fixture; chưa thực hiện submit qua browser.",
      "Tải PDF thật PASS; chưa test mở lại/chốt lại dossier qua API.",
      "Plan/task có FK/history; chưa giao mới qua browser.",
      "Download checksum/IDOR PASS; upload/resubmit browser chưa chạy.",
      "Đúng GVHD có assertion; thiếu fixture FAIL và sửa nhận xét qua API.",
      "60 report/summary/confirm qua producer thật; case reject chưa chạy.",
      "60 ELIGIBLE/finalize qua producer; 16 đề nghị hoãn còn PENDING.",
      "3×4 hội đồng/60 assignments chốt thật; xung đột GVHD có assertion.",
      "60 reviewer assignments chốt thật, khác GVHD; negative mutation chưa chạy.",
      "GET workspace PASS, GET proposal HTTP500/P2028; chưa lưu/chốt/công bố lịch.",
      "GET options PASS; chưa nhập/chốt điểm vì UC21 bị chặn.",
      "GET options PASS; chưa nhập rubric vì UC21 bị chặn.",
      "GET own result PASS nhưng chưa có kết quả; chưa khóa/công bố, precision BLOCKED.",
      "Lượt smoke mới nhất: statistics HTTP500; service riêng P2028 sau 60 giây. ExportJob/biên bản/Excel/PDF kết quả chưa có.",
    ];
    let coverage = `# Bao phủ UC01–UC25\n\n**Không phải 25/25 nghiệm thu E2E.** Lượt smoke mới nhất: ${smoke.checks.filter((t) => t.result === "PASS").length}/${smoke.checks.length} PASS; các ca còn lại ghi FAIL ở bảng. Phạm vi gồm đọc API, 401/403/404, nộp khi đóng và tải bytes. Test IDs/actor nằm trong [smoke.cjs](../../scripts/demo-v3/smoke.cjs); đầu vào negative submit được giữ trong script, không chứa secret. Positive/negative cho mỗi UC dưới đây chỉ xác nhận endpoint và phạm vi của assertion đã chạy.\n\nTiền điều kiện: PostgreSQL TEST baseline V3, API thật với auth/RBAC thật; faculty có grant hai đợt; sinh viên chủ hồ sơ current là SV074, outsider là SV001, GVHD tương ứng GV01. UC17–25 đọc đợt cũ; UC24 đọc bằng chính sinh viên. Negative mặc định là unauthenticated, trừ quyền khác/ownership và đăng ký hết hạn ghi trong script.\n\n| UC / tên | Test ID / request thực tế / status | Mutation/data workflow còn lại |\n|---|---|---|\n`;
    for (let i = 1; i <= 25; i++) {
      const uc = "UC" + String(i).padStart(2, "0");
      coverage +=
        `| ${uc} · ${titles[i - 1]} | ` +
        smoke.checks
          .filter((t) => t.uc === uc)
          .map(
            (t) =>
              `${t.testId}: ${t.method} \`${t.route}\` → ${t.status ?? t.error ?? "NOT_CAPTURED"} **${t.result}**`,
          )
          .join("<br>") +
        ` | ${limits[i - 1]} |\n`;
    }
    coverage +=
      "\nDB after action: negative UC09 assert toàn bộ registration không đổi; tải file không mutate hồ sơ. Các negative unauth/role/ownership được API từ chối, chưa có assertion DB từng bảng cho tất cả negative cases. Auth/session/audit có ghi thật khi login. Các ca 0/5/10, thiếu 1/6 điểm, cross-term đầy đủ, lịch trùng phòng/GV, sửa sau khóa cần scenario DB độc lập; chưa chạy nên NOT_TESTED.\n\nUnit/HTTP fixture test backend và unit frontend được báo riêng trong evidence; không thay cho các ca trên PostgreSQL. Xem [blockers](blocked-gaps.md), [browser evidence](evidence/README.md).";
    write("uc01-uc25-coverage.md", coverage);
    console.log(
      JSON.stringify({
        status: "DOCUMENTED",
        models: models.length,
        users: users.length,
        ucs: 25,
      }),
    );
  } finally {
    await c.db.$disconnect();
  }
}
main().catch((e) => {
  console.error(e.code || e.message);
  process.exitCode = 1;
});
