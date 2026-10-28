import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { PassThrough } from "stream";
import { lastValueFrom, of } from "rxjs";
import type { ExecutionContext } from "@nestjs/common";
import type { Response } from "express";
import {
  FinalReportController,
  FinalReportUploadInterceptor,
  reportIdentity,
} from "./final-report.controller";
import { FinalReportService } from "./final-report.service";
import { finalReportPolicy } from "./final-report-policy";
import { PERMISSION_KEY } from "../../common/security/require-permission.decorator";

const user = {
  userId: "user",
  sub: "user",
  locked: false,
  mustChangePassword: false,
  roles: ["STUDENT"],
  permissions: ["submission:read", "submission:create", "submission:download"],
};
const request = () => ({
  user: { ...user },
  params: { proposalId: "proposal" },
});
const pdf = Buffer.from(
  "%PDF-1.7\n1 0 obj\n<</Type /Catalog>>\nendobj\nstartxref\n0\n%%EOF\n",
);
function multipart(
  parts: Array<{ name: string; filename?: string; value: string | Buffer }>,
) {
  const boundary = "unit-test-boundary";
  const chunks: Buffer[] = [];
  for (const part of parts) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${part.name}"${part.filename ? `; filename="${part.filename}"` : ""}\r\n${part.filename ? "Content-Type: application/pdf\r\n" : ""}\r\n`,
      ),
    );
    chunks.push(
      Buffer.isBuffer(part.value) ? part.value : Buffer.from(part.value),
      Buffer.from("\r\n"),
    );
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return { boundary, bytes: Buffer.concat(chunks) };
}
async function parse(
  parts: Array<{ name: string; filename?: string; value: string | Buffer }>,
  cap = 1024,
) {
  const body = multipart(parts);
  const req = Object.assign(new PassThrough(), request(), {
    method: "PUT",
    headers: {
      "content-type": `multipart/form-data; boundary=${body.boundary}`,
      "content-length": String(body.bytes.length),
    },
  });
  const res = {};
  const ctx = {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as unknown as ExecutionContext;
  const preflight = vi.fn().mockResolvedValue(finalReportPolicy(cap));
  const interceptor = new FinalReportUploadInterceptor({
    preflight,
  } as unknown as FinalReportService);
  req.end(body.bytes);
  const observable = await interceptor.intercept(ctx, {
    handle: () => of(req),
  });
  return {
    req: (await lastValueFrom(observable)) as typeof req & {
      body: Record<string, string>;
      file: Express.Multer.File;
    },
    preflight,
  };
}

describe("Final report HTTP contract and actual in-memory multipart parser", () => {
  it("declares existing RBAC permissions on all four routes", () => {
    const prototype = FinalReportController.prototype;
    for (const [method, action] of [
      [prototype.context, "read"],
      [prototype.detail, "read"],
      [prototype.put, "create"],
      [prototype.download, "download"],
    ] as const) {
      expect(Reflect.getMetadata(PERMISSION_KEY, method)).toEqual({
        resource: "submission",
        action,
      });
    }
  });
  it("checks actor identity and student permission in controller/interceptor", () => {
    expect(reportIdentity(request(), "create")).toBe("user");
    for (const patch of [
      { userId: "different" },
      { locked: true },
      { mustChangePassword: true },
      { roles: ["ADMIN"] },
      { permissions: [] },
    ]) {
      expect(() =>
        reportIdentity({ ...request(), user: { ...user, ...patch } }, "create"),
      ).toThrow();
    }
    expect(() =>
      reportIdentity({ ...request(), user: undefined }, "read"),
    ).toThrow();
  });
  it("accepts exactly one PDF plus expectedRevision and invokes preflight", async () => {
    const { req, preflight } = await parse([
      { name: "expectedRevision", value: "0" },
      { name: "file", filename: "report.pdf", value: pdf },
    ]);
    expect(preflight).toHaveBeenCalledWith("user", "proposal");
    expect(req.file.buffer).toEqual(pdf);
    expect(req.body).toEqual({ expectedRevision: "0" });
  });
  it("rejects two files, unexpected file fields and extra multipart fields", async () => {
    for (const parts of [
      [
        { name: "file", filename: "a.pdf", value: pdf },
        { name: "file", filename: "b.pdf", value: pdf },
      ],
      [{ name: "wrong", filename: "a.pdf", value: pdf }],
      [
        { name: "expectedRevision", value: "0" },
        { name: "actorId", value: "other" },
        { name: "file", filename: "a.pdf", value: pdf },
      ],
    ])
      await expect(parse(parts)).rejects.toMatchObject({ status: 400 });
  });
  it("rejects an oversized PDF before the controller is called", async () => {
    await expect(
      parse([{ name: "file", filename: "a.pdf", value: pdf }], pdf.length - 1),
    ).rejects.toMatchObject({ status: 413 });
  });
  it("fails preflight before allocating or parsing a multipart stream", async () => {
    const preflight = vi.fn().mockRejectedValue(new Error("closed window"));
    const interceptor = new FinalReportUploadInterceptor({
      preflight,
    } as unknown as FinalReportService);
    const req = { ...request(), headers: {} };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
    const handle = vi.fn();
    await expect(interceptor.intercept(ctx, { handle })).rejects.toThrow(
      "closed window",
    );
    expect(handle).not.toHaveBeenCalled();
  });
  it("sends guarded attachment headers and only the verified PDF bytes", async () => {
    const download = vi
      .fn()
      .mockResolvedValue({ name: "Đồ án.pdf", bytes: pdf });
    const controller = new FinalReportController({
      download,
    } as unknown as FinalReportService);
    const response = { set: vi.fn(), send: vi.fn() };
    await controller.download(
      request(),
      "proposal",
      response as unknown as Response,
    );
    expect(download).toHaveBeenCalledWith("user", "proposal");
    expect(response.set).toHaveBeenCalledWith(
      expect.objectContaining({
        "Content-Type": "application/pdf",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Content-Disposition": expect.stringContaining("attachment;"),
      }),
    );
    expect(response.send).toHaveBeenCalledWith(pdf);
  });
});
