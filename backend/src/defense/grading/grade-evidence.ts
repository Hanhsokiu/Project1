import { HttpException } from "@nestjs/common";
import type { EffectiveDefenseSchedule } from "@doan/shared";
import type { ScheduleSession } from "../scheduling/schedule.repository";
import type { ScheduleService } from "../scheduling/schedule.service";
import { scheduleContext } from "../scheduling/schedule-context";
import type { FinalDefenseSession } from "../../guidance/final-defense/final-defense.repository";
import type { FileStorageService } from "../../common/storage/file-storage.service";
import { digest } from "../../guidance/submissions/submission.validator";
import { groupError } from "../../topic/review-groups/review-group.errors";
import { reviewHash } from "../../topic/proposal-reviews/proposal-review.validator";
function fail(code: string, message: string): never {
  return groupError(409, code, message);
}
// Internal evidence readers. Caller must authorize ownership before invocation.
export async function readGradePdf(
  s: FinalDefenseSession,
  storage: FileStorageService,
  proposalId: string,
) {
  const report = await s.report(proposalId),
    version = report?.versions[0],
    a = version?.fileAsset;
  if (
    !report ||
    report.proposalId !== proposalId ||
    !version ||
    version.reportId !== report.id ||
    !a ||
    version.fileAssetId !== a.id ||
    a.state !== "READY" ||
    a.kind !== "REPORT" ||
    a.mimeType !== "application/pdf" ||
    a.sizeBytes <= 0 ||
    a.sizeBytes > 50 * 1024 * 1024 ||
    !/^guidance\/[a-f0-9-]{36}$/.test(a.storageKey) ||
    !/^[a-f0-9]{64}$/.test(a.checksum)
  )
    fail(
      "FINAL_PDF_REQUIRED",
      "Cần PDF cuối private READY có metadata hợp lệ.",
    );
  let bytes: Buffer;
  try {
    bytes = await storage.readPrivateGuidance(a.storageKey, a.sizeBytes);
  } catch {
    fail("FILE_NOT_AVAILABLE", "Không đọc được PDF từ storage private.");
  }
  if (
    bytes.length !== a.sizeBytes ||
    digest(bytes) !== a.checksum ||
    !bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))
  )
    fail("FILE_INTEGRITY_FAILED", "PDF không khớp metadata/checksum.");
  return { version, asset: a, bytes };
}
export async function currentGradeSchedule(
  s: ScheduleSession,
  service: ScheduleService,
  a: {
    termId: string;
    committeeId: string;
    termStudentId: string;
    proposalId: string;
  },
) {
  if (!(await s.scReady())) return null;
  const found: EffectiveDefenseSchedule[] = [];
  for (const row of await s.scRecords()) {
    const c = scheduleContext(row.context);
    if (
      row.committee.termId !== a.termId ||
      row.committeeId !== a.committeeId ||
      !row.updatedBy ||
      !c ||
      !c.slots.some(
        (x) =>
          x.termStudentId === a.termStudentId && x.proposalId === a.proposalId,
      )
    )
      continue;
    try {
      const ef = await service.effectiveInSession(
        s,
        row.updatedBy,
        a.termId,
        row.id,
        row.revision,
        c.evidenceHash,
      );
      if (
        ef.termId === a.termId &&
        ef.committeeId === a.committeeId &&
        ef.slots.some(
          (x) =>
            x.termStudentId === a.termStudentId &&
            x.proposalId === a.proposalId,
        )
      )
        found.push(ef);
    } catch (e) {
      if (
        !(e instanceof HttpException) ||
        ![401, 403, 404, 409].includes(e.getStatus())
      )
        throw e;
    }
  }
  return found.length === 1 ? found[0] : null;
}
export function gradeScheduleHash(
  s: EffectiveDefenseSchedule,
  requirePublished: boolean,
) {
  return reviewHash(
    Object.fromEntries(
      Object.entries(s).filter(
        ([key]) =>
          key !== "revision" &&
          (!["publishedBy", "publishedAt"].includes(key) || requirePublished),
      ),
    ),
  );
}
