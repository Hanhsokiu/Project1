import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { createSeed } from "../../../shared/data/seed";
import TermDetailPage from "./TermDetailPage";

const mocks = vi.hoisted(() => ({ workspace: vi.fn(), pending: false }));
vi.mock("../../../shared/hooks/use-workspace", () => ({ useWorkspace: mocks.workspace }));
vi.mock("../../../shared/hooks/use-demo", () => ({
  useAction: () => ({ run: vi.fn(), pending: mocks.pending }),
}));
vi.mock("../../../shared/api/api-session", () => ({ AUTH_API: true }));

describe("term defense transition entry", () => {
  beforeEach(() => { mocks.pending = false; });

  function render(options: { locked?: boolean; permission?: boolean; status?: "IN_PROGRESS" | "DEFENDING" } = {}) {
    const db = createSeed();
    const term = db.terms[0];
    term.status = options.status ?? "IN_PROGRESS";
    term.locked = options.locked ?? false;
    mocks.workspace.mockReturnValue({
      db,
      setTermId: vi.fn(),
      user: { roles: ["FACULTY"], permissions: options.permission === false ? [] : ["term:transition"] },
    });
    return renderToStaticMarkup(
      <MemoryRouter initialEntries={[`/terms/${term.id}`]}>
        <Routes><Route path="/terms/:id" element={<TermDetailPage />} /></Routes>
      </MemoryRouter>,
    );
  }

  function transitionButton(html: string) {
    return html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g)
      ?.find(button => button.includes("Chuyển sang bảo vệ"));
  }

  it("exposes the supported transition for an authorized faculty member", () => {
    const button = transitionButton(render());
    expect(button).toBeDefined();
    expect(button).not.toContain("disabled");
  });

  it.each([
    { locked: true },
    { permission: false },
  ])("prevents transitions when the term or permission blocks editing: %j", options => {
    expect(transitionButton(render(options))).toContain("disabled");
  });

  it("prevents a second transition while a request is pending", () => {
    mocks.pending = true;
    expect(transitionButton(render())).toContain("disabled");
  });

  it("does not expose this transition again or unlock completion in DEFENDING", () => {
    const html = render({ status: "DEFENDING" });
    expect(transitionButton(html)).toBeUndefined();
    expect(html).not.toMatch(/<button\b[^>]*>Hoàn thành<\/button>/);
  });
});
