"use strict";
// Diagnose credential handoff without attempting login or resetting a password.
const {req,read,save,safeError}=require("./context.cjs"),{environment,targetInfo}=require("./preflight.cjs");
async function main(){const target=targetInfo(environment()),db=new(req("@prisma/client").PrismaClient)({datasources:{db:{url:target.url}},log:[]});try{
 const faculty=read("faculty-report.json"),credentials=read("faculty-credentials.private.json");
 const account=await db.userAccount.findUnique({where:{id:faculty.userId},select:{status:true,mustChangePassword:true,failedLoginCount:true,passwordHash:true}});
 const report={operation:"READ_ONLY",verifiedAt:new Date().toISOString(),role:"FACULTY",status:account?.status||"MISSING",mustChangePassword:account?.mustChangePassword??null,failedLoginCount:account?.failedLoginCount??null,initialPasswordStillMatches:!!account&&await req("bcryptjs").compare(credentials.initialPassword,account.passwordHash),passwordChangedByThisTool:false};
 save("account-access-status.json",report);console.log(JSON.stringify(report,null,2));
}finally{await db.$disconnect();}}
if(require.main===module)main().catch(safeError);
