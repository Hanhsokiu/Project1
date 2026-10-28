import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import { finalReportErrorMessage, uploadFinalReport } from "./actions";
import { contextFixture, pdfFixture, reportFixture } from "./test-fixtures";

const api = vi.hoisted(() => ({ upload: vi.fn() }));
vi.mock("./api", () => ({ finalReportApi: api }));
beforeEach(() => vi.resetAllMocks());
const lifecycle = () => ({
  invalidate: vi.fn(),
  reload: vi.fn().mockResolvedValue(undefined),
});

describe("final PDF upload/reupload workflow", () => {
  it.each([0, 1])(
    "uploads first/replacement PDF at revision %i then invalidates selection and reloads",
    async (revision) => {
      const life = lifecycle(),
        events: string[] = [],
        file = pdfFixture();
      api.upload.mockImplementation(async () => {
        events.push("put");
        return reportFixture(revision + 1);
      });
      life.invalidate.mockImplementation(() => {
        events.push("invalidate");
      });
      life.reload.mockImplementation(async () => {
        events.push("reload context and metadata");
      });
      expect(
        await uploadFinalReport(
          contextFixture(revision),
          reportFixture(revision),
          file,
          life,
        ),
      ).toEqual(reportFixture(revision + 1));
      expect(events).toEqual([
        "put",
        "invalidate",
        "reload context and metadata",
      ]);
      expect(api.upload).toHaveBeenCalledWith(
        "proposal-pdf",
        file,
        revision,
        undefined,
      );
    },
  );
  it("reuploads after GVHD CONFIRMED without sending or changing UC17 fields", async () => {
    const c = Object.assign(contextFixture(3), {
      uc17: { status: "CONFIRMED", revision: 4 },
    });
    const decisionBefore = JSON.stringify(c.uc17);
    const file = pdfFixture();
    api.upload.mockResolvedValue(reportFixture(4));
    await uploadFinalReport(c, reportFixture(3), file, lifecycle());
    expect(api.upload).toHaveBeenCalledWith(
      "proposal-pdf",
      file,
      c.expectedRevision,
      undefined,
    );
    expect(JSON.stringify(c.uc17)).toBe(decisionBefore);
  });
  it("passes backend expectedRevision unchanged and does not mutate prior metadata optimistically", async () => {
    const c = contextFixture(4),
      metadata = reportFixture(4),
      before = JSON.stringify(metadata),
      file = pdfFixture();
    api.upload.mockResolvedValue(reportFixture(5));
    await uploadFinalReport(c, metadata, file, lifecycle());
    expect(api.upload.mock.calls[0][2]).toBe(c.expectedRevision);
    expect(JSON.stringify(metadata)).toBe(before);
  });
  it("409 clears selection and blocks further upload until an explicit successful reload; no automatic retry", async () => {
    const life = lifecycle(),
      error = Object.assign(new Error("REVISION_CONFLICT"), { status: 409 });
    api.upload.mockRejectedValue(error);
    await expect(
      uploadFinalReport(contextFixture(), reportFixture(), pdfFixture(), life),
    ).rejects.toBe(error);
    expect(life.invalidate).toHaveBeenCalledOnce();
    expect(life.reload).not.toHaveBeenCalled();
    expect(api.upload).toHaveBeenCalledOnce();
  });
  it("does not reach upload when separately read context/metadata revisions differ", async () => {
    await expect(
      uploadFinalReport(
        contextFixture(),
        reportFixture(1),
        pdfFixture(),
        lifecycle(),
      ),
    ).rejects.toThrow("tải lại");
    expect(api.upload).not.toHaveBeenCalled();
  });
  it("does not reach upload while the independent window is closed/missing", async () => {
    const c = contextFixture();
    c.window = null;
    await expect(
      uploadFinalReport(c, reportFixture(), pdfFixture(), lifecycle()),
    ).rejects.toThrow("cửa sổ");
    expect(api.upload).not.toHaveBeenCalled();
  });
  it("does not reach upload for invalid file selection", async () => {
    await expect(
      uploadFinalReport(
        contextFixture(),
        reportFixture(),
        pdfFixture("bad.txt"),
        lifecycle(),
      ),
    ).rejects.toThrow("Chỉ nhận");
    expect(api.upload).not.toHaveBeenCalled();
  });
  it.each([400, 401, 403, 404, 413, 422])(
    "propagates rejection %s and preserves the visible prior report",
    async (status) => {
      const c = contextFixture(1),
        metadata = reportFixture(1),
        life = lifecycle(),
        before = JSON.stringify(metadata);
      const error = Object.assign(new Error("refused"), { status });
      api.upload.mockRejectedValue(error);
      await expect(
        uploadFinalReport(c, metadata, pdfFixture(), life),
      ).rejects.toBe(error);
      expect(JSON.stringify(metadata)).toBe(before);
      expect(life.reload).not.toHaveBeenCalled();
      expect(api.upload).toHaveBeenCalledOnce();
    },
  );
  it.each([undefined, 500])(
    "treats network/server failure %s as ambiguous and requires reload, without retry",
    async (status) => {
      const life = lifecycle();
      api.upload.mockRejectedValue(
        Object.assign(new Error("offline"), { status }),
      );
      await expect(
        uploadFinalReport(
          contextFixture(),
          reportFixture(),
          pdfFixture(),
          life,
        ),
      ).rejects.toThrow("Chưa xác định");
      expect(life.invalidate).toHaveBeenCalledOnce();
      expect(life.reload).not.toHaveBeenCalled();
      expect(api.upload).toHaveBeenCalledOnce();
    },
  );
  it("does not claim full UI success or resend when readback fails after commit", async () => {
    const life = lifecycle();
    api.upload.mockResolvedValue(reportFixture(1));
    life.reload.mockRejectedValue(new Error("offline"));
    await expect(
      uploadFinalReport(contextFixture(), reportFixture(), pdfFixture(), life),
    ).rejects.toThrow("Backend đã nhận PDF");
    expect(life.invalidate).toHaveBeenCalledOnce();
    expect(api.upload).toHaveBeenCalledOnce();
  });
});
describe("final PDF actionable errors", () => {
  it.each([400, 401, 403, 404, 409, 413, 422])(
    "maps HTTP %s to a user-facing error",
    (status) => {
      expect(
        finalReportErrorMessage(
          Object.assign(new Error("raw error"), { status }),
        ),
      ).not.toBe("raw error");
    },
  );
  it("does not expose schema parsing details or invent success for a network error", () => {
    expect(finalReportErrorMessage(new ZodError([]))).toContain("hợp đồng");
    expect(
      finalReportErrorMessage(new Error("Không kết nối được máy chủ")),
    ).toContain("Không kết nối");
  });
});
