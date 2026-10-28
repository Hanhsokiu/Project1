import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  EligibilityState,
  StageState,
  PolicyEditor,
  OfficialStagePanel,
  workflowInput,
} from "./panels";
import { PublishedRows } from "./published";
import { officialContextFixture } from "./test-fixtures";
vi.mock("../../../shared/api/api-session", () => ({
  getAccessToken: () => "unit-token",
  getApiUser: () => ({ id: "faculty" }),
}));
describe("Official workflow UI states, server render (not browser E2E)", () => {
  it("shows full roster UNKNOWN and exact exclusion reason, not a fabricated admit", () => {
    const c = officialContextFixture();
    const html = renderToStaticMarkup(<EligibilityState context={c} />);
    expect(html).toContain("Sinh viên TEST");
    expect(html).toContain("ACADEMIC_UNKNOWN");
    expect(html).toContain("Không admit");
  });
  it.each(["DRAFT", "FINALIZED", "PUBLISHED"] as const)(
    "shows server %s, revision and source state",
    (state) => {
      const c = officialContextFixture();
      c.stages[2] = {
        ...c.stages[2],
        state,
        revision: 4,
        version: 2,
        sourceCurrent: true,
      };
      const html = renderToStaticMarkup(
        <StageState stage="SCHEDULE" context={c} />,
      );
      expect(html).toContain(state);
      expect(html).toContain("revision 4");
      expect(html).toContain("version");
    },
  );
  it("policy has no invented dates/capacity when absent", () => {
    const c = officialContextFixture();
    c.policy = null;
    c.capabilities.configure = false;
    const html = renderToStaticMarkup(
      <PolicyEditor context={c} busy={false} onSave={() => undefined} />,
    );
    expect(html).toContain("Chọn cấu hình");
    expect(html).toContain("disabled");
    expect(html).not.toContain("2026-");
  });
  it("request token/revision is taken directly from backend context", () => {
    const c = officialContextFixture(),
      input = workflowInput(c, 8);
    expect(input.expectedContext).toBe(c.expectedContext);
    expect(input.expectedRevision).toBe(8);
    expect(input.requestId).toHaveLength(36);
  });
  it("official actions are disabled without server capability or local plan", () => {
    const c = officialContextFixture();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    client.setQueryData(["official-defense", "faculty:unit-token", "term"], c);
    const html = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <OfficialStagePanel
          termId="term"
          stage="SCHEDULE"
          plan={null}
          onLoad={() => undefined}
        />
      </QueryClientProvider>,
    );
    expect(html).toContain("disabled");
    expect(html).toContain("Lưu draft SCHEDULE");
    expect(html).toContain("Công bố lịch");
    expect(html).toContain("chính bản draft đã");
    client.clear();
  });
  it("NOT_PUBLISHED stays empty instead of showing demo students", () => {
    const html = renderToStaticMarkup(
      <PublishedRows
        schedule={{
          termId: "term",
          state: "NOT_PUBLISHED",
          version: null,
          items: [],
        }}
      />,
    );
    expect(html).toContain("NOT_PUBLISHED");
    expect(html).toContain("Không hiển thị draft");
    expect(html).not.toContain("Sinh viên TEST");
  });
  it("renders only rows returned by the scoped publication reader", () => {
    const html = renderToStaticMarkup(
      <PublishedRows
        schedule={{
          termId: "term",
          state: "PUBLISHED",
          version: 2,
          items: [
            {
              key: "slot",
              proposalId: "proposal",
              studentName: "SV được phép xem",
              title: "Đồ án",
              committeeName: "Hội đồng 1",
              roomCode: "P101",
              startsAt: "2026-11-01T02:00:00Z",
              endsAt: "2026-11-01T03:00:00Z",
            },
          ],
        }}
      />,
    );
    expect(html).toContain("SV được phép xem");
    expect(html).toContain("P101");
    expect(html).not.toMatch(/storageKey|checksum|snapshot/);
  });
});
