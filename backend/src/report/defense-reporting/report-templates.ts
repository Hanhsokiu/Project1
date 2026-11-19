import { applicationPolicyRuntimeAllowed } from "../../common/security/application-policy-runtime";
import { Injectable } from "@nestjs/common";
import {
  ReportCodeSchema,
  ReportPolicySchema,
  scoreFraction,
} from "@doan/shared";
import type {
  ReportCode,
  ReportColumn,
  ReportPolicy,
  ReportTemplate,
} from "@doan/shared";
export const reportNames: Record<ReportCode, string> = {
  XLSX_STUDENTS: "Danh sách sinh viên theo đợt/lớp",
  XLSX_COMMITTEES: "Danh sách hội đồng",
  XLSX_COMMITTEE_STUDENTS: "Sinh viên theo hội đồng",
  XLSX_REVIEWERS: "Danh sách phân công phản biện",
  XLSX_COMMITTEE_RESULTS: "Bảng điểm hội đồng",
  XLSX_CLASS_RESULTS: "Bảng điểm theo lớp/bộ môn",
  XLSX_TERM_RESULTS: "Bảng điểm toàn đợt",
  XLSX_OFFICIAL_RESULTS: "Kết quả bảo vệ chính thức",
  PDF_ADVISOR_GRADE: "Phiếu nhận xét và điểm GVHD",
  PDF_REVIEWER_GRADE: "Phiếu nhận xét và điểm phản biện",
  PDF_COMMITTEE: "Hội đồng và vai trò",
  PDF_COMMITTEE_RESULTS: "Bảng điểm hội đồng để in/ký",
  PDF_MINUTES: "Biên bản bảo vệ",
  PDF_RESULTS: "Báo cáo kết quả bảo vệ",
  PDF_DOSSIER: "Đề cương đã chốt B1–B8",
};
export const resultReport = (code: ReportCode) => /RESULTS|MINUTES/.test(code);
export const committeeReport = (code: ReportCode) =>
  code === "XLSX_COMMITTEES" || code === "PDF_COMMITTEE";
export const columnNames: Record<ReportColumn, string> = {
  ORDER: "Thứ tự",
  STUDENT_CODE: "Mã sinh viên",
  FAMILY_NAME: "Họ đệm",
  GIVEN_NAME: "Tên",
  STUDENT_NAME: "Họ và tên",
  CLASS: "Lớp",
  TITLE: "Tên đề tài",
  RESEARCH_AREA: "Hướng nghiên cứu",
  ADVISOR: "GVHD",
  REVIEWERS: "GVPB",
  COMMITTEE: "Hội đồng",
  LECTURER: "Giảng viên",
  ROLE: "Vai trò",
  DATE: "Ngày bảo vệ",
  PERIOD: "Buổi",
  ROOM: "Phòng",
  ADVISOR_SCORE: "Điểm GVHD",
  REVIEWER_SCORE: "Điểm phản biện",
  COMMITTEE_SCORE: "Điểm hội đồng",
  MEMBER_SCORES: "Điểm từng thành viên hội đồng",
  REVIEWER_SCORES: "Điểm từng GVPB",
  FINAL_SCORE: "Điểm cuối",
  RESULT: "Kết quả",
  COMMENTS: "Nhận xét",
  QUESTIONS: "Câu hỏi",
  CONCLUSION: "Kết luận",
  REVISION_REQUESTS: "Yêu cầu chỉnh sửa",
  STATE: "Trạng thái nguồn",
  SIGNATURE_STATUS: "Ký xác nhận",
};
const identity: ReportColumn[] = [
    "STUDENT_CODE",
    "FAMILY_NAME",
    "GIVEN_NAME",
    "CLASS",
    "TITLE",
  ],
  scores: ReportColumn[] = [
    "MEMBER_SCORES",
    "REVIEWER_SCORES",
    "ADVISOR_SCORE",
    "REVIEWER_SCORE",
    "COMMITTEE_SCORE",
    "FINAL_SCORE",
    "RESULT",
  ];
export function defaultColumns(code: ReportCode): ReportColumn[] {
  if (committeeReport(code)) return ["COMMITTEE", "LECTURER", "ROLE", "STATE"];
  if (code === "XLSX_REVIEWERS")
    return [...identity, "COMMITTEE", "REVIEWERS", "STATE"];
  if (code === "PDF_ADVISOR_GRADE")
    return [
      ...identity,
      "ADVISOR",
      "ADVISOR_SCORE",
      "COMMENTS",
      "SIGNATURE_STATUS",
    ];
  if (code === "PDF_REVIEWER_GRADE")
    return [
      ...identity,
      "LECTURER",
      "REVIEWER_SCORE",
      "COMMENTS",
      "QUESTIONS",
      "SIGNATURE_STATUS",
    ];
  if (code === "PDF_DOSSIER") return [...identity, "ADVISOR"];
  if (resultReport(code))
    return [
      "ORDER",
      ...identity,
      "ADVISOR",
      "REVIEWERS",
      "COMMITTEE",
      ...scores,
      "STATE",
      ...(code === "PDF_MINUTES"
        ? ([
            "DATE",
            "PERIOD",
            "ROOM",
            "CONCLUSION",
            "COMMENTS",
            "REVISION_REQUESTS",
            "SIGNATURE_STATUS",
          ] as ReportColumn[])
        : []),
    ];
  return [...identity, "ADVISOR", "COMMITTEE", "STATE"];
}
export function contentActions(t: ReportTemplate) {
  const actions = ["list-export"];
  if (
    t.columns.some((c) =>
      [
        "ADVISOR_SCORE",
        "REVIEWER_SCORE",
        "COMMITTEE_SCORE",
        "MEMBER_SCORES",
        "REVIEWER_SCORES",
      ].includes(c),
    )
  )
    actions.push("components-export");
  if (resultReport(t.code) || t.columns.includes("FINAL_SCORE"))
    actions.push("final-export");
  if (t.columns.some((c) => ["COMMENTS", "QUESTIONS"].includes(c)))
    actions.push("comments-export");
  if (t.code === "PDF_MINUTES") actions.push("minutes-export");
  if (t.code === "PDF_DOSSIER") actions.push("dossier-export", "pii-export");
  return actions;
}
@Injectable()
export class ReportTemplates {
  policy(raw?: string | null): ReportPolicy | null {
    try {
      const p = ReportPolicySchema.parse(JSON.parse(raw ?? "null"));
      if (!applicationPolicyRuntimeAllowed(p)) return null;
      if (
        Date.parse(p.approvedAt) > Date.now() ||
        new Set(p.templates.map((t) => t.code)).size !== p.templates.length
      )
        return null;
      if (
        p.templates.some(
          (t) =>
            (t.approval && Date.parse(t.approval.at) > Date.now()) ||
            (t.effectiveFrom &&
              t.effectiveUntil &&
              Date.parse(t.effectiveFrom) >= Date.parse(t.effectiveUntil)) ||
            t.columns.some((c) => !defaultColumns(t.code).includes(c)),
        )
      )
        return null;
      if (
        p.incompleteDraft &&
        p.templates.some(
          (t) => resultReport(t.code) && !t.columns.includes("STATE"),
        )
      )
        return null;
      const cmp = (a: string, b: string) => {
        const x = scoreFraction(a),
          y = scoreFraction(b);
        return x.n * y.d - y.n * x.d;
      };
      const bins = [...p.distribution].sort((a, b) =>
        cmp(a.from, b.from) < 0n ? -1 : 1,
      );
      if (
        new Set(bins.map((b) => b.label)).size !== bins.length ||
        bins.some(
          (b, i) =>
            cmp(b.from, b.to) >= 0n ||
            (i > 0 &&
              (cmp(b.from, bins[i - 1].to) < 0n ||
                (cmp(b.from, bins[i - 1].to) === 0n &&
                  bins[i - 1].includeUpper))),
        )
      )
        return null;
      return p;
    } catch {
      return null;
    }
  }
  all(policy: ReportPolicy | null): ReportTemplate[] {
    return ReportCodeSchema.options.map(
      (code) =>
        policy?.templates.find((t) => t.code === code) ?? {
          code,
          version: "ENGINEERING_DRAFT_V1",
          name: reportNames[code],
          format: code.startsWith("XLSX_") ? "XLSX" : "PDF",
          engineVersion: "UC25_V1",
          owner: "PENDING_APPROVAL",
          status: "DRAFT",
          approval: null,
          effectiveFrom: null,
          effectiveUntil: null,
          roles: ["FACULTY", "LECTURER"],
          columns: defaultColumns(code),
          draftAllowed: true,
          requirePublished: true,
          allowMissing: ["CONCLUSION", "DEFENSE_REMARKS", "REVISION_REQUESTS"],
          signatureRoles: [],
          institution: null,
          dossierTemplateVersion: null,
        },
    );
  }
  blockers(
    t: ReportTemplate,
    mode: "DRAFT" | "OFFICIAL",
    policy: ReportPolicy | null,
  ): string[] {
    const b: string[] = [];
    if (!policy) b.push("UC25_POLICY_REQUIRED");
    if (
      mode === "OFFICIAL" &&
      (t.status !== "APPROVED" || !t.approval || !t.institution)
    )
      b.push("TEMPLATE_NOT_APPROVED");
    if (mode === "DRAFT" && !t.draftAllowed) b.push("DRAFT_NOT_ALLOWED");
    if (
      (t.effectiveFrom && Date.now() < Date.parse(t.effectiveFrom)) ||
      (t.effectiveUntil && Date.now() >= Date.parse(t.effectiveUntil))
    )
      b.push("TEMPLATE_NOT_EFFECTIVE");
    return b;
  }
}
