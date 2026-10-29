import {
  test,
  expect,
  signInFixture,
  gate,
  inboxPath,
  inbox,
  detailPath,
  assignedRow,
  gradeContext,
  fakeActor,
} from "./fixtures";

test("successful login restores a workflow deep link and its term", async ({
  page,
  network,
}) => {
  network.mock("POST", "/api/auth/login", {
    accessToken: "browser-login-token",
    refreshToken: "browser-refresh-token",
    user: fakeActor,
  });
  network.mock("GET", inboxPath, inbox());
  await page.goto("/grading/reviewer?termId=browser-term");
  await page
    .getByPlaceholder("Ví dụ: 221230001 hoặc gv001")
    .fill("browser-test");
  await page.getByPlaceholder("Nhập mật khẩu").fill("test-only");
  await page.getByRole("button", { name: "Đăng nhập hệ thống" }).click();
  await expect(page).toHaveURL(/\/grading\/reviewer\?termId=browser-term$/);
  await expect(
    page.getByText("Không có hồ sơ được phân công chính thức", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".app-shell")).toHaveCount(1);
});

test("UC17–25 share one shell and use only their scoped APIs", async ({
  page,
  network,
}) => {
  await signInFixture(page, ["FACULTY", "LECTURER", "STUDENT", "COMMITTEE"]);
  network.mock("GET", "/api/defense-confirmations/terms", { items: [] });
  network.mock("GET", "/api/defense-lists/terms", { items: [] });
  network.mock("GET", "/api/defense-planning/terms", { items: [] });
  const paths = [
    "/guidance/defense-confirm",
    "/guidance/final-report",
    "/defense/eligibility",
    "/defense/committees",
    "/defense/reviewers",
    "/defense/schedule",
    "/defense/published",
    "/grading/reviewer",
    "/grading/committee",
    "/grading/results",
    "/grading/policy",
    "/report/official",
  ];
  await page.goto(paths[0]);
  for (const path of paths) {
    const nav = page.getByRole("navigation", { name: "Điều hướng chính" });
    await expect(nav.locator(`a[href="${path}"]`)).toHaveCount(1);
    await nav.locator(`a[href="${path}"]`).click();
    await expect(page).toHaveURL(new RegExp(path + "$"));
    await expect(page.locator(".app-shell")).toHaveCount(1);
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page.getByLabel("Tài khoản demo")).toHaveCount(0);
    await expect(page.getByLabel("Đợt làm việc", { exact: true })).toHaveCount(
      0,
    );
    const links = await nav
      .locator("a")
      .evaluateAll((items) => items.map((item) => item.getAttribute("href")));
    expect(new Set(links).size).toBe(links.length);
  }
  expect(
    network.requests.every((request) =>
      [
        "/api/defense-confirmations/terms",
        "/api/defense-lists/terms",
        "/api/defense-planning/terms",
      ].includes(request.path),
    ),
  ).toBe(true);
  expect(
    await page.evaluate(() => sessionStorage.getItem("utc-thesis-session")),
  ).toBe(null);
});

test("workflow role guard rejects faculty-only routes without loading catalogs", async ({
  page,
  network,
}) => {
  await signInFixture(page, ["STUDENT"]);
  await page.goto("/defense/committees");
  await expect(page).toHaveURL(/\/forbidden$/);
  await expect(
    page.getByRole("heading", { name: "403 · Không đủ quyền" }),
  ).toBeVisible();
  await expect(page.locator(".app-shell")).toHaveCount(1);
  await expect(
    page
      .getByRole("navigation", { name: "Điều hướng chính" })
      .locator('a[href="/defense/committees"]'),
  ).toHaveCount(0);
  expect(network.requests).toEqual([]);
});

test("legacy score URL redirects to the canonical page with its term", async ({
  page,
  network,
}) => {
  await signInFixture(page);
  network.mock("GET", inboxPath, inbox());
  await page.goto("/grading/scores?termId=browser-term");
  await expect(page).toHaveURL(/\/grading\/reviewer\?termId=browser-term$/);
  await expect(
    page.getByText("Không có hồ sơ được phân công chính thức", { exact: true }),
  ).toBeVisible();
});

test("mobile workflow navigation closes on Escape and route change", async ({
  page,
  network,
}) => {
  await signInFixture(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/grading/reviewer");
  await page
    .getByRole("button", { name: "Mở điều hướng", exact: true })
    .click();
  await expect(page.locator("aside.sidebar")).toHaveClass(/open/);
  await page.keyboard.press("Escape");
  await expect(page.locator("aside.sidebar")).not.toHaveClass(/open/);
  await expect(
    page.getByRole("button", { name: "Mở điều hướng", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Mở điều hướng", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Điều hướng chính" })
    .locator('a[href="/grading/committee"]')
    .click();
  await expect(page).toHaveURL(/\/grading\/committee$/);
  await expect(page.locator("aside.sidebar")).not.toHaveClass(/open/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(network.requests).toEqual([]);
});

test("step 4–8 workflow and grading use the same navigation", async ({
  page,
  network,
}) => {
  await signInFixture(page, ["FACULTY"]);
  network.mock("GET", "/api/review-group-options/terms", []);
  network.mock("GET", "/api/notifications/me", []);
  await page.goto("/topic/review-groups");
  await expect(page.locator(".app-shell")).toHaveCount(1);
  await page
    .getByRole("navigation", { name: "Điều hướng chính" })
    .locator('a[href="/grading/results"]')
    .click();
  await expect(page).toHaveURL(/\/grading\/results$/);
  await expect(page.locator(".app-shell")).toHaveCount(1);
  await expect(
    page.getByText("Chọn đợt để bắt đầu", { exact: true }),
  ).toBeVisible();
});

test("API mode hides demo account selectors", async ({ page }) => {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Chào mừng trở lại!" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Quản trị viên", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("KHÔNG GIAN DEMO · BƯỚC 1–3")).toHaveCount(0);
});
test("empty required login fields block submission before any HTTP request", async ({
  page,
  network,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Đăng nhập hệ thống" }).click();
  expect(
    await page
      .locator("input[autocomplete=username]")
      .evaluate((input: HTMLInputElement) => input.validity.valueMissing),
  ).toBe(true);
  expect(network.requests).toEqual([]);
});
test("login401 displays API error and never creates a demo session", async ({
  page,
  network,
}) => {
  network.error(
    "POST",
    "/api/auth/login",
    401,
    "INVALID_CREDENTIALS",
    "Browser mock: invalid credentials",
  );
  await page.goto("/login");
  await page
    .getByPlaceholder("Ví dụ: 221230001 hoặc gv001")
    .fill("not-a-real-user");
  await page
    .getByPlaceholder("Nhập mật khẩu")
    .fill("test-only-not-a-real-password");
  await page.getByRole("button", { name: "Đăng nhập hệ thống" }).click();
  await expect(
    page.getByText("Browser mock: invalid credentials", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => sessionStorage.getItem("utc-thesis-session")),
  ).toBe(null);
  expect(network.requests.filter((r) => r.method === "POST")).toHaveLength(1);
});
test("login shows loading and disables duplicate submit until API finishes", async ({
  page,
  network,
}) => {
  const pending = gate();
  network.handle("POST", "/api/auth/login", async (route) => {
    await pending.promise;
    await route.fulfill({
      status: 401,
      json: {
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Browser delayed rejection",
        },
      },
    });
  });
  await page.goto("/login");
  await page
    .getByPlaceholder("Ví dụ: 221230001 hoặc gv001")
    .fill("browser-test");
  await page.getByPlaceholder("Nhập mật khẩu").fill("test-only");
  await page.getByRole("button", { name: "Đăng nhập hệ thống" }).click();
  try {
    await expect(
      page.getByRole("button", { name: "Đang đăng nhập…" }),
    ).toBeDisabled();
  } finally {
    pending.release();
  }
  await expect(
    page.getByText("Browser delayed rejection", { exact: true }),
  ).toBeVisible();
});
test("grading navigation retains real API mode and term query", async ({
  page,
  network,
}) => {
  await signInFixture(page);
  network.mock("GET", inboxPath, inbox());
  await page.goto("/grading/reviewer?termId=browser-term");
  await expect(
    page.getByText("Không có hồ sơ được phân công chính thức", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Hội đồng", exact: true }).click();
  await expect(page).toHaveURL(/\/grading\/committee\?termId=browser-term$/);
  await expect(
    page.getByText(
      "Dữ liệu API thật, theo phân công/permission/grant hiện hành.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(network.requests.length).toBeGreaterThanOrEqual(2);
});
test("empty term validation does not send an inbox request", async ({
  page,
  network,
}) => {
  await signInFixture(page);
  await page.goto("/grading/reviewer");
  await page.getByRole("button", { name: "Đọc dữ liệu đợt" }).click();
  const input = page.getByLabel("ID đợt tốt nghiệp");
  expect(
    await input.evaluate(
      (node: HTMLInputElement) => node.validity.valueMissing,
    ),
  ).toBe(true);
  await expect(
    page.getByText("Chọn đợt để bắt đầu", { exact: true }),
  ).toBeVisible();
  expect(network.requests).toEqual([]);
});
test("inbox loading becomes empty only after the mocked response", async ({
  page,
  network,
}) => {
  await signInFixture(page);
  const pending = gate();
  network.handle("GET", inboxPath, async (route) => {
    await pending.promise;
    await route.fulfill({ json: { data: inbox() } });
  });
  await page.goto("/grading/reviewer?termId=browser-term");
  try {
    await expect(
      page.getByText("Đang đọc phân công chính thức…", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Không có hồ sơ được phân công chính thức", {
        exact: true,
      }),
    ).toHaveCount(0);
  } finally {
    pending.release();
  }
  await expect(
    page.getByText("Không có hồ sơ được phân công chính thức", { exact: true }),
  ).toBeVisible();
});
test("API403 explains permission/grant without displaying demo rows", async ({
  page,
  network,
}) => {
  await signInFixture(page);
  network.error(
    "GET",
    inboxPath,
    403,
    "GRADING_FORBIDDEN",
    "Denied by browser mock",
  );
  await page.goto("/grading/reviewer?termId=browser-term");
  await expect(
    page.getByText("403 — Không có permission, grant hoặc phân công phù hợp.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("Browser Student", { exact: false })).toHaveCount(
    0,
  );
  expect(network.requests.every((r) => r.method === "GET")).toBe(true);
});
test("API401 clears the API session and redirects to the shared login", async ({
  page,
  network,
}) => {
  await signInFixture(page);
  network.error(
    "GET",
    inboxPath,
    401,
    "UNAUTHENTICATED",
    "Expired test-only session",
  );
  await page.goto("/grading/reviewer?termId=browser-term");
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Chào mừng trở lại!" }),
  ).toBeVisible();
  await expect(page.locator(".app-shell")).toHaveCount(0);
  expect(
    network.requests.filter((request) => request.path === inboxPath),
  ).toHaveLength(1);
  expect(
    await page.evaluate(() => sessionStorage.getItem("utc-api-access")),
  ).toBe(null);
  expect(
    await page.evaluate(() => sessionStorage.getItem("utc-thesis-session")),
  ).toBe(null);
});
test("network failure stays an API error with no mock fallback", async ({
  page,
  network,
}) => {
  await signInFixture(page);
  network.handle("GET", inboxPath, (route) => route.abort("failed"));
  await page.goto("/grading/reviewer?termId=browser-term");
  await expect(page.getByText(/Không kết nối được máy chủ/)).toBeVisible();
  await expect(
    page.getByText("Không có hồ sơ được phân công chính thức", { exact: true }),
  ).toHaveCount(0);
});
test("own assigned context is shown using API revision and no automatic save", async ({
  page,
  network,
}) => {
  await prepareDetail(page, network);
  await expect(
    page.getByRole("heading", {
      name: "Browser Student · Browser-only thesis",
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Phiếu: DRAFT · Revision 1", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Tải PDF đúng revision context" }),
  ).toBeDisabled();
  expect(network.requests.every((r) => r.method === "GET")).toBe(true);
});
test("out-of-range score is rejected locally without a PUT", async ({
  page,
  network,
}) => {
  await prepareDetail(page, network);
  await page
    .getByRole("button", { name: "Nạp phiếu, đã xem lại nguồn hiện hành" })
    .click();
  await page.getByLabel("Browser criterion (0–10)").fill("11");
  expect(
    await page
      .getByLabel("Browser criterion (0–10)")
      .evaluate((input: HTMLInputElement) => input.validity.rangeOverflow),
  ).toBe(true);
  await page.getByRole("button", { name: "Lưu draft vào backend" }).click();
  await expect(page.getByText(/too_big/)).toBeVisible();
  expect(network.requests.filter((r) => r.method === "PUT")).toHaveLength(0);
});
test("409 context conflict requires another explicit review, with no automatic retry", async ({
  page,
  network,
}) => {
  await prepareDetail(page, network);
  await page
    .getByRole("button", { name: "Nạp phiếu, đã xem lại nguồn hiện hành" })
    .click();
  network.handle("PUT", `${detailPath}/draft`, async (route) => {
    expect(route.request().headers().authorization).toBe(
      "Bearer browser-test-token-not-a-real-jwt",
    );
    expect(route.request().postDataJSON()).toMatchObject({
      expectedRevision: 1,
      expectedContext: "1".repeat(64),
    });
    network.mock("GET", detailPath, gradeContext(2));
    await route.fulfill({
      status: 409,
      json: {
        error: {
          code: "GRADING_CONTEXT_CHANGED",
          message: "Context changed in browser mock",
        },
      },
    });
  });
  await page.getByRole("button", { name: "Lưu draft vào backend" }).click();
  await expect(page.getByText(/409 — Nguồn, revision/)).toBeVisible();
  await expect(
    page.getByText("Phiếu: DRAFT · Revision 2", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Lưu draft vào backend" }),
  ).toHaveCount(0);
  expect(network.requests.filter((r) => r.method === "PUT")).toHaveLength(1);
});
test("UC17 API inbox can be empty without inserting a demo proposal", async ({
  page,
  network,
}) => {
  await signInFixture(page);
  network.mock("GET", "/api/defense-confirmations/terms", { items: [] });
  await page.goto("/guidance/defense-confirm");
  await expect(
    page.getByRole("heading", { name: "Xác nhận bảo vệ UC17", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Chưa có đợt trong phạm vi", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Chọn hồ sơ thực để xem UC17", { exact: true }),
  ).toBeVisible();
});

test("policy history is lazy, paginated, read-only and hides cached rows after forbidden", async ({
  page,
  network,
}) => {
  await signInFixture(page, ["FACULTY"]);
  const path = "/api/terms/browser-term/grading/policy";
  network.mock("GET", path, {
    termId: "browser-term",
    configured: false,
    revision: 0,
    config: null,
    expectedContext: "a".repeat(64),
    needsApproval: [],
  });
  const pending = gate();
  network.handle("GET", `${path}/history`, async (route) => {
    const after = Number(
      new URL(route.request().url()).searchParams.get("afterRevision"),
    );
    expect(new URL(route.request().url()).searchParams.get("limit")).toBe("25");
    await pending.promise;
    await route.fulfill({
      json: {
        data: {
          items: [
            {
              revision: after + 1,
              recordedAt: "2026-10-29T00:00:00.000Z",
              actorUserId: after ? "second-actor" : "first-actor",
              contentHash: "b".repeat(64),
              integrity: "UNKNOWN",
            },
          ],
          nextRevision: after ? null : 25,
        },
      },
    });
  });
  await page.goto("/grading/policy?termId=browser-term");
  const history = page
    .locator("details")
    .filter({ has: page.locator("summary", { hasText: "Lịch sử thay đổi" }) });
  await expect(history).toBeVisible();
  expect(network.requests.some((r) => r.path.endsWith("/history"))).toBe(false);
  await history.locator("summary").click();
  await expect(history.getByRole("status")).toBeVisible();
  pending.release();
  await expect(history.getByText(/first-actor/)).toBeVisible();
  await expect(history.locator("input, textarea, select")).toHaveCount(0);
  await history.getByRole("button", { name: "Trang lịch sử tiếp" }).click();
  await expect(history.getByText(/second-actor/)).toBeVisible();
  await expect(history.getByText(/first-actor/)).toHaveCount(0);
  network.error(
    "GET",
    `${path}/history`,
    403,
    "FORBIDDEN",
    "Permission revoked",
  );
  await history.getByRole("button", { name: "Tải lại lịch sử" }).click();
  await expect(history.getByText(/403/)).toBeVisible();
  await expect(history.getByText(/second-actor/)).toHaveCount(0);
  network.mock("GET", `${path}/history`, { items: [], nextRevision: null });
  await history.getByRole("button", { name: "Tải lại lịch sử" }).click();
  await expect(
    history.getByText("Chưa có lịch sử thay đổi", { exact: true }),
  ).toBeVisible();
  expect(network.requests.every((r) => r.method === "GET")).toBe(true);
});

test("faculty result history shows only server metadata without enabling publication", async ({
  page,
  network,
}) => {
  await signInFixture(page, ["FACULTY"]);
  network.mock("GET", "/api/terms/browser-term/grading/results/preview", {
    items: [
      {
        proposalId: "browser-proposal",
        studentName: "History Student",
        title: "History thesis",
        state: "ABSENT",
        revision: 0,
        expectedContext: "a".repeat(64),
        blockers: ["CALCULATION_POLICY_NEEDS_APPROVAL"],
        process: null,
        committee: null,
        final: null,
        passed: null,
        canSeal: false,
        canPublish: false,
      },
    ],
  });
  network.mock(
    "GET",
    "/api/terms/browser-term/grading/results/browser-proposal/history",
    {
      items: [
        {
          revision: 1,
          recordedAt: "2026-10-29T00:00:00.000Z",
          actorUserId: "history-actor",
          integrity: "VERIFIED",
          state: "SEALED",
        },
      ],
      nextRevision: null,
    },
  );
  await page.goto("/grading/results?termId=browser-term");
  await page.locator("summary", { hasText: "Lịch sử kết quả" }).click();
  await expect(page.getByText(/history-actor/)).toBeVisible();
  await expect(page.getByText("Trạng thái: Đã chốt (SEALED)")).toBeVisible();
  await expect(page.getByRole("button", { name: /Công bố/ })).toBeDisabled();
  expect(network.requests.every((r) => r.method === "GET")).toBe(true);
});

test("students never request unpublished result history", async ({
  page,
  network,
}) => {
  await signInFixture(page, ["STUDENT"]);
  network.mock("GET", "/api/terms/browser-term/grading/my-results", {
    items: [
      {
        configured: false,
        state: "NOT_PUBLISHED",
        proposalId: "mine",
        revision: 0,
        publishedAt: null,
        result: null,
      },
    ],
  });
  await page.goto("/grading/results?termId=browser-term");
  await expect(page.getByText(/chưa công bố/)).toBeVisible();
  await expect(
    page.locator("summary", { hasText: "Lịch sử kết quả" }),
  ).toHaveCount(0);
  expect(network.requests.map((r) => r.path)).toEqual([
    "/api/terms/browser-term/grading/my-results",
  ]);
});

async function prepareDetail(
  page: Parameters<typeof signInFixture>[0],
  network: import("./fixtures").MockNetwork,
) {
  await signInFixture(page);
  network.mock("GET", inboxPath, inbox([assignedRow]));
  network.mock("GET", detailPath, gradeContext());
  network.mock("GET", `${detailPath}/history`, {
    items: [],
    nextRevision: null,
  });
  await page.goto("/grading/reviewer?termId=browser-term");
  await page
    .getByRole("button", { name: /Browser Student · Browser-only thesis/ })
    .click();
}
