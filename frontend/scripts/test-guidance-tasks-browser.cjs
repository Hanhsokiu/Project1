"use strict";
// Isolated Edge demo: mocked API only, never backend/database.
const { spawn } = require("node:child_process"),
  fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { chromium, expect } = require("@playwright/test");
async function main() {
  const interactive = process.argv.includes("--interactive"),
    root = path.resolve(__dirname, ".."),
    origin = "http://127.0.0.1:50177",
    vite = spawn(
      process.execPath,
      [
        path.join(
          path.dirname(require.resolve("vite/package.json")),
          "bin/vite.js",
        ),
        "--host",
        "127.0.0.1",
        "--port",
        "50177",
        "--strictPort",
      ],
      {
        cwd: root,
        env: {
          ...process.env,
          VITE_API_URL: "/api",
          VITE_REVIEW_GROUP_DEMO: "true",
        },
        stdio: "ignore",
        windowsHide: true,
      },
    );
  let browser;
  const checks = [],
    pass = (name) => {
      checks.push({ name, result: "PASS" });
      console.log("PASS " + name);
    };
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(origin)).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    assert(ready, "Vite did not start");
    browser = await chromium.launch({
      channel: "msedge",
      headless: !interactive,
    });
    const page = await browser.newPage({
        viewport: { width: 1280, height: 900 },
      }),
      pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(e.message));
    await page.addInitScript(() =>
      localStorage.setItem("accessToken", "demo-guidance-token"),
    );
    let actor = process.argv.includes("--student")
        ? "student"
        : process.argv.includes("--faculty")
          ? "faculty"
          : "advisor",
      hasPlan = actor !== "advisor",
      planRevision = 0,
      obligationRevision = 0,
      description = "",
      phaseLocked = false,
      invalidDossier = false,
      conflict = false,
      deny = false,
      weeklyId = null,
      createdBody = null;
    const tasks = new Map(),
      now = Date.now(),
      iso = (v) => new Date(v).toISOString(),
      picker = (v) => new Date(v + 7 * 3600000).toISOString().slice(0, 16);
    const periods = [
      {
        id: "m1",
        termId: "t1",
        ordinal: 1,
        label: "Mốc phân tích",
        type: "MILESTONE",
        startsAt: iso(now - 86400000),
        endsAt: iso(now + 86400000),
        reportDueAt: null,
        revision: 0,
      },
      {
        id: "w1",
        termId: "t1",
        ordinal: 2,
        label: "Tuần 1",
        type: "WEEK",
        startsAt: iso(now - 43200000),
        endsAt: iso(now + 3600000),
        reportDueAt: iso(now - 21600000),
        revision: 0,
      },
    ];
    const valid = () => !phaseLocked && !invalidDossier;
    const taskView = (t) => ({
      ...t,
      isOverdue:
        Date.now() > Date.parse(t.dueDate) &&
        !["COMPLETED", "CANCELLED"].includes(t.status),
      allowedActions:
        !valid() || ["COMPLETED", "CANCELLED"].includes(t.status)
          ? []
          : actor === "advisor"
            ? ["update", "cancel"]
            : actor === "student" &&
                ["TODO", "IN_PROGRESS", "REVISION_REQUESTED"].includes(t.status)
              ? ["progress"]
              : [],
    });
    const addTask = (body, kind = "AD_HOC") => {
      const id = "task" + (tasks.size + 1),
        value = {
          id,
          planId: "plan1",
          proposalId: "p2",
          termId: "t1",
          termStudentId: "ts2",
          studentName: "Nguyễn Văn An",
          studentCode: "SV02",
          topicTitle: "Đồ án quản lý đào tạo DEMO",
          advisorId: "advisor",
          periodId: body.periodId,
          periodLabel:
            periods.find((p) => p.id === body.periodId)?.label ?? null,
          kind,
          title: body.title,
          description: body.description ?? null,
          expectedDeliverables: body.expectedDeliverables,
          startDate: body.startDate,
          dueDate: body.dueDate,
          status: "TODO",
          revision: 0,
          hasSubmissions: false,
          progress: [],
          history: [
            {
              id: "h" + id,
              reason: "TASK_CREATED",
              actorId: actor,
              createdAt: iso(now),
            },
          ],
        };
      tasks.set(id, value);
      return value;
    };
    if (hasPlan)
      addTask({
        title: "Phân tích yêu cầu demo",
        description: "Mô tả nhiệm vụ",
        expectedDeliverables: "Tài liệu yêu cầu",
        periodId: "m1",
        startDate: iso(now - 3600000),
        dueDate: iso(now + 3600000),
      });
    const context = () => ({
      proposalId: "p2",
      termId: "t1",
      title: "Đồ án quản lý đào tạo DEMO",
      studentName: "Nguyễn Văn An",
      studentCode: "SV02",
      currentFinalizationId: "f1",
      dossierRevision: 1,
      canCreate: !hasPlan && actor === "advisor" && valid(),
      readiness: !valid()
        ? [phaseLocked ? "TERM_003" : "DOSSIER_NOT_FINALIZED"]
        : [],
      phase: {
        startsAt: iso(now - 86400000),
        endsAt: iso(now + 86400000),
        isLocked: phaseLocked,
      },
      periods,
      plan: hasPlan
        ? {
            id: "plan1",
            proposalId: "p2",
            termId: "t1",
            termStudentId: "ts2",
            studentName: "Nguyễn Văn An",
            studentCode: "SV02",
            topicTitle: "Đồ án quản lý đào tạo DEMO",
            advisorId: "advisor",
            currentAdvisorId: "advisor",
            state: "ACTIVE",
            revision: planRevision,
            description,
            finalizationId: "f1",
            assignmentId: "assignment1",
            assignmentRevision: 0,
            allowedActions:
              actor === "advisor" && valid() ? ["create-task", "update"] : [],
            readiness: !valid()
              ? [phaseLocked ? "TERM_003" : "DOSSIER_NOT_FINALIZED"]
              : [],
          }
        : null,
    });
    const coverage = () => ({
      data: [
        {
          termStudentId: "ts2",
          studentName: "Nguyễn Văn An",
          studentCode: "SV02",
          proposalId: "p2",
          periodId: "w1",
          periodLabel: "Tuần 1",
          startsAt: periods[1].startsAt,
          reportDueAt: periods[1].reportDueAt,
          obligationId: "o1",
          obligationRevision,
          planId: hasPlan ? "plan1" : null,
          planRevision: hasPlan ? planRevision : null,
          currentTaskId: weeklyId,
          missingPlan: !hasPlan,
          missingTask: !weeklyId,
          missingObligationRecord: false,
          isOverdue: true,
          submissionState: "MISSING",
          canEnsure: hasPlan && !weeklyId && actor !== "faculty" && valid(),
          readiness: [
            ...(!hasPlan ? ["MISSING_PLAN"] : []),
            ...(!weeklyId ? ["MISSING_TASK"] : []),
          ],
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
      coverageState: "READY",
      warnings: [],
    });
    await page.route("**/*", async (route) => {
      const r = route.request(),
        url = new URL(r.url());
      if (url.origin !== origin) return route.abort();
      if (!url.pathname.startsWith("/api/")) return route.continue();
      const p = url.pathname.slice(4),
        method = r.method(),
        send = (data, status = 200) =>
          route.fulfill({
            status,
            contentType: "application/json",
            body: JSON.stringify(
              status < 300
                ? { success: true, data, timestamp: iso(now) }
                : {
                    success: false,
                    error: {
                      code: status === 409 ? "REVISION_CONFLICT" : "COMMON_001",
                      message: data,
                    },
                  },
            ),
          });
      if (deny) return send("Không tìm thấy nhiệm vụ trong phạm vi.", 404);
      if (method === "GET" && p === "/proposal-review-options/terms")
        return send([
          { id: "t1", name: "Đợt demo 2026", status: "IN_PROGRESS" },
        ]);
      if (method === "GET" && p === "/terms/t1/proposals")
        return send({
          data: [
            {
              id: "p2",
              termId: "t1",
              title: "Đồ án quản lý đào tạo DEMO",
              studentName: "Nguyễn Văn An",
              studentCode: "SV02",
              departmentId: "d1",
              departmentName: "Bộ môn demo",
              researchAreaName: null,
              status: "APPROVED",
              revision: 4,
              submittedVersionId: "v2",
              versionNumber: 2,
              activeReviewId: null,
              groupName: null,
              readiness: [],
              canAssign: false,
            },
          ],
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        });
      if (method === "GET" && p === "/proposals/p2/guidance-context")
        return send(context());
      if (method === "GET" && p === "/terms/t1/guidance-periods")
        return send(periods);
      if (method === "GET" && p === "/terms/t1/weekly-report-coverage") {
        const value = coverage();
        if (
          url.searchParams.get("periodId") &&
          url.searchParams.get("periodId") !== "w1"
        )
          return send({ ...value, data: [], total: 0, totalPages: 0 });
        return send(value);
      }
      if (
        method === "GET" &&
        (p === "/terms/t1/guidance-tasks" ||
          p === "/guidance-plans/plan1/tasks")
      ) {
        const data = [...tasks.values()]
          .map(taskView)
          .filter(
            (t) =>
              (!url.searchParams.get("periodId") ||
                t.periodId === url.searchParams.get("periodId")) &&
              (!url.searchParams.get("status") ||
                t.status === url.searchParams.get("status")) &&
              (!url.searchParams.get("isOverdue") ||
                t.isOverdue === (url.searchParams.get("isOverdue") === "true")),
          );
        return send({
          data,
          total: data.length,
          page: 1,
          limit: 20,
          totalPages: data.length ? 1 : 0,
          overdueTotal: data.filter((t) => t.isOverdue).length,
        });
      }
      const match = /^\/tasks\/([^/]+)(?:\/(progress|cancel))?$/.exec(p),
        t = match ? tasks.get(match[1]) : null;
      if (method === "GET" && match && !match[2])
        return t ? send(taskView(t)) : send("Không tìm thấy nhiệm vụ.", 404);
      const known =
        (method === "POST" &&
          [
            "/proposals/p2/guidance-plan",
            "/guidance-plans/plan1/tasks",
            "/weekly-report-obligations/o1/task",
          ].includes(p)) ||
        (method === "PATCH" && p === "/guidance-plans/plan1") ||
        (!!t &&
          ((method === "PATCH" && !match[2]) ||
            (method === "POST" && !!match[2])));
      if (!known) return send("API ngoài phạm vi demo bước 8A.", 404);
      if (!r.headers()["idempotency-key"])
        return send("Thiếu Idempotency-Key.", 400);
      let body;
      try {
        body = r.postDataJSON();
      } catch {
        return send("JSON không hợp lệ.", 400);
      }
      if (!body) return send("Thiếu request.", 400);
      if (!valid() || conflict)
        return send("Kế hoạch/nhiệm vụ đã thay đổi. Hãy tải lại.", 409);
      if (p === "/proposals/p2/guidance-plan") {
        if (actor !== "advisor") return send("Không có quyền.", 404);
        if (hasPlan) return send("Đã có kế hoạch.", 409);
        hasPlan = true;
        description = body.description ?? "";
        obligationRevision++;
        return send(context().plan, 201);
      }
      if (p === "/guidance-plans/plan1" && method === "PATCH") {
        if (actor !== "advisor") return send("Không có quyền.", 404);
        if (body.expectedRevision !== planRevision)
          return send("Kế hoạch đã thay đổi.", 409);
        description = body.description;
        planRevision++;
        return send(context().plan);
      }
      if (p === "/guidance-plans/plan1/tasks") {
        if (actor !== "advisor")
          return send("Không có quyền giao nhiệm vụ.", 404);
        if (body.expectedPlanRevision !== planRevision)
          return send("Kế hoạch đã thay đổi.", 409);
        if (
          !periods.some((p) => p.id === body.periodId) ||
          Date.parse(body.startDate) >= Date.parse(body.dueDate)
        )
          return send("Mốc/ngày không hợp lệ.", 400);
        createdBody = body;
        const value = addTask(body);
        planRevision++;
        return send(taskView(value), 201);
      }
      if (p === "/weekly-report-obligations/o1/task") {
        if (actor === "faculty") return send("Không có quyền.", 404);
        if (
          body.expectedPlanRevision !== planRevision ||
          body.expectedObligationRevision !== obligationRevision
        )
          return send("Nghĩa vụ đã thay đổi.", 409);
        if (weeklyId) return send(taskView(tasks.get(weeklyId)), 201);
        const value = addTask(
          {
            title: "Báo cáo Tuần 1",
            expectedDeliverables: "Báo cáo và source theo cấu hình tuần",
            periodId: "w1",
            startDate: periods[1].startsAt,
            dueDate: periods[1].reportDueAt,
          },
          "WEEKLY_REPORT",
        );
        weeklyId = value.id;
        planRevision++;
        obligationRevision++;
        return send(taskView(value), 201);
      }
      if (body.expectedRevision !== t.revision)
        return send("Nhiệm vụ đã thay đổi. Hãy tải lại.", 409);
      if (match[2] === "progress") {
        if (actor !== "student")
          return send("Không có quyền ghi thay SV.", 403);
        if (!["TODO", "IN_PROGRESS", "REVISION_REQUESTED"].includes(t.status))
          return send("Không được ghi tiến độ.", 409);
        t.progress.push({
          id: "progress" + t.progress.length,
          note: body.note,
          actorId: "student",
          createdAt: iso(Date.now()),
        });
        if (t.status === "TODO") t.status = "IN_PROGRESS";
        t.revision++;
        return send(taskView(t));
      }
      if (actor !== "advisor") return send("Không có quyền sửa/hủy.", 404);
      if (match[2] === "cancel") {
        t.status = "CANCELLED";
        if (t.id === weeklyId) {
          weeklyId = null;
          obligationRevision++;
        }
        t.revision++;
        t.history.push({
          id: "cancel" + t.id,
          reason: body.reason,
          actorId: actor,
          createdAt: iso(Date.now()),
        });
        return send(taskView(t));
      }
      for (const name of [
        "title",
        "description",
        "expectedDeliverables",
        "startDate",
        "dueDate",
      ])
        if (body[name] !== undefined) t[name] = body[name];
      t.revision++;
      t.history.push({
        id: "update" + t.revision,
        reason: body.reason,
        actorId: actor,
        createdAt: iso(Date.now()),
      });
      return send(taskView(t));
    });
    if (interactive) {
      await page.goto(
        origin +
          (actor === "advisor"
            ? "/guidance/plan/p2"
            : "/guidance/tasks?termId=t1"),
      );
      console.log(
        "Da mo Step 8A DEMO trong Edge; khong ket noi backend/database.",
      );
      console.log(
        `Vai tro demo: ${actor}. GVHD tao ke hoach/giao viec; SV ghi tien do; Khoa chi xem tong hop.`,
      );
      console.log(
        "Nghia vu tuan van thieu bao cao du da co task. Chua co upload/danh gia. Cac menu khac chua duoc gia lap.",
      );
      process.once("SIGINT", () => browser.close());
      process.once("SIGTERM", () => browser.close());
      await new Promise((resolve) => {
        page.once("close", resolve);
        browser.once("disconnected", resolve);
      });
      return;
    }
    await page.goto(origin + "/guidance/plan");
    await page
      .getByRole("link", { name: "Mở kế hoạch hướng dẫn", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Tạo kế hoạch hướng dẫn", exact: true }),
    ).toBeVisible();
    await page.getByLabel("Mô tả kế hoạch").fill("Kế hoạch demo theo bản chốt");
    await page
      .getByRole("button", { name: "Tạo kế hoạch hướng dẫn", exact: true })
      .click();
    await expect(
      page.getByRole("link", { name: "Giao nhiệm vụ mới", exact: true }),
    ).toBeVisible();
    assert(hasPlan);
    pass(
      "official-advisor UI creates a plan from finalization and reveals task creation",
    );
    await page
      .getByRole("link", { name: "Giao nhiệm vụ mới", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Giao nhiệm vụ", exact: true })
      .click();
    assert.equal(tasks.size, 0);
    await page
      .getByLabel("Tên nhiệm vụ", { exact: true })
      .fill("Phân tích yêu cầu");
    await page
      .getByLabel("Mô tả nhiệm vụ", { exact: true })
      .fill("Mô tả chi tiết");
    await page
      .getByLabel("Sản phẩm dự kiến", { exact: true })
      .fill("Tài liệu yêu cầu");
    await page.getByLabel("Mốc nhiệm vụ", { exact: true }).selectOption("m1");
    await page
      .getByLabel("Ngày bắt đầu", { exact: true })
      .fill(picker(now - 3600000));
    await page
      .getByLabel("Hạn hoàn thành", { exact: true })
      .fill(picker(now + 3600000));
    await page
      .getByRole("button", { name: "Giao nhiệm vụ", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Phân tích yêu cầu", exact: true }),
    ).toBeVisible();
    assert(createdBody.startDate.endsWith("+07:00"));
    assert.equal(tasks.size, 1);
    pass(
      "task form validates required fields, sends UTC+7 dates and opens the saved task",
    );
    await page
      .getByRole("button", { name: "Chỉnh sửa nhiệm vụ", exact: true })
      .click();
    await page
      .getByLabel("Tên nhiệm vụ", { exact: true })
      .fill("Giữ nội dung khi xung đột");
    await page
      .getByLabel("Lý do thay đổi", { exact: true })
      .fill("Làm rõ yêu cầu");
    conflict = true;
    await page
      .getByRole("button", { name: "Lưu thay đổi nhiệm vụ", exact: true })
      .click();
    await expect(page.getByRole("alert").last()).toContainText("đã thay đổi");
    await expect(page.getByLabel("Tên nhiệm vụ", { exact: true })).toHaveValue(
      "Giữ nội dung khi xung đột",
    );
    assert.equal(tasks.get("task1").revision, 0);
    conflict = false;
    await page
      .getByRole("button", { name: "Lưu thay đổi nhiệm vụ", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Giữ nội dung khi xung đột",
        exact: true,
      }),
    ).toBeVisible();
    pass(
      "edit conflict preserves draft/reason and retry updates only the expected task revision",
    );
    actor = "student";
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Chỉnh sửa nhiệm vụ", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Xác nhận hủy nhiệm vụ", exact: true }),
    ).toHaveCount(0);
    await page
      .getByLabel("Ghi nhận tiến độ", { exact: true })
      .fill("Đã hoàn tất phân tích ban đầu");
    await page
      .getByRole("button", { name: "Bắt đầu / Ghi tiến độ", exact: true })
      .click();
    await expect(
      page.getByText("Đã hoàn tất phân tích ban đầu", { exact: true }),
    ).toBeVisible();
    assert.equal(tasks.get("task1").status, "IN_PROGRESS");
    assert.equal(tasks.get("task1").progress.length, 1);
    await expect(page.locator("input[type=file]")).toHaveCount(0);
    pass(
      "student starts/appends progress without advisor controls, upload or self-completion",
    );
    tasks.get("task1").dueDate = iso(now - 1000);
    await page.goto(origin + "/guidance/tasks?termId=t1");
    await page
      .getByLabel("Lọc trạng thái nhiệm vụ")
      .selectOption("IN_PROGRESS");
    await page
      .getByRole("checkbox", { name: "Chỉ nhiệm vụ quá hạn", exact: true })
      .check();
    await expect(
      page.getByText("1 nhiệm vụ · 1 quá hạn trong bộ lọc", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Giữ nội dung khi xung đột",
        exact: true,
      }),
    ).toBeVisible();
    await page.getByLabel("Lọc mốc nhiệm vụ").selectOption("w1");
    await expect(
      page.getByRole("heading", {
        name: "Chưa có nhiệm vụ hoặc kế hoạch phù hợp",
        exact: true,
      }),
    ).toBeVisible();
    await page.getByLabel("Lọc mốc nhiệm vụ").selectOption("");
    await expect(
      page.getByRole("heading", {
        name: "Giữ nội dung khi xung đột",
        exact: true,
      }),
    ).toBeVisible();
    await page.getByLabel("Lọc trạng thái nhiệm vụ").selectOption("COMPLETED");
    await expect(
      page.getByRole("heading", {
        name: "Chưa có nhiệm vụ hoặc kế hoạch phù hợp",
        exact: true,
      }),
    ).toBeVisible();
    pass(
      "week/status/overdue filtering and empty state keep overdue separate from task state",
    );
    await expect(
      page.getByText("Chưa có báo cáo · Quá hạn báo cáo", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Tạo nhiệm vụ cho Tuần 1", exact: true })
      .click();
    await expect(
      page.getByRole("link", { name: "Xem nhiệm vụ tuần", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Chưa có báo cáo · Quá hạn báo cáo", { exact: true }),
    ).toBeVisible();
    assert.equal(tasks.size, 2);
    assert.equal(tasks.get(weeklyId).status, "TODO");
    pass(
      "weekly missing report appears before manual task creation and stays missing after explicit ensure",
    );
    actor = "faculty";
    await page.reload();
    await expect(
      page.getByRole("button", {
        name: "Tạo nhiệm vụ cho Tuần 1",
        exact: true,
      }),
    ).toHaveCount(0);
    await page.goto(origin + "/guidance/tasks/task1");
    await expect(
      page.getByRole("button", { name: "Chỉnh sửa nhiệm vụ", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByLabel("Ghi nhận tiến độ", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", {
        name: "Giữ nội dung khi xung đột",
        exact: true,
      }),
    ).toBeVisible();
    pass(
      "faculty can inspect term summary and task history with no student/advisor mutations",
    );
    actor = "advisor";
    await page.reload();
    await page
      .getByLabel("Lý do hủy nhiệm vụ", { exact: true })
      .fill("Thay đổi công việc");
    await page
      .getByRole("button", { name: "Xác nhận hủy nhiệm vụ", exact: true })
      .click();
    await expect(page.getByText("Đã hủy", { exact: true })).toBeVisible();
    await expect(page.getByText("Quá hạn", { exact: true })).toHaveCount(0);
    assert.equal(tasks.get("task1").status, "CANCELLED");
    pass(
      "cancel requires a reason and removes mutation/overdue controls while keeping history",
    );
    phaseLocked = true;
    await page.goto(origin + "/guidance/plan/p2/tasks/new");
    await expect(page.getByRole("alert")).toContainText(
      "không cho phép giao nhiệm vụ",
    );
    await expect(
      page.getByRole("button", { name: "Giao nhiệm vụ", exact: true }),
    ).toHaveCount(0);
    phaseLocked = false;
    invalidDossier = true;
    await page.goto(origin + "/guidance/plan/p2");
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Đề cương chưa có hồ sơ chính thức" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Giao nhiệm vụ mới", exact: true }),
    ).toHaveCount(0);
    invalidDossier = false;
    pass(
      "locked phase or invalid finalization hides task creation instead of bypassing readiness",
    );
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(origin + "/guidance/tasks/task1");
    await expect
      .poll(
        async () =>
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
      )
      .toBe(true);
    pass("mobile task detail and history have no horizontal page overflow");
    deny = true;
    await page.goto(origin + "/guidance/tasks/foreign");
    await expect(page.getByRole("alert")).toContainText(
      "Không tìm thấy nhiệm vụ",
    );
    await expect(
      page.getByText("Sản phẩm dự kiến", { exact: true }),
    ).toHaveCount(0);
    assert.deepEqual(pageErrors, []);
    pass(
      "scope failures hide academic content and navigation causes no unhandled page errors",
    );
    fs.writeFileSync(
      path.join(root, "../backend/prisma/review/step8a-browser-results.json"),
      JSON.stringify(
        {
          result: "PASS",
          mockedApi: true,
          sharedDatabaseAccess: false,
          checks,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(`${checks.length} Step 8A browser checks passed`);
  } finally {
    if (browser) await browser.close();
    vite.kill();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
