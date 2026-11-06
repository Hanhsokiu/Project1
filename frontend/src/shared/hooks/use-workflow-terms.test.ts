import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import {
  invalidateWorkflowTerms,
  preferredWorkflowTerm,
  type WorkflowTerm,
} from "./use-workflow-terms";

describe("workflow term synchronization", () => {
  const terms: WorkflowTerm[] = [
    { id: "old", name: "Đợt trước", status: "IN_PROGRESS" },
    { id: "new", name: "Đợt Khoa vừa tạo", status: "DRAFT" },
  ];
  it("keeps the selected new term even if the API returns an older term first", () => {
    expect(preferredWorkflowTerm(terms, "new")?.id).toBe("new");
  });
  it("falls back only to a term inside the returned academic scope", () => {
    expect(preferredWorkflowTerm(terms, "outside-scope")?.id).toBe("old");
    expect(preferredWorkflowTerm([], "new")).toBeUndefined();
  });
  it("invalidates every account's workflow term lists and dependent options after a term mutation", async () => {
    const client = new QueryClient();
    const keys = [
      ["review-group-terms", "faculty"],
      ["proposal-review-terms", "faculty"],
      ["proposal-review-terms", "student"],
      ["review-group-options", "new"],
      ["proposal-review-options", "new"],
      ["progress-options"],
    ];
    for (const key of keys) client.setQueryData(key, terms);
    client.setQueryData(["unrelated"], "keep");
    await invalidateWorkflowTerms(client);
    for (const key of keys)
      expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    expect(client.getQueryState(["unrelated"])?.isInvalidated).toBe(false);
    client.clear();
  });
});
