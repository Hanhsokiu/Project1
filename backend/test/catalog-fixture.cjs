'use strict';
// Provision synthetic accounts BEFORE faculty catalog enrichment, per current B1-B8 policy.
// Never use on an application .env fallback or a shared database.
const assert=require('node:assert/strict'),bcrypt=require('bcryptjs');
const {testTarget}=require('../scripts/rehearse-pr2b.cjs');
exports.provision=async(db,kind,input)=>{
 const target=testTarget(process.env.PR2B_TEST_URL);
 assert.equal(new URL(process.env.DATABASE_URL).toString(),target.toString());
 const api=new URL(process.env.TEST_API_URL);assert.equal(api.hostname,'127.0.0.1');
 assert(['student','lecturer'].includes(kind));
 const code=input[kind+'Code'],role=await db.role.findUniqueOrThrow({where:{name:kind.toUpperCase()}});
 assert.equal(await db[kind].count({where:{[kind+'Code']:code}}),0,'Fixture must be new');
 return db.userAccount.create({data:{username:kind==='lecturer'?code.toLowerCase():code,passwordHash:await bcrypt.hash(code,4),displayName:input.fullName,status:'ACTIVE',mustChangePassword:true,userRoles:{create:{roleId:role.id}},[kind]:{create:{[kind+'Code']:code,fullName:input.fullName,...(kind==='student'?{trainingSystemId:input.trainingSystemId}:{departmentId:input.departmentId})}}}});
};
