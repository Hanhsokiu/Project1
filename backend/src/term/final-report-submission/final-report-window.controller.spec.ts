import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { PERMISSION_KEY } from "../../common/security/require-permission.decorator";
import { CurrentUserPayload } from "../../common/security/current-user.decorator";
import { ZodValidationPipe } from "../../common/validation/zod.pipe";
import { FinalReportWindowController } from "./final-report-window.controller";
import { FinalReportWindowService } from "./final-report-window.service";
import { finalReportWindowPutSchema } from "./final-report-window.dto";

describe("Final report window controller contract", () => {
  it("declares distinct read/plan permissions and the new route", () => {
    expect(Reflect.getMetadata("path", FinalReportWindowController)).toBe(
      "terms/:termId/final-report-submission-window",
    );
    expect(
      Reflect.getMetadata(
        PERMISSION_KEY,
        FinalReportWindowController.prototype.get,
      ),
    ).toEqual({ resource: "term", action: "read" });
    expect(
      Reflect.getMetadata(
        PERMISSION_KEY,
        FinalReportWindowController.prototype.put,
      ),
    ).toEqual({ resource: "term", action: "plan" });
  });
  it("passes the verified actor to both service methods and returns ApiResponse", async () => {
    const data = { configured: false, revision: 0, window: null };
    const service = {
      get: vi.fn().mockResolvedValue(data),
      put: vi.fn().mockResolvedValue(data),
    };
    const controller = new FinalReportWindowController(
      service as unknown as FinalReportWindowService,
    );
    const user = { userId: "verified-user" } as CurrentUserPayload;
    const input = {
      opensAt: "2026-12-01T00:00:00Z",
      closesAt: "2026-12-20T00:00:00Z",
      locked: false,
      expectedRevision: 0,
    };
    expect(await controller.get({ termId: "term-1" }, user)).toMatchObject({
      success: true,
      data,
    });
    expect(
      await controller.put({ termId: "term-1" }, input, user),
    ).toMatchObject({ success: true, data });
    expect(service.get).toHaveBeenCalledWith("verified-user", "term-1");
    expect(service.put).toHaveBeenCalledWith("verified-user", "term-1", input);
  });
  it("uses the existing validation pipe to reject invalid request shapes", () => {
    const pipe = new ZodValidationPipe(finalReportWindowPutSchema);
    expect(() =>
      pipe.transform({ locked: "false", expectedRevision: "0" }),
    ).toThrow();
  });
});
