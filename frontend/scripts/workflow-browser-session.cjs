"use strict";

// Multi-role fixture for workflow interaction tests. API fixtures still decide
// each actor's capabilities; separate UI tests verify single-role navigation.
async function installWorkflowSession(page) {
  await page.addInitScript(() => {
    const user = {
      id: "workflow-browser-actor", username: "workflow-browser-actor", name: "Kiểm thử workflow",
      email: "workflow@example.test", phone: "0912345678", roles: ["FACULTY", "LECTURER", "STUDENT"],
      permissions: ["review-group:read", "review-group:manage", "proposal:read", "proposal:assign", "proposal:edit", "proposal:submit", "guidance:read", "guidance:monitor", "task:review", "task:manage", "submission:read"],
      locked: false, mustChangePassword: false, profileComplete: true,
    };
    sessionStorage.setItem("utc-api-access", "workflow-browser-fixture");
    sessionStorage.setItem("utc-api-user", JSON.stringify(user));
  });
}
async function openFilter(page, label) {
  const control = page.getByLabel(label, { exact: true });
  await control.waitFor({ state: "attached" });
  const details = control.locator("xpath=ancestor::details[1]");
  if (await details.count() && !(await details.getAttribute("open"))) {
    if (!(await control.isVisible())) await details.locator("summary").click();
  }
}
module.exports = { installWorkflowSession, openFilter };
