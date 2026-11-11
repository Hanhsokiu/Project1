import { createHash } from "crypto";
import { z } from "zod";
import {
  FinalDefensePolicySchema, EligibilityPolicySchema, CommitteePolicySchema,
  ReviewerPolicySchema, SchedulePolicySchema, ReviewerGradePolicySchema,
  CommitteeGradePolicySchema, FinalResultPolicySchema, ReportPolicySchema,
  ReportCodeSchema,
  DOSSIER_TEMPLATE_VERSION,
} from "@doan/shared";
import type { ReportTemplate } from "@doan/shared";
import { defaultColumns } from "../report/defense-reporting/report-templates";

// These choices belong to a synthetic project acceptance run, never a faculty regulation.
export const AcceptanceContextSchema = z.object({
  runId: z.string().regex(/^DATN-E2E-B1B10-TEST-[A-Za-z0-9-]+$/).max(90),
  termId: z.string().min(1).max(36),
  departmentId: z.string().min(1).max(36),
  roomId: z.string().min(1).max(36),
  approvedBy: z.string().min(1).max(36),
  approvedAt: z.string().datetime({ offset: true }),
  startAt: z.string().datetime({ offset: true }),
  endAt: z.string().datetime({ offset: true }),
  defenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // IDs are term-owned rows created through the setup service, not global example IDs.
  reviewerCriteriaIds: z.array(z.string().min(1).max(36)).length(5),
  committeeCriteriaIds: z.array(z.string().min(1).max(36)).length(5),
}).strict().superRefine((c, ctx) => {
  if (Date.parse(c.startAt) >= Date.parse(c.endAt) ||
      Date.parse(c.approvedAt) > Date.now() ||
      new Set([...c.reviewerCriteriaIds, ...c.committeeCriteriaIds]).size !== 10)
    ctx.addIssue({ code: "custom", message: "Invalid acceptance dates/approval/criterion ownership" });
  const day = Date.parse(c.defenseDate + "T08:00:00+07:00");
  if (!(day >= Date.parse(c.startAt) && day < Date.parse(c.endAt)))
    ctx.addIssue({ code: "custom", message: "Defense date outside acceptance window" });
});
export type AcceptanceContext = z.infer<typeof AcceptanceContextSchema>;
const labels = ["Cấu trúc báo cáo", "Nội dung báo cáo", "Tính thực tiễn", "Mức độ hoàn thiện", "Nắm vững sản phẩm"];
const maxima = ["2", "3", "1", "2", "2"];
const weights = ["0.2", "0.3", "0.1", "0.2", "0.2"];
export const acceptancePolicySchemas = {
  UC17_POLICY: FinalDefensePolicySchema, UC18_POLICY: EligibilityPolicySchema,
  UC19_POLICY: CommitteePolicySchema, UC20_POLICY: ReviewerPolicySchema,
  UC21_POLICY: SchedulePolicySchema, UC22_POLICY: ReviewerGradePolicySchema,
  UC23_POLICY: CommitteeGradePolicySchema, UC24_POLICY: FinalResultPolicySchema,
  UC25_POLICY: ReportPolicySchema,
};
export function buildAcceptancePolicies(input: AcceptanceContext) {
  const c = AcceptanceContextSchema.parse(input);
  const common = { version: c.runId, status: "APPROVED" as const, approvedBy: c.approvedBy, approvedAt: c.approvedAt };
  const reference = `PROJECT_ACCEPTANCE_ONLY:${c.runId}; synthetic TEST data; technical assumptions, NOT faculty regulations`;
  const referenced = { ...common, reference };
  const round = { mode: "HALF_UP" as const, decimalPlaces: 1 };
  const criteria = (ids: string[]) => ids.map((id, i) => ({ id, name: labels[i], maxScore: maxima[i], weight: weights[i], step: "0.1" }));
  const templates: ReportTemplate[] = ReportCodeSchema.options.map(code => ({
    code, version: c.runId, name: `TEST — ${code}`, format: code.startsWith("XLSX_") ? "XLSX" : "PDF",
    engineVersion: "UC25_V1", owner: "PROJECT_ACCEPTANCE_TEST", status: "APPROVED",
    approval: { by: c.approvedBy, at: c.approvedAt, reference },
    effectiveFrom: c.startAt, effectiveUntil: c.endAt, roles: ["FACULTY"],
    columns: defaultColumns(code), draftAllowed: true,
    requirePublished: /RESULTS|MINUTES/.test(code),
    allowMissing: code === "PDF_MINUTES" ? ["CONCLUSION", "DEFENSE_REMARKS", "REVISION_REQUESTS"] : [],
    signatureRoles: ["CHAIR", "SECRETARY", "FACULTY"],
    institution: { school: "DATN — NGHIỆM THU DỮ LIỆU TEST", faculty: "DỰ ÁN B1–B10 — KHÔNG PHẢI BIỂU MẪU CHÍNH THỨC" },
    dossierTemplateVersion: code === "PDF_DOSSIER" ? DOSSIER_TEMPLATE_VERSION : null,
  }));
  const policies = {
    UC17_POLICY: FinalDefensePolicySchema.parse({ ...common, scoreStep: 0.1, maxPdfBytes: 20 * 1024 * 1024, replacementAfterDecision: "BLOCK", rubric: null }),
    UC18_POLICY: EligibilityPolicySchema.parse({ ...common, phaseCode: "FINAL", progressRule: "ALL_ACTIVE_TASKS_PASSED", academicSources: [{ key: "TEST_ACADEMIC_ELIGIBILITY", label: "Xác nhận học vụ CHỈ cho hồ sơ TEST", mode: "FACULTY_ATTESTATION" }] }),
    UC19_POLICY: CommitteePolicySchema.parse({ ...referenced, phaseCode: "DEFENSE", chairCount: 1, secretaryCount: 1, distinctOfficers: true, allowEmptyFinalization: false, memberScope: "SAME_DEPARTMENT", studentScope: "SAME_DEPARTMENT", allowedTitleIds: null, maxCommitteesPerLecturer: 1, maxStudentsPerCommittee: 10, maxStudentsPerLecturer: 10 }),
    UC20_POLICY: ReviewerPolicySchema.parse({ ...referenced, phaseCode: "DEFENSE", reviewersPerStudent: 1, maxReviewsPerLecturer: 10, maxTotalStudentDuties: 20, totalLoadRule: "ADVISOR_PLUS_COMMITTEE_PLUS_REVIEW", departmentRule: "SAME_DEPARTMENT", allowedTitleIds: null, expertiseRule: "NONE", committeeMembership: "FORBID", formerAdvisorRule: "FORBID" }),
    UC21_POLICY: SchedulePolicySchema.parse({ ...referenced, phaseCode: "DEFENSE", timezone: "Asia/Ho_Chi_Minh", allowedDates: [c.defenseDate], periods: { MORNING: { start: "08:00", end: "11:30", breaks: [] }, AFTERNOON: { start: "13:30", end: "17:00", breaks: [] } }, durationMin: 20, bufferMin: 5, sessionBufferMin: 10, startStepMin: 5, maxStudentsPerSession: 8, minRoomCapacity: 10, roomAccess: [{ roomId: c.roomId, departmentIds: [c.departmentId] }], reviewerAttendance: "REQUIRED", nameRule: "LAST_TOKEN_MIDDLE_THEN_FAMILY", compoundFamilyNames: [], manualOrderAllowed: false, studentVisibility: true, lecturerVisibility: true, advisorCanView: true, publishNotBefore: c.startAt, crossTermConflicts: "ALL_TERMS", legacyRule: "BLOCK_SHARED_RESOURCES_UNTIL_RECONCILED" }),
    UC22_POLICY: ReviewerGradePolicySchema.parse({ ...referenced, phaseCode: "DEFENSE", scoreStep: "0.1", draftAllowed: true, requiredFeedback: ["comment", "strengths", "weaknesses", "questions"], minimumQuestions: 2, sourceChange: "BLOCK", afterFinalize: "IMMUTABLE", studentRelease: "WITHHELD", schedule: { required: true, requirePublished: true, window: null }, rubric: { version: c.runId, calculation: "WEIGHTED_NORMALIZED_10_EXACT", criteria: criteria(c.reviewerCriteriaIds) } }),
    UC23_POLICY: CommitteeGradePolicySchema.parse({ ...referenced, effectiveFrom: c.startAt, effectiveUntil: c.endAt, effectiveScope: "GRADING_WINDOW", phaseCode: "DEFENSE", gradingRoles: ["CHAIR", "SECRETARY", "MEMBER"], draftAllowed: true, commentRequired: true, sourceChange: "BLOCK", afterFinalize: "IMMUTABLE", studentRelease: "WITHHELD", schedule: { required: true, requirePublished: true, anchor: "SESSION" }, defenseEvidence: "NOT_REQUIRED", rubric: { version: c.runId, calculation: "WEIGHTED_NORMALIZED_10", missingOptional: "BLOCK", rounding: round, totalStep: "0.1", criteria: criteria(c.committeeCriteriaIds).map(x => ({ ...x, description: "PROJECT ACCEPTANCE TEST — không phải rubric Khoa", minScore: "0", required: true })) } }),
    UC24_POLICY: FinalResultPolicySchema.parse({ ...referenced, formula: "WEIGHTED_SUM", advisorSource: "UC17_OFFICIAL_SUMMARY", components: [{ source: "ADVISOR_UC17", weight: "0.2" }, { source: "REVIEWER", weight: "0.2" }, { source: "COMMITTEE", weight: "0.6" }], reviewerAggregate: { mode: "MEAN", rounding: round }, committeeAggregate: { mode: "MEAN", rounding: round }, finalRounding: round, finalStep: "0.1", storageDecimalPlaces: 1, passRule: { minimumFinal: "5", minimumComponents: [] }, classifications: [], confirmation: { scope: "STUDENT", rule: "ONE_PER_ROLE", roles: ["CHAIR", "SECRETARY"], distinctActors: true, reasonRequired: true }, separation: { finalizerNotConfirmer: true, publisherNotFinalizer: false }, finalizeWindow: { phaseCode: "DEFENSE", notBefore: c.startAt, before: c.endAt }, publication: { phaseCode: "DEFENSE", notBefore: c.startAt, before: c.endAt, studentFinal: true, studentComponents: false }, sourceChange: "BLOCK", afterFinalize: "IMMUTABLE", sourceLock: "PRESERVE_PRODUCER_LOCKS" }),
    UC25_POLICY: ReportPolicySchema.parse({ ...referenced, memberResults: "DENY", statisticsRelease: "PUBLISHED_ONLY", incompleteDraft: true, retentionDays: 30, distribution: [{ label: "Dưới 5 (TEST)", from: "0", to: "5", includeUpper: false }, { label: "Từ 5 (TEST)", from: "5", to: "10", includeUpper: true }], templates, signature: "UNSIGNED_ONLY" }),
  };
  return { kind: "PROJECT_ACCEPTANCE_ONLY" as const, termId: c.termId, runId: c.runId,
    approval: { by: c.approvedBy, at: c.approvedAt, reference }, policies,
    hash: createHash("sha256").update(JSON.stringify(policies)).digest("hex") };
}
