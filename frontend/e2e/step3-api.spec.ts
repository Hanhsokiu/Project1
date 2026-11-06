import { test, expect, type Page } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
test("Step 3: real student → faculty → lecturer browsers, SMTP, saved proposal PDF", async ({
  browser,
  request,
}, testInfo) => {
  test.setTimeout(240000);
  const fixture = JSON.parse(
    readFileSync(
      resolve(process.cwd(), "../.cache/step3-browser-fixture.json"),
      "utf8",
    ),
  );
  const api = "http://127.0.0.1:3010/api",
    password = "StepThree@2026";
  const evidence = resolve(
    process.cwd(),
    "../docs/implementation/step3-evidence",
  );
  mkdirSync(evidence, { recursive: true });
  const studentContext = await browser.newContext(),
    facultyContext = await browser.newContext(),
    lecturerContext = await browser.newContext();
  const student = await studentContext.newPage(),
    faculty = await facultyContext.newPage(),
    lecturer = await lecturerContext.newPage();
  const errors: string[] = [];
  for (const p of [student, faculty, lecturer])
    p.on("pageerror", (e) => errors.push(e.message));
  async function login(p: Page, username: string) {
    await p.goto("http://127.0.0.1:5173/login");
    await p.getByLabel("Tên đăng nhập / Mã định danh").fill(username);
    await p.getByLabel("Mật khẩu", { exact: false }).first().fill(password);
    await p.getByRole("button", { name: "Đăng nhập hệ thống" }).click();
    await expect(p).not.toHaveURL(/\/login$/);
  }
  async function term(p: Page) {
    await p.getByLabel("Đợt làm việc").selectOption(fixture.termId);
  }
  const facultyLogin = await request.post(api + "/auth/login", {
    data: { username: fixture.facultyUsername, password },
  });
  expect(facultyLogin.ok()).toBeTruthy();
  const auth = {
    Authorization: `Bearer ${(await facultyLogin.json()).data.accessToken}`,
  };
  await test.step("student submits registration through the Step2 UI and reloads", async () => {
    await login(student, fixture.studentCodes[0]);
    await student.goto("http://127.0.0.1:5173/registration");
    await term(student);
    await student
      .getByLabel("Chọn duy nhất một hướng *", { exact: false })
      .selectOption(fixture.directionId);
    await student
      .getByLabel("Thêm nguyện vọng 1")
      .selectOption(fixture.lecturerIds[0]);
    await student
      .getByRole("button", { name: "Nộp đăng ký", exact: true })
      .click();
    await student
      .getByRole("dialog")
      .getByRole("button", { name: "Xác nhận", exact: true })
      .click();
    await expect(
      student.getByText("Đã nộp", { exact: true }).first(),
    ).toBeVisible();
    await student.reload();
    await expect(
      student.getByText("Đã nộp", { exact: true }).first(),
    ).toBeVisible();
  });
  await test.step("faculty closes registration, previews and saves a draft in independent browser", async () => {
    const closed = await request.patch(
      `${api}/terms/${fixture.termId}/status`,
      { headers: auth, data: { status: "CLOSED_REGISTRATION" } },
    );
    expect(closed.ok(), await closed.text()).toBeTruthy();
    await login(faculty, fixture.facultyUsername);
    await faculty.goto("http://127.0.0.1:5173/registration/assignment");
    await term(faculty);
    await faculty
      .getByRole("button", { name: "Xem trước phân bổ bổ sung" })
      .click();
    await expect(faculty.getByRole("dialog")).toBeVisible();
    await expect(
      faculty.getByRole("dialog").getByText("NV1", { exact: true }),
    ).toBeVisible();
    await faculty.getByRole("button", { name: "Lưu phương án nháp" }).click();
    await expect(faculty.getByRole("dialog")).toHaveCount(0);
    await faculty.reload();
    await expect(faculty.getByText(/Phương án · phiên 1/)).toBeVisible();
    await faculty.screenshot({
      path: resolve(evidence, "faculty-draft.png"),
      fullPage: true,
    });
  });
  await test.step("faculty manually adjusts to Y, publishes, student and lecturer see same official result", async () => {
    await faculty
      .getByRole("link", { name: "Điều chỉnh thủ công", exact: true })
      .last()
      .click();
    await faculty
      .getByLabel("Sinh viên đã đăng ký *", { exact: false })
      .selectOption(fixture.studentIds[0]);
    await faculty
      .getByLabel("Giảng viên hướng dẫn mới *", { exact: false })
      .selectOption(fixture.lecturerIds[1]);
    await faculty
      .getByLabel("Lý do điều chỉnh *", { exact: false })
      .fill("Cân bằng tải theo hướng chuyên môn trong kiểm thử");
    await faculty
      .getByRole("button", { name: "Lưu điều chỉnh", exact: true })
      .click();
    await faculty
      .getByRole("dialog")
      .getByRole("button", { name: "Xác nhận", exact: true })
      .click();
    await expect(faculty.getByRole("dialog")).toHaveCount(0);
    await faculty.goto("http://127.0.0.1:5173/registration/assignment");
    await faculty
      .getByRole("button", { name: "Chốt & công bố", exact: true })
      .click();
    await faculty
      .getByRole("dialog")
      .getByRole("button", { name: "Xác nhận", exact: true })
      .click();
    await expect(
      faculty.getByRole("button", { name: "Đã công bố", exact: true }),
    ).toBeVisible();
    await student.goto("http://127.0.0.1:5173/registration/result");
    await expect(
      student.getByText("Giảng viên Y", { exact: true }),
    ).toBeVisible();
    await login(lecturer, fixture.lecturerCodes[1]);
    await lecturer.goto("http://127.0.0.1:5173/registration/result");
    await term(lecturer);
    await expect(
      lecturer.getByText(fixture.studentCodes[0], { exact: false }),
    ).toBeVisible();
  });
  const title = "Ứng dụng quản lý đồ án tiếng Việt qua API";
  await test.step("student saves content, current lecturer confirms, student submits", async () => {
    await student.goto("http://127.0.0.1:5173/topic/proposal");
    await student.getByLabel("Tên đề tài *", { exact: false }).fill(title);
    await student
      .getByLabel("Mục tiêu *", { exact: false })
      .fill("Quản lý đăng ký, phân công và đề cương có lịch sử");
    await student
      .getByLabel("Nội dung và phạm vi *", { exact: false })
      .fill("Một sinh viên một đề tài, lưu dữ liệu thật trong PostgreSQL");
    await student
      .getByLabel("Công nghệ, công cụ, ngôn ngữ *", { exact: false })
      .fill("React, NestJS, Prisma, PostgreSQL");
    await student
      .getByLabel("Kết quả dự kiến *", { exact: false })
      .fill("Đăng ký và đề cương được lưu, xuất PDF tiếng Việt");
    await student
      .getByLabel("Công việc", { exact: true })
      .fill("Phân tích, triển khai và kiểm thử xuyên suốt");
    await student
      .getByRole("button", { name: "Lưu nháp", exact: true })
      .click();
    await expect(student.getByText(/Đã lưu nháp\./)).toBeVisible();
    await lecturer.goto("http://127.0.0.1:5173/topic/my");
    await expect(lecturer.getByText(title, { exact: true })).toBeVisible();
    await lecturer
      .getByRole("button", { name: "Thống nhất đề tài", exact: true })
      .click();
    await lecturer
      .getByRole("dialog")
      .getByRole("button", { name: "Xác nhận", exact: true })
      .click();
    await expect(lecturer.getByRole("dialog")).toHaveCount(0);
    await student.reload();
    await expect(
      student.getByRole("button", { name: "Nộp đề cương", exact: true }),
    ).toBeEnabled();
    await student
      .getByRole("button", { name: "Nộp đề cương", exact: true })
      .click();
    await student
      .getByRole("dialog")
      .getByRole("button", { name: "Xác nhận", exact: true })
      .click();
    await expect(student.getByText(/Đề cương đã được nộp\./)).toBeVisible();
    await student.reload();
    await expect(
      student.getByLabel("Tên đề tài *", { exact: false }),
    ).toHaveValue(title);
    await student.screenshot({
      path: resolve(evidence, "student-submitted.png"),
      fullPage: true,
    });
  });
  await test.step("download PDF uses saved version despite unsaved form edits; API data stays out of localStorage", async () => {
    await student
      .getByLabel("Tên đề tài *", { exact: false })
      .fill("NỘI DUNG CHƯA LƯU KHÔNG ĐƯỢC XUẤT");
    const download = student.waitForEvent("download");
    await student
      .getByRole("button", { name: "Tải biểu mẫu PDF", exact: true })
      .click();
    const file = await download;
    await file.saveAs(resolve(evidence, "browser-de-cuong-v2.pdf"));
    expect(
      readFileSync(resolve(evidence, "browser-de-cuong-v2.pdf"))
        .subarray(0, 5)
        .toString(),
    ).toBe("%PDF-");
    const parse = createRequire(resolve(process.cwd(), "package.json"))(
      resolve(
        process.cwd(),
        "../backend/node_modules/pdf-parse/lib/pdf-parse.js",
      ),
    );
    const pdfText = (
      await parse(readFileSync(resolve(evidence, "browser-de-cuong-v2.pdf")))
    ).text.normalize("NFC");
    expect(pdfText).toContain(title);
    expect(pdfText).toContain("Phiên bản 2");
    expect(pdfText).not.toContain("NỘI DUNG CHƯA LƯU");
    writeFileSync(resolve(evidence, "browser-de-cuong-v2.txt"), pdfText);
    const stored = await student.evaluate(() =>
      JSON.parse(localStorage.getItem("utc-thesis-demo-v1") || "null"),
    );
    for (const key of ["registrations", "assignments", "topics"])
      expect(stored?.[key] || []).toEqual([]);
  });
  await test.step("MailHog received SMTP and UI shows SENT from persisted outbox", async () => {
    await expect
      .poll(
        async () => {
          const r = await request.get(
            `${api}/notifications/outbox/term/${fixture.termId}`,
            { headers: auth },
          );
          const rows = (await r.json()).data;
          return rows[0]?.status;
        },
        { timeout: 30000 },
      )
      .toBe("SENT");
    const events = (
      await (
        await request.get(
          `${api}/notifications/outbox/term/${fixture.termId}`,
          { headers: auth },
        )
      ).json()
    ).data;
    const mail = (
      await (
        await request.get("http://127.0.0.1:8025/api/v2/messages?limit=100")
      ).json()
    ).items;
    expect(
      mail.some((m: { Content: { Headers: Record<string, string[]> } }) =>
        (m.Content.Headers["Message-ID"] ?? []).some((id) =>
          id.includes(events[0].id),
        ),
      ),
    ).toBeTruthy();
    await faculty.goto("http://127.0.0.1:5173/registration/assignment");
    await expect(faculty.getByText("Đã gửi", { exact: true })).toBeVisible();
    await faculty.screenshot({
      path: resolve(evidence, "faculty-published.png"),
      fullPage: true,
    });
    const mailPage = await facultyContext.newPage();
    await mailPage.goto("http://127.0.0.1:8025");
    await expect(mailPage.getByText(/Phân công GVHD/).first()).toBeVisible();
    await mailPage.screenshot({
      path: resolve(evidence, "mailhog.png"),
      fullPage: true,
    });
    writeFileSync(
      resolve(evidence, "browser-result.json"),
      JSON.stringify(
        {
          termId: fixture.termId,
          studentCode: fixture.studentCodes[0],
          advisorCode: fixture.lecturerCodes[1],
          outboxId: events[0].id,
          status: events[0].status,
          pdfVersion: 2,
          title,
          pageErrors: errors,
        },
        null,
        2,
      ),
    );
  });
  expect(errors).toEqual([]);
  await testInfo.attach("Step3 evidence", {
    path: resolve(evidence, "browser-result.json"),
    contentType: "application/json",
  });
  await studentContext.close();
  await facultyContext.close();
  await lecturerContext.close();
});
