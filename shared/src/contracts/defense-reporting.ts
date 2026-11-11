import { z } from "zod";
const id = z.string().trim().min(1).max(36),
  hash = z.string().regex(/^[a-f0-9]{64}$/);
export const ReportCodeSchema = z.enum([
  "XLSX_STUDENTS",
  "XLSX_COMMITTEES",
  "XLSX_COMMITTEE_STUDENTS",
  "XLSX_REVIEWERS",
  "XLSX_COMMITTEE_RESULTS",
  "XLSX_CLASS_RESULTS",
  "XLSX_TERM_RESULTS",
  "XLSX_OFFICIAL_RESULTS",
  "PDF_ADVISOR_GRADE",
  "PDF_REVIEWER_GRADE",
  "PDF_COMMITTEE",
  "PDF_COMMITTEE_RESULTS",
  "PDF_MINUTES",
  "PDF_RESULTS",
  "PDF_DOSSIER",
]);
export const ReportColumnSchema = z.enum([
  "ORDER",
  "STUDENT_CODE",
  "FAMILY_NAME",
  "GIVEN_NAME",
  "STUDENT_NAME",
  "CLASS",
  "TITLE",
  "RESEARCH_AREA",
  "ADVISOR",
  "REVIEWERS",
  "COMMITTEE",
  "LECTURER",
  "ROLE",
  "DATE",
  "PERIOD",
  "ROOM",
  "ADVISOR_SCORE",
  "REVIEWER_SCORE",
  "COMMITTEE_SCORE",
  "MEMBER_SCORES",
  "REVIEWER_SCORES",
  "FINAL_SCORE",
  "RESULT",
  "COMMENTS",
  "QUESTIONS",
  "CONCLUSION",
  "REVISION_REQUESTS",
  "STATE",
  "SIGNATURE_STATUS",
]);
export const ReportTemplateSchema = z
  .object({
    code: ReportCodeSchema,
    version: z.string().trim().min(1).max(100),
    name: z.string().trim().min(1).max(200),
    format: z.enum(["XLSX", "PDF"]),
    engineVersion: z.literal("UC25_V1"),
    owner: z.string().trim().min(1).max(200),
    status: z.enum(["DRAFT", "APPROVED"]),
    approval: z
      .object({
        by: id,
        at: z.string().datetime({ offset: true }),
        reference: z.string().trim().min(1).max(1000),
      })
      .strict()
      .nullable(),
    effectiveFrom: z.string().datetime({ offset: true }).nullable(),
    effectiveUntil: z.string().datetime({ offset: true }).nullable(),
    roles: z
      .array(z.enum(["FACULTY", "LECTURER"]))
      .min(1)
      .max(2),
    columns: z.array(ReportColumnSchema).min(1).max(28),
    draftAllowed: z.boolean(),
    requirePublished: z.boolean(),
    allowMissing: z
      .array(z.enum(["CONCLUSION", "DEFENSE_REMARKS", "REVISION_REQUESTS"]))
      .max(3),
    signatureRoles: z
      .array(z.enum(["CHAIR", "SECRETARY", "STUDENT", "FACULTY"]))
      .max(4),
    institution: z
      .object({
        school: z.string().trim().min(1).max(200),
        faculty: z.string().trim().min(1).max(200),
      })
      .strict()
      .nullable(),
    dossierTemplateVersion: z.string().trim().min(1).max(100).nullable(),
  })
  .strict()
  .superRefine((t, c) => {
    if (
      new Set(t.columns).size !== t.columns.length ||
      new Set(t.roles).size !== t.roles.length ||
      new Set(t.allowMissing).size !== t.allowMissing.length ||
      new Set(t.signatureRoles).size !== t.signatureRoles.length
    )
      c.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Duplicate template fields",
      });
    if (
      t.format !== (t.code.startsWith("XLSX_") ? "XLSX" : "PDF") ||
      (t.status === "APPROVED" && (!t.approval || !t.institution))
    )
      c.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Template approval/format missing",
      });
  });
export const ReportPolicySchema = z
  .object({
    version: z.string().trim().min(1).max(100),
    status: z.literal("APPROVED"),
    approvedBy: id,
    approvedAt: z.string().datetime({ offset: true }),
    reference: z.string().trim().min(1).max(1000),
    memberResults: z.enum(["DENY", "EXPLICIT_RESULT_PERMISSION"]),
    statisticsRelease: z.enum(["PUBLISHED_ONLY", "FINALIZED_INTERNAL"]),
    incompleteDraft: z.boolean(),
    retentionDays: z.number().int().min(1).max(3650),
    distribution: z
      .array(
        z
          .object({
            label: z.string().trim().min(1).max(100),
            from: z.string().regex(/^\d+(?:\.\d{1,6})?$/),
            to: z.string().regex(/^\d+(?:\.\d{1,6})?$/),
            includeUpper: z.boolean(),
          })
          .strict(),
      )
      .max(20),
    templates: z.array(ReportTemplateSchema).min(1).max(30),
    signature: z.literal("UNSIGNED_ONLY"),
  })
  .strict();
export const ReportFilterSchema = z
  .object({
    termId: id,
    committeeId: id.optional(),
    departmentId: id.optional(),
    className: z.string().trim().max(100).optional(),
    termStudentId: id.optional(),
    lecturerId: id.optional(),
    state: z.enum(["FINALIZED", "PUBLISHED", "STALE", "MISSING"]).optional(),
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
  })
  .strict();
export const ReportPreviewSchema = z
  .object({
    filters: ReportFilterSchema,
    templateCode: ReportCodeSchema,
    templateVersion: z.string().trim().min(1).max(100),
    mode: z.enum(["DRAFT", "OFFICIAL"]),
  })
  .strict();
export const ReportExportSchema = ReportPreviewSchema.extend({
  expectedSnapshotHash: hash,
}).strict();
export type ReportCode = z.infer<typeof ReportCodeSchema>;
export type ReportColumn = z.infer<typeof ReportColumnSchema>;
export type ReportTemplate = z.infer<typeof ReportTemplateSchema>;
export type ReportPolicy = z.infer<typeof ReportPolicySchema>;
export type ReportFilter = z.infer<typeof ReportFilterSchema>;
export const ReportOptionsQuerySchema = ReportFilterSchema.partial({
  termId: true,
});
export type ReportRequest = z.infer<typeof ReportPreviewSchema>;
export type ReportExport = z.infer<typeof ReportExportSchema>;
export type ReportRow = {
  cells: Partial<Record<ReportColumn, string>>;
  missing: string[];
  sourceState: string;
};
export type ReportPreview = {
  template: ReportTemplate;
  mode: "DRAFT" | "OFFICIAL";
  snapshotHash: string;
  rows: ReportRow[];
  count: number;
  truncated: boolean;
  blockers: string[];
  canExport: boolean;
  signatureStatus: "UNSIGNED";
};
export type ReportOptions = {
  terms: { id: string; code: string; name: string; status: string }[];
  committees: {
    id: string;
    termId: string;
    code: string | null;
    name: string;
  }[];
  departments: { id: string; name: string }[];
  classes: string[];
  members: { id: string; name: string; code: string }[];
  permissions: string[];
  blockers: string[];
};
export type ReportStatistics = {
  termId: string;
  students: number;
  proposals: number;
  lecturers: number;
  committees: number | null;
  scheduledStudents: number | null;
  sessions: number | null;
  eligibleStudents: number | null;
  unknownEligibility: number;
  reviewerAssignments: number | null;
  reviewerSheets: number | null;
  committeeSheets: number | null;
  finalizedResults: number | null;
  publishedResults: number | null;
  average: string | null;
  passRate: string | null;
  distribution: { label: string; count: number }[] | null;
  byClass: { key: string; students: number; finalized: number | null }[];
  byCommittee: { key: string; students: number; finalized: number | null }[];
  byDepartment: { key: string; students: number; finalized: number | null }[];
  researchAreas: { key: string; students: number }[];
  advisorLoads: { lecturerId: string; name: string; students: number }[];
  reviewerLoads: { lecturerId: string; name: string; students: number }[];
  progress: {
    activeTasks: number;
    completedTasks: number;
    unknownStudents: number;
  };
  snapshotHash: string;
  blockers: string[];
};
export type ReportExportMetadata = {
  id: string;
  actor: string;
  termId: string;
  templateCode: ReportCode;
  templateVersion: string;
  mode: "DRAFT" | "OFFICIAL";
  createdAt: string;
  expiresAt: string;
  count: number;
  snapshotHash: string;
  scopeHash: string;
  fileHash: string | null;
  sizeBytes: number | null;
  filename: string;
  status: "GENERATED" | "GENERATION_FAILED";
  signatureStatus: "UNSIGNED";
  request: ReportExport;
  errorCode: string | null;
};
