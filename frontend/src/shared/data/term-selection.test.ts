import { describe, expect, it } from "vitest";
import { selectedTerm, termDestination, termLabel } from "./term-selection";

describe("shared term selection", () => {
  const terms = [
    { id: "old", name: "Đợt cũ" },
    { id: "new", name: "Đợt mới" },
  ];
  it("uses the same identity for full term responses and scoped workflow responses", () => {
    expect(
      termLabel({
        id: "new",
        name: "Đợt mới",
        code: "MD01",
        program: "Chính quy",
      }),
    ).toBe(
      termLabel({
        id: "new",
        name: "Đợt mới",
        code: "MD01",
        trainingSystem: { name: "Chính quy" },
      }),
    );
  });
  it("honors a direct URL and never substitutes data for an unavailable term", () => {
    expect(selectedTerm(terms, "new", "old")?.id).toBe("new");
    expect(selectedTerm(terms, "outside", "old")).toBeUndefined();
    expect(selectedTerm(terms, null, "new")?.id).toBe("new");
  });
  it("switches weeks and preserves independent filters while discarding old term references", () => {
    const dest = termDestination(
      "/guidance/weeks",
      "?termId=old&search=abc&periodId=old-week&page=4",
      "new",
    );
    expect(dest.pathname).toBe("/guidance/weeks");
    expect(new URLSearchParams(dest.search).get("termId")).toBe("new");
    expect(new URLSearchParams(dest.search).get("search")).toBe("abc");
    expect(new URLSearchParams(dest.search).has("periodId")).toBe(false);
  });
  it("leaves an old term's detail instead of relabelling it as the new term", () => {
    expect(
      termDestination("/topic/review-assignments/proposal-old", "", "new")
        .pathname,
    ).toBe("/topic/reviews");
    expect(
      termDestination(
        "/guidance/tasks/task-old/submissions",
        "?termId=old",
        "new",
      ).pathname,
    ).toBe("/guidance/tasks");
    expect(
      termDestination("/topic/review-groups/group-old/edit", "", "new")
        .pathname,
    ).toBe("/topic/review-groups");
    expect(termDestination("/terms/old/phases", "", "new").pathname).toBe(
      "/terms/new/phases",
    );
  });
});
