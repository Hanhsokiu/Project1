import { test, expect, signInFixture } from "./fixtures";

test("real authentication never hydrates old demo marks when grading is disabled", async ({
  page,
  network,
}) => {
  await signInFixture(page, ["FACULTY", "LECTURER"]);
  await page.addInitScript(() => {
    sessionStorage.setItem("utc-thesis-session", "admin");
    localStorage.setItem("utc-thesis-demo-v1", "old-local-marks");
  });
  for (const path of ["reviewer", "committee", "results", "policy"]) {
    await page.goto(`/grading/${path}?termId=browser-term`);
    await expect(
      page.getByText(
        "Chức năng chấm điểm chính thức chưa được bật trong môi trường này.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page.getByText("DỮ LIỆU DEMO — KHÔNG LƯU VÀO HỆ THỐNG CHÍNH THỨC", {
        exact: true,
      }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(() => localStorage.getItem("utc-thesis-demo-v1")),
    ).toBe("old-local-marks");
  }
  expect(network.requests).toEqual([]);
});

test("an old demo session cannot authenticate an API grading route", async ({
  page,
  network,
}) => {
  await page.addInitScript(() =>
    sessionStorage.setItem("utc-thesis-session", "admin"),
  );
  await page.goto("/grading/results");
  await expect(page).toHaveURL(/\/login$/);
  expect(network.requests).toEqual([]);
});
