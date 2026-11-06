import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { csvCell } from "./pages";
import { ReportContent } from "../task-submissions/report-fields";
import { fromVietnamInput, toVietnamInput } from "../guidance-tasks/components";
describe("weekly report presentation", () => {
  it("escapes CSV formulas, quotes and newlines", () => {
    expect(csvCell("=1+1")).toBe('"\'=1+1"');
    expect(csvCell('a"b\nc')).toBe('"a""b\nc"');
    expect(csvCell("  @SUM(A1)")).toContain("'");
  });
  it("round trips Vietnam midnight without browser timezone assumptions", () => {
    expect(new Date(fromVietnamInput("2026-11-05T00:00")).toISOString()).toBe(
      "2026-11-04T17:00:00.000Z",
    );
    expect(toVietnamInput("2026-11-04T17:00:00.000Z")).toBe("2026-11-05T00:00");
  });
  it("renders structured reports as escaped text", () => {
    const html = renderToStaticMarkup(
      <ReportContent value={{ results: "<script>alert(1)</script>" }} />,
    );
    expect(html).toContain("Kết quả đạt được");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
});
