import type { DefenseConfirmationContext } from "./defense-confirmation.types";
import type {
  DefenseConfirmationReadRecord,
  DefenseConfirmationHistoryRecord,
} from "./defense-confirmation.repository";
import type { ConfirmationViewer } from "./defense-confirmation-read.validator";
import { defenseConfirmationExpectedContextSchema } from "./defense-confirmation.dto";
import { decisionSnapshotSchema } from "./defense-confirmation.validator";

const iso = (date: Date | null) =>
  date instanceof Date && Number.isFinite(date.getTime())
    ? date.toISOString()
    : null;
const person = (
  value: { id: string; displayName: string | null } | null,
  student: boolean,
) =>
  value
    ? student
      ? { displayName: value.displayName }
      : { userId: value.id, displayName: value.displayName }
    : null;
const advisor = (
  value: { id: string; fullName: string } | null,
  student: boolean,
) =>
  value
    ? student
      ? { fullName: value.fullName }
      : { lecturerId: value.id, fullName: value.fullName }
    : null;

/** A transport DTO, never an arbitrary Prisma object. No snapshots/private PDF
 * evidence are exposed to students or through the shared decision endpoint. */
export function confirmationDecisionDto(
  proposalId: string,
  row: DefenseConfirmationReadRecord | null,
  decision: DefenseConfirmationContext["decision"],
  viewer: ConfirmationViewer,
) {
  const status = ["PENDING", "CONFIRMED", "REJECTED"].includes(
    decision.status ?? "",
  )
    ? decision.status
    : null;
  return {
    code: "DEFENSE_CONFIRMATION" as const,
    proposalId,
    viewer,
    configured: row !== null,
    decision: {
      state: decision.state,
      status,
      note: decision.note,
      revision: row ? decision.revision : null,
      decidedAt: decision.decidedAt,
      confirmedAt: status === "CONFIRMED" ? decision.confirmedAt : null,
      decidedBy: person(row?.decidedBy ?? null, viewer === "STUDENT"),
      advisor: advisor(row?.advisor ?? null, viewer === "STUDENT"),
      issues: decision.issues,
    },
  };
}
export type DefenseConfirmationDecisionResponse = ReturnType<
  typeof confirmationDecisionDto
>;

export function confirmationContextDto(
  context: DefenseConfirmationContext,
  canDecide: boolean,
) {
  const candidate = {
    revision: context.decision.revision,
    assignment:
      context.advisor.state === "OFFICIAL"
        ? {
            assignmentId: context.advisor.assignmentId,
            revision: context.advisor.revision,
          }
        : null,
    pdf:
      context.pdf.state === "READY" && context.pdf.snapshot
        ? {
            finalReportId: context.pdf.snapshot.finalReportId,
            revision: context.pdf.snapshot.revision,
            checksum: context.pdf.snapshot.checksum,
          }
        : null,
  };
  const parsed = defenseConfirmationExpectedContextSchema.safeParse(candidate);
  const usable = parsed.success && candidate.revision <= 2147483646;
  const permissionIssue = {
    code: "UC17_DECISION_FORBIDDEN",
    message: "Thiếu quyền ra quyết định UC17.",
  };
  const expectationIssue = {
    code: "EXPECTED_CONTEXT_INVALID",
    message: "Không có context/revision có thể dùng cho PUT.",
  };
  const gate = (
    readiness: DefenseConfirmationContext["readiness"]["confirm"],
  ) => {
    const blockers = [
      ...readiness.blockers,
      ...(!canDecide ? [permissionIssue] : []),
      ...(!usable ? [expectationIssue] : []),
    ];
    return { allowed: blockers.length === 0, blockers };
  };
  return {
    ...context,
    expectedRevision: usable ? candidate.revision : null,
    expectedContext: usable && parsed.success ? parsed.data : null,
    permissions: { canDecide },
    changeReasonRequiredForChanges: !["ABSENT", "PENDING"].includes(
      context.decision.state,
    ),
    readiness: {
      confirm: gate(context.readiness.confirm),
      reject: gate(context.readiness.reject),
    },
  };
}
export type DefenseConfirmationContextResponse = ReturnType<
  typeof confirmationContextDto
>;

export function confirmationHistoryItem(row: DefenseConfirmationHistoryRecord) {
  const snapshot = decisionSnapshotSchema.safeParse(row.decisionContext);
  return {
    id: row.id,
    revision: row.revision,
    status: row.status,
    note: row.note,
    changeReason: row.changeReason,
    decidedAt: iso(row.decidedAt),
    actor: person(row.actor, false),
    advisor: advisor(row.advisor, false),
    snapshotSchemaVersion: snapshot.success
      ? snapshot.data.schemaVersion
      : null,
    pdfRevision: snapshot.success
      ? (snapshot.data.pdf?.revision ?? null)
      : null,
    // No checksum, originalName, storageKey, path, raw context or PDF bytes.
  };
}
export type DefenseConfirmationHistoryResponse = {
  code: "DEFENSE_CONFIRMATION_HISTORY";
  proposalId: string;
  viewer: Exclude<ConfirmationViewer, "STUDENT">;
  currentRevision: number | null;
  historyState:
    | "AVAILABLE"
    | "EMPTY"
    | "NO_DECISION"
    | "LEGACY_WITHOUT_HISTORY"
    | "UNKNOWN";
  items: Array<ReturnType<typeof confirmationHistoryItem>>;
  hasMore: boolean;
  nextAfterRevision: number | null;
};
