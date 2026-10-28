import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  GradeStatus,
  PublishedGradeRows,
  ResultPreviewRows,
  scoreCommand,
  canSealForm,
  cleanGradeDraft,
  draftForCurrentRubric,
} from "./pages";
import { gradeContextFixture } from "./test-fixtures";
vi.mock("../../../shared/api/api-session", () => ({
  getApiUser: () => ({ id: "test", roles: [] }),
  getAccessToken: () => "token",
}));
describe("Grade frontend states/validation/commands (SSR and pure helpers, not browser E2E)", () => {
  it.each(["ABSENT", "DRAFT", "SEALED", "INVALID"] as const)(
    "shows server state %s",
    (state) => {
      const c = gradeContextFixture();
      c.grade.state = state;
      expect(renderToStaticMarkup(<GradeStatus context={c} />)).toContain(
        state,
      );
    },
  );
  it("warns missing/locked sources without claiming success", () => {
    const c = gradeContextFixture();
    c.window = null;
    c.blockers = ["PDF_CHANGED_SINCE_UC18", "SCORER_NOT_IN_TERM"];
    const html = renderToStaticMarkup(<GradeStatus context={c} />);
    expect(html).toContain("Chưa cấu hình");
    expect(html).toContain("PDF_CHANGED_SINCE_UC18");
  });
  it("no publication means no marks in student HTML", () => {
    const html = renderToStaticMarkup(
      <PublishedGradeRows
        items={[
          {
            configured: false,
            state: "NOT_PUBLISHED",
            proposalId: "mine",
            revision: 0,
            publishedAt: null,
            result: null,
          },
        ]}
      />,
    );
    expect(html).toContain("chưa công bố");
    expect(html).not.toContain("HP:");
  });
  it("published state exposes only the returned result, empty stays empty", () => {
    const html = renderToStaticMarkup(
      <PublishedGradeRows
        items={[
          {
            configured: true,
            state: "PUBLISHED",
            proposalId: "mine",
            revision: 2,
            publishedAt: "2026-11-02",
            result: {
              process: 8,
              committee: 8.25,
              final: 8.15,
              passed: true,
              policyVersion: 1,
            },
          },
        ]}
      />,
    );
    expect(html).toContain("8.15");
    expect(renderToStaticMarkup(<PublishedGradeRows items={[]} />)).toContain(
      "Chưa có hồ sơ",
    );
  });
  it("policy blockers disable publish; missing marks are not rendered as0", () => {
    const html = renderToStaticMarkup(
      <ResultPreviewRows
        items={[
          {
            proposalId: "p",
            studentName: "SV",
            title: "Đồ án",
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
        ]}
        onCommand={() => undefined}
      />,
    );
    expect(html.match(/disabled/g)).toHaveLength(2);
    expect(html).toContain("NEEDS_APPROVAL");
    expect(html).toContain("—");
  });
  it("expectedRevision/context are copied verbatim, no frontend checksum computation", () => {
    const c = gradeContextFixture(),
      b = scoreCommand(c);
    expect(b.expectedContext).toBe(c.expectedContext);
    expect(b.expectedRevision).toBe(c.expectedRevision);
    expect(b.requestId).toHaveLength(36);
  });
  it("seal requires saved complete marks/note/questions and capability", () => {
    const c = gradeContextFixture(),
      d = structuredClone(c.grade.draft!);
    expect(canSealForm(c, d)).toBe(true);
    expect(canSealForm(c, { ...d, comment: "" })).toBe(false);
    expect(canSealForm(c, { ...d, values: {} })).toBe(false);
    expect(canSealForm(c, { ...d, questions: ["Q1"] })).toBe(false);
    c.canSeal = false;
    expect(canSealForm(c, d)).toBe(false);
  });
  it("edits after saving must be saved again before sealing", () => {
    const c = gradeContextFixture(),
      d = structuredClone(c.grade.draft!);
    d.values.A = 9;
    expect(canSealForm(c, d)).toBe(false);
    expect(
      cleanGradeDraft({ ...d, questions: [" Q1 ", "", " Q2 "] }).questions,
    ).toEqual(["Q1", "Q2"]);
  });
  it("loading a changed rubric removes obsolete component keys so a draft can be saved again", () => {
    const c = gradeContextFixture();
    c.grade.draft!.values.OLD = 2;
    expect(draftForCurrentRubric(c).values).toEqual({ A: 8 });
  });
});
