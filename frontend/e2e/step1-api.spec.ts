import { test, expect, type Page } from "@playwright/test";

test("Step 1 persists a semester, term, six phases, roster and imported students through the real API", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  const stamp = String(Date.now());
  const studentCode = `00${stamp}`;
  const termCode = `E2E-${stamp}`;
  const semesterName = `Học kỳ kiểm thử ${stamp}`;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error")
      errors.push(`${message.text()} (${message.location().url})`);
  });
  await page.goto("/login");
  const semestersResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/semesters") &&
      response.request().method() === "GET",
  );
  await page
    .getByLabel("Tên đăng nhập / Mã định danh")
    .fill(process.env.E2E_FACULTY_USER || "giaovu");
  await page
    .getByLabel("Mật khẩu", { exact: false })
    .first()
    .fill(process.env.E2E_FACULTY_PASSWORD || "Demo@2026");
  await page.getByRole("button", { name: "Đăng nhập hệ thống" }).click();
  await expect(page).toHaveURL(/\/$/);
  const semesters = (await (await semestersResponse).json()).data as {
    academicYear: string;
    semester: number;
  }[];
  let year = 2027;
  while (
    semesters.some(
      (s) => s.academicYear === `${year}-${year + 1}` && s.semester === 1,
    )
  )
    year++;

  await test.step("create an actual semester", async () => {
    await page.goto("/catalog/reference");
    await page.getByRole("button", { name: "Kỳ học", exact: true }).click();
    await page.getByRole("button", { name: "Thêm danh mục" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Năm học").fill(`${year}-${year + 1}`);
    await dialog.getByLabel("Học kỳ").selectOption("1");
    await dialog.getByLabel("Ngày bắt đầu kỳ").fill(`${year}-08-01`);
    await dialog.getByLabel("Ngày kết thúc kỳ").fill(`${year + 1}-07-31`);
    await dialog.getByLabel("Tên danh mục").fill(semesterName);
    const response = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/semesters") && r.request().method() === "POST",
    );
    await dialog.getByRole("button", { name: "Lưu danh mục" }).click();
    expect((await response).ok()).toBeTruthy();
    await expect(dialog).toBeHidden();
    await expect(
      page.getByRole("cell", { name: semesterName, exact: true }),
    ).toBeVisible();
  });

  let termId = "";
  await test.step("create a term with real semester and training-system UUIDs", async () => {
    await page.goto("/terms");
    await page.getByRole("button", { name: "Tạo đợt mới" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Mã đợt").fill(termCode);
    await dialog.getByLabel("Tên đợt").fill(`Đợt kiểm thử API ${stamp}`);
    await dialog.getByLabel("Kỳ học").selectOption({ label: semesterName });
    await dialog.getByLabel("Hệ đào tạo").selectOption({ label: "Chính quy" });
    await dialog
      .getByLabel("Ngày bắt đầu", { exact: true })
      .fill(`${year}-09-01`);
    await dialog
      .getByLabel("Ngày kết thúc", { exact: true })
      .fill(`${year + 1}-01-31`);
    await dialog
      .getByLabel("Mở đăng ký (giờ Việt Nam)")
      .fill(`${year}-09-01T08:00`);
    await dialog
      .getByLabel("Đóng đăng ký (giờ Việt Nam)")
      .fill(`${year}-09-10T17:00`);
    const response = page.waitForResponse(
      (r) => r.url().endsWith("/api/terms") && r.request().method() === "POST",
    );
    await dialog.getByRole("button", { name: "Lưu đợt đồ án" }).click();
    const saved = await response;
    expect(saved.ok(), await saved.text()).toBeTruthy();
    termId = (await saved.json()).data.id;
    await expect(page).toHaveURL(new RegExp(`/terms/${termId}$`));
    await expect(
      page.getByRole("heading", {
        name: `Đợt kiểm thử API ${stamp}`,
        exact: true,
      }),
    ).toBeVisible();
  });

  await test.step("save six ordered phases with Vietnam times", async () => {
    await page.goto(`/terms/${termId}/phases`);
    const starts = page.getByLabel("Bắt đầu (giờ Việt Nam)", { exact: true });
    const ends = page.getByLabel("Kết thúc (giờ Việt Nam)", { exact: true });
    await expect(starts).toHaveCount(6);
    const times = [
      `${year}-09-01T08:00`,
      `${year}-09-10T17:00`,
      `${year}-09-15T17:00`,
      `${year}-09-30T17:00`,
      `${year}-12-15T17:00`,
      `${year + 1}-01-15T17:00`,
      `${year + 1}-01-30T17:00`,
    ];
    for (let i = 0; i < 6; i++) {
      await starts.nth(i).fill(times[i]);
      await ends.nth(i).fill(times[i + 1]);
    }
    const response = page.waitForResponse(
      (r) =>
        r.url().endsWith(`/api/terms/${termId}/phases`) &&
        r.request().method() === "PUT",
    );
    await page
      .getByRole("button", { name: "Lưu kế hoạch", exact: true })
      .click();
    const saved = await response;
    expect(saved.ok(), await saved.text()).toBeTruthy();
    await page.reload();
    await expect(starts.nth(0)).toHaveValue(times[0]);
    await expect(ends.nth(5)).toHaveValue(times[6]);
  });

  await test.step("save eligible students, an advisor and a per-term quota", async () => {
    await page.goto(`/terms/${termId}/roster`);
    await page
      .getByRole("button", { name: "Chọn tất cả đủ điều kiện" })
      .click();
    await page
      .getByRole("button", { name: "Giảng viên & quota", exact: true })
      .click();
    await page
      .getByRole("checkbox", { name: /^Chọn giảng viên / })
      .first()
      .check();
    await page
      .getByRole("spinbutton", { name: /^Quota / })
      .first()
      .fill("7");
    const response = page.waitForResponse(
      (r) =>
        r.url().endsWith(`/api/terms/${termId}/roster`) &&
        r.request().method() === "PUT",
    );
    await page.getByRole("button", { name: "Lưu danh sách tham gia" }).click();
    const saved = await response;
    expect(saved.ok(), await saved.text()).toBeTruthy();
    const body = (await saved.json()).data;
    expect(body.studentIds.length).toBeGreaterThan(0);
    expect(body.lecturers).toHaveLength(1);
    expect(body.lecturers[0].quota).toBe(7);
    await page.reload();
    await page
      .getByRole("button", { name: "Giảng viên & quota", exact: true })
      .click();
    await expect(
      page.getByRole("spinbutton", { name: /^Quota / }).first(),
    ).toHaveValue("7");
    await page.screenshot({
      path: testInfo.outputPath("actual-term-roster.png"),
      fullPage: true,
    });
    await testInfo.attach("actual-term-roster", {
      path: testInfo.outputPath("actual-term-roster.png"),
      contentType: "image/png",
    });
  });

  let jobId = "";
  await test.step("preview uploaded CSV on the server, inspect errors and import valid rows", async () => {
    await page.goto("/catalog/import");
    await expect(
      page.getByText(`Nhập sinh viên đủ điều kiện vào đợt ${termCode}.`, {
        exact: false,
      }),
    ).toBeVisible();
    const csv = `studentCode,fullName,className,gpa,email,phone\n${studentCode},Sinh viên kiểm thử API,CNTT E2E,3.4,,\n${studentCode}ERR,Dòng sai GPA,CNTT E2E,5.5,,\n`;
    await page.getByLabel("Chọn tệp CSV hoặc XLSX").setInputFiles({
      name: `students-${stamp}.csv`,
      mimeType: "text/csv",
      buffer: Buffer.from("\uFEFF" + csv),
    });
    const response = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/imports/students/preview") &&
        r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Kiểm tra tệp", exact: true })
      .click();
    const preview = await response;
    expect(preview.ok(), await preview.text()).toBeTruthy();
    const job = (await preview.json()).data;
    jobId = job.id;
    expect(job.validRows).toBe(1);
    expect(job.invalidRows).toBe(1);
    await expect(
      page.getByRole("button", { name: "Xác nhận nhập", exact: true }),
    ).toBeDisabled();
    await page
      .getByLabel("Chỉ nhập dòng hợp lệ, bỏ qua dòng lỗi", { exact: true })
      .check();
    await page
      .getByRole("button", { name: "Xác nhận nhập", exact: true })
      .click();
    const confirmedResponse = page.waitForResponse(
      (r) =>
        r.url().endsWith(`/api/imports/${jobId}/confirm`) &&
        r.request().method() === "POST",
    );
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Xác nhận", exact: true })
      .click();
    const confirmed = await confirmedResponse;
    expect(confirmed.ok(), await confirmed.text()).toBeTruthy();
    expect((await confirmed.json()).data.successRows).toBe(1);
    await expect(
      page.getByText("Đã nhập 1 dòng;", { exact: false }),
    ).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: testInfo.outputPath("actual-student-import.png"),
      fullPage: true,
    });
    await testInfo.attach("actual-student-import", {
      path: testInfo.outputPath("actual-student-import.png"),
      contentType: "image/png",
    });
    await expect(page).toHaveURL(new RegExp(`\\?job=${jobId}$`));
    const restoredJobResponse = page.waitForResponse(
      (r) =>
        r.url().endsWith(`/api/imports/${jobId}`) &&
        r.request().method() === "GET",
    );
    await page.reload();
    const restoredResponse = await restoredJobResponse;
    expect(restoredResponse.ok(), await restoredResponse.text()).toBeTruthy();
    const restoredJob = (await restoredResponse.json()).data;
    expect(["DONE", "PARTIAL"]).toContain(restoredJob.status);
    expect(restoredJob.successRows).toBe(1);
    expect(restoredJob.invalidRows).toBe(1);
    await expect(
      page.getByText("Đã nhập 1 dòng;", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByText("GPA bắt buộc từ 0 đến 4", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Xác nhận nhập", exact: true }),
    ).toBeDisabled();
    await page.getByLabel("Chọn tệp CSV hoặc XLSX").setInputFiles({
      name: `students-${stamp}.csv`,
      mimeType: "text/csv",
      buffer: Buffer.from("\uFEFF" + csv),
    });
    await expect(page).not.toHaveURL(/\?job=/);
    const repeatedPreviewResponse = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/imports/students/preview") &&
        r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Kiểm tra tệp", exact: true })
      .click();
    const repeatedJob = (await (await repeatedPreviewResponse).json()).data;
    expect(["SKIP", "UPDATE"]).toContain(repeatedJob.rows[0].action);
    await page
      .getByLabel("Chỉ nhập dòng hợp lệ, bỏ qua dòng lỗi", { exact: true })
      .check();
    await page
      .getByRole("button", { name: "Xác nhận nhập", exact: true })
      .click();
    const repeatedConfirmResponse = page.waitForResponse(
      (r) =>
        r.url().endsWith(`/api/imports/${repeatedJob.id}/confirm`) &&
        r.request().method() === "POST",
    );
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Xác nhận", exact: true })
      .click();
    const repeatedConfirm = await repeatedConfirmResponse;
    expect(repeatedConfirm.ok(), await repeatedConfirm.text()).toBeTruthy();
    expect((await repeatedConfirm.json()).data.successRows).toBeLessThanOrEqual(
      1,
    );
    await expect(page).toHaveURL(new RegExp(`\\?job=${repeatedJob.id}$`));
    await expect(
      page.getByRole("button", { name: "Xác nhận nhập", exact: true }),
    ).toBeDisabled();
  });

  await test.step("reload proves that the imported student, roster and term survive outside local mock state", async () => {
    await page.goto("/catalog/students");
    await page
      .getByRole("textbox", { name: "Tìm kiếm", exact: true })
      .fill(studentCode);
    await expect(page.getByText(studentCode, { exact: true })).toBeVisible();
    await page.reload();
    await page
      .getByRole("textbox", { name: "Tìm kiếm", exact: true })
      .fill(studentCode);
    await expect(page.getByText(studentCode, { exact: true })).toBeVisible();
    await page.goto(`/terms/${termId}/roster`);
    await page
      .getByRole("textbox", { name: "Tìm kiếm", exact: true })
      .fill(studentCode);
    await expect(
      page.getByRole("checkbox", {
        name: `Thêm ${studentCode} vào đợt`,
        exact: true,
      }),
    ).toBeChecked();
  });
  await test.step("the real roster and plan remain usable at a phone viewport", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("table")).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(391);
    await page.goto(`/terms/${termId}/phases`);
    await expect(
      page.getByLabel("Bắt đầu (giờ Việt Nam)", { exact: true }).first(),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Lưu kế hoạch", exact: true })
      .scrollIntoViewIfNeeded();
    await expect(
      page.getByRole("button", { name: "Lưu kế hoạch", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(391);
    await page.screenshot({
      path: testInfo.outputPath("actual-mobile-plan.png"),
      fullPage: true,
    });
  });
  await testInfo.attach("step1-api-records.json", {
    body: JSON.stringify(
      { termId, termCode, studentCode, jobId, semesterName },
      null,
      2,
    ),
    contentType: "application/json",
  });
  expect(errors).toEqual([]);
});
