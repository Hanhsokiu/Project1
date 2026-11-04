"use strict";
const ExcelJS = require("exceljs");
const fs = require("node:fs");
const path = require("node:path");
const output = path.resolve(__dirname, "../../frontend/public/samples");

async function workbook(kind, columns, rows, notes) {
  const book = new ExcelJS.Workbook();
  book.creator = "Hệ thống quản lý đồ án tốt nghiệp";
  const sheet = book.addWorksheet(
    kind === "student" ? "Sinh viên" : "Giảng viên",
    {
      views: [{ state: "frozen", ySplit: 1 }],
    },
  );
  sheet.columns = columns.map(([key, width]) => ({
    header: key,
    key,
    width,
    style: { numFmt: ["gpa", "maxStudents"].includes(key) ? "0.00" : "@" },
  }));
  rows.forEach((row) => sheet.addRow(row));
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF174C60" },
    };
    cell.alignment = { vertical: "middle" };
  });
  sheet.getRow(1).height = 28;
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: rows.length + 1, column: columns.length },
  };
  const help = book.addWorksheet("Hướng dẫn");
  help.columns = [
    { key: "item", width: 30 },
    { key: "description", width: 105 },
  ];
  [
    ["DANH SÁCH MẪU", kind === "student" ? "Sinh viên" : "Giảng viên"],
    [
      "Dữ liệu",
      "Thông tin giả lập để thử chức năng import. Dữ liệu nhập nằm ở sheet đầu tiên.",
    ],
    [
      "Tên đăng nhập",
      "Bằng mã sinh viên hoặc mã giảng viên. Giữ cột mã ở định dạng văn bản để không mất số 0 đầu.",
    ],
    [
      "Mật khẩu ban đầu",
      "Bằng chính mã trong danh sách. Tài khoản mới phải đổi mật khẩu ở lần đăng nhập đầu tiên.",
    ],
    ["Tài khoản đã có", "Import không đặt lại mật khẩu của tài khoản hiện có."],
    [
      "Cách nhập",
      "Vào Import dữ liệu → chọn loại danh sách → tải file → Kiểm tra tệp → Xác nhận nhập.",
    ],
    ...notes,
  ].forEach((row) => help.addRow(row));
  help.getColumn(2).alignment = { wrapText: true, vertical: "top" };
  help.eachRow((row) => {
    row.height = row.number === 1 ? 28 : 44;
    row.getCell(1).font = { bold: true };
  });
  const filename =
    kind === "student"
      ? "danh-sach-sinh-vien.xlsx"
      : "danh-sach-giang-vien.xlsx";
  await book.xlsx.writeFile(path.join(output, filename));
  console.log(filename + ": " + rows.length + " dòng dữ liệu");
}
async function main() {
  fs.mkdirSync(output, { recursive: true });
  await workbook(
    "student",
    [
      ["studentCode", 20],
      ["fullName", 27],
      ["className", 20],
      ["majorName", 27],
      ["cohort", 12],
      ["trainingSystemCode", 22],
      ["gpa", 10],
      ["email", 30],
      ["phone", 17],
      ["academicEligible", 20],
    ],
    [
      { studentCode: "0026001001", fullName: "Nguyễn Minh An", gpa: 3.25 },
      { studentCode: "0026001002", fullName: "Trần Thu Hà", gpa: 3.6 },
      { studentCode: "0026001003", fullName: "Lê Hoàng Nam", gpa: 3.1 },
    ].map((row) => ({
      ...row,
      className: "CNTT K67",
      majorName: "Công nghệ thông tin",
      cohort: "K67",
      trainingSystemCode: "",
      email: "",
      phone: "",
      academicEligible: "true",
    })),
    [
      [
        "Đợt đích",
        "Chọn đợt Nháp hoặc Mở đăng ký, chưa khóa, đã cấu hình hệ đào tạo.",
      ],
      [
        "trainingSystemCode",
        "Để trống để lấy hệ đào tạo của đợt đang chọn; hoặc điền mã hệ đào tạo tương ứng.",
      ],
      [
        "gpa",
        "Điểm từ 0 đến 4, phải đạt ngưỡng GPA của đợt. Điều chỉnh nếu đợt có ngưỡng cao hơn dữ liệu mẫu.",
      ],
      [
        "academicEligible",
        "true: đủ điều kiện học vụ; false: không đủ điều kiện.",
      ],
      [
        "Liên hệ",
        "Email và phone có thể để trống. Người dùng bổ sung thông tin sau khi đăng nhập.",
      ],
    ],
  );
  await workbook(
    "lecturer",
    [
      ["lecturerCode", 22],
      ["fullName", 28],
      ["departmentCode", 22],
      ["researchAreas", 28],
      ["maxStudents", 17],
      ["email", 30],
      ["phone", 17],
    ],
    [
      {
        lecturerCode: "GV_MAU_26001",
        fullName: "Phạm Minh Khôi",
        maxStudents: 5,
      },
      { lecturerCode: "GV_MAU_26002", fullName: "Vũ Ngọc Lan", maxStudents: 4 },
      {
        lecturerCode: "GV_MAU_26003",
        fullName: "Đặng Quốc Huy",
        maxStudents: 6,
      },
    ].map((row) => ({
      ...row,
      departmentCode: "CNPM",
      researchAreas: "Phần mềm",
      email: "",
      phone: "",
    })),
    [
      [
        "departmentCode",
        "Mã bộ môn có trong Danh mục. Mẫu dùng CNPM (Công nghệ phần mềm).",
      ],
      [
        "researchAreas",
        "Tên hướng chuyên môn đang hoạt động. Mẫu dùng Phần mềm. Nhiều hướng phân cách bằng dấu chấm phẩy (;).",
      ],
      ["maxStudents", "Chỉ tiêu hướng dẫn là số nguyên từ 0 đến 100."],
      [
        "Đợt",
        "Import giảng viên vào danh mục chung; chưa tự thêm giảng viên vào đợt hoặc tạo phân công.",
      ],
    ],
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
