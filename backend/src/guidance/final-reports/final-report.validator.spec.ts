import "reflect-metadata";
import { describe, it, expect } from "vitest";
import { FileAsset } from "@prisma/client";
import { FinalReportValidator } from "./final-report.validator";
import { finalReportMultipartSchema } from "./final-report.dto";
import { ReportPrincipal, ReportProposal } from "./final-report.repository";
import {
  finalReportPolicy,
  TEMPORARY_FINAL_REPORT_MAX_BYTES,
} from "./final-report-policy";
import { SubmissionValidator } from "../submissions/submission.validator";
import { validateEnvironment } from "../../config/environment";

const validator = new FinalReportValidator(),
  files = new SubmissionValidator();
const pdf = Buffer.from(
  "%PDF-1.7\n1 0 obj\n<</Type /Catalog>>\nendobj\nstartxref\n0\n%%EOF\n",
);
const file = (name = "Đồ án.pdf", mime = "application/pdf", bytes = pdf) =>
  ({
    originalname: name,
    mimetype: mime,
    buffer: bytes,
    size: bytes.length,
  }) as Express.Multer.File;
const user = {
  id: "user",
  status: "ACTIVE",
  mustChangePassword: false,
  student: { id: "student", isActive: true },
  userRoles: [
    {
      role: {
        name: "STUDENT",
        rolePermissions: ["read", "create", "download"].map((action) => ({
          permission: { resource: "submission", action },
        })),
      },
    },
  ],
} as NonNullable<ReportPrincipal>;
const proposal = {
  id: "proposal",
  studentId: "student",
  termId: "term",
  topic: { termId: "term" },
  term: {
    id: "term",
    status: "IN_PROGRESS",
    isLocked: false,
    startDate: new Date("2026-01-01Z"),
    endDate: new Date("2027-01-01Z"),
    finalReportSubmissionWindow: {
      termId: "term",
      opensAt: new Date("2026-11-01Z"),
      closesAt: new Date("2026-12-01Z"),
      isLocked: false,
      revision: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  },
} as ReportProposal;

describe("Final report authorization and independent window", () => {
  it.each(["read", "create", "download"] as const)(
    "requires active student plus existing submission:%s permission",
    (action) => {
      expect(validator.principal(user, "user", action)).toBe(user);
      expect(() =>
        validator.principal({ ...user, userRoles: [] }, "user", action),
      ).toThrow();
    },
  );
  it.each([
    null,
    { ...user, status: "LOCKED" },
    { ...user, mustChangePassword: true },
    { ...user, student: null },
    { ...user, student: { id: "student", isActive: false } },
    {
      ...user,
      userRoles: [
        {
          role: {
            name: "ADMIN",
            rolePermissions: user.userRoles[0].role.rolePermissions,
          },
        },
      ],
    },
  ])("rejects ineligible principals without a role bypass", (principal) => {
    expect(() =>
      validator.principal(principal as ReportPrincipal, "user", "create"),
    ).toThrow();
  });
  it("rejects a mismatched authenticated actor", () => {
    expect(() => validator.principal(user, "another-user", "read")).toThrow();
  });
  it("requires ownership AND membership of the correct term roster", () => {
    expect(validator.ownership(user, proposal, { id: "roster" })).toBe(
      proposal,
    );
    expect(() =>
      validator.ownership(
        user,
        { ...proposal, studentId: "other" },
        { id: "roster" },
      ),
    ).toThrow();
    expect(() => validator.ownership(user, proposal, null)).toThrow();
    expect(() => validator.ownership(user, null, null)).toThrow();
    expect(() =>
      validator.ownership(
        user,
        { ...proposal, topic: { termId: "other-term" } },
        { id: "roster" },
      ),
    ).toThrow();
  });
  it("accepts the opening boundary and rejects the closing boundary", () => {
    expect(() =>
      validator.open(proposal, new Date("2026-11-01Z")),
    ).not.toThrow();
    expect(() =>
      validator.open(proposal, new Date("2026-10-31T23:59:59Z")),
    ).toThrow();
    expect(() => validator.open(proposal, new Date("2026-12-01Z"))).toThrow();
  });
  it("does not infer a missing milestone from FINAL or require UC17 confirmation", () => {
    expect(() =>
      validator.open(
        {
          ...proposal,
          term: { ...proposal.term, finalReportSubmissionWindow: null },
        },
        new Date("2026-11-02Z"),
      ),
    ).toThrow();
    expect(() =>
      validator.open(
        { ...proposal, term: { ...proposal.term, status: "DEFENDING" } },
        new Date("2026-11-02Z"),
      ),
    ).not.toThrow();
  });
  it.each(["COMPLETED", "CANCELLED"] as const)("rejects %s terms", (status) => {
    expect(() =>
      validator.open(
        { ...proposal, term: { ...proposal.term, status } },
        new Date("2026-11-02Z"),
      ),
    ).toThrow();
  });
  it("rejects locked terms/windows and windows outside the term", () => {
    for (const term of [
      { ...proposal.term, isLocked: true },
      {
        ...proposal.term,
        finalReportSubmissionWindow: {
          ...proposal.term.finalReportSubmissionWindow!,
          isLocked: true,
        },
      },
      {
        ...proposal.term,
        finalReportSubmissionWindow: {
          ...proposal.term.finalReportSubmissionWindow!,
          closesAt: new Date("2027-02-01Z"),
        },
      },
    ])
      expect(() =>
        validator.open({ ...proposal, term }, new Date("2026-11-02Z")),
      ).toThrow();
  });
  it("accepts only matching safe revisions", () => {
    expect(() => validator.revision(0, 0)).not.toThrow();
    expect(() => validator.revision(2, 2)).not.toThrow();
    for (const value of [-1, 0.5, 2147483647, NaN, 1])
      expect(() => validator.revision(value, 2)).toThrow();
  });
  it("rejects foreign namespaces, actors, quarantine and malformed metadata", () => {
    const asset = {
      kind: "REPORT",
      state: "READY",
      createdByUserId: "user",
      storageKey: "final-reports/11111111-1111-4111-8111-111111111111",
      mimeType: "application/pdf",
      sizeBytes: 20,
      checksum: "a".repeat(64),
    } as FileAsset;
    expect(validator.asset(asset, "user")).toBe(asset);
    for (const patch of [
      { storageKey: "guidance/11111111-1111-4111-8111-111111111111" },
      { createdByUserId: "other" },
      { state: "QUARANTINED" },
      { checksum: "bad" },
      { sizeBytes: 0 },
      { mimeType: "text/html" },
    ]) {
      expect(() =>
        validator.asset({ ...asset, ...patch } as FileAsset, "user"),
      ).toThrow();
    }
  });
});

describe("Strict multipart and reusable Step 8 PDF screening", () => {
  it("accepts canonical multipart revision strings and rejects client-controlled identities/keys", () => {
    expect(finalReportMultipartSchema.parse({ expectedRevision: "0" })).toEqual(
      { expectedRevision: 0 },
    );
    for (const expectedRevision of [
      "",
      "-1",
      "1.5",
      "1e3",
      "01",
      "2147483647",
      ["0", "1"],
    ])
      expect(
        finalReportMultipartSchema.safeParse({ expectedRevision }).success,
      ).toBe(false);
    for (const field of [
      "studentId",
      "actorId",
      "storageKey",
      "submittedAt",
      "kind",
    ])
      expect(
        finalReportMultipartSchema.safeParse({
          expectedRevision: "0",
          [field]: "untrusted",
        }).success,
      ).toBe(false);
  });
  it("accepts a safe Vietnamese PDF via the unmodified Step 8 validator", () => {
    expect(files.file("REPORT", file(), finalReportPolicy())).toMatchObject({
      originalName: "Đồ án.pdf",
      sizeBytes: pdf.length,
      mimeType: "application/pdf",
    });
  });
  it.each([
    file("../x.pdf"),
    file("CON.pdf"),
    file("x\n.pdf"),
    file("x.exe"),
    file("x.pdf", "text/plain"),
    file("x.pdf", "application/pdf", Buffer.from("not pdf")),
    file("x.pdf", "application/pdf", Buffer.alloc(0)),
    file(
      "x.pdf",
      "application/pdf",
      Buffer.from(pdf.toString().replace("/Catalog", "/Catalog /JavaScript")),
    ),
  ])("rejects unsafe name, type, empty or active PDF", (upload) => {
    expect(() => files.file("REPORT", upload, finalReportPolicy())).toThrow();
  });
  it("enforces the separately configured temporary file limit, including exact boundary", () => {
    expect(finalReportPolicy().maxFileBytes).toBe(
      TEMPORARY_FINAL_REPORT_MAX_BYTES,
    );
    expect(() =>
      files.file("REPORT", file(), finalReportPolicy(pdf.length)),
    ).not.toThrow();
    expect(() =>
      files.file("REPORT", file(), finalReportPolicy(pdf.length - 1)),
    ).toThrow();
    for (const cap of [0, -1, 1.5, "invalid", 101 * 1024 * 1024])
      expect(() => finalReportPolicy(cap)).toThrow();
  });
  it("validates new environment limits without altering guidance defaults", () => {
    const env = {
      DATABASE_URL: "postgresql://unused@localhost:1/no_db",
      DIRECT_URL: "postgresql://unused@localhost:1/no_db",
      JWT_SECRET: "long-secret-for-test-only",
      JWT_REFRESH_SECRET: "another-test-only-secret",
    };
    expect(validateEnvironment(env).FINAL_REPORT_MAX_FILE_BYTES).toBe(
      20 * 1024 * 1024,
    );
    expect(
      validateEnvironment({ ...env, FINAL_REPORT_MAX_FILE_BYTES: "1024" })
        .FINAL_REPORT_MAX_FILE_BYTES,
    ).toBe(1024);
    expect(() =>
      validateEnvironment({ ...env, FINAL_REPORT_MAX_FILE_BYTES: "0" }),
    ).toThrow("FINAL_REPORT_MAX_FILE_BYTES");
    expect(validateEnvironment(env).GUIDANCE_UPLOAD_ENABLED).toBe("true");
  });
});
