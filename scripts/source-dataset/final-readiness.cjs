"use strict";
// Read-only permission preflight. Role definitions do not authorize new grants.
const fs=require("node:fs"),path=require("node:path");
const {req,read,save,outputDir,safeError}=require("./context.cjs"),{environment,targetInfo}=require("./preflight.cjs");
async function main(){const target=targetInfo(environment()),db=new(req("@prisma/client").PrismaClient)({datasources:{db:{url:target.url}},log:[]});try{
 const roles=await db.role.findMany({where:{name:{in:["FACULTY","LECTURER","STUDENT"]}},select:{name:true,_count:{select:{userRoles:true}},rolePermissions:{select:{permission:{select:{resource:true,action:true}}}}}});
 const required={FACULTY:{"defense-result":["read","components-read","finalize","publish"],"defense-report":["read","templates-read","preview","export","download","list-export","components-export","final-export","comments-export","minutes-export","dossier-export","pii-export"],"defense-confirmation":["comment-read"],"defense-reviewer-grade":["comment-read"],dossier:["export"]},LECTURER:{"defense-result":["read","confirm"]},STUDENT:{"defense-result":["read","read-own","final-read"]}};
 const definitions=new Set((await db.permission.findMany({select:{resource:true,action:true}})).map(p=>p.resource+":"+p.action));
 const results=Object.entries(required).map(([role,resources])=>{const stored=roles.find(r=>r.name===role),available=new Set((stored?.rolePermissions||[]).map(r=>r.permission.resource+":"+r.permission.action)),missing=Object.entries(resources).flatMap(([resource,actions])=>actions.map(a=>resource+":"+a)).filter(p=>!available.has(p));return{role,affectedAccounts:stored?._count.userRoles||0,missing,undefinedPermissions:missing.filter(p=>!definitions.has(p))};});
 const {termId,datasetId}=read("foundation-report.json"),report={operation:"READ_ONLY",datasetId,termId,verifiedAt:new Date().toISOString(),roles:results,permissionsChanged:false};save(fs.existsSync(path.join(outputDir,"final-access-report.json"))?"final-access-verification.json":"final-readiness.json",report);console.log(JSON.stringify(report,null,2));
}finally{await db.$disconnect();}}
if(require.main===module)main().catch(safeError);
