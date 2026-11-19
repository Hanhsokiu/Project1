"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {acceptedReport}=require("./inspection-guide.cjs");
test("inspection index excludes partial, stale or unrelated completion claims",()=>{
  const verification={termId:"term",datasetId:"source",verifiedAt:"2026-11-18T07:00:00Z",finalizedEligibility:2};
  const report={termId:"term",datasetId:"source",verifiedAt:"2026-11-18T06:59:00Z",results:[{},{}]};
  assert.equal(acceptedReport(report,verification,"finalizedEligibility"),true);
  for(const value of [null,{...report,termId:"other"},{...report,datasetId:"other"},{...report,verifiedAt:"2026-11-18T07:01:00Z"},{...report,results:[{}]},{...report,verifiedAt:undefined}])
    assert.equal(acceptedReport(value,verification,"finalizedEligibility"),false);
  assert.equal(acceptedReport(report,verification,"finalizedReviewers"),false);
});
