import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createSeed } from "../../../shared/data/seed";
import { DashboardContent } from "./DashboardPage";
const workspace = vi.hoisted(() => ({ value: { user: { roles: ["STUDENT"] }, termId: "" } }));
vi.mock("../../../shared/hooks/use-workspace", () => ({ useWorkspace: () => workspace.value }));
describe("dashboard before a student has a visible term", () => {
  it.each(["", "unavailable-term"])("keeps the dashboard usable for selection %s without falling back to another term", termId => {
    const db = createSeed(), user = db.accounts.find(a => a.id === "sv1")!;
    workspace.value = { user, termId };
    const html = renderToStaticMarkup(<MemoryRouter><DashboardContent db={db} /></MemoryRouter>);
    expect(html).toContain("Chưa có đợt đồ án");
    expect(html).toContain("trong phạm vi tài khoản");
    expect(html).not.toContain("Xin chào");
  });
});
