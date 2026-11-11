import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { createSeed } from "../../../shared/data/seed";
import PhasePlanPage from "./PhasePlanPage";
const mocks=vi.hoisted(()=>({workspace:vi.fn()}));
vi.mock("../../../shared/hooks/use-workspace",()=>({useWorkspace:mocks.workspace}));
vi.mock("../../../shared/hooks/use-demo",()=>({useAction:()=>({run:vi.fn(),pending:false})}));
vi.mock("../../../shared/api/api-session",()=>({AUTH_API:true}));
vi.mock("../../../shared/data/snapshot-api",()=>({step1Api:{term:true}}));
describe("plan editing explains time and requires a live change reason",()=>{
  function render(permissions:string[]){
    const db=createSeed(),term=db.terms[0];term.status="IN_PROGRESS";term.locked=false;
    mocks.workspace.mockReturnValue({db,user:{roles:["FACULTY"],permissions}});
    return renderToStaticMarkup(<MemoryRouter initialEntries={[`/terms/${term.id}/phases`]}>
      <Routes><Route path="/terms/:id/phases" element={<PhasePlanPage/>}/></Routes></MemoryRouter>);
  }
  it("requires a reason and preserves sub-minute precision for an authorized planner",()=>{
    const html=render(["term:plan"]);
    expect(html).toMatch(/<textarea[^>]*required=""[^>]*minlength="5"/i);
    expect(html).toContain('step="0.001"');
    expect(html).toContain("UTC+7");
  });
  it("keeps the form read only without term:plan",()=>{
    const html=render([]);
    expect(html).toMatch(/<textarea[^>]*disabled=""/);
    expect(html).toContain("tài khoản thiếu quyền lập kế hoạch");
  });
});
