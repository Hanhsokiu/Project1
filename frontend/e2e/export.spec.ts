import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import ExcelJS from 'exceljs';
import { createSeed } from '../src/shared/data/seed';

async function setup(page:Page,actor='khoa') {
  const db=createSeed();const account=db.accounts.find(a=>a.id===actor)!;account.mustChangePassword=false;
  db.terms[0].studentIds=['sv1','sv2'];db.terms[0].assignmentPublished=true;db.exports=[];
  db.students[0].name='Nguyễn Ánh Đào';db.students[1].name='Trần Hồ Sơ Riêng';
  db.assignments=[{id:'a1',termId:'dot1',studentId:'sv1',lecturerId:'gv1',published:true,manual:false,preference:1,reason:''},{id:'a2',termId:'dot1',studentId:'sv2',lecturerId:'gv2',published:true,manual:false,preference:2,reason:''}];
  db.registrations=db.registrations.filter(r=>r.termId==='dot1'&&['sv1','sv2'].includes(r.studentId));
  db.registrations.forEach(r=>{r.directionId=r.studentId==='sv1'?'h1':'h2';r.preferences=[r.studentId==='sv1'?'gv1':'gv2'];});
  db.topics=db.topics.filter(t=>t.termId==='dot1'&&['sv1','sv2'].includes(t.studentId));
  db.topics.forEach(t=>{t.status='DRAFT';t.title=t.studentId==='sv1'?'Hệ thống quản lý Đồ án tốt nghiệp':'Đề tài riêng của sinh viên khác';t.lecturerId=t.studentId==='sv1'?'gv1':'gv2';t.directionId=t.studentId==='sv1'?'h1':'h2';});
  await page.addInitScript(({fixture,actorId})=>{
    localStorage.clear();sessionStorage.clear();localStorage.setItem('utc-thesis-demo-v1',JSON.stringify(fixture));sessionStorage.setItem('utc-thesis-session',actorId);sessionStorage.setItem('utc-workspace',JSON.stringify({termId:'dot1',studentId:'sv1'}));
  },{fixture:db,actorId:actor});
  await page.goto('/report/export');await expect(page.getByRole('heading',{name:'Xuất dữ liệu và biểu mẫu',exact:true})).toBeVisible();
  return db;
}

/** jsPDF embeds a ToUnicode CMap for the Vietnamese font; decode its text operators. */
function pdfText(bytes:Buffer) {
  const source=bytes.toString('latin1');const mappings=new Map<string,string>();
  for(const segment of source.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for(const item of segment[1].matchAll(/<([0-9a-f]+)>\s*<([0-9a-f]+)>/gi)) {
      const chars=item[2].match(/.{4}/g)??[];mappings.set(item[1].toLowerCase(),chars.map(char=>String.fromCharCode(parseInt(char,16))).join(''));
    }
  }
  return [...source.matchAll(/<([0-9a-f]+)>\s*Tj/gi)].map(item=>(item[1].match(/.{4}/g)??[]).map(glyph=>mappings.get(glyph.toLowerCase())??'').join('')).join('\n');
}

test('exports actual Unicode PDF and XLSX files with the selected Bước 1–3 filters',async({page},testInfo)=>{
  test.setTimeout(90_000);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await setup(page);
  await page.getByLabel('Nội dung',{exact:true}).selectOption('PROPOSAL');
  await page.getByLabel('Sinh viên',{exact:true}).selectOption('sv1');
  await page.getByLabel('Biểu mẫu bằng cấp').selectOption('Kỹ sư');
  await page.getByRole('button',{name:'Xem trước',exact:true}).click();
  const dialog=page.getByRole('dialog');await expect(dialog).toContainText('Nguyễn Ánh Đào');await expect(dialog).not.toContainText('Trần Hồ Sơ Riêng');
  await dialog.getByRole('button',{name:'Đóng',exact:true}).click();
  const pdfDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Tạo và tải tệp',exact:true}).click();const pdf=await pdfDownload;
  expect(pdf.suggestedFilename()).toBe('proposal-dot1.pdf');const pdfPath=testInfo.outputPath('de-cuong-ky-su.pdf');await pdf.saveAs(pdfPath);
  const pdfBytes=await readFile(pdfPath);expect(pdfBytes.subarray(0,5).toString()).toBe('%PDF-');expect(pdfBytes.byteLength).toBeGreaterThan(20_000);
  const text=pdfText(pdfBytes);expect(text).toContain('Nguyễn Ánh Đào');expect(text).toContain('KỸ SƯ');expect(text).toContain('Hệ thống quản lý Đồ án tốt nghiệp');expect(text).toContain('TRƯỞNG BỘ MÔN');expect(text).not.toContain('Trần Hồ Sơ Riêng');
  await testInfo.attach('pdf-text-decoded.txt',{body:text,contentType:'text/plain'});
  await expect(page.getByText('Đã tạo và gửi tới trình duyệt',{exact:true})).toHaveCount(1);
  await page.getByLabel('Nội dung',{exact:true}).selectOption('ASSIGNMENTS');await page.getByLabel('Hướng đồ án',{exact:true}).selectOption('h1');await page.getByLabel('Giảng viên hướng dẫn',{exact:true}).selectOption('gv1');await page.getByLabel('Định dạng',{exact:true}).selectOption('XLSX');
  const xlsxDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Tạo và tải tệp',exact:true}).click();const xlsx=await xlsxDownload;
  expect(xlsx.suggestedFilename()).toBe('assignments-dot1.xlsx');const xlsxPath=testInfo.outputPath('phan-cong-da-loc.xlsx');await xlsx.saveAs(xlsxPath);
  const xlsxBytes=await readFile(xlsxPath);expect(xlsxBytes.subarray(0,2).toString()).toBe('PK');const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(xlsxBytes as unknown as ExcelJS.Buffer);
  const sheet=workbook.worksheets[0];expect(sheet.rowCount).toBe(2);const data=JSON.stringify(sheet.getSheetValues());expect(data).toContain('Nguyễn Ánh Đào');expect(data).toContain('Đã công bố');expect(data).not.toContain('Trần Hồ Sơ Riêng');
  await expect(page.getByText('Đã tạo và gửi tới trình duyệt',{exact:true})).toHaveCount(2);
  const jobs=await page.evaluate(()=>JSON.parse(localStorage.getItem('utc-thesis-demo-v1')!).exports);expect(jobs).toHaveLength(2);expect(jobs.every((job:{status:string})=>job.status==='COMPLETED')).toBe(true);expect(errors).toEqual([]);
});

test('student report preview and downloads keep other students private',async({page},testInfo)=>{
  await setup(page,'sv1');const options=await page.getByLabel('Nội dung',{exact:true}).locator('option').evaluateAll(nodes=>nodes.map(node=>(node as HTMLOptionElement).value));expect(options).toEqual(['ASSIGNMENTS','PROPOSAL']);
  await page.getByRole('button',{name:'Xem trước',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Nguyễn Ánh Đào');await expect(page.getByRole('dialog')).not.toContainText('Trần Hồ Sơ Riêng');await page.getByRole('dialog').getByRole('button',{name:'Đóng',exact:true}).click();
  await page.getByLabel('Định dạng',{exact:true}).selectOption('XLSX');const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Tạo và tải tệp',exact:true}).click();const download=await downloadEvent;const target=testInfo.outputPath('sinh-vien-phan-cong.xlsx');await download.saveAs(target);
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(await readFile(target) as unknown as ExcelJS.Buffer);const values=JSON.stringify(workbook.worksheets[0].getSheetValues());expect(values).toContain('Nguyễn Ánh Đào');expect(values).not.toContain('Trần Hồ Sơ Riêng');
});
