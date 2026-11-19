"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { root, sourceDir, outputDir, sources } = require("./sources.cjs");
const Excel = require(path.join(root, "backend/node_modules/exceljs"));
const pdf = require(path.join(root, "backend/node_modules/pdf-parse/lib/pdf-parse.js"));

const clean = value => String(value ?? "").normalize("NFC").replace(/\s+/gu, " ").trim();
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const codePattern = /^[A-Z]?\d{8,12}$/;
const isResearchArea = value => Boolean(clean(value)) && !/^(?:PGS|GS|TS|ThS|Th\.S|KS)[.\s]/u.test(clean(value));
function cellValue(cell) {
  const v = cell.value;
  if (v instanceof Date) return v.toISOString();
  if (v && typeof v === "object") return v.result ?? v.text ?? v.richText?.map(t => t.text).join("") ?? null;
  return v ?? null;
}
function lecturerIdentity(raw) {
  const alias = clean(raw);
  // Only remove explicit degree/rank prefixes; never accent-fold or fuzzy-merge names.
  const name = clean(alias.replace(/^(?:(?:PGS|GS|TS|ThS|Th\.S|Ths|KS)\s*\.?\s*)+/u, ""));
  return { name, key: name.toLocaleLowerCase("vi"), alias,
    academicDegree: /(?:^|\.)\s*TS\b/u.test(alias) ? "DOCTOR" : /^Th\.?S\b/iu.test(alias) ? "MASTER" : null,
    academicRank: /^PGS\b/u.test(alias) ? "ASSOCIATE_PROFESSOR" : /^GS\b/u.test(alias) ? "PROFESSOR" : "NONE" };
}
function groupPdfLines(items) {
  const lines = [];
  for (const item of items.filter(i => clean(i.str))) {
    const y = item.transform[5];
    let line = lines.find(l => Math.abs(l.y - y) < 2);
    if (!line) lines.push(line = { y, items: [] });
    line.items.push({ x: item.transform[4], text: item.str });
  }
  return lines.sort((a,b) => b.y-a.y).map(l => ({...l, items:l.items.sort((a,b)=>a.x-b.x)}));
}
function parsePdfLine(line, source) {
  const text = clean(line.items.map(i=>i.text).join(" "));
  if (!/^\d{1,3}\s/u.test(text)) return null;
  const match = /^(\d{1,3})\s+(?:(.+?)\s+)?([A-Z]?\d{8,12})\s+(.+)$/u.exec(text);
  if (!match) return { issue: "PDF_ROW_WITHOUT_VALID_CODE", source, raw: text };
  const tail = match[4];
  const scores = /\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)\s*$/u.exec(tail);
  if (!scores) return { issue: "PDF_ROW_COLUMNS_UNRESOLVED", source, raw:text };
  const fullName = clean(tail.slice(0, scores.index));
  if (!/^[\p{L}\p{M} .'-]+$/u.test(fullName)) return {issue:"PDF_NAME_UNRESOLVED",source,raw:text};
  return { studentCode: match[3], fullName, className:clean(match[2]), source,
    sourceScores: { process:Number(scores[1].replace(",",".")), defense:Number(scores[2].replace(",",".")), final:Number(scores[3].replace(",",".")) } };
}
function combine(records, lecturerObservations, issues, limit) {
  const students = new Map(), lecturers = new Map();
  for (const obs of lecturerObservations) {
    const identity = lecturerIdentity(obs.raw);
    if (!identity.name || identity.name.split(" ").length < 2) {
      issues.push({issue:"LECTURER_NAME_UNRESOLVED",...obs}); continue;
    }
    let lecturer = lecturers.get(identity.key);
    if (!lecturer) lecturers.set(identity.key, lecturer={key:identity.key,fullName:identity.name,aliases:[],sources:[],degrees:[],ranks:[],observedAreas:[]});
    for (const [field,value] of [["aliases",identity.alias],["degrees",identity.academicDegree],["ranks",identity.academicRank],["observedAreas",isResearchArea(obs.area)?obs.area:null]]) {
      if (value && !lecturer[field].includes(value)) lecturer[field].push(value);
    }
    lecturer.sources.push(obs.source);
  }
  for (const record of records) {
    if (!codePattern.test(record.studentCode) || !record.fullName) { issues.push({issue:"INVALID_STUDENT_IDENTITY",record}); continue; }
    let student = students.get(record.studentCode);
    if (!student) students.set(record.studentCode, student={studentCode:record.studentCode,observations:[]});
    student.observations.push(record);
  }
  const allStudents = [...students.values()].map(s=> {
    const unique = field => [...new Set(s.observations.map(o=>o[field]).filter(Boolean))];
    const names = unique("fullName"), classes = unique("className");
    const nameKeys = [...new Set(names.map(n=>n.toLocaleLowerCase("vi")))];
    const preferred = [...s.observations].sort((a,b)=> {
      const rank=o=>o.source.key==="grades-hd6"&&o.advisor?4:o.source.key==="defense-roster"&&o.reviewer?3:o.source.key==="defense-roster"?2:1;
      return rank(b)-rank(a);
    })[0];
    const conflicts=[];
    if(nameKeys.length>1) conflicts.push("NAME_CONFLICT");
    // Even plausible abbreviations remain visible; do not silently overwrite classes.
    if(classes.length>1) conflicts.push("CLASS_VARIANTS");
    const advisorKeys=[...new Set(s.observations.filter(o=>o.advisor).map(o=>lecturerIdentity(o.advisor).key))];
    if(advisorKeys.length>1) conflicts.push("ADVISOR_VARIANTS");
    const result={...s,fullName:preferred.fullName,className:preferred.className,aliases:names,classVariants:classes,
      advisorKeys,reviewerKeys:[...new Set(s.observations.filter(o=>o.reviewer).map(o=>lecturerIdentity(o.reviewer).key))],
      topic:unique("topic")[0]||null,areas:unique("area").filter(isResearchArea),conflicts,
      sourceCount:new Set(s.observations.map(o=>o.source.key)).size};
    result.selectable=conflicts.length===0&&Boolean(result.className)&&advisorKeys.length===1;
    return result;
  });
  const eligible = allStudents.filter(s=>s.selectable).sort((a,b)=>b.sourceCount-a.sourceCount || Number(Boolean(b.topic))-Number(Boolean(a.topic)) || b.observations.length-a.observations.length || a.studentCode.localeCompare(b.studentCode,"en"));
  const selected=eligible.slice(0,limit);
  if(selected.length!==limit) throw Error(`Only ${selected.length} unambiguous students; requested ${limit}`);
  return {allStudents:allStudents.sort((a,b)=>a.studentCode.localeCompare(b.studentCode,"en")),selectedStudents:selected,
    lecturers:[...lecturers.values()].sort((a,b)=>a.key.localeCompare(b.key,"vi")),issues};
}
async function extract(limit=80) {
  const records=[],lecturerObservations=[],issues=[],manifest=[],rawSheets=[],pdfPages=[];
  for(const source of sources) {
    const bytes=fs.readFileSync(path.join(sourceDir,source.file));
    manifest.push({...source,sha256:sha(bytes),bytes:bytes.length});
    if(source.kind==="xlsx") {
      const book=new Excel.Workbook();await book.xlsx.load(bytes);
      for(const sheet of book.worksheets) {
        const rows=[];
        sheet.eachRow((row,n)=> {
          const values=Array.from({length:sheet.columnCount},(_,i)=>cellValue(row.getCell(i+1)));rows.push({row:n,values});
          const at=i=>clean(values[i-1]);const ref={key:source.key,sheet:sheet.name,row:n};
          let record;
          if(source.key==="grades-hd6"&&sheet.name==="In"&&n>=8&&codePattern.test(at(4))) {
            record={studentCode:at(4),fullName:clean(`${at(5)} ${at(6)}`),className:at(3)};
          } else if(source.key==="grades-hd6"&&sheet.name==="HĐ6"&&n>=4&&at(5)) {
            record={studentCode:at(4),fullName:clean(`${at(5)} ${at(6)}`),className:at(3),advisor:at(8),reviewer:at(9),topic:at(11),committee:at(10)};
          } else if(source.key==="defense-roster"&&sheet.name==="HĐ-PB"&&n>=4&&at(5)) {
            record={studentCode:at(4),fullName:at(5),className:at(6),advisor:at(8),reviewer:at(9),area:at(7),committee:at(10)};
          } else if(source.key==="defense-roster"&&sheet.name==="CNTT - Đại trà"&&n>=4&&at(3)) {
            record={studentCode:at(2),fullName:at(3),className:at(4),area:at(5),advisor:at(6)};
          }
          if(record) {
            for(const role of ["advisor","reviewer"]) if(record[role]) lecturerObservations.push({raw:record[role],area:role==="advisor"?record.area:null,source:{...ref,role}});
            if(codePattern.test(record.studentCode)) records.push({...record,source:ref});
            else issues.push({issue:"SOURCE_ROW_MISSING_CODE",source:ref,record});
          }
          if(source.key==="grades-hd6"&&sheet.name==="In"&&n===65) for(const i of [2,5,8,12]) {
            if(at(i)) lecturerObservations.push({raw:at(i),source:{...ref,column:i,role:"committee"}});
          }
        });
        rawSheets.push({key:source.key,sheet:sheet.name,rows});
      }
    } else {
      let page=0;
      await pdf(bytes,{pagerender:async p=> {
        const lines=groupPdfLines((await p.getTextContent()).items);const pageNumber=++page;
        pdfPages.push({key:source.key,page:pageNumber,lines});
        for(const [index,line] of lines.entries()) {
          const parsed=parsePdfLine(line,{key:source.key,page:pageNumber,line:index+1});
          if(parsed?.issue) issues.push(parsed);else if(parsed) records.push(parsed);
        }
        return "";
      }});
    }
  }
  const combined=combine(records,lecturerObservations,issues,limit);
  return {schemaVersion:1,datasetId:`source80-${sha(JSON.stringify(manifest)).slice(0,16)}`,selection:{limit,rule:"No name/class/advisor conflicts; advisor present; prioritize cross-source support, topic, observations, then code"},
    provenance:{identities:"SOURCE_DOCUMENTS",workflow:"NOT_EXECUTED",grades:"SOURCE_REFERENCE_ONLY_NOT_FOR_IMPORT"},manifest,...combined,rawSheets,pdfPages};
}
async function writeWorkbook(dataset) {
  const book=new Excel.Workbook();book.creator="Source dataset importer";
  function add(name,columns,rows) {
    const sheet=book.addWorksheet(name);sheet.columns=columns.map(([header,key,width])=>({header,key,width:width||24}));sheet.addRows(rows);
    sheet.views=[{state:"frozen",ySplit:1}];sheet.autoFilter={from:{row:1,column:1},to:{row:Math.max(1,sheet.rowCount),column:columns.length}};
    sheet.getRow(1).font={bold:true};sheet.eachRow(r=>{r.alignment={vertical:"top",wrapText:true};});
  }
  add("80 sinh viên",[["Mã sinh viên","studentCode"],["Họ tên","fullName",30],["Lớp","className"],["GVHD (nguồn)","advisor",30],["Đề tài (nguồn)","topic",55],["Vị trí nguồn","refs",60]],dataset.selectedStudents.map(s=>({...s,advisor:s.advisorKeys.join("; "),refs:s.observations.map(o=>`${o.source.key}/${o.source.sheet||`page${o.source.page}`}:${o.source.row||o.source.line}`).join("; ")})));
  add("Toàn bộ giảng viên",[["Họ tên","fullName",30],["Tên trong nguồn","aliases",55],["Học vị","degrees"],["Hướng hướng dẫn quan sát","areas",65],["Bộ môn","department"]],dataset.lecturers.map(l=>({...l,aliases:l.aliases.join("; "),degrees:l.degrees.join("; "),areas:l.observedAreas.join("; "),department:"CHƯA CÓ TRONG NGUỒN"})));
  add("Cần đối chiếu",[["Mã SV","studentCode"],["Tên khác nhau","names",40],["Lớp khác nhau","classes",45],["Vấn đề","issues",40]],dataset.allStudents.filter(s=>s.conflicts.length).map(s=>({studentCode:s.studentCode,names:s.aliases.join(" | "),classes:s.classVariants.join(" | "),issues:s.conflicts.join("; ")})));
  add("Dòng không đủ mã",[["Vấn đề","issue",40],["Nguồn","source",55],["Nội dung","raw",90]],dataset.issues.map(i=>({...i,source:JSON.stringify(i.source||i.record?.source),raw:i.raw||JSON.stringify(i.record)})));
  add("Nguồn",[["File","file",85],["SHA256","sha256",68],["Bytes","bytes"]],dataset.manifest);
  await book.xlsx.writeFile(path.join(outputDir,"bo-du-lieu-goc.xlsx"));
}
async function main() {
  const dataset=await extract(80);fs.mkdirSync(outputDir,{recursive:true});
  fs.writeFileSync(path.join(outputDir,"dataset.json"),JSON.stringify(dataset,null,2)+"\n");
  await writeWorkbook(dataset);
  const summary={datasetId:dataset.datasetId,selectedStudents:dataset.selectedStudents.length,lecturers:dataset.lecturers.length,uniqueSourceStudents:dataset.allStudents.length,
    conflictStudents:dataset.allStudents.filter(s=>s.conflicts.length).length,unresolvedRows:dataset.issues.length,
    recordsBySource:Object.fromEntries(sources.map(s=>[s.key,dataset.allStudents.reduce((n,st)=>n+st.observations.filter(o=>o.source.key===s.key).length,0)])),supabaseWrites:0};
  fs.writeFileSync(path.join(outputDir,"summary.json"),JSON.stringify(summary,null,2)+"\n");console.log(JSON.stringify(summary,null,2));
}
module.exports={clean,sha,lecturerIdentity,groupPdfLines,parsePdfLine,combine,extract};
if(require.main===module) main().catch(error=>{console.error(error.message);process.exitCode=1;});
