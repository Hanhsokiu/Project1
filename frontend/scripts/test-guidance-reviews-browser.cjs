"use strict";
// Stateful Edge demo/test for Step 8C with 8B resubmission. Mock API only.
const { spawn } = require("node:child_process"),
  fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  assert = require("node:assert/strict");
const { chromium, expect } = require("@playwright/test");
async function main() {
  const interactive = process.argv.includes("--interactive"),
    root = path.resolve(__dirname, ".."),
    origin = "http://127.0.0.1:50179",
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
        "50179",
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
    assert(ready, "Vite not ready");
    browser = await chromium.launch({
      channel: "msedge",
      headless: !interactive,
    });
    const page = await browser.newPage({
        viewport: { width: 1280, height: 900 },
        acceptDownloads: true,
      }),
      errors = [],
      requests = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() =>
      localStorage.setItem("accessToken", "demo-guidance-review-token"),
    );
    let actor = process.argv.includes("--student")
        ? "student"
        : process.argv.includes("--faculty")
          ? "faculty"
          : "advisor",
      taskRevision = 0,
      planRevision = 0,
      taskState = "SUBMITTED",
      currentId = "sub1",
      conflict = false,
      locked = false,
      deny = false;
    const now = Date.now(),
      iso = (n) => new Date(n).toISOString(),
      pdf = fs.readFileSync(
        path.join(root, "../backend/prisma/review/step7-sample.pdf"),
      ),
      zip = Buffer.from("UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==", "base64"),
      submissions = [],
      reviews = new Map(),
      uploads = new Map(),
      meetings = [],
      notifications = [];
    const policy = {
      policyId: "approved-20261022-v1",
      maxFileBytes: 20 * 1024 * 1024,
      maxSubmissionBytes: 50 * 1024 * 1024,
      stagingTtlHours: 24,
      maxPendingFilesPerStudent: 10,
      zipMaxEntries: 1000,
      zipMaxExpandedBytes: 200 * 1024 * 1024,
      roles: {
        REPORT: { extensions: ["pdf"], maxFiles: 1 },
        SOURCE: { extensions: ["zip"], maxFiles: 1 },
        EVIDENCE: { extensions: ["pdf", "png", "jpg", "jpeg"], maxFiles: 3 },
      },
    };
    const sub1 = {
      id: "sub1",
      taskId: "task1",
      versionNumber: 1,
      state: "SUBMITTED",
      submittedBy: "s2",
      submittedAt: iso(now - 60000),
      deadlineSnapshot: iso(now - 3600000),
      isLate: true,
      revision: 0,
      content: "Báo cáo và source phiên bản 1 DEMO",
      contextSnapshot: {
        schemaVersion: 1,
        planId: "plan1",
        studentId: "s2",
        termId: "t1",
        periodId: "w1",
      },
      files: [
        {
          id: "f1",
          kind: "REPORT",
          originalName: "report.pdf",
          sizeBytes: pdf.length,
          mimeType: "application/pdf",
          checksum: "demo",
        },
        {
          id: "f2",
          kind: "SOURCE",
          originalName: "source.zip",
          sizeBytes: zip.length,
          mimeType: "application/zip",
          checksum: "demo",
        },
      ],
    };
    submissions.push(sub1);
    const effective = (id) =>
      (reviews.get(id) ?? []).find((r) => r.state === "RECORDED") ?? null;
    const context = (id) => {
      const s = submissions.find((s) => s.id === id),
        r = effective(id);
      return {
        submission: s,
        taskId: "task1",
        taskTitle: "Báo cáo tuần 1 DEMO",
        proposalId: "p2",
        termId: "t1",
        studentName: "Nguyễn Văn An",
        studentCode: "SV02",
        periodLabel: "Tuần 1",
        taskStatus: taskState,
        taskRevision,
        currentSubmissionId: currentId,
        effectiveReview: r,
        history: reviews.get(id) ?? [],
        allowedActions:
          actor === "advisor" && !locked && id === currentId
            ? [r ? "amend" : "review"]
            : [],
        readiness:
          id !== currentId ? ["STALE_SUBMISSION"] : locked ? ["TERM_003"] : [],
      };
    };
    function record(id, body, old) {
      if (old) {
        old.state = "SUPERSEDED";
        old.revision++;
      }
      const r = {
        id: crypto.randomUUID(),
        submissionId: id,
        decision: body.decision,
        comment: body.comment ?? null,
        state: "RECORDED",
        reviewerUserId: "advisor",
        reviewerName: "TS. Trần Bình",
        assignmentRevision: 1,
        recordedAt: iso(Date.now()),
        revision: 0,
        supersedesReviewId: old?.id ?? null,
        amendmentReason: old ? body.reason : null,
      };
      reviews.set(id, [r, ...(reviews.get(id) ?? [])]);
      submissions.find((s) => s.id === id).state = "REVIEWED";
      submissions.find((s) => s.id === id).revision++;
      taskRevision++;
      taskState = r.decision === "PASS" ? "COMPLETED" : "REVISION_REQUESTED";
      notifications.unshift({
        id: crypto.randomUUID(),
        title: "Cập nhật đánh giá báo cáo",
        body: "GVHD đã cập nhật đánh giá bài nộp. Mở hồ sơ để xem nhận xét và yêu cầu tiếp theo.",
        link: "/guidance/review/" + id,
        status: "UNREAD",
        createdAt: iso(Date.now()),
        readAt: null,
      });
      return r;
    }
    const task = () => ({
      id: "task1",
      planId: "plan1",
      proposalId: "p2",
      termId: "t1",
      termStudentId: "ts2",
      studentName: "Nguyễn Văn An",
      studentCode: "SV02",
      topicTitle: "Quản lý đào tạo DEMO",
      advisorId: "advisor",
      periodId: "w1",
      periodLabel: "Tuần 1",
      kind: "WEEKLY_REPORT",
      title: "Báo cáo tuần 1 DEMO",
      description: "Báo cáo và source",
      expectedDeliverables: "PDF báo cáo + ZIP source",
      startDate: iso(now - 86400000),
      dueDate: iso(now - 3600000),
      status: taskState,
      revision: taskRevision,
      isOverdue: taskState !== "COMPLETED",
      hasSubmissions: true,
      allowedActions: [],
      progress: [],
      history: [],
    });
    const rows = () => [
      {
        legacyUnknown: false,
        taskId: "task1",
        planId: "plan1",
        proposalId: "p2",
        termId: "t1",
        studentId: "s2",
        studentName: "Nguyễn Văn An",
        studentCode: "SV02",
        advisorId: "advisor",
        advisorName: "TS. Trần Bình",
        title: "Báo cáo tuần 1 DEMO",
        periodId: "w1",
        periodLabel: "Tuần 1",
        status: taskState,
        dueDate: iso(now - 3600000),
        isOverdue: taskState !== "COMPLETED",
        hasSubmission: true,
        submissionId: currentId,
        versionNumber: submissions.find((s) => s.id === currentId)
          .versionNumber,
        decision: effective(currentId)?.decision ?? null,
        pendingReview: !effective(currentId),
      },
      {
        legacyUnknown: false,
        taskId: "task2",
        planId: "plan2",
        proposalId: "p3",
        termId: "t1",
        studentId: "s3",
        studentName: "Lê Thị Mai",
        studentCode: "SV03",
        advisorId: "other",
        advisorName: "GV Nguyễn Hòa",
        title: "Báo cáo tuần 1 của Mai",
        periodId: "w1",
        periodLabel: "Tuần 1",
        status: "TODO",
        dueDate: iso(now - 3600000),
        isOverdue: true,
        hasSubmission: false,
        submissionId: null,
        versionNumber: null,
        decision: null,
        pendingReview: false,
      },
    ];
    const paged = (data) => ({
      data,
      total: data.length,
      page: 1,
      limit: 20,
      totalPages: data.length ? 1 : 0,
    });
    await page.route("**/*", async (route) => {
      const r = route.request(),
        url = new URL(r.url());
      if (url.origin !== origin) return route.abort();
      if (!url.pathname.startsWith("/api/")) return route.continue();
      const p = url.pathname.slice(4),
        method = r.method();
      const send = (data, status = 200, code = "COMMON_001") =>
        route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(
            status < 300
              ? { success: true, data, timestamp: iso(Date.now()) }
              : {
                  success: false,
                  error: { code, message: data },
                  timestamp: iso(Date.now()),
                },
          ),
        });
      requests.push({
        method,
        path: p,
        key: r.headers()["idempotency-key"],
        body:
          method === "POST" &&
          r.headers()["content-type"]?.includes("application/json")
            ? r.postDataJSON()
            : undefined,
      });
      if (deny) return send("Không tìm thấy hồ sơ trong phạm vi.", 404);
      if (p === "/proposal-review-options/terms")
        return send([
          { id: "t1", name: "Đợt hướng dẫn DEMO", status: "IN_PROGRESS" },
        ]);
      if (p === "/guidance-review-options/terms")
        return send({
          terms: [
            { id: "t1", name: "Đợt hướng dẫn DEMO", status: "IN_PROGRESS" },
          ],
          canReview: actor === "advisor",
          canMonitor: actor === "faculty",
        });
      if (method === "GET" && p === "/terms/t1/progress-review-inbox") {
        const q = url.searchParams,
          data = rows().filter(
            (x) =>
              x.hasSubmission &&
              x.advisorId === "advisor" &&
              (!q.get("pending") ||
                (q.get("pending") === "true") === x.pendingReview) &&
              (!q.get("decision") || x.decision === q.get("decision")) &&
              (!q.get("search") || x.studentName.includes(q.get("search"))),
          );
        return send(paged(data));
      }
      let match = /^\/task-submissions\/([^/]+)\/review-context$/.exec(p);
      if (method === "GET" && match) {
        if (!submissions.some((s) => s.id === match[1]))
          return send("Không tìm thấy bài.", 404);
        return send(context(match[1]));
      }
      match = /^\/task-submissions\/([^/]+)\/reviews$/.exec(p);
      if (method === "POST" && match) {
        if (actor !== "advisor" || locked)
          return send("Không đủ quyền/giai đoạn đã khóa.", 409, "TERM_003");
        const b = r.postDataJSON(),
          c = context(match[1]);
        if (conflict) {
          conflict = false;
          taskRevision++;
          return send(
            "Dữ liệu đã thay đổi; tải lại trước khi gửi.",
            409,
            "REVISION_CONFLICT",
          );
        }
        if (match[1] !== currentId)
          return send("Bài nộp đã cũ.", 409, "STALE_SUBMISSION");
        if (
          b.expectedTaskRevision !== taskRevision ||
          b.expectedSubmissionRevision !== c.submission.revision
        )
          return send("Dữ liệu đã thay đổi.", 409, "REVISION_CONFLICT");
        if (c.effectiveReview)
          return send("Đã có đánh giá.", 409, "REVIEW_ALREADY_RECORDED");
        return send(record(match[1], b), 201);
      }
      match = /^\/task-reviews\/([^/]+)\/amendments$/.exec(p);
      if (method === "POST" && match) {
        const old = [...reviews.values()].flat().find((x) => x.id === match[1]),
          b = r.postDataJSON();
        if (!old) return send("Không tìm thấy đánh giá.", 404);
        if (old.submissionId !== currentId || old.state !== "RECORDED")
          return send("Bài/đánh giá đã cũ.", 409, "STALE_SUBMISSION");
        if (
          b.expectedTaskRevision !== taskRevision ||
          b.expectedSubmissionRevision !==
            context(currentId).submission.revision ||
          b.expectedReviewRevision !== old.revision
        )
          return send("Đánh giá đã thay đổi.", 409, "REVISION_CONFLICT");
        return send(record(old.submissionId, b, old), 201);
      }
      if (method === "GET" && p === "/tasks/task1") return send(task());
      if (method === "GET" && p === "/tasks/task1/submission-context")
        return send({
          taskId: "task1",
          taskRevision,
          canSubmit:
            actor === "student" && taskState !== "COMPLETED" && !locked,
          readiness: [],
          policy,
          latePolicy: "ACCEPT_WHILE_PHASE_OPEN",
          dueDate: iso(now - 3600000),
          currentSubmissionId: currentId,
        });
      if (method === "GET" && p === "/tasks/task1/submissions")
        return send({
          ...paged([...submissions].reverse()),
          currentSubmissionId: currentId,
        });
      if (method === "POST" && p === "/tasks/task1/submission-uploads") {
        const text = r.postDataBuffer().toString("latin1"),
          kind = /\r\nSOURCE\r\n/.test(text) ? "SOURCE" : "REPORT",
          id = crypto.randomUUID(),
          name = /filename="([^"]+)"/.exec(text)?.[1] ?? "file",
          file = {
            id: crypto.randomUUID(),
            kind,
            originalName: name,
            sizeBytes: kind === "SOURCE" ? zip.length : pdf.length,
            mimeType: kind === "SOURCE" ? "application/zip" : "application/pdf",
            checksum: "demo",
          };
        const u = { id, expiresAt: iso(now + 86400000), file };
        uploads.set(id, u);
        return send(u, 201);
      }
      if (method === "POST" && p === "/tasks/task1/submissions") {
        const b = r.postDataJSON();
        if (
          actor !== "student" ||
          taskState === "COMPLETED" ||
          b.expectedTaskRevision !== taskRevision
        )
          return send("Không nộp được bản cũ.", 409, "REVISION_CONFLICT");
        const old = submissions.find((s) => s.id === currentId);
        old.state = "SUPERSEDED";
        const s = {
          ...old,
          id: crypto.randomUUID(),
          versionNumber: submissions.length + 1,
          state: "SUBMITTED",
          revision: 0,
          content: b.content,
          submittedAt: iso(Date.now()),
          files: b.uploadIds.map((id) => uploads.get(id).file),
        };
        submissions.push(s);
        currentId = s.id;
        taskRevision++;
        taskState = "SUBMITTED";
        return send(s, 201);
      }
      match = /^\/task-submissions\/([^/]+)\/files\/([^/]+)\/download$/.exec(p);
      if (method === "GET" && match) {
        const f = submissions
          .find((s) => s.id === match[1])
          ?.files.find((f) => f.id === match[2]);
        if (!f) return send("Không tìm thấy file.", 404);
        return route.fulfill({
          status: 200,
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Disposition": 'attachment; filename="report.pdf"',
            "Cache-Control": "private, no-store",
          },
          body: f.kind === "SOURCE" ? zip : pdf,
        });
      }
      if (method === "GET" && p === "/terms/t1/guidance-dashboard") {
        const data = rows().filter(
          (x) =>
            (!url.searchParams.get("advisorId") ||
              x.advisorId === url.searchParams.get("advisorId")) &&
            (!url.searchParams.get("studentId") ||
              x.studentId === url.searchParams.get("studentId")),
        );
        return send({
          asOf: iso(Date.now()),
          termId: "t1",
          metrics: {
            totalTasks: data.length,
            completed: data.filter((x) => x.status === "COMPLETED").length,
            notSubmitted: data.filter((x) => !x.hasSubmission).length,
            overdue: data.filter((x) => x.isOverdue).length,
            needsResubmission: data.filter(
              (x) => x.status === "REVISION_REQUESTED",
            ).length,
            failed: data.filter((x) => x.decision === "FAIL").length,
            revisionRequired: data.filter(
              (x) => x.decision === "REVISION_REQUIRED",
            ).length,
            pendingReview: data.filter((x) => x.pendingReview).length,
            cancelled: 0,
            legacyUnknown: 0,
          },
          weekly: {
            coverageState: "READY",
            required: 3,
            submitted: 1,
            missing: 2,
            notDue: 0,
            overdue: 2,
            missingPlan: 1,
            missingTask: 1,
            warnings: [],
          },
          tasks: paged(data),
          advisors: [
            { id: "advisor", name: "TS. Trần Bình" },
            { id: "other", name: "GV Nguyễn Hòa" },
          ],
          students: [
            { id: "s2", name: "Nguyễn Văn An", code: "SV02" },
            { id: "s3", name: "Lê Thị Mai", code: "SV03" },
          ],
        });
      }
      if (method === "GET" && p === "/guidance-plans/plan1/meetings")
        return send({
          ...paged(meetings),
          planId: "plan1",
          planRevision,
          proposalId: "p2",
          studentName: "Nguyễn Văn An",
          canCreate: actor === "advisor" && !locked,
          readiness: [],
          data: meetings.map((m) => ({
            ...m,
            canAmend: actor === "advisor" && !locked,
          })),
        });
      if (method === "POST" && p === "/guidance-plans/plan1/meetings") {
        const b = r.postDataJSON();
        if (b.expectedPlanRevision !== planRevision)
          return send("Kế hoạch đã đổi.", 409, "REVISION_CONFLICT");
        const m = {
          id: crypto.randomUUID(),
          planId: "plan1",
          ...b,
          authorUserId: "advisor",
          revision: 0,
          canAmend: true,
          history: [
            {
              id: crypto.randomUUID(),
              actorId: "advisor",
              createdAt: iso(Date.now()),
              reason: "MEETING_RECORDED",
              snapshot: b,
            },
          ],
        };
        meetings.unshift(m);
        planRevision++;
        return send(m, 201);
      }
      match = /^\/guidance-meetings\/([^/]+)$/.exec(p);
      if (method === "PATCH" && match) {
        const b = r.postDataJSON(),
          m = meetings.find((m) => m.id === match[1]);
        if (!m) return send("Không tìm thấy buổi hướng dẫn.", 404);
        if (m.revision !== b.expectedRevision)
          return send("Nhật ký đã đổi.", 409, "REVISION_CONFLICT");
        m.history.unshift({
          id: crypto.randomUUID(),
          actorId: "advisor",
          createdAt: iso(Date.now()),
          reason: b.reason,
          snapshot: {
            before: {
              occurredAt: m.occurredAt,
              mode: m.mode,
              location: m.location,
              discussion: m.discussion,
              conclusion: m.conclusion,
            },
            after: b,
          },
        });
        Object.assign(m, b, { revision: m.revision + 1 });
        planRevision++;
        return send(m);
      }
      if (method === "GET" && p === "/me/notifications")
        return send(paged(actor === "student" ? notifications : []));
      match = /^\/me\/notifications\/([^/]+)\/read$/.exec(p);
      if (method === "POST" && match) {
        const n = notifications.find((n) => n.id === match[1]);
        if (!n || actor !== "student")
          return send("Không tìm thấy thông báo.", 404);
        if (n.status === "UNREAD") {
          n.status = "READ";
          n.readAt = iso(Date.now());
        }
        return send(n);
      }
      return send("API ngoài phạm vi demo 8C.", 404);
    });
    const go = async (route) => page.goto(origin + route);
    if (interactive) {
      if (actor === "student")
        record("sub1", {
          decision: "REVISION_REQUIRED",
          comment: "Bổ sung kiểm thử tích hợp và làm rõ thiết kế.",
        });
      await go(
        actor === "faculty"
          ? "/guidance/progress?termId=t1"
          : actor === "student"
            ? "/guidance/review/sub1"
            : "/guidance/review?termId=t1",
      );
      console.log(
        "Da mo Step 8C DEMO trong Edge. API mock, khong backend/database.",
      );
      console.log(
        "Vai tro " +
          actor +
          ": nhan xet, lich su, nop lai 8B, nhat ky, dashboard va thong bao. Cac menu khac chua gia lap day du.",
      );
      process.once("SIGINT", () => browser.close());
      process.once("SIGTERM", () => browser.close());
      await new Promise((resolve) => {
        page.once("close", resolve);
        browser.once("disconnected", resolve);
      });
      return;
    }
    await go("/guidance/review?termId=t1");
    await expect(
      page.getByRole("link", { name: "Xem lần nộp 1", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Xem lần nộp 1", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Báo cáo tuần 1 DEMO · Lần nộp 1" }),
    ).toBeVisible();
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Tải báo cáo: report.pdf", exact: true })
      .click();
    assert.equal((await download).suggestedFilename(), "report.pdf");
    pass("advisor inbox opens exact submission version and secure download");
    await page
      .getByRole("button", { name: "Ghi nhận đánh giá", exact: true })
      .click();
    assert.equal(reviews.size, 0);
    await page
      .getByLabel("Nhận xét đánh giá")
      .fill("Cần bổ sung kiểm thử tích hợp");
    conflict = true;
    await page
      .getByRole("button", { name: "Ghi nhận đánh giá", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText("Dữ liệu đã thay đổi");
    await expect(page.getByLabel("Nhận xét đánh giá")).toHaveValue(
      "Cần bổ sung kiểm thử tích hợp",
    );
    await page
      .getByRole("button", { name: "Tải phiên bản hiện tại", exact: true })
      .click();
    await page
      .getByLabel("Nhận xét đánh giá")
      .fill("Cần bổ sung kiểm thử tích hợp");
    await page
      .getByRole("button", { name: "Ghi nhận đánh giá", exact: true })
      .click();
    await expect(
      page.getByText("Yêu cầu chỉnh sửa: Cần bổ sung kiểm thử tích hợp", {
        exact: true,
      }),
    ).toBeVisible();
    assert.equal(taskState, "REVISION_REQUESTED");
    pass(
      "required revision comment, frozen revisions, conflict preserves input and explicit reload enables valid review",
    );
    actor = "student";
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Sửa đánh giá có lý do" }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Yêu cầu chỉnh sửa: Cần bổ sung kiểm thử tích hợp", {
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Xem yêu cầu và nộp lại", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Nộp báo cáo và source", exact: true }),
    ).toBeVisible();
    await page.getByLabel("Báo cáo PDF", { exact: true }).setInputFiles({
      name: "v2.pdf",
      mimeType: "application/pdf",
      buffer: pdf,
    });
    await page.getByLabel("Mã nguồn ZIP", { exact: true }).setInputFiles({
      name: "source-v2.zip",
      mimeType: "application/zip",
      buffer: zip,
    });
    await page
      .getByLabel("Nội dung báo cáo bổ sung")
      .fill("v2 đã bổ sung kiểm thử");
    await page
      .getByRole("button", { name: "Tải file lên", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "File đã tải lên staging" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Xác nhận nộp", exact: true })
      .click();
    await expect(page.getByText("Lần nộp 2 · Hiện hành")).toBeVisible();
    assert.equal(submissions.length, 2);
    pass(
      "student reads reviewer request and completes real 8B UI resubmission flow with immutable v1 history",
    );
    actor = "advisor";
    await go("/guidance/review/sub1");
    await expect(
      page.getByText("Đây là bản nộp cũ.", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Sửa đánh giá có lý do" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: /Cần sửa · Kết luận/ }),
    ).toBeVisible();
    await go("/guidance/review/" + currentId);
    await page.getByLabel("Kết quả đánh giá").selectOption("PASS");
    await page
      .getByRole("button", { name: "Ghi nhận đánh giá", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Sửa đánh giá có lý do" }),
    ).toBeVisible();
    assert.equal(taskState, "COMPLETED");
    pass("stale v1 is read-only; PASS on v2 completes canonical task");
    await page.getByRole("button", { name: "Sửa đánh giá có lý do" }).click();
    await page.getByLabel("Kết quả đánh giá").selectOption("FAIL");
    await page.getByLabel("Nhận xét đánh giá").fill("Kết quả chưa đầy đủ");
    await page
      .getByRole("button", { name: "Lưu sửa đánh giá", exact: true })
      .click();
    assert.equal(effective(currentId).decision, "PASS");
    await page.getByLabel("Lý do sửa đánh giá").fill("Đối soát lại chứng cứ");
    await page
      .getByRole("button", { name: "Lưu sửa đánh giá", exact: true })
      .click();
    await expect(
      page.getByText(
        "Báo cáo không đạt; cần làm và nộp lại: Kết quả chưa đầy đủ",
        { exact: true },
      ),
    ).toBeVisible();
    assert.equal(taskState, "REVISION_REQUESTED");
    await page.getByRole("button", { name: "Sửa đánh giá có lý do" }).click();
    await page.getByLabel("Kết quả đánh giá").selectOption("REVISION_REQUIRED");
    await page.getByLabel("Nhận xét đánh giá").fill("Chỉnh cách trình bày");
    await page
      .getByLabel("Lý do sửa đánh giá")
      .fill("Phân loại đúng yêu cầu sửa");
    await page
      .getByRole("button", { name: "Lưu sửa đánh giá", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Không đạt · Đã được sửa" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Đạt · Đã được sửa", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Yêu cầu chỉnh sửa: Chỉnh cách trình bày", {
        exact: true,
      }),
    ).toBeVisible();
    pass(
      "amendment requires reason and preserves separate PASS/FAIL/revision decisions/comments",
    );
    actor = "faculty";
    await go("/guidance/progress?termId=t1");
    await expect(page.locator('[data-metric="Tổng nhiệm vụ"]')).toHaveText("2");
    await expect(page.locator('[data-metric="Cần sửa"]')).toHaveText("1");
    await expect(
      page.getByText("Nghĩa vụ báo cáo tuần (kể cả chưa có task)"),
    ).toBeVisible();
    await page.getByLabel("Lọc GVHD", { exact: true }).selectOption("other");
    await expect(page.locator('[data-metric="Tổng nhiệm vụ"]')).toHaveText("1");
    await expect(page.locator('[data-metric="Cần sửa"]')).toHaveText("0");
    await expect(
      page.getByRole("button", { name: "Ghi nhận đánh giá" }),
    ).toHaveCount(0);
    pass(
      "faculty dashboard has derived metrics, independent missing weeks and advisor filter with no review controls",
    );
    actor = "advisor";
    await go("/guidance/meetings?planId=plan1");
    await page
      .getByLabel("Thời gian buổi hướng dẫn")
      .fill(new Date(now - 3600000 + 7 * 3600000).toISOString().slice(0, 16));
    await page.getByLabel("Nội dung trao đổi").fill("Đã kiểm tra báo cáo");
    await page.getByLabel("Kết luận hướng dẫn").fill("Bổ sung tài liệu");
    await page
      .getByRole("button", { name: "Lưu buổi hướng dẫn", exact: true })
      .click();
    await expect(
      page.getByText("Đã lưu nhật ký và lịch sử hướng dẫn."),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Sửa nhật ký", exact: true })
      .click();
    await page.getByLabel("Kết luận hướng dẫn").fill("Bổ sung bộ test");
    await page
      .getByLabel("Lý do sửa nhật ký")
      .fill("Bổ sung kết luận đã thống nhất");
    await page
      .getByRole("button", { name: "Lưu sửa nhật ký", exact: true })
      .click();
    await expect(
      page.getByText("Kết luận: Bổ sung bộ test", { exact: true }).first(),
    ).toBeVisible();
    assert.equal(meetings[0].history.length, 2);
    assert.equal(
      meetings[0].history[0].snapshot.before.conclusion,
      "Bổ sung tài liệu",
    );
    actor = "student";
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Lưu buổi hướng dẫn" }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Kết luận: Bổ sung bộ test", { exact: true }).first(),
    ).toBeVisible();
    pass(
      "confirmed meeting create/amend preserves prior content and student read-only view",
    );
    await go("/guidance/notifications");
    await expect(
      page.getByRole("heading", { name: "Thông báo của tôi", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Đánh dấu đã đọc" }).first(),
    ).toBeVisible();
    await page.getByRole("button", { name: "Đánh dấu đã đọc" }).first().click();
    await expect(
      page.getByRole("heading", { name: "Cập nhật đánh giá báo cáo · Đã đọc" }),
    ).toBeVisible();
    pass(
      "student receives in-app notice, follows resource links and marks own notification read",
    );
    actor = "advisor";
    await page.setViewportSize({ width: 375, height: 812 });
    await go("/guidance/review/" + currentId);
    await expect(
      page.getByRole("heading", {
        name: "Nhận xét báo cáo tiến độ",
        exact: true,
      }),
    ).toBeVisible();
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    locked = true;
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Sửa đánh giá có lý do" }),
    ).toHaveCount(0);
    pass(
      "mobile view fits viewport; locked phase hides mutation controls while keeping readable history",
    );
    deny = true;
    await page.reload();
    await expect(page.getByRole("alert").first()).toContainText(
      "Không tìm thấy hồ sơ",
    );
    assert.deepEqual(errors, []);
    assert(
      requests
        .filter(
          (r) =>
            ["POST", "PATCH"].includes(r.method) &&
            !r.path.startsWith("/me/notifications"),
        )
        .every((r) => r.key),
    );
    pass(
      "scope errors hide content with no unhandled page errors or missing mutation idempotency keys",
    );
    fs.writeFileSync(
      path.join(root, "../backend/prisma/review/step8c-browser-results.json"),
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
    console.log(checks.length + " Step 8C browser checks passed");
  } finally {
    if (browser) await browser.close();
    vite.kill();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
