"use strict";
const assert=require("node:assert/strict");
const {context,dist,read,save,safeError}=require("./context.cjs");
// Confirmed explicitly by the user for this synthetic workflow, not inferred
// institutional ownership and not a change to lecturers' departments.
const routing={
  "Phát triển phần mềm và ứng dụng (webApp, MobleApp)":"KTPM-HTS",
  "Kiểm thử phần mềm":"KTPM-HTS","Lập trình Game":"KTPM-HTS",
  "An toàn thông tin và an ninh mạng":"KTPM-HTS","Khác":"KTPM-HTS",
  "Dữ liệu và trí tuệ nhân tạo":"KHMT-TTNT",
  "Hệ thống, mạng và hạ tầng CNTT":"MANG-HTTT",
};
async function main(){const c=await context();try{
  const Audit=dist("common/audit/audit.service.js","AuditService"),Repo=dist("catalog/repository/catalog.repository.js","CatalogRepository"),Service=dist("catalog/service/reference.service.js","ReferenceService");
  const manifest=read("lecturer-import-plan.json"),names=new Set(manifest.rows.filter(l=>l.status==="READY").flatMap(l=>l.researchAreas));assert.equal(names.size,7);
  const results=[];
  for(const [name,code] of Object.entries(routing)){
    assert.ok(names.has(name));
    results.push(await c.once("routing:"+code+":"+name,{source:"USER_CONFIRMED_SYNTHETIC_ROUTING",name,departmentCode:code},async(tx,db)=>{
      const area=await tx.researchArea.findUnique({where:{name}}),dept=await tx.department.findUnique({where:{code}});assert.ok(area&&dept);
      const existing=await tx.researchAreaWorkflow.findUnique({where:{researchAreaId:area.id}});
      assert.ok(!existing?.departmentId||existing.departmentId===dept.id,"Refuse to reroute an existing department mapping");
      if(!existing?.departmentId){assert.equal(await tx.topic.count({where:{researchAreaId:area.id}}),0,"Review preexisting topics before filling a shared mapping");
        await new Service(new Repo(db,new Audit(db))).save("research-areas",area.id,{departmentId:dept.id},c.faculty.userId);}
      return {researchAreaId:area.id,name,departmentId:dept.id,departmentCode:code};
    }));
  }
  for(const r of results){const actual=await c.db.researchAreaWorkflow.findUnique({where:{researchAreaId:r.researchAreaId}});assert.equal(actual?.departmentId,r.departmentId);}
  save("routing-report.json",{datasetId:c.dataset.datasetId,origin:"USER_CONFIRMED_SYNTHETIC_ROUTING",verifiedAt:new Date().toISOString(),results});console.log(JSON.stringify({verifiedMappings:results.length,lecturerDepartmentsChanged:0}));
}finally{await c.db.$disconnect();}}
module.exports={routing};
if(require.main===module)main().catch(safeError);
