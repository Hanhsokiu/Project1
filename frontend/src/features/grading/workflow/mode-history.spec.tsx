import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { gradingMode } from "./api";
import { GradingDemoBoundary, GradingUnavailable } from "./mode-boundary";
import { HistoryRows } from "./history";

afterEach(() => vi.unstubAllEnvs());
describe("explicit grading mode", () => {
  const flags = ["true", "false", undefined];
  for (const auth of flags)
    for (const grading of flags)
      for (const demo of flags) {
        it(`auth=${auth}, grading=${grading}, demo=${demo}`, () => {
          vi.stubEnv("VITE_AUTH_API", auth);
          vi.stubEnv("VITE_GRADING_API", grading);
          vi.stubEnv("VITE_DEMO_MODE", demo);
          const expected =
            grading === "true"
              ? auth === "true"
                ? "API"
                : "CONFIG_ERROR"
              : auth === "true"
                ? "DISABLED"
                : demo === "true"
                  ? "DEMO"
                  : "DISABLED";
          expect(gradingMode()).toBe(expected);
          const html = renderToStaticMarkup(
            <GradingDemoBoundary>
              <div>old-local-marks</div>
            </GradingDemoBoundary>,
          );
          expect(html.includes("old-local-marks")).toBe(expected === "DEMO");
          if (expected === "DEMO")
            expect(html).toContain(
              "DỮ LIỆU DEMO — KHÔNG LƯU VÀO HỆ THỐNG CHÍNH THỨC",
            );
          else
            expect(html).toContain(
              "Chức năng chấm điểm chính thức chưa được bật trong môi trường này.",
            );
        });
      }
  it("unavailable page has no grading actions", () => {
    const html = renderToStaticMarkup(<GradingUnavailable />);
    expect(html).not.toContain("button");
  });
});
describe("read-only history presentation", () => {
  it("renders empty state", () =>
    expect(renderToStaticMarkup(<HistoryRows items={[]} />)).toContain(
      "Chưa có lịch sử",
    ));
  it("renders only returned metadata, including unknown integrity", () => {
    const html = renderToStaticMarkup(
      <HistoryRows
        items={[
          {
            revision: 1,
            recordedAt: "2026-10-29T00:00:00Z",
            actorUserId: "actor-one",
            contentHash: "hash",
            integrity: "UNKNOWN",
          },
          {
            revision: 2,
            recordedAt: "2026-10-29T01:00:00Z",
            actorUserId: "actor-two",
            state: "PUBLISHED",
            integrity: "VERIFIED",
          },
        ]}
      />,
    );
    for (const value of [
      "Revision 1",
      "actor-one",
      "hash",
      "UNKNOWN",
      "PUBLISHED",
      "actor-two",
    ])
      expect(html).toContain(value);
    expect(html).not.toMatch(/<input|<button|<textarea/);
  });
});
