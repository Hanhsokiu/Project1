"use strict";
const fs=require("node:fs"),path=require("node:path"),{crc32}=require("node:zlib");
const {req,root,outputDir}=require("./context.cjs");
function sourceZip(code){
  const name=Buffer.from("src/README.txt"),bytes=Buffer.from(`SYNTHETIC WORKFLOW MATERIAL\nStudent reference: ${code}\nThis archive is generated to verify upload, versioning and download UI.\nIt is not a claim of a student's actual implementation.\n`),crc=crc32(bytes);
  const local=Buffer.alloc(30),central=Buffer.alloc(46),end=Buffer.alloc(22);
  local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt32LE(crc,14);local.writeUInt32LE(bytes.length,18);local.writeUInt32LE(bytes.length,22);local.writeUInt16LE(name.length,26);
  central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,6);central.writeUInt32LE(crc,16);central.writeUInt32LE(bytes.length,20);central.writeUInt32LE(bytes.length,24);central.writeUInt16LE(name.length,28);
  end.writeUInt32LE(0x06054b50);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);end.writeUInt32LE(central.length+name.length,12);end.writeUInt32LE(local.length+name.length+bytes.length,16);
  return Buffer.concat([local,name,bytes,central,name,end]);
}
async function reportPdf(code,round=1){
  const dir=path.join(outputDir,"workflow-assets");fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,`${code}-report-${round}.pdf`);
  if(fs.existsSync(file))return fs.readFileSync(file);
  const title=round==="final"?"BÁO CÁO ĐỒ ÁN CUỐI — NỘI DUNG TỔNG HỢP":"BÁO CÁO TIẾN ĐỘ TỔNG HỢP";
  const Doc=req("pdfkit"),doc=new Doc({size:"A4",margin:50,info:{Title:title,Author:"Bộ dữ liệu nguồn 80"}}),parts=[];
  const done=new Promise((resolve,reject)=>{doc.on("data",b=>parts.push(b));doc.on("end",()=>resolve(Buffer.concat(parts)));doc.on("error",reject);});
  doc.font(path.join(root,"backend/assets/fonts/NotoSerif-Regular.ttf")).fontSize(16).text(title).moveDown().fontSize(11);
  doc.text(`Mã hồ sơ sinh viên: ${code}\nLần nộp: ${round}\nNguồn nội dung: sinh tự động theo yêu cầu để kiểm tra giao diện.`).moveDown();
  for(const [title,body] of [["Công việc được giao","Phân tích yêu cầu, xây dựng mô hình dữ liệu và thiết kế luồng nghiệp vụ của đề tài."],["Kết quả minh họa","Đã mô tả các luồng chính, tình huống lỗi và tiêu chí kiểm chứng sản phẩm."],["Khó khăn và hướng xử lý","Cần bổ sung minh chứng kiểm thử và đánh giá tính đầy đủ của yêu cầu."],["Kế hoạch tiếp theo","Hoàn thiện chức năng, kiểm thử tích hợp và tổng hợp tài liệu."],["Giới hạn sử dụng","File được tạo để kiểm tra chức năng nộp, tải và lưu phiên bản. Không chứng nhận công việc hoặc kết quả học tập thật."]])doc.text(title).text(body).moveDown();
  doc.end();const bytes=await done;fs.writeFileSync(file,bytes);return bytes;
}
module.exports={sourceZip,reportPdf};
