import "reflect-metadata";
import { beforeEach, describe, expect, it } from "vitest";
import { digest } from "../submissions/submission.validator";
import { at, bytes, key } from "./defense-confirmation.test-fixtures";
import { reportFixture } from "./defense-confirmation-report.test-fixtures";

let f: ReturnType<typeof reportFixture>;
beforeEach(() => {
  f = reportFixture();
});
const denied = async (status: number, code?: string) => {
  await expect(f.download()).rejects.toMatchObject({
    status,
    ...(code ? { response: { error: { code } } } : {}),
  });
  expect(f.forbidden).not.toHaveBeenCalled();
};
const changeAdvisor = () => {
  const a = f.state.registration!.advisorAssignment!;
  a.advisorId = "new-advisor";
  a.advisor = { ...a.advisor, userId: "new-advisor-user" };
  a.pr2bAssignmentChangeAssignmentId = [
    {
      assignmentId: a.id,
      assignmentRevision: 1,
      newAdvisorId: "new-advisor",
      effectiveAt: at,
    } as (typeof a.pr2bAssignmentChangeAssignmentId)[number],
  ];
  f.state.roster!.lecturerId = "new-advisor";
};

describe("UC17 advisor private PDF download", () => {
  it("downloads the verified PDF selected by the context, without returning private metadata", async () => {
    const context = await f.read.context("advisor-user", "proposal");
    const identity = context.expectedContext!.pdf!;
    f.storage.readPrivateFinalReport.mockClear();
    const file = await f.download(identity);
    expect(file).toEqual({ bytes, name: "do-an.pdf" });
    expect(Object.keys(file).sort()).toEqual(["bytes", "name"]);
    expect(JSON.stringify(file)).not.toContain(key);
    expect(JSON.stringify(file)).not.toMatch(/storageKey|filePath/);
    expect(f.storage.readPrivateFinalReport).toHaveBeenCalledTimes(1);
    expect(f.storage.readPrivateFinalReport).toHaveBeenCalledWith(
      key,
      bytes.length,
    );
  });

  it("accepts the new official advisor after AssignmentChange and rejects the former advisor", async () => {
    changeAdvisor();
    await denied(404, "UC17_NOT_FOUND");
    expect(f.storage.readPrivateFinalReport).not.toHaveBeenCalled();
    f.state.user!.id = "new-advisor-user";
    f.state.user!.lecturer!.id = "new-advisor";
    expect((await f.download()).bytes).toEqual(bytes);
  });

  it("rejects another lecturer even with read permission", async () => {
    f.state.user!.id = "another-user";
    f.state.user!.lecturer!.id = "another-lecturer";
    await denied(404, "UC17_NOT_FOUND");
    expect(f.raw.finalReport.findUnique).not.toHaveBeenCalled();
    expect(f.storage.readPrivateFinalReport).not.toHaveBeenCalled();
  });

  it.each(["STUDENT", "FACULTY", "ADMIN"] as const)(
    "does not let %s use the advisor route, including with a full term grant",
    async (role) => {
      f.viewer(role);
      f.fullGrant();
      await denied(403);
      expect(f.storage.readPrivateFinalReport).not.toHaveBeenCalled();
    },
  );

  it.each(["read", "guidance", "inactive", "password", "profile"])(
    "rejects missing permission or inactive account/profile: %s",
    async (condition) => {
      const user = f.state.user!;
      if (condition === "read" || condition === "guidance")
        user.userRoles[0].role.rolePermissions =
          user.userRoles[0].role.rolePermissions.filter((p) =>
            condition === "read"
              ? p.permission.resource !== "defense-confirmation"
              : p.permission.resource !== "guidance",
          );
      if (condition === "inactive") user.status = "LOCKED";
      if (condition === "password") user.mustChangePassword = true;
      if (condition === "profile") user.lecturer!.isActive = false;
      await denied(403);
      expect(f.storage.readPrivateFinalReport).not.toHaveBeenCalled();
    },
  );

  it.each(["plan", "pointer", "handover", "roster", "ownership"])(
    "fails closed when official assignment/ownership is not trustworthy: %s",
    async (condition) => {
      const a = f.state.registration!.advisorAssignment!;
      if (condition === "plan") a.assignmentPlan.status = "DRAFT";
      if (condition === "pointer")
        f.state.term!.pr2bTermWorkflowTermId!.officialAssignmentPlanId =
          "other-plan";
      if (condition === "handover") {
        changeAdvisor();
        f.state.user!.id = "new-advisor-user";
        f.state.user!.lecturer!.id = "new-advisor";
        a.pr2bAssignmentChangeAssignmentId[0].newAdvisorId = "wrong-advisor";
      }
      if (condition === "roster") f.state.roster = null;
      if (condition === "ownership")
        f.state.proposal!.topic.pr2bTopicWorkflowTopicId!.refTermStudentId!.studentId =
          "other-student";
      await denied(404, "UC17_NOT_FOUND");
      expect(f.storage.readPrivateFinalReport).not.toHaveBeenCalled();
    },
  );

  it("returns not found for an absent PDF", async () => {
    f.state.report = null;
    await denied(404, "UC17_PDF_NOT_FOUND");
    expect(f.storage.readPrivateFinalReport).not.toHaveBeenCalled();
  });

  it("never reads a legacy filePath", async () => {
    Object.assign(f.state.report!, {
      revision: 0,
      fileAssetId: null,
      fileAsset: null,
      filePath: "C:/private/legacy.pdf",
    });
    await denied(409, "UC17_PDF_NOT_READY");
    expect(f.storage.readPrivateFinalReport).not.toHaveBeenCalled();
  });

  it.each([
    [
      "wrong proposal",
      () => {
        f.state.report!.proposalId = "other-proposal";
      },
    ],
    [
      "wrong student",
      () => {
        f.state.report!.fileAsset!.createdByUserId = "other-student";
      },
    ],
    [
      "wrong asset FK",
      () => {
        f.state.report!.fileAssetId = "other-asset";
      },
    ],
    [
      "malformed checksum",
      () => {
        f.state.report!.fileAsset!.checksum = "x".repeat(64);
      },
    ],
    [
      "not ready",
      () => {
        f.state.report!.fileAsset!.state = "QUARANTINED";
      },
    ],
    [
      "wrong kind",
      () => {
        f.state.report!.fileAsset!.kind = "SOURCE";
      },
    ],
    [
      "wrong MIME",
      () => {
        f.state.report!.fileAsset!.mimeType = "text/html";
      },
    ],
    [
      "wrong size",
      () => {
        f.state.report!.fileAsset!.sizeBytes = 0;
      },
    ],
    [
      "unsafe key",
      () => {
        f.state.report!.fileAsset!.storageKey = "../secret";
      },
    ],
    [
      "unsafe name",
      () => {
        f.state.report!.fileAsset!.originalName = "x.pdf\r\nX-Evil: 1";
      },
    ],
    [
      "path in name",
      () => {
        f.state.report!.fileAsset!.originalName = "../x.pdf";
      },
    ],
  ] as const)("rejects invalid PDF metadata: %s", async (_name, mutate) => {
    mutate();
    await denied(409, "UC17_PDF_NOT_READY");
    expect(f.storage.readPrivateFinalReport).not.toHaveBeenCalled();
  });

  it("sanitizes a missing/unreadable private file error", async () => {
    f.storage.readPrivateFinalReport.mockRejectedValue(
      new Error(`ENOENT C:/private/${key}`),
    );
    try {
      await f.download();
      expect.fail("download should fail");
    } catch (error) {
      expect(error).toMatchObject({
        status: 409,
        response: { error: { code: "UC17_PDF_FILE_UNAVAILABLE" } },
      });
      expect(JSON.stringify(error)).not.toMatch(
        /ENOENT|C:\/private|storageKey|filePath/,
      );
      expect(JSON.stringify(error)).not.toContain(key);
    }
  });

  it("rejects checksum mismatch and truncated PDF", async () => {
    f.storage.readPrivateFinalReport.mockResolvedValue(Buffer.from("tampered"));
    await denied(409, "UC17_PDF_CONTENT_INVALID");
  });

  it("rejects content that matches SHA-256 but fails the existing PDF validator", async () => {
    const invalid = Buffer.from("<html>Not a PDF</html>");
    f.state.report!.fileAsset!.sizeBytes = invalid.length;
    f.state.report!.fileAsset!.checksum = digest(invalid);
    f.storage.readPrivateFinalReport.mockResolvedValue(invalid);
    await expect(
      f.download({ ...f.identity, checksum: digest(invalid) }),
    ).rejects.toMatchObject({
      status: 409,
      response: { error: { code: "UC17_PDF_CONTENT_INVALID" } },
    });
  });

  it("rejects a replacement even with identical bytes/checksum", async () => {
    const c = await f.read.context("advisor-user", "proposal");
    f.storage.readPrivateFinalReport.mockClear();
    f.state.report!.revision++;
    await expect(f.download(c.expectedContext!.pdf)).rejects.toMatchObject({
      status: 409,
      response: { error: { code: "PDF_CONTEXT_CHANGED" } },
    });
    expect(f.storage.readPrivateFinalReport).not.toHaveBeenCalled();
  });

  it.each(["finalReportId", "checksum"] as const)(
    "rejects an outdated %s",
    async (field) => {
      await expect(
        f.download({
          ...f.identity,
          [field]: field === "checksum" ? "0".repeat(64) : "old-report",
        }),
      ).rejects.toMatchObject({ status: 409 });
      expect(f.storage.readPrivateFinalReport).not.toHaveBeenCalled();
    },
  );

  it("reloads the PDF after waiting for the parent lock", async () => {
    f.state.onLock = () => {
      f.state.report!.revision++;
    };
    await denied(409, "PDF_CONTEXT_CHANGED");
    expect(f.storage.readPrivateFinalReport).not.toHaveBeenCalled();
  });

  it("reloads official assignment after waiting for the parent lock", async () => {
    f.state.onLock = changeAdvisor;
    await denied(404, "UC17_NOT_FOUND");
    expect(f.storage.readPrivateFinalReport).not.toHaveBeenCalled();
  });

  it.each(["account", "permission", "advisor", "pdf", "asset", "metadata"])(
    "rechecks %s after file I/O before returning bytes",
    async (condition) => {
      f.state.afterFileRead = () => {
        if (condition === "account") f.state.user!.status = "LOCKED";
        if (condition === "permission") f.state.user!.userRoles = [];
        if (condition === "advisor") changeAdvisor();
        if (condition === "pdf") f.state.report!.revision++;
        if (condition === "asset") {
          f.state.report!.fileAssetId = "new-asset";
          f.state.report!.fileAsset!.id = "new-asset";
        }
        if (condition === "metadata")
          f.state.report!.fileAsset!.originalName = "new-name.pdf";
      };
      await denied(
        ["account", "permission"].includes(condition)
          ? 403
          : condition === "advisor"
            ? 404
            : 409,
      );
    },
  );

  it.each([
    "window missing",
    "window locked",
    "window expired",
    "UC18 UNKNOWN",
    "UC18 FINALIZED",
    "term completed",
  ])(
    "allows authorized download after %s, without using write readiness",
    async (condition) => {
      if (condition === "window missing") f.state.window = null;
      if (condition === "window locked") f.state.window!.isLocked = true;
      if (condition === "window expired") f.state.window!.closesAt = at;
      if (condition === "UC18 UNKNOWN") f.state.list = null;
      if (condition === "UC18 FINALIZED") f.state.list!.state = "FINALIZED";
      if (condition === "term completed") f.state.term!.status = "COMPLETED";
      expect((await f.download()).bytes).toEqual(bytes);
      expect(f.raw.defenseList.findUnique).not.toHaveBeenCalled();
      expect(f.raw.defenseConfirmationWindow.findUnique).not.toHaveBeenCalled();
    },
  );

  it("does not mutate business data, create audit/history, or mark the PDF as read", async () => {
    f.state.decision = structuredClone(f.facts.decision);
    const before = structuredClone(f.state);
    await f.download();
    expect(f.state).toEqual(before);
    expect(f.forbidden).not.toHaveBeenCalled();
    expect(f.raw.defenseConfirmation.create).not.toHaveBeenCalled();
    expect(f.raw.defenseConfirmation.updateMany).not.toHaveBeenCalled();
    expect(f.raw.defenseConfirmationHistory.create).not.toHaveBeenCalled();
    expect(f.auditLog).not.toHaveBeenCalled();
    expect(f.raw.auditLog.create).not.toHaveBeenCalled();
    expect(f.raw.defenseConfirmation.findUnique).not.toHaveBeenCalled();
  });

  it("uses parent/proposal/key lock order and current database time", async () => {
    await f.download();
    const locks = f.events.filter((s) =>
      /FOR UPDATE|pg_advisory_xact_lock/.test(s),
    );
    expect(locks).toHaveLength(3);
    expect(locks[0]).toContain('"THESIS_TERM"');
    expect(locks[1]).toContain('"PROPOSAL"');
    expect(locks[2]).toContain("pg_advisory_xact_lock(hashtextextended");
    expect(
      f.events.filter((s) => /transaction_timestamp/.test(s)),
    ).toHaveLength(0);
    expect(f.events.some((s) => /clock_timestamp/.test(s))).toBe(true);
    expect(f.prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "ReadCommitted",
      maxWait: 10000,
      timeout: 15000,
    });
  });

  it("download does not waive fresh PUT context checks after a later replacement", async () => {
    const c = await f.read.context("advisor-user", "proposal");
    await f.download(c.expectedContext!.pdf);
    f.state.report!.revision++;
    await expect(
      f.service.put("advisor-user", "proposal", {
        status: "CONFIRMED",
        expectedRevision: c.expectedRevision,
        expectedContext: c.expectedContext,
      }),
    ).rejects.toMatchObject({
      status: 409,
      response: { error: { code: "PDF_CONTEXT_CHANGED" } },
    });
    expect(f.state.decision).toBeNull();
  });
});
