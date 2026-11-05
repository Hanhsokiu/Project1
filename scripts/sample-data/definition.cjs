"use strict";
const crypto = require("node:crypto");
const namespace = "MAU18-V1";
const day = 86400000;
function id(key) {
  const h = crypto
    .createHash("sha256")
    .update(namespace + "/" + key)
    .digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
const students = [
  "Nguyễn Minh Anh",
  "Trần Hoàng Bảo",
  "Lê Ngọc Châu",
  "Phạm Tiến Dũng",
  "Hoàng Thu Giang",
  "Vũ Quang Huy",
  "Đặng Khánh Linh",
  "Bùi Đức Long",
  "Đỗ Phương Mai",
  "Ngô Tuấn Nam",
  "Dương Hải Phong",
  "Lý Thanh Tâm",
].map((name, i) => ({
  key: `sv${String(i + 1).padStart(2, "0")}`,
  name,
  code: `MAU18-SV${String(i + 1).padStart(2, "0")}`,
  advisor: `gv${String((i % 4) + 1).padStart(2, "0")}`,
}));
const lecturers = [
  "Nguyễn Hoài An",
  "Trần Minh Đức",
  "Lê Thu Hà",
  "Phạm Quang Vinh",
].map((name, i) => ({ key: `gv0${i + 1}`, name, code: `MAU18-GV0${i + 1}` }));
const terms = [
  {
    key: "registration",
    code: "MAU18-01-DANGKY",
    name: "[MẪU 1–8] 01 · Đăng ký nguyện vọng",
    stage: "REGISTRATION",
  },
  {
    key: "proposal",
    code: "MAU18-02-DECUONG",
    name: "[MẪU 1–8] 02 · Đề cương và xét duyệt",
    stage: "PROPOSAL",
  },
  {
    key: "guidance",
    code: "MAU18-03-BAOCAO",
    name: "[MẪU 1–8] 03 · Hướng dẫn và báo cáo tuần",
    stage: "WEEKLY",
  },
];
const topics = [
  "Quản lý thư viện và mượn trả sách",
  "Đặt lịch khám bệnh trực tuyến",
  "Quản lý bán hàng và kho",
  "Theo dõi tiến độ đồ án tốt nghiệp",
  "Quản lý ký túc xá sinh viên",
  "Đặt vé xe khách trực tuyến",
  "Quản lý câu lạc bộ sinh viên",
  "Cổng học tập và bài tập trực tuyến",
  "Quản lý tuyển dụng và hồ sơ ứng viên",
  "Tra cứu và đặt phòng khách sạn",
  "Quản lý chi tiêu cá nhân",
  "Giám sát thiết bị trong phòng thực hành",
];
// All base phases are sequential. Only the optional review phase overlaps proposal,
// as explicitly allowed by the application's canonical phase validator.
function phases(anchor, stage) {
  const ranges = {
    REGISTRATION: [
      [-60, 14],
      [14, 21],
      [21, 42],
      [42, 105],
      [105, 119],
      [119, 130],
    ],
    ASSIGNMENT: [
      [-60, -2],
      [-2, 14],
      [14, 35],
      [35, 105],
      [105, 119],
      [119, 130],
    ],
    PROPOSAL: [
      [-60, -35],
      [-35, -21],
      [-21, 28],
      [28, 105],
      [105, 119],
      [119, 130],
    ],
    WEEKLY: [
      [-60, -49],
      [-49, -42],
      [-42, -21],
      [-21, 105],
      [105, 119],
      [119, 130],
    ],
  }[stage];
  const labels = [
    "Đăng ký nguyện vọng",
    "Phân công giảng viên",
    "Đề tài và đề cương",
    "Hướng dẫn và báo cáo tuần",
    "Nộp đồ án cuối kỳ",
    "Tổ chức bảo vệ",
  ];
  const codes = [
    "REGISTRATION",
    "ASSIGNMENT",
    "PROPOSAL",
    "WEEKLY",
    "FINAL",
    "DEFENSE",
  ];
  const result = codes.map((code, i) => ({
    code,
    name: labels[i],
    start: new Date(anchor + ranges[i][0] * day).toISOString(),
    end: new Date(anchor + ranges[i][1] * day).toISOString(),
    locked: false,
  }));
  result.push({
    ...result[2],
    code: "PROPOSAL_REVIEW",
    name: "Xét duyệt đề cương",
  });
  return result;
}
function week(anchor, ordinal) {
  const local = new Date(anchor + 7 * 3600000);
  const monday =
    Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate() - ((local.getUTCDay() + 6) % 7),
    ) -
    7 * 3600000;
  const startsAt = monday + (ordinal - 2) * 7 * day;
  return {
    ordinal,
    startsAt: new Date(startsAt).toISOString(),
    endsAt: new Date(startsAt + 7 * day).toISOString(),
    reportDueAt: new Date(startsAt + 7 * day - 60000).toISOString(),
  };
}
module.exports = {
  namespace,
  id,
  day,
  students,
  lecturers,
  terms,
  topics,
  phases,
  week,
};
