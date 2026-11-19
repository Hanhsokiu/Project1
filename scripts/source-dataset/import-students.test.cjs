"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {markerId,loadDataset,validateExisting}=require("./import-students.cjs");
const {workflow}=require("./workflow.cjs");
test("Import rejects an unrelated account and an orphaned provenance marker",()=>{
  const student={studentCode:"001234567",fullName:"Nguyễn Văn An"};
  const existing={id:"account-1",student};
  assert.equal(validateExisting(null,null,student,"source80"),"CREATE");
  assert.throws(()=>validateExisting(existing,null,student,"source80"),/not owned/);
  assert.throws(()=>validateExisting(null,{action:"SOURCE_DATASET_ACCOUNT_IMPORTED"},student,"source80"),/Marker without account/);
});
test("Reruns preserve owned accounts and fail on changed identity or foreign dataset",()=>{
  const student={studentCode:"001234567",fullName:"Nguyễn Văn An"};
  const existing={id:"account-1",student};
  const marker={action:"SOURCE_DATASET_ACCOUNT_IMPORTED",resourceId:"account-1",newValue:{datasetId:"source80"}};
  assert.equal(validateExisting(existing,marker,student,"source80"),"KEEP_EXISTING");
  assert.throws(()=>validateExisting(existing,marker,{...student,fullName:"Other"},"source80"),/Student name changed/);
  assert.throws(()=>validateExisting(existing,marker,student,"another"),/not owned/);
  assert.notEqual(markerId("source80",student.studentCode),markerId("another",student.studentCode));
});
test("Each of 80 source identities has one scenario and all 20 key routes exist",()=>{
  const {dataset}=loadDataset(),plan=workflow(dataset);
  assert.equal(plan.scenarios.length,80);assert.equal(plan.actions.length,20);
  assert.equal(new Set(plan.scenarios.map(s=>s.studentCode)).size,80);
  for(const action of plan.actions)assert.equal(plan.scenarios.filter(s=>s.group===action.key).length,4);
  for(const scenario of plan.scenarios){assert.equal(scenario.executionStatus,"NOT_EXECUTED");assert.deepEqual(scenario.events,[]);}
});
