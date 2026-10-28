'use strict';
const fs=require('node:fs'),path=require('node:path');
const {session,save,assert,expect,out}=require('./helpers.cjs'),{connect}=require('./private-db.cjs');
(async()=>{const s=await session('pdf-errors'),db=await connect();try{
 const f=await s.actor('faculty','/topic/dossier/p-page-04');
 const metrics=async()=>Promise.all(['thesisDossier','dossierWorkflow','dossierFinalization','dossierReceipt','fileAsset','dossierPdfContent','dossierHistory','idempotencyRecord'].map(m=>db[m].findMany({orderBy:m==='dossierPdfContent'?{assetId:'asc'}:{id:'asc'}})));
 const before=await metrics();
 await s.check('preview-shows-real-business-error',async()=>{
   await expect(f.page.getByRole('heading',{name:'Hồ sơ đề cương chính thức',exact:true})).toBeVisible();
   await f.page.getByRole('button',{name:'Tải PDF xem trước (chưa chốt)',exact:true}).click();
   const alert=f.page.getByRole('alert');await expect(alert).toContainText('Bước 1–3 chưa cung cấp lớp/ngành đã xác nhận cho sinh viên trong đợt.');
   assert(!await alert.innerText().then(t=>t.includes('Request failed')));
   await s.shot(f,'preview-business-error');
   assert.deepEqual(await metrics(),before);return {expectedStatus:409,message:await alert.innerText(),noPartialWrites:true};
 });
 await s.check('historical-corrupt-PDF-error-and-recovery',async()=>{
   await f.go('/topic/dossier/p-student','Hồ sơ đề cương chính thức');
   const d=await f.data('/proposals/p-student/dossier'),historical=d.finalizations.find(x=>x.sequence===1);
   assert(historical.supersededAt);const fin=await db.dossierFinalization.findUniqueOrThrow({where:{id:historical.id}}),asset=await db.fileAsset.findUniqueOrThrow({where:{id:fin.pdfAssetId}});
   const button=f.page.getByRole('button',{name:'Tải PDF bản chốt 1 (đã thay thế)',exact:true});
   try{await db.fileAsset.update({where:{id:asset.id},data:{sizeBytes:asset.sizeBytes+1}});await button.click();await expect(f.page.getByRole('alert')).toHaveText('File PDF không khớp metadata.');await s.shot(f,'historical-PDF-business-error');}
   finally{await db.fileAsset.update({where:{id:asset.id},data:{sizeBytes:asset.sizeBytes,updatedAt:asset.updatedAt}})}
   const downloaded=f.page.waitForEvent('download');await button.click();await (await downloaded).saveAs(path.join(out,'recovered-historical.pdf'));
   await expect(f.page.getByRole('alert')).toHaveCount(0);
   assert.deepEqual(fs.readFileSync(path.join(out,'recovered-historical.pdf')),fs.readFileSync(path.join(out,'../step7-fixes-20261028-1933/student-official.pdf')));
   assert.deepEqual(await metrics(),before);return {businessMessage:true,restoredMetadata:true,originalBytesPreserved:true,noPartialWrites:true};
 });
 save('no-business-changes.json',{beforeRows:before.map(x=>x.length),afterRows:(await metrics()).map(x=>x.length),identical:require('./helpers.cjs').hash(before)===require('./helpers.cjs').hash(await metrics())});
 }catch(e){s.fail('fatal',e);process.exitCode=1}finally{await db.$disconnect();await s.close()}})().catch(e=>{console.error(e.message);process.exitCode=1});
