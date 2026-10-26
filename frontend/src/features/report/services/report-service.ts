import {
  assert,
  currentUser,
  mutate,
  now,
  readDb,
  uid,
} from "../../../shared/data/store";
import type { Account, DemoDb, ExportJob } from "../../../shared/data/types";
import {
  exportExcel,
  exportPdf,
  exportProposalPdf,
} from "../../../shared/services/export-service";
import { proposalLines } from "../../topic/components/ProposalDocument";
import { STEP3_API } from "../../registration/services/assignment-api";
import { hasEligibleGpa } from "../../../shared/utils/gpa";

export type ReportKind =
  | "STUDENTS"
  | "LECTURERS"
  | "ROSTER"
  | "REGISTRATIONS"
  | "ASSIGNMENTS"
  | "TOPICS"
  | "PROPOSAL";
export interface ReportFilters {
  program?: string;
  directionId?: string;
  status?: string;
  lecturerId?: string;
  studentId?: string;
  degree?: string;
}
export const reportNames: Record<ReportKind, string> = {
  STUDENTS: "Danh sách sinh viên",
  LECTURERS: "Danh sách giảng viên",
  ROSTER: "Danh sách tham gia đợt",
  REGISTRATIONS: "Đăng ký hướng và nguyện vọng",
  ASSIGNMENTS: "Kết quả phân công GVHD",
  TOPICS: "Danh sách đề tài",
  PROPOSAL: "Đề cương đồ án tốt nghiệp",
};
export function allowedReportKinds(user: Account): ReportKind[] {
  if (user.roles.some((r) => r === "ADMIN" || r === "FACULTY"))
    return Object.keys(reportNames) as ReportKind[];
  if (user.roles.includes("LECTURER") && user.lecturerId)
    return ["STUDENTS", "ROSTER", "ASSIGNMENTS", "TOPICS", "PROPOSAL"];
  if (user.roles.includes("STUDENT") && user.studentId)
    return ["ASSIGNMENTS", "PROPOSAL"];
  return [];
}

/** Read adapter for auth/Bước 1–3. Every export rechecks ownership and publication. */
export function buildReport(
  db: DemoDb,
  user: Account,
  termId: string,
  kind: ReportKind,
  filters: ReportFilters = {},
) {
  const term = db.terms.find((t) => t.id === termId);
  assert(term, "Không tìm thấy đợt.");
  assert(
    allowedReportKinds(user).includes(kind),
    "Tài khoản không có quyền xuất biểu mẫu này.",
    "FORBIDDEN",
  );
  const manager = user.roles.some((r) => r === "ADMIN" || r === "FACULTY");
  const assignments = db.assignments.filter(
    (a) =>
      a.termId === termId &&
      (manager || (term.assignmentPublished && a.published)),
  );
  const visible = (id: string) =>
    manager ||
    (user.studentId === id && assignments.some((a) => a.studentId === id)) ||
    (!!user.lecturerId &&
      assignments.some(
        (a) => a.studentId === id && a.lecturerId === user.lecturerId,
      ));
  const selectedProgram = !filters.program || term.program === filters.program;
  const students = db.students.filter((student) => {
    if (
      !selectedProgram ||
      !term.studentIds.includes(student.id) ||
      !visible(student.id) ||
      (filters.studentId && student.id !== filters.studentId)
    )
      return false;
    const registration = db.registrations.find(
      (r) => r.termId === termId && r.studentId === student.id,
    );
    const topic = db.topics.find(
      (t) => t.termId === termId && t.studentId === student.id,
    );
    const assignment = assignments.find((a) => a.studentId === student.id);
    if (
      filters.directionId &&
      registration?.directionId !== filters.directionId &&
      topic?.directionId !== filters.directionId
    )
      return false;
    if (
      filters.lecturerId &&
      assignment?.lecturerId !== filters.lecturerId &&
      !(
        kind === "REGISTRATIONS" &&
        registration?.preferences.includes(filters.lecturerId)
      )
    )
      return false;
    return true;
  });
  const lecturer = (id: string) =>
    db.lecturers.find((l) => l.id === id)?.name ?? "Chưa phân công";
  const direction = (id: string) =>
    db.catalogs.find((c) => c.kind === "direction" && c.id === id)?.name ??
    "Chưa chọn hướng";
  const subjectIds = students.map((s) => s.id);
  let rows: Record<string, unknown>[] = [];
  if (kind === "STUDENTS" || kind === "ROSTER")
    rows = students
      .filter(
        (student) =>
          !filters.status ||
          (student.eligible &&
          hasEligibleGpa(student.gpa, term.parameters.passing_gpa_threshold)
            ? "ELIGIBLE"
            : "INELIGIBLE") === filters.status,
      )
      .map((student) => ({
        "Mã sinh viên": student.code,
        "Họ và tên": student.name,
        Lớp: student.className,
        "Hệ đào tạo": student.program,
        Email: student.email,
        "Số điện thoại": student.phone,
        GPA: student.gpa === null ? "—" : student.gpa,
        "Điều kiện học vụ":
          student.eligible &&
          hasEligibleGpa(student.gpa, term.parameters.passing_gpa_threshold)
            ? "Đủ điều kiện"
            : "Chưa đủ điều kiện",
        GVHD: lecturer(
          assignments.find((a) => a.studentId === student.id)?.lecturerId ?? "",
        ),
        Đợt: term.code,
      }));
  if (kind === "LECTURERS")
    rows = selectedProgram
      ? term.lecturers
          .filter(
            (member) =>
              (!filters.lecturerId ||
                member.lecturerId === filters.lecturerId) &&
              (!filters.directionId ||
                db.lecturers
                  .find((l) => l.id === member.lecturerId)
                  ?.directionIds.includes(filters.directionId)),
          )
          .flatMap((member) => {
            const item = db.lecturers.find((l) => l.id === member.lecturerId);
            if (!item) return [];
            const load = assignments.filter(
              (a) => a.lecturerId === member.lecturerId,
            ).length;
            if (
              filters.status &&
              (load >= member.quota ? "FULL" : "AVAILABLE") !== filters.status
            )
              return [];
            return [
              {
                "Mã giảng viên": item.code,
                "Họ và tên": item.name,
                "Bộ môn": db.catalogs.find((c) => c.id === item.departmentId)
                  ?.name,
                "Hướng chuyên môn": item.directionIds.map(direction).join(", "),
                Email: item.email,
                "Số điện thoại": item.phone,
                "Quota đợt": member.quota,
                "Đã phân công": load,
                "Còn nhận": Math.max(0, member.quota - load),
                Đợt: term.code,
              },
            ];
          })
      : [];
  if (kind === "REGISTRATIONS")
    rows = db.registrations
      .filter(
        (r) =>
          r.termId === termId &&
          subjectIds.includes(r.studentId) &&
          (!filters.status || r.status === filters.status),
      )
      .map((r) => {
        const student = students.find((s) => s.id === r.studentId)!;
        return {
          "Mã sinh viên": student.code,
          "Họ và tên": student.name,
          Lớp: student.className,
          "Hướng đăng ký": direction(r.directionId),
          NV1: lecturer(r.preferences[0] ?? ""),
          NV2: r.preferences[1] ? lecturer(r.preferences[1]) : "",
          NV3: r.preferences[2] ? lecturer(r.preferences[2]) : "",
          "Ghi chú": r.note,
          "Trạng thái": r.status === "SUBMITTED" ? "Đã nộp" : "Bản nháp",
          "Cập nhật": r.updatedAt,
          Đợt: term.code,
        };
      });
  if (kind === "ASSIGNMENTS")
    rows = students.flatMap((student) => {
      const item = assignments.find((a) => a.studentId === student.id);
      const status = item
        ? item.published && term.assignmentPublished
          ? "PUBLISHED"
          : "DRAFT"
        : "UNASSIGNED";
      if (filters.status && filters.status !== status) return [];
      const registration = db.registrations.find(
        (r) => r.termId === termId && r.studentId === student.id,
      );
      return [
        {
          "Mã sinh viên": student.code,
          "Họ và tên": student.name,
          Lớp: student.className,
          GPA: student.gpa === null ? "—" : student.gpa,
          Hướng: direction(registration?.directionId ?? ""),
          GVHD: lecturer(item?.lecturerId ?? ""),
          "Cách phân": item
            ? item.manual
              ? "Điều chỉnh thủ công"
              : item.preference <= 3
                ? `NV${item.preference}`
                : "Tự phân theo hướng"
            : "Chưa được phân",
          "Lý do điều chỉnh": item?.reason ?? "",
          "Trạng thái":
            status === "PUBLISHED"
              ? "Đã công bố"
              : status === "DRAFT"
                ? "Phương án nháp"
                : "Chưa phân công",
          Đợt: term.code,
        },
      ];
    });
  const topics = db.topics.filter(
    (topic) =>
      topic.termId === termId &&
      subjectIds.includes(topic.studentId) &&
      (!filters.status || topic.status === filters.status),
  );
  if (kind === "TOPICS" || kind === "PROPOSAL")
    rows = topics.map((topic) => {
      const student = students.find((s) => s.id === topic.studentId)!;
      const advisor = db.lecturers.find((l) => l.id === topic.lecturerId);
      return {
        "Mã sinh viên": student.code,
        "Sinh viên": student.name,
        Lớp: student.className,
        "Hệ đào tạo": term.program,
        "Email sinh viên": student.email,
        "SĐT sinh viên": student.phone,
        "Đề tài": topic.title,
        Hướng: direction(topic.directionId),
        GVHD: lecturer(topic.lecturerId),
        "Email GVHD": advisor?.email,
        "SĐT GVHD": advisor?.phone,
        "GVHD thống nhất": topic.advisorAgreed
          ? "Đã thống nhất"
          : "Chưa thống nhất",
        "Trạng thái đề cương": topic.status,
        "Phiên bản đã nộp": topic.versions.length,
        ...(kind === "PROPOSAL"
          ? {
              "Mục tiêu": topic.objectives,
              "Nội dung và phạm vi": topic.scope,
              "Công nghệ": topic.technology,
              "Kết quả dự kiến": topic.expected,
              "Kế hoạch": topic.plan
                .map((p) => `Tuần ${p.week}: ${p.content}`)
                .join("\n"),
              "Chữ ký": "Trưởng Khoa | Trưởng Bộ môn | GVHD | Sinh viên",
            }
          : {}),
        Đợt: term.code,
      };
    });
  const degree = filters.degree === "Kỹ sư" ? "Kỹ sư" : "Cử nhân";
  const lines =
    kind === "PROPOSAL"
      ? topics.flatMap((topic, index) => [
          `HỒ SƠ ${index + 1} / ${topics.length}`,
          "BẢN DEMO · CHƯA PHÊ DUYỆT BỞI KHOA",
          ...proposalLines(db, topic, degree),
          "",
        ])
      : [
          `Đợt: ${term.name} (${term.code})`,
          `Hệ đào tạo: ${term.program}`,
          `Phạm vi dữ liệu: ${rows.length} bản ghi`,
          kind === "ASSIGNMENTS"
            ? term.assignmentPublished
              ? "KẾT QUẢ PHÂN CÔNG ĐÃ CÔNG BỐ"
              : "PHƯƠNG ÁN NHÁP · CHƯA CÔNG BỐ"
            : "Dữ liệu demo phục vụ Bước 1–3",
          ...rows.flatMap((row, index) => [
            `BẢN GHI ${index + 1}`,
            ...Object.entries(row)
              .filter(
                ([, value]) =>
                  value !== undefined && value !== null && value !== "",
              )
              .map(([key, value]) => `${key}: ${String(value)}`),
            "",
          ]),
        ];
  return { title: reportNames[kind], rows, lines };
}

export async function createReport(
  termId: string,
  kind: ReportKind,
  format: ExportJob["format"],
  filters: ReportFilters = {},
) {
  const db = readDb();
  const user = currentUser(db);
  assert(user, "Vui lòng đăng nhập.", "UNAUTHENTICATED");
  const report = buildReport(db, user, termId, kind, filters);
  assert(
    report.rows.length,
    "Không có dữ liệu phù hợp để xuất.",
    "EXPORT_EMPTY",
  );
  const job = mutate(
    "Tạo công việc xuất dữ liệu Bước 1–3",
    ["ADMIN", "FACULTY", "LECTURER", "STUDENT"],
    (draft) => {
      const item: ExportJob = {
        id: uid("export"),
        termId,
        name: report.title,
        format,
        status: "PENDING",
        at: now(),
        error: "",
        requestedBy: user.id,
        reportKind: kind,
        filters: { ...filters },
      };
      draft.exports.unshift(item);
      return item;
    },
  );
  try {
    if (STEP3_API && kind === "PROPOSAL" && format === "PDF") {
      const subjects = new Set(report.rows.map((row) => row["Mã sinh viên"]));
      const topics = db.topics.filter(
        (t) =>
          t.termId === termId &&
          subjects.has(
            db.students.find((s) => s.id === t.studentId)?.code ?? "",
          ),
      );
      for (const topic of topics)
        await exportProposalPdf(
          topic,
          filters.degree ?? "Cử nhân",
          async () => {},
        );
    } else if (format === "PDF")
      await exportPdf(
        report.title,
        report.lines,
        `${kind.toLowerCase()}-${termId}.pdf`,
      );
    else
      await exportExcel(
        report.title,
        report.rows,
        `${kind.toLowerCase()}-${termId}.xlsx`,
      );
    mutate("Hoàn tất xuất dữ liệu Bước 1–3", undefined, (draft) => {
      const item = draft.exports.find((e) => e.id === job.id);
      if (item) {
        item.status = "COMPLETED";
        item.completedAt = now();
      }
    });
  } catch (error) {
    mutate("Xuất dữ liệu Bước 1–3 thất bại", undefined, (draft) => {
      const item = draft.exports.find((e) => e.id === job.id);
      if (item) {
        item.status = "FAILED";
        item.error =
          error instanceof Error ? error.message : "Không thể tạo tệp";
      }
    });
    throw error;
  }
  return job.id;
}
