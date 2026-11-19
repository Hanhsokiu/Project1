"use strict";
const assert=require("node:assert/strict"),path=require("node:path"),fs=require("node:fs"),crypto=require("node:crypto");
const {root,outputDir,read,save,safeError}=require("./context.cjs");
async function main(){
  const {chromium}=require(path.join(root,"frontend/node_modules/@playwright/test"));
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  try{
    const failures=[];
    page.on("pageerror",()=>failures.push("UNHANDLED_BROWSER_ERROR"));
    const checkEligibility=process.argv.includes("--eligibility"),checkFinal=checkEligibility||process.argv.includes("--final"),row=checkEligibility?read("eligibility-checkpoint.json").results[0]:checkFinal?read("final-reports-checkpoint.json").results.find(r=>r.stage==="ADVISOR_CONFIRMED"):read("guidance-checkpoint.json").results[0];assert.ok(row);
    const account=read("workflow-passwords.private.json").students.find(r=>r.username===row.studentCode);assert.ok(account);
    await page.goto("http://127.0.0.1:5183/login");
    await page.getByRole("textbox",{name:"Tên đăng nhập / Mã định danh *"}).fill(account.username);
    await page.locator('input[type="password"]').fill(account.temporaryWorkflowPassword);
    await page.getByRole("button",{name:"Đăng nhập hệ thống"}).click();
    await page.waitForURL(url=>!url.pathname.startsWith("/login"),{timeout:30000});
    await page.waitForFunction(()=>document.querySelectorAll("nav a").length>0,{},{timeout:30000});
    await page.screenshot({path:path.join(outputDir,"ui-student-dashboard.png"),fullPage:true});
    const links=await page.locator("nav a").evaluateAll(nodes=>nodes.map(n=>({text:n.textContent,path:n.getAttribute("href")})));
    save("ui-student-navigation.json",{links});
    const text=await page.locator("body").innerText();fs.writeFileSync(path.join(outputDir,"ui-student-dashboard.private.txt"),text);
    await page.goto("http://127.0.0.1:5183/guidance/plan/"+row.proposalId+"?termId="+read("foundation-report.json").termId);
    // This page renders context and tasks; it does not render plan.description.
    await page.getByRole("heading",{name:"Báo cáo Tuần 1 — dữ liệu tổng hợp",exact:true}).waitFor({timeout:45000});
    assert.ok((await page.locator("body").innerText()).includes(row.studentCode));
    assert.ok(await page.locator(`a[href="/guidance/tasks/${row.taskId}"]`).count(),"Expected real task link must render");
    await page.screenshot({path:path.join(outputDir,"ui-student-guidance.png"),fullPage:true});
    fs.writeFileSync(path.join(outputDir,"ui-student-guidance.private.txt"),await page.locator("body").innerText());
    let finalEvidence=null;
    if(checkFinal){
      await page.goto("http://127.0.0.1:5183/guidance/final-report?termId="+read("foundation-report.json").termId+"&proposalId="+row.proposalId);
      const filename=`bao-cao-cuoi-tong-hop-${row.studentCode}.pdf`;
      await page.getByText(filename,{exact:false}).waitFor({timeout:45000});
      assert.ok((await page.locator("body").innerText()).includes(row.studentCode));
      const download=page.waitForEvent("download",{timeout:45000});await page.getByRole("button",{name:"Tải PDF",exact:true}).click();
      const result=await download;assert.equal(result.suggestedFilename(),filename);const bytes=fs.readFileSync(await result.path());assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"),row.finalReportChecksum);
      await page.screenshot({path:path.join(outputDir,"ui-student-final-report.png"),fullPage:true});
      fs.writeFileSync(path.join(outputDir,"ui-student-final-report.private.txt"),await page.locator("body").innerText());
      finalEvidence={rendered:true,downloadChecksumVerified:true,screenshot:"ui-student-final-report.png"};
    }
    let eligibilityEvidence=null;
    if(checkEligibility){
      const termId=read("foundation-report.json").termId;
      await page.goto(`http://127.0.0.1:5183/defense/eligibility?termId=${termId}&termStudentId=${row.termStudentId}`);
      // Effective downstream bindings are deliberately faculty-only. Students
      // see the official decision and evidence summary, not that binding notice.
      await page.getByText("Kiểm tra chứng cứ: Chứng cứ đầy đủ. Quyết định Khoa: Khoa đã chốt.",{exact:true}).waitFor({timeout:60000});
      assert.ok((await page.locator("body").innerText()).includes(row.studentCode));
      assert.equal(await page.getByText("Khoa kiểm tra và quyết định",{exact:true}).count(),0,"Student must not receive faculty command form");
      // Detail can succeed while the separate list request times out. Record
      // both outcomes; never label the whole screen verified from detail alone.
      await page.waitForFunction(()=>{const text=document.body.innerText;return text.includes("hồ sơ · Trang")||text.includes("timeout of")||text.includes("Không xử lý được yêu cầu");},{},{timeout:30000}).catch(()=>{});
      const eligibilityText=await page.locator("body").innerText();
      await page.screenshot({path:path.join(outputDir,"ui-student-eligibility.png"),fullPage:true});
      fs.writeFileSync(path.join(outputDir,"ui-student-eligibility.private.txt"),await page.locator("body").innerText());
      eligibilityEvidence={rendered:true,officialStateFinalized:true,evidenceQualified:true,facultyCommandHidden:true,listRendered:eligibilityText.includes("hồ sơ · Trang"),listTimeoutVisible:eligibilityText.includes("timeout of"),fullScreenVerified:eligibilityText.includes("hồ sơ · Trang")&&!eligibilityText.includes("timeout of"),screenshot:"ui-student-eligibility.png"};
    }
    assert.deepEqual(failures,[]);
    const report={verifiedAt:new Date().toISOString(),realApi:true,loginUi:true,guidancePlanRendered:true,landingPath:checkEligibility?"/defense/eligibility":checkFinal?"/guidance/final-report":"/guidance/plan/:proposalId",screenshots:["ui-student-dashboard.png","ui-student-guidance.png"],finalReport:finalEvidence,eligibility:eligibilityEvidence,unhandledErrors:failures.length,fullWorkflowUiVerified:false};save("ui-verification.json",report);console.log(JSON.stringify(report));
  }catch(error){
    await page.screenshot({path:path.join(outputDir,"ui-check-failure.png"),fullPage:true}).catch(()=>{});
    fs.writeFileSync(path.join(outputDir,"ui-check-failure.private.txt"),await page.locator("body").innerText().catch(()=>"Page unavailable"));
    save("ui-verification.json",{verifiedAt:new Date().toISOString(),realApi:true,passed:false,errorType:error.name,fullWorkflowUiVerified:false});
    throw error;
  }finally{
    // Revoke only the actual JWT session opened by this browser check.
    await page.evaluate(async()=>{
      const token=sessionStorage.getItem("utc-api-access");
      if(token){const response=await fetch("/api/auth/logout",{method:"POST",headers:{Authorization:"Bearer "+token},signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error("Inspection logout failed");}
      sessionStorage.clear();
    }).catch(()=>console.error("Inspection session logout could not be confirmed"));
    await browser.close();
  }
}
if(require.main===module)main().catch(safeError);
