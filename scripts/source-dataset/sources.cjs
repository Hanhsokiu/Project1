"use strict";
const path = require("node:path");
const root = path.resolve(__dirname, "../..");
const sources = [
  { key: "grades-hd6", file: "3. Chấm điểm- HD6.xlsx", kind: "xlsx" },
  { key: "course-results", file: "Điểm HP Đồ án TN.pdf", kind: "pdf" },
  { key: "defense-roster", file: "Thứ tự bảo vệ tại các Hội đồng chấm đồ án  Cử nhân CNTT - K63 -62 Kỹ sư Khóa cũ.xlsx", kind: "xlsx" },
];
module.exports = { root, sourceDir: path.resolve(root, ".."), outputDir: path.join(root, ".cache/source-dataset"), sources };
