// Complete only canonical standard UI read permissions, on the private QA DB.
const {connect,out}=require('./private-db.cjs');const fs=require('node:fs'),path=require('node:path');
(async()=>{const db=await connect();const changes=[];try{
 for(const [resource,action,roles] of [['term','read',['LECTURER','STUDENT','COMMITTEE']],['lecturer','read',['LECTURER','STUDENT','COMMITTEE']],['catalog','read',['COMMITTEE']],['assignment','read',['FACULTY','LECTURER','STUDENT']]]){
  const p=await db.permission.upsert({where:{resource_action:{resource,action}},create:{resource,action},update:{}});
  for(const roleId of roles){await db.rolePermission.upsert({where:{roleId_permissionId:{roleId,permissionId:p.id}},create:{roleId,permissionId:p.id},update:{}});changes.push({role:roleId,permission:resource+':'+action});}
 }
 fs.writeFileSync(path.join(out,'fixture-ui-permissions.json'),JSON.stringify({source:'backend/prisma/seed.cjs:44-70',reason:'Synthetic seed omits standard permissions; initial workflow 403s outside canonical STEP5 routes are retained in raw logs.',privateDatabaseOnly:true,applicationRbacChanged:false,changes},null,2));console.log('Private UI fixture baseline completed; no app RBAC or existing DB changed.');
}finally{await db.$disconnect();}})().catch(e=>{console.error(e.message.replace(/postgres(?:ql)?:\/\/[^\s]+/gi,'[REDACTED]'));process.exitCode=1;});
