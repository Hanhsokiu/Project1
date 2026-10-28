import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  confirmationErrorMessage,
  downloadReport,
  recordDecision,
} from "./actions";
import { contextFixture } from "./test-fixtures";

const api = vi.hoisted(() => ({ put: vi.fn(), download: vi.fn() }));
vi.mock("./api", () => ({ defenseConfirmationApi: api }));
const form = {
  status: "CONFIRMED" as const,
  note: "",
  changeReason: "",
  reviewed: true,
};
beforeEach(() => vi.resetAllMocks());
function lifecycle() {
  return {
    invalidateReview: vi.fn(),
    reload: vi.fn().mockResolvedValue(undefined),
  };
}
describe("UC17 commit/readback and concurrent context changes", () => {
  it.each([true, false])(
    "reloads context, decision and history only after server success (changed=%s)",
    async (changed) => {
      const life = lifecycle(),
        events: string[] = [];
      api.put.mockImplementation(async () => {
        events.push("put");
        return { changed };
      });
      life.invalidateReview.mockImplementation(() => {
        events.push("invalidate");
      });
      life.reload.mockImplementation(async () => {
        events.push("reload all three reads");
      });
      expect(await recordDecision(contextFixture(), form, life)).toEqual({
        changed,
      });
      expect(events).toEqual(["put", "invalidate", "reload all three reads"]);
    },
  );
  it("a 409 invalidates review before refreshing; does not retry until a fresh context is explicitly reviewed", async () => {
    const life = lifecycle(),
      error = Object.assign(new Error("PDF_CONTEXT_CHANGED"), { status: 409 });
    const events: string[] = [];
    let reviewed = true;
    const fresh = contextFixture();
    fresh.expectedContext!.pdf!.revision = 2;
    api.put.mockRejectedValueOnce(error).mockResolvedValue({ changed: true });
    life.invalidateReview.mockImplementation(() => {
      events.push("invalidate");
      reviewed = false;
    });
    life.reload.mockImplementation(async () => {
      events.push("refresh");
    });
    await expect(recordDecision(contextFixture(), form, life)).rejects.toBe(
      error,
    );
    expect(events).toEqual(["invalidate", "refresh"]);
    expect(api.put).toHaveBeenCalledOnce();
    await expect(
      recordDecision(fresh, { ...form, reviewed }, life),
    ).rejects.toThrow("xem lại");
    expect(api.put).toHaveBeenCalledOnce();
    await recordDecision(fresh, { ...form, reviewed: true }, life);
    expect(api.put.mock.calls[1][1].expectedContext.pdf.revision).toBe(2);
    expect(api.put.mock.calls[1][1].expectedContext.pdf.checksum).toBe(
      "a".repeat(64),
    );
  });
  it("a failed conflict refresh keeps the original conflict, without any automatic overwrite", async () => {
    const life = lifecycle(),
      error = Object.assign(new Error("revision"), { status: 409 });
    api.put.mockRejectedValue(error);
    life.reload.mockRejectedValue(new Error("offline"));
    await expect(recordDecision(contextFixture(), form, life)).rejects.toBe(
      error,
    );
    expect(life.invalidateReview).toHaveBeenCalledOnce();
    expect(api.put).toHaveBeenCalledOnce();
  });
  it("does not report unqualified success or retry PUT when readback fails after commit", async () => {
    const life = lifecycle();
    api.put.mockResolvedValue({ changed: true });
    life.reload.mockRejectedValue(new Error("offline"));
    await expect(recordDecision(contextFixture(), form, life)).rejects.toThrow(
      "Backend đã xử lý",
    );
    expect(api.put).toHaveBeenCalledOnce();
    expect(life.invalidateReview).toHaveBeenCalledOnce();
  });
  it.each([400, 401, 403, 404, 422])(
    "propagates failed PUT %i without fake state or success reload",
    async (status) => {
      const life = lifecycle(),
        error = Object.assign(new Error("refused"), { status });
      api.put.mockRejectedValue(error);
      await expect(recordDecision(contextFixture(), form, life)).rejects.toBe(
        error,
      );
      expect(life.reload).not.toHaveBeenCalled();
      expect(api.put).toHaveBeenCalledOnce();
    },
  );
  it("a local permission/readiness failure cannot reach the PUT even for an unchanged note/status", async () => {
    const c = contextFixture();
    c.readiness.confirm.allowed = false;
    await expect(recordDecision(c, form, lifecycle())).rejects.toThrow();
    expect(api.put).not.toHaveBeenCalled();
  });
});
describe("UC17 download and errors", () => {
  it("passes exactly expectedContext.pdf and never records/acknowledges a decision", async () => {
    const c = contextFixture(),
      life = lifecycle(),
      blob = new Blob(["pdf"]);
    api.download.mockResolvedValue(blob);
    expect(await downloadReport(c, life)).toBe(blob);
    expect(api.download).toHaveBeenCalledWith(
      c.proposal.id,
      c.expectedContext!.pdf,
    );
    expect(api.put).not.toHaveBeenCalled();
    expect(life.invalidateReview).not.toHaveBeenCalled();
    expect(life.reload).not.toHaveBeenCalled();
  });
  it("download 409 refreshes/requires review and never silently downloads a newer PDF", async () => {
    const life = lifecycle(),
      error = Object.assign(new Error("stale"), { status: 409 });
    api.download.mockRejectedValue(error);
    await expect(downloadReport(contextFixture(), life)).rejects.toBe(error);
    expect(api.download).toHaveBeenCalledOnce();
    expect(life.invalidateReview).toHaveBeenCalledOnce();
    expect(life.reload).toHaveBeenCalledOnce();
    expect(api.put).not.toHaveBeenCalled();
  });
  it.each(["NOT_SUBMITTED", "LEGACY", "INVALID", "UNVERIFIED"] as const)(
    "cannot download PDF in %s state",
    async (state) => {
      const c = contextFixture();
      c.pdf.state = state;
      await expect(downloadReport(c, lifecycle())).rejects.toThrow(
        "Chưa có PDF",
      );
      expect(api.download).not.toHaveBeenCalled();
    },
  );
  it.each([400, 401, 403, 404, 409, 422])(
    "maps %i to an actionable Vietnamese error",
    (status) => {
      const message = confirmationErrorMessage(
        Object.assign(new Error("raw transport"), { status }),
      );
      expect(message).not.toBe("raw transport");
      if (status === 409) expect(message).toContain("xem lại");
    },
  );
});
