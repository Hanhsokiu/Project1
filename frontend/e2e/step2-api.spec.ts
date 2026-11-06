import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
test.use({ actionTimeout: 15000 });

test("Step 2: default-password onboarding, real registration and separate faculty browser", async ({
  browser,
  request,
}, testInfo) => {
  test.setTimeout(180000);
  // npm --prefix backend run test:step2 creates isolated API/PostgreSQL fixtures.
  const fixture = JSON.parse(
    readFileSync(
      resolve(process.cwd(), "../.cache/step2-fixture.json"),
      "utf8",
    ),
  );
  const api = "http://127.0.0.1:3010/api";
  const password = "StepTwo@2026";
  const facultyLogin = await request.post(api + "/auth/login", {
    data: { username: fixture.facultyUsername, password },
  });
  expect(facultyLogin.ok()).toBeTruthy();
  const auth = {
    Authorization: `Bearer ${(await facultyLogin.json()).data.accessToken}`,
  };
  const stamp = String(Date.now());
  const code = "00E2E" + stamp;
  const term = (
    await (
      await request.get(`${api}/terms/${fixture.termId}`, { headers: auth })
    ).json()
  ).data;
  const created = await request.post(api + "/students", {
    headers: auth,
    data: {
      studentCode: code,
      fullName: "Step2 Browser Student",
      className: "QA E2E",
      trainingSystemId: term.trainingSystemId,
      gpa: 3.3,
    },
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  const studentId = (await created.json()).data.id;
  const roster = await request.put(`${api}/terms/${fixture.termId}/roster`, {
    headers: auth,
    data: {
      studentIds: [...term.studentIds, studentId],
      lecturers: term.lecturers.map(
        (l: { lecturerId: string; quota: number }) => ({
          lecturerId: l.lecturerId,
          quota: l.quota,
        }),
      ),
    },
  });
  expect(roster.ok(), await roster.text()).toBeTruthy();
  const studentContext = await browser.newContext();
  const facultyContext = await browser.newContext();
  const student = await studentContext.newPage();
  const faculty = await facultyContext.newPage();
  const errors: string[] = [];
  for (const page of [student, faculty])
    page.on("pageerror", (e) => errors.push(e.message));
  async function login(page: Page, username: string, pw: string) {
    await page.goto("http://127.0.0.1:5173/login");
    await page.getByLabel("Tên đăng nhập / Mã định danh").fill(username);
    await page.getByLabel("Mật khẩu", { exact: false }).first().fill(pw);
    await page.getByRole("button", { name: "Đăng nhập hệ thống" }).click();
    await expect(page).not.toHaveURL(/\/login$/);
  }
  await test.step("default password leads to password change then server contact completion", async () => {
    await login(student, code, code);
    await expect(student).toHaveURL(/change-password$/);
    await student.getByLabel("Mật khẩu hiện tại").fill(code);
    await student.getByLabel("Mật khẩu mới", { exact: true }).fill(password);
    await student.getByLabel(/Xác nhận mật khẩu/).fill(password);
    await student
      .getByRole("button", { name: /Lưu mật khẩu|Đổi mật khẩu/ })
      .click();
    await expect(student).toHaveURL(/profile$/);
    await student.goto("http://127.0.0.1:5173/registration");
    await expect(student).toHaveURL(/profile$/);
    await student
      .getByLabel("Email", { exact: true })
      .fill(`browser_${stamp}@example.test`);
    await student
      .getByLabel("Số điện thoại", { exact: false })
      .fill("0912345678");
    await student.getByRole("button", { name: "Lưu hồ sơ" }).click();
    await expect(
      student.getByText(
        "Thông tin liên hệ đã được lưu và đồng bộ với danh mục.",
        { exact: true },
      ),
    ).toBeVisible();
    await student
      .getByRole("link", { name: "Đăng ký nguyện vọng", exact: true })
      .last()
      .click();
    await expect(student).toHaveURL(/registration$/);
  });
  await test.step("save draft, reorder NV, submit via real API and reload", async () => {
    await student.getByLabel("Đợt làm việc").selectOption(fixture.termId);
    await expect(
      student.getByText("Cổng đăng ký đang mở.", { exact: false }),
    ).toBeVisible();
    await student
      .getByLabel("Chọn duy nhất một hướng *", { exact: false })
      .selectOption(fixture.directionId);
    await student
      .getByLabel("Thêm nguyện vọng 1")
      .selectOption(fixture.lecturerIds[0]);
    await student
      .getByLabel("Thêm nguyện vọng 2")
      .selectOption(fixture.lecturerIds[1]);
    await student.getByRole("button", { name: "Nâng NV2" }).click();
    await student
      .getByRole("button", { name: "Lưu nháp", exact: true })
      .click();
    await expect(
      student.getByText("Đã lưu bản nháp đăng ký.", { exact: true }),
    ).toBeVisible();
    await student.reload();
    await expect(
      student.getByLabel("Chọn duy nhất một hướng *", { exact: false }),
    ).toHaveValue(fixture.directionId);
    const submitted = student.waitForResponse(
      (r) =>
        r.url().endsWith(`/registrations/term/${fixture.termId}/me/submit`) &&
        r.request().method() === "POST",
    );
    await student
      .getByRole("button", { name: "Nộp đăng ký", exact: true })
      .click();
    await student
      .getByRole("dialog")
      .getByRole("button", { name: "Xác nhận", exact: true })
      .click();
    const response = await submitted;
    expect(response.ok(), await response.text()).toBeTruthy();
    const row = (await response.json()).data;
    expect(row.status).toBe("SUBMITTED");
    expect(row.submittedAt).toBeTruthy();
    expect(
      row.preferences.map((p: { lecturerId: string }) => p.lecturerId),
    ).toEqual([fixture.lecturerIds[1], fixture.lecturerIds[0]]);
    await student.reload();
    await expect(
      student.getByText("Đã nộp", { exact: true }).first(),
    ).toBeVisible();
    const stored = await student.evaluate(() =>
      JSON.parse(localStorage.getItem("utc-thesis-demo-v1") || "null"),
    );
    expect(stored?.registrations || []).toEqual([]);
  });
  await test.step("another browser's faculty reads the saved record from DB", async () => {
    await login(faculty, fixture.facultyUsername, password);
    await faculty.goto("http://127.0.0.1:5173/registration/list");
    await faculty.getByLabel("Đợt làm việc").selectOption(fixture.termId);
    await expect(faculty.getByText(code, { exact: true })).toBeVisible();
    await faculty.reload();
    await expect(faculty.getByText(code, { exact: true })).toBeVisible();
    await faculty.screenshot({
      path: testInfo.outputPath("step2-faculty-db.png"),
      fullPage: true,
    });
    await student.screenshot({
      path: testInfo.outputPath("step2-student-db.png"),
      fullPage: true,
    });
  });
  await studentContext.close();
  const otherContext = await browser.newContext();
  const otherStudent = await otherContext.newPage();
  await login(otherStudent, code, password);
  await otherStudent.goto("http://127.0.0.1:5173/registration");
  await otherStudent.getByLabel("Đợt làm việc").selectOption(fixture.termId);
  await expect(
    otherStudent.getByText("Đã nộp", { exact: true }).first(),
  ).toBeVisible();
  expect(errors).toEqual([]);
  await otherContext.close();
  await facultyContext.close();
});
