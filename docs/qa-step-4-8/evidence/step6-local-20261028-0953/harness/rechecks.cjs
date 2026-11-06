// Re-run only the three read/UI assertions affected by harness mistakes. No producer/legacy fixture replay.
'use strict';
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const file=path.join(__dirname,'final-cases.cjs'),source=fs.readFileSync(file,'utf8');
const block=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
let mobile=block(" await s.check('T44-large-diff-mobile'"," const faculty=");
mobile=mobile.replace("s.check('T44-large-diff-mobile'","s.check('T44-large-diff-mobile-recheck'").replace("await s.shot(student,'T44-large-compare-mobile');","await student.page.getByRole('heading',{name:'Khác biệt dữ liệu phiên bản',exact:true}).scrollIntoViewIfNeeded();await student.page.screenshot({path:path.join(out,'T44-large-compare-mobile-viewport.png'),fullPage:false,timeout:30000});");
let spa=block(" await s.check('T47-SPA-no-draft-feedback-or-compare-leak'"," await s.check('T46-");
spa=spa.replace("s.check('T47-SPA-no-draft-feedback-or-compare-leak'","s.check('T47-SPA-recheck'").replace("let link=advisor.page.locator('a[href=\"/topic/proposal/p-page-02\"]');if(!await link.count()){await advisor.page.getByRole('button',{name:'Sau',exact:true}).click();link=advisor.page.locator('a[href=\"/topic/proposal/p-page-02\"]')}await link.click();","await advisor.page.getByRole('textbox',{name:'Tìm hồ sơ chỉnh sửa',exact:true}).fill('QA-PAGE-02');const link=advisor.page.locator('a[href=\"/topic/proposal/p-page-02\"]');await expect(link).toBeVisible();await link.click();");
let legacy=block(" await s.check('T27-T48-legacy-diff-raw-XSS-no-backfill'"," await s.check('contract-withdraw");
legacy=legacy.replace("s.check('T27-T48-legacy-diff-raw-XSS-no-backfill'","s.check('T27-T48-legacy-recheck'").replace('Không có khác biệt dữ liệu.','Không có khác biệt về nội dung và phản hồi.');
const header=source.slice(0,source.indexOf('(async()=>'));
const code=header+`(async()=>{const s=await session('rechecks'),db=await connect();try{const student=await s.actor('student2','/topic/proposal/p-student2');\n`+mobile+`const advisor=await s.actor('advisor','/topic/proposal/p-page-01');\n`+spa+`const legacy=await s.actor('page-21','/topic/proposal/p-page-21');\n`+legacy+`}catch(e){s.fail('rechecks-fatal',e);process.exitCode=1}finally{await db.$disconnect();await s.close()}})().catch(e=>{console.error(clean(e.stack));process.exitCode=1});`;
const runner=new Module(file,module);runner.filename=file;runner.paths=Module._nodeModulePaths(__dirname);runner._compile(code,file);
