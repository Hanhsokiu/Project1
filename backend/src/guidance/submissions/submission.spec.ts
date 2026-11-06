import { describe, it, expect, vi } from "vitest";
import { ConfigService } from "@nestjs/config";
import { HttpException } from "@nestjs/common";
import { SubmissionValidator, crc32 } from "./submission.validator";
import { SubmissionService } from "./submission.service";
import {
  approvedSubmissionPolicy as p,
  readSubmissionPolicy,
} from "./submission-policy";
import { TaskSubmissionCreateSchema } from "@doan/shared";
import { GuidanceTaskRecord } from "../tasks/guidance.repository";
const v = new SubmissionValidator();
function zip(name = "src/main.ts", text = "export const source = true;") {
  const n = Buffer.from(name),
    b = Buffer.from(text),
    crc = crc32(b),
    local = Buffer.alloc(30),
    central = Buffer.alloc(46),
    end = Buffer.alloc(22);
  local.writeUInt32LE(0x04034b50);
  local.writeUInt16LE(20, 4);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(b.length, 18);
  local.writeUInt32LE(b.length, 22);
  local.writeUInt16LE(n.length, 26);
  central.writeUInt32LE(0x02014b50);
  central.writeUInt16LE(20, 6);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(b.length, 20);
  central.writeUInt32LE(b.length, 24);
  central.writeUInt16LE(n.length, 28);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + n.length, 12);
  end.writeUInt32LE(local.length + n.length + b.length, 16);
  return Buffer.concat([local, n, b, central, n, end]);
}
const pdf = Buffer.from(
  "%PDF-1.7\n1 0 obj\n<</Type /Catalog>>\nendobj\nstartxref\n0\n%%EOF\n",
);
const file = (name: string, mime: string, b: Buffer) =>
  ({
    originalname: name,
    mimetype: mime,
    buffer: b,
    size: b.length,
  }) as Express.Multer.File;
const fail = (fn: () => unknown, code: string) => {
  try {
    fn();
    throw Error("expected failure");
  } catch (e) {
    expect(e).toBeInstanceOf(HttpException);
    expect((e as HttpException).getResponse()).toMatchObject({
      error: { code },
    });
  }
};
describe("8B submission rules and file screening", () => {
  it("validates approved configuration and rejects unsupported format or unbounded limits", () => {
    expect(readSubmissionPolicy().policyId).toBe(p.policyId);
    expect(() =>
      readSubmissionPolicy(JSON.stringify({ ...p, maxFileBytes: 0 })),
    ).toThrow();
    expect(() =>
      readSubmissionPolicy(
        JSON.stringify({
          ...p,
          roles: { ...p.roles, SOURCE: { extensions: ["exe"], maxFiles: 1 } },
        }),
      ),
    ).toThrow();
  });
  it("accepts Vietnamese safe filename; rejects path, controls and Windows reserved names", () => {
    expect(v.filename("Báo cáo tuần 1.pdf")).toBe("Báo cáo tuần 1.pdf");
    for (const n of [
      "../x.pdf",
      "C:\\x.pdf",
      "CON.pdf",
      "x\n.pdf",
      "x.pdf.",
      "x\u202epdf",
    ])
      fail(() => v.filename(n), "FILE_NAME_INVALID");
  });
  it("validates PDF envelope/MIME and rejects empty, spoofed and active-action files", () => {
    expect(
      v.file("REPORT", file("r.pdf", "application/pdf", pdf), p).checksum,
    ).toHaveLength(64);
    for (const f of [
      file("r.pdf", "text/plain", pdf),
      file("r.pdf", "application/pdf", Buffer.from("not pdf")),
      file("r.pdf", "application/pdf", Buffer.alloc(0)),
      file(
        "r.pdf",
        "application/pdf",
        Buffer.from(
          pdf.toString().replace("Catalog", "Catalog /OpenAction 3 0 R"),
        ),
      ),
    ])
      fail(() => v.file("REPORT", f, p), "FILE_TYPE_INVALID");
  });
  it("enforces exact byte limit and role extension allowlist", () => {
    const f = file("r.pdf", "application/pdf", pdf);
    expect(
      v.file("REPORT", f, { ...p, maxFileBytes: pdf.length }).sizeBytes,
    ).toBe(pdf.length);
    fail(
      () => v.file("REPORT", f, { ...p, maxFileBytes: pdf.length - 1 }),
      "FILE_TOO_LARGE",
    );
    fail(() => v.file("SOURCE", f, p), "FILE_TYPE_INVALID");
  });
  it("accepts intact ZIP; rejects traversal, corruption, encryption and expanded-byte bombs", () => {
    expect(
      v.file("SOURCE", file("source.zip", "application/zip", zip()), p).kind,
    ).toBe("SOURCE");
    for (const b of [
      zip("../secret"),
      zip("/root"),
      zip("a\\b"),
      zip("a:drive"),
    ])
      fail(
        () => v.file("SOURCE", file("s.zip", "application/zip", b), p),
        "FILE_TYPE_INVALID",
      );
    const corrupt = zip();
    corrupt[40] ^= 1;
    fail(
      () => v.file("SOURCE", file("s.zip", "application/zip", corrupt), p),
      "FILE_TYPE_INVALID",
    );
    const encrypted = zip();
    encrypted.writeUInt16LE(1, 6);
    fail(
      () => v.file("SOURCE", file("s.zip", "application/zip", encrypted), p),
      "FILE_TYPE_INVALID",
    );
    fail(
      () =>
        v.file("SOURCE", file("s.zip", "application/zip", zip()), {
          ...p,
          zipMaxExpandedBytes: 1,
        }),
      "FILE_TYPE_INVALID",
    );
  });
  it("image evidence checks structural bytes, not only filename or MIME", () => {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
      "base64",
    );
    // Generate a CRC-correct IDAT to avoid accepting invalid example bytes.
    let i = 8;
    while (i < png.length) {
      const size = png.readUInt32BE(i);
      png.writeUInt32BE(crc32(png.subarray(i + 4, i + 8 + size)), i + 8 + size);
      i += 12 + size;
    }
    expect(
      v.file("EVIDENCE", file("e.png", "image/png", png), p).mimeType,
    ).toBe("image/png");
    png[20] ^= 1;
    fail(
      () => v.file("EVIDENCE", file("e.png", "image/png", png), p),
      "FILE_TYPE_INVALID",
    );
    fail(
      () =>
        v.file(
          "EVIDENCE",
          file("e.jpg", "image/jpeg", Buffer.from("fakejpeg")),
          p,
        ),
      "FILE_TYPE_INVALID",
    );
  });
  it("allows open submission states and rejects completed/cancelled/unknown legacy metadata", () => {
    const t = {
      guidancePlanId: "p",
      pr2bTaskWorkflowTaskId: {
        kind: "AD_HOC",
        state: "TODO",
        startsAt: new Date(),
        periodId: "w",
        planId: "p",
        nextSubmissionNumber: 1,
      },
    } as unknown as GuidanceTaskRecord;
    expect(v.task(t).state).toBe("TODO");
    for (const state of ["COMPLETED", "CANCELLED", null])
      fail(
        () =>
          v.task({
            ...t,
            pr2bTaskWorkflowTaskId: { ...t.pr2bTaskWorkflowTaskId!, state },
          } as GuidanceTaskRecord),
        state ? "STATE_TRANSITION_INVALID" : "INPUT_NOT_READY",
      );
  });
  it("deadline equality is on-time; +1ms is late without rejecting submission", () => {
    const d = new Date("2026-10-22T01:00:00Z");
    expect(v.late(new Date(d), d)).toBe(false);
    expect(v.late(new Date(+d + 1), d)).toBe(true);
  });
  it("strict commit accepts references/revision only and rejects duplicate IDs/forged owner", () => {
    const input = {
      expectedTaskRevision: 0,
      uploadIds: [
        "00000000-0000-4000-8000-000000000001",
        "00000000-0000-4000-8000-000000000002",
      ],
    };
    expect(TaskSubmissionCreateSchema.safeParse(input).success).toBe(true);
    expect(
      TaskSubmissionCreateSchema.safeParse({ ...input, studentId: "other" })
        .success,
    ).toBe(false);
    expect(
      TaskSubmissionCreateSchema.safeParse({
        ...input,
        uploadIds: [input.uploadIds[0], input.uploadIds[0]],
      }).success,
    ).toBe(false);
  });
});
describe("8B service denial and operational policy", () => {
  const service = (repo: unknown, guidance: unknown, storage: unknown) =>
    new SubmissionService(
      repo as never,
      guidance as never,
      {} as never,
      {} as never,
      v,
      storage as never,
      new ConfigService({ GUIDANCE_UPLOAD_ENABLED: "true" }),
    );
  it("scope denial runs before private IO and leaves no staging intent", async () => {
    const add = vi.fn(),
      save = vi.fn(),
      s = service(
        {
          transaction: (fn: (s: unknown) => unknown) => fn({ addUpload: add }),
        },
        {
          submissionAccess: async () => {
            throw new HttpException("Forbidden", 404);
          },
        },
        { savePrivateGuidance: save },
      );
    await expect(
      s.stage(
        "other",
        "task",
        "REPORT",
        file("r.pdf", "application/pdf", pdf),
        "key",
      ),
    ).rejects.toThrow();
    expect(add).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });
  it("explicit upload disable fails closed while approved default stays available", () => {
    const s = service({}, {}, {});
    expect(s.policy().policyId).toBe(p.policyId);
    const off = new SubmissionService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      v,
      {} as never,
      new ConfigService({ GUIDANCE_UPLOAD_ENABLED: "false" }),
    );
    fail(() => off.policy(), "FILE_POLICY_NOT_CONFIGURED");
    expect(() => s.key("invalid key")).toThrow();
    expect(() => s.key("good-key")).not.toThrow();
  });
});
