import { describe, it, expect } from "vitest";
import { ProposalValidator as V } from "./proposal.validator";
import { LoadedProposal } from "../repository/topic.repository";
const p = (extra: object = {}) =>
  ({
    status: "DRAFT",
    dossier: null,
    versions: [{ version: 2 }],
    ...extra,
  }) as unknown as LoadedProposal;
const content = {
  title: "Đề tài kiểm thử đủ nội dung",
  objectives: "Mục tiêu đủ mười lăm ký tự",
  scope: "Phạm vi đủ mười lăm ký tự",
  technology: "React",
  expected: "Kết quả dự kiến đầy đủ",
  plan: [{ week: "1–2", content: "Khảo sát" }],
};
describe("proposal ownership, immutable versions and handoff", () => {
  it("permits official student/advisor and blocks unrelated identities", () => {
    expect(() =>
      V.owner("S", "L", { student: { id: "S" }, lecturer: null }),
    ).not.toThrow();
    expect(() =>
      V.owner("S", "L", { student: null, lecturer: { id: "L" } }),
    ).not.toThrow();
    expect(() =>
      V.owner("S", "L", { student: { id: "X" }, lecturer: { id: "Y" } }),
    ).toThrow("GVHD");
  });
  it("permits editing drafts and pending submission, blocks finalized/under review", () => {
    expect(() => V.editable(p())).not.toThrow();
    expect(() => V.editable(p({ status: "SUBMITTED" }))).not.toThrow();
    expect(() => V.editable(p({ status: "UNDER_REVIEW" }))).toThrow();
    expect(() => V.editable(p({ dossier: { status: "APPROVED" } }))).toThrow();
  });
  it("detects stale version, accepts current version and first draft", () => {
    expect(() => V.version(null, 0)).not.toThrow();
    expect(() => V.version(p(), 2)).not.toThrow();
    expect(() => V.version(p(), 1)).toThrow();
  });
  it("submission requires confirmed unchanged content and complete structure", () => {
    expect(() => V.submit(content, true)).not.toThrow();
    expect(() => V.submit(content, false)).toThrow("thống nhất");
    expect(() => V.submit({ ...content, plan: [] }, true)).toThrow("kế hoạch");
  });
});
