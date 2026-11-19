"use strict";
// Keep the handoff workbook useful after the owner changes their own password.
const assert=require("node:assert/strict"),path=require("node:path");
const {req,read,outputDir,safeError}=require("./context.cjs");
async function main(){const access=read("account-access-status.json");assert.equal(access.operation,"READ_ONLY");assert.equal(access.role,"FACULTY");assert.equal(access.status,"ACTIVE");assert.equal(access.initialPasswordStillMatches,false);assert.equal(access.mustChangePassword,false);
 const file=path.join(outputDir,"tai-khoan-he-thong.private.xlsx"),book=new(req("exceljs").Workbook)();await book.xlsx.readFile(file);const sheet=book.getWorksheet("Tài khoản đã xác minh");assert.ok(sheet);assert.equal(sheet.rowCount,115);let updated=0;
 sheet.eachRow((row,index)=>{if(index>1&&row.getCell(1).value==="FACULTY"&&row.getCell(3).value==="khoa.nguon80"){row.getCell(4).value="Đã đổi — dùng mật khẩu hiện tại của bạn";row.getCell(5).value="Đã đổi lần đầu";updated++;}});assert.equal(updated,1);
 const notes=book.getWorksheet("Lưu ý mật khẩu")||book.addWorksheet("Lưu ý mật khẩu");notes.columns=[{header:"Thông tin",width:110}];notes.spliceRows(2,Math.max(0,notes.rowCount-1));notes.addRows([["Mật khẩu trong bảng là mật khẩu khởi tạo, không phải mật khẩu hiện tại nếu chủ tài khoản đã đổi."],["Khoa khoa.nguon80 đã đổi mật khẩu; không reset trong quá trình hoàn thiện dữ liệu."],["Trạng thái Khoa được đối chiếu chỉ đọc lúc "+access.verifiedAt],["Sinh viên ban đầu dùng mã sinh viên; bắt buộc đổi lần đầu. Sau khi đổi dùng mật khẩu mới của bạn."],["Các hàng khác giữ nội dung bàn giao ngày 18/11; không coi đó là lần kiểm tra lại mật khẩu hiện tại."]]);
 await book.xlsx.writeFile(file);console.log("Updated faculty password note in the 114-account workbook; no database or password changes.");
}
if(require.main===module)main().catch(safeError);
