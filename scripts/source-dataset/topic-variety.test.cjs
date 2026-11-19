"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),{generatedTitle}=require("./topic-variety.cjs");
test("all 80 generated labels are distinct and do not depend on student identity",()=>{
 const titles=Array.from({length:80},(_,i)=>generatedTitle(i));assert.equal(new Set(titles).size,80);
 for(const title of titles){assert.ok(title.length>=30);assert.ok(!title.includes("quản lý học tập và tiến độ đồ án"));assert.ok(!/hồ sơ \d{6,}/.test(title));}
 assert.throws(()=>generatedTitle(-1));assert.throws(()=>generatedTitle(80));
});
