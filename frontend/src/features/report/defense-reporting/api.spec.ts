import { describe, expect, it, vi } from "vitest";
import {
  reportingApi as api,
  reportingKeys as keys,
  saveReportBlob,
} from "./api";
const client = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("../../../shared/api/http-client", () => ({ httpClient: client }));
describe("UC25 API endpoints and scope cache keys", () => {
  it("global options and scoped statistics/templates/history stay GET-only", async () => {
    client.get.mockResolvedValue({ data: { data: [] } });
    await api.options({});
    expect(client.get).toHaveBeenLastCalledWith("/defense-reports/options", {
      params: {},
    });
    const f = { termId: "t", committeeId: "c" };
    await api.statistics(f);
    expect(client.get).toHaveBeenLastCalledWith("/defense-reports/statistics", {
      params: f,
    });
    await api.templates(f);
    expect(client.get).toHaveBeenLastCalledWith("/defense-reports/templates", {
      params: f,
    });
    await api.history(f);
    expect(client.get).toHaveBeenLastCalledWith("/defense-reports/exports", {
      params: f,
    });
  });
  it("preview and creation use distinct commands; persisted export has idempotency", async () => {
    client.post.mockResolvedValue({ data: { data: {} } });
    const b = {
      filters: { termId: "t" },
      templateCode: "XLSX_STUDENTS" as const,
      templateVersion: "v",
      mode: "DRAFT" as const,
    };
    await api.preview(b);
    expect(client.post).toHaveBeenLastCalledWith(
      "/defense-reports/exports/preview",
      b,
    );
    const command = { ...b, expectedSnapshotHash: "a".repeat(64) };
    await api.create(command, "retry");
    expect(client.post).toHaveBeenLastCalledWith(
      "/defense-reports/exports",
      command,
      { headers: { "Idempotency-Key": "retry" } },
    );
  });
  it("download is authenticated POST with key, encoded ID and blob response", async () => {
    client.post.mockResolvedValue({ data: new Blob(["test"]) });
    await api.download("id/path", "delivery");
    expect(client.post).toHaveBeenLastCalledWith(
      "/defense-reports/exports/id%2Fpath/download",
      {},
      { responseType: "blob", headers: { "Idempotency-Key": "delivery" } },
    );
  });
  it("decodes JSON blob errors instead of treating them as a successful file", async () => {
    client.post.mockRejectedValue({
      response: {
        status: 409,
        data: new Blob([
          JSON.stringify({ error: { message: "Nguồn đã thay đổi" } }),
        ]),
      },
    });
    await expect(api.download("id", "bad")).rejects.toMatchObject({
      response: { data: { error: { message: "Nguồn đã thay đổi" } } },
    });
  });
  it("cache isolation includes actor/role/permissions and filters", () => {
    const f = { termId: "t" };
    expect(keys.statistics("actor/faculty", f)).not.toEqual(
      keys.statistics("actor/member", f),
    );
    expect(keys.templates("actor", f)).not.toEqual(keys.templates("other", f));
    expect(keys.history("actor", f)).not.toEqual(
      keys.history("actor", { termId: "other" }),
    );
    expect(keys.options("actor", {})).not.toEqual(keys.options("actor", f));
  });
  it.each(["../../secret.pdf", "https://public/report.pdf", "uc25-test.exe"])(
    "rejects unsafe filename %s before browser download",
    (filename) => expect(() => saveReportBlob(new Blob(), filename)).toThrow(),
  );
});
