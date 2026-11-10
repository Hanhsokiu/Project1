import { HttpException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  DossierPrintSnapshot,
  EffectiveCommittee,
  EffectiveFinalResult,
  ReportFilter,
  ReportRow,
  ReportTemplate,
} from "@doan/shared";
import { CommitteeWorkflowService } from "../../defense/committees/committee-workflow.service";
import { ReviewerService } from "../../defense/reviewers/reviewer.service";
import { ReviewerGradeService } from "../../defense/reviewer-grading/reviewer-grade.service";
import { CommitteeGradeService } from "../../defense/committee-grading/committee-grade.service";
import { CommitteeGradeValidator } from "../../defense/committee-grading/committee-grade.validator";
import { FinalResultService } from "../../defense/final-results/final-result.service";
import { AdvisorGradeReader } from "../../defense/final-results/advisor-grade.reader";
import { EligibilityService } from "../../defense/eligibility/eligibility.service";
import { ScheduleService } from "../../defense/scheduling/schedule.service";
import { currentGradeSchedule } from "../../defense/grading/grade-evidence";
import {
  ProposalReviewValidator,
  reviewHash,
} from "../../topic/proposal-reviews/proposal-review.validator";
import type { ReviewPrincipal } from "../../topic/proposal-reviews/proposal-review.repository";
import { GuidanceValidator } from "../../guidance/tasks/guidance.validator";
import { DossierValidator } from "../../topic/proposal-dossiers/dossier.validator";
import { ReportSession } from "./report.repository";
import { committeeReport, resultReport } from "./report-templates";
import { groupError } from "../../topic/review-groups/review-group.errors";
const missing = (): never =>
  groupError(
    404,
    "COMMON_001",
    "Không tìm thấy báo cáo trong phạm vi được cấp quyền.",
  );
const issue = (e: unknown) => {
  if (
    e instanceof HttpException &&
    [401, 403, 404, 409].includes(e.getStatus())
  )
    return "SOURCE_NOT_CURRENT";
  throw e;
};
export type ReportAccess = {
  u: ReviewPrincipal;
  role: "FACULTY" | "LECTURER";
  departments: string[] | null;
  committee: EffectiveCommittee | null;
};
export type ReportFact = {
  memberId: string;
  department: string;
  className: string;
  researchArea: string;
  advisor: { id: string; name: string } | null;
  reviewers: { id: string; name: string }[];
  committee: EffectiveCommittee | null;
  sessionId: string | null;
  eligible: boolean | null;
  reviewerSheets: number | null;
  committeeSheets: number | null;
  result: EffectiveFinalResult | null;
  state: string;
  row: ReportRow;
  proof: unknown[];
  progress: { active: number; completed: number } | null;
};
export type ReportSnapshot = {
  termId: string;
  termCode: string;
  termName: string;
  facts: ReportFact[];
  committees: EffectiveCommittee[];
  rows: ReportRow[];
  blockers: string[];
  hash: string;
  dossier: {
    snapshot: DossierPrintSnapshot;
    version: string;
    id: string;
    at: string;
  } | null;
  capabilities: {
    committees: boolean;
    schedules: boolean;
    reviewers: boolean;
    grades: boolean;
    results: boolean;
  };
  committeeMembers: { committeeId: string; name: string; role: string }[];
};
@Injectable()
export class ReportReader {
  constructor(
    private readonly committees: CommitteeWorkflowService,
    private readonly reviewers: ReviewerService,
    private readonly reviewerGrades: ReviewerGradeService,
    private readonly committeeGrades: CommitteeGradeService,
    private readonly cgValidator: CommitteeGradeValidator,
    private readonly results: FinalResultService,
    private readonly advisors: AdvisorGradeReader,
    private readonly eligibility: EligibilityService,
    private readonly schedules: ScheduleService,
    private readonly review: ProposalReviewValidator,
    private readonly roles: GuidanceValidator,
    private readonly dossierValidator: DossierValidator,
    private readonly config: ConfigService,
  ) {}
  has(
    u: ReviewPrincipal,
    role: string,
    action: string,
    resource = "defense-report",
  ) {
    return this.roles.role(u, role, resource, action);
  }
  private async effectiveCommittee(
    s: ReportSession,
    termId: string,
    id: string,
  ) {
    if (!(await s.ccReady())) return null;
    const row = (await s.ccList(termId)).find((c) => c.id === id);
    if (!row?.finalizedBy) return null;
    try {
      const w = await this.committees.workspaceInSession(
          s,
          row.finalizedBy,
          termId,
        ),
        v = w.committees.find((c) => c.id === id);
      if (!v?.downstream) return null;
      return await this.committees.effectiveInSession(
        s,
        row.finalizedBy,
        termId,
        id,
        v.revision,
        v.downstream.evidenceHash,
      );
    } catch (e) {
      issue(e);
      return null;
    }
  }
  async access(
    s: ReportSession,
    actor: string,
    f: ReportFilter,
    action: string,
  ): Promise<ReportAccess> {
    const u = this.review.principal(await s.principal(actor));
    if (f.from && f.to && Date.parse(f.from) >= Date.parse(f.to))
      groupError(400, "COMMON_003", "Khoảng ngày không hợp lệ.");
    if (this.has(u, "FACULTY", "read") && this.has(u, "FACULTY", action)) {
      const grants = (await s.grants(actor, f.termId)).filter(
          (g) => g.termId === f.termId,
        ),
        all = grants.some((g) => g.allDepartments),
        deps = [
          ...new Set(
            grants.flatMap((g) =>
              g.pr2bGrantDepartmentGrantId.map((d) => d.departmentId),
            ),
          ),
        ];
      const committee = f.committeeId
        ? (await s.ccList(f.termId)).find(c => c.id === f.committeeId)
        : null;
      const committeeAllowed = !f.committeeId || !!(
        committee && committee.termId === f.termId &&
        (all || (committee.departmentId && deps.includes(committee.departmentId)))
      );
      if (
        (all || deps.length) &&
        (!f.departmentId || all || deps.includes(f.departmentId)) &&
        committeeAllowed
      )
        return {
          u,
          role: "FACULTY",
          departments: f.departmentId
            ? [f.departmentId]
            : all
              ? null
              : deps.sort(),
          committee: null,
        };
    }
    if (
      u.lecturer?.isActive &&
      f.committeeId &&
      this.has(u, "LECTURER", "read") &&
      this.has(u, "LECTURER", action)
    ) {
      const c = await this.effectiveCommittee(s, f.termId, f.committeeId);
      if (
        c &&
        c.members.some((m) => m.lecturerId === u.lecturer!.id) &&
        (!f.departmentId || c.departmentId === f.departmentId)
      )
        return {
          u,
          role: "LECTURER",
          departments: [c.departmentId],
          committee: c,
        };
    }
    return missing();
  }
  async collect(
    s: ReportSession,
    a: ReportAccess,
    f: ReportFilter,
    template: ReportTemplate | null,
    memberResults: boolean,
    statistics = template === null,
  ): Promise<ReportSnapshot> {
    const term = await s.term(f.termId);
    if (!term) return missing();
    const cap = this.config.get<number>("UC25_MAX_CANDIDATES", 1000),
      max = template ? this.config.get<number>("UC25_MAX_ROWS", 100) : cap,
      candidates = await s.rpCandidates(
        f.termId,
        f.className,
        cap,
        f.termStudentId,
      );
    if (candidates.length > cap)
      groupError(
        409,
        "REPORT_LIMIT_EXCEEDED",
        "Thu hẹp kỳ/lớp trước khi xuất.",
      );
    const committeeRows = (await s.ccReady()) ? await s.ccList(f.termId) : [],
      ef = new Map<string, EffectiveCommittee>(),
      blockers: string[] = [],
      facts: ReportFact[] = [],
      rows: ReportRow[] = [];
    for (const row of committeeRows) {
      if (
        (f.committeeId && row.id !== f.committeeId) ||
        (a.departments &&
          (!row.departmentId || !a.departments.includes(row.departmentId)))
      )
        continue;
      const c =
        a.committee?.committeeId === row.id
          ? a.committee
          : await this.effectiveCommittee(s, f.termId, row.id);
      if (c) ef.set(c.committeeId, c);
    }
    if (f.committeeId && !ef.has(f.committeeId))
      groupError(
        409,
        "COMMITTEE_NOT_CURRENT",
        "Hội đồng chưa chốt hoặc không còn hiệu lực.",
      );
    const roster = await s.ccLecturers(f.termId),
      name = (id: string) => roster.find((l) => l.id === id)?.fullName ?? id,
      gradeRead =
        (statistics && this.has(a.u, a.role, "grade-statistics")) ||
        (!!template &&
          (resultReport(template.code) || /GRADE/.test(template.code))),
      resultsRead =
        (!!template && resultReport(template.code)) ||
        (!template &&
          statistics &&
          (this.has(a.u, a.role, "score-statistics") ||
            this.has(a.u, a.role, "grade-statistics"))),
      cgPolicy = (await s.cgReady())
        ? this.cgValidator.policy((await s.cgPolicy(f.termId))?.value)
        : null,
      reviewerReady = await s.rgReady();
    let dossier: ReportSnapshot["dossier"] = null;
    for (const candidate of candidates) {
      if (f.termStudentId && candidate.id !== f.termStudentId) continue;
      const m = await s.member(candidate.id);
      if (!m || m.termId !== f.termId || !m.student.isActive) continue;
      const owner = await s.memberProposal(m.id),
        p = owner.proposals.length === 1 ? owner.proposals[0] : null;
      if (
        p &&
        (p.termId !== f.termId ||
          p.studentId !== m.studentId ||
          this.review.ownership(p).termStudentId !== m.id)
      )
        continue;
      const dep =
          p?.topic.researchArea?.pr2bResearchAreaWorkflowResearchAreaId
            ?.departmentId ?? "",
        c =
          [...ef.values()].find((c) =>
            c.students.some(
              (x) => x.termStudentId === m.id && x.proposalId === p?.id,
            ),
          ) ?? null;
      if (
        (a.departments && !a.departments.includes(dep)) ||
        (f.committeeId && c?.committeeId !== f.committeeId) ||
        (a.role === "LECTURER" && c?.committeeId !== a.committee?.committeeId)
      )
        continue;
      if (facts.length >= max)
        groupError(
          409,
          "REPORT_LIMIT_EXCEEDED",
          "Số sinh viên vượt giới hạn báo cáo; hãy thu hẹp bộ lọc.",
        );
      const parts = m.student.fullName.trim().normalize("NFC").split(/\s+/),
        reviewerRows: ReportRow[] = [],
        cells: ReportRow["cells"] = {
          STUDENT_CODE: m.student.studentCode,
          FAMILY_NAME: parts.slice(0, -1).join(" "),
          GIVEN_NAME: parts[parts.length - 1] ?? "",
          STUDENT_NAME: m.student.fullName,
          CLASS: m.student.className,
          TITLE: p?.topic.title ?? "",
          RESEARCH_AREA: p?.topic.researchArea?.name ?? "",
          COMMITTEE: c?.code ?? "",
          SIGNATURE_STATUS: "CHƯA KÝ — không có chứng cứ chữ ký",
        },
        missingSources: string[] = [],
        proof: unknown[] = [c],
        fact: ReportFact = {
          memberId: m.id,
          department: dep,
          className: m.student.className,
          researchArea: p?.topic.researchArea?.name ?? "",
          advisor: null,
          reviewers: [],
          committee: c,
          sessionId: null,
          eligible: null,
          reviewerSheets: reviewerReady ? 0 : null,
          committeeSheets: cgPolicy ? 0 : null,
          result: null,
          state: "MISSING",
          row: {
            cells,
            missing: missingSources,
            sourceState: "BASELINE_RECORD",
          },
          proof,
          progress: null,
        };
      if (p) {
        try {
          const advisor = await this.review.advisor(s, p);
          fact.advisor = {
            id: advisor.assignment.advisorId,
            name: name(advisor.assignment.advisorId),
          };
          cells.ADVISOR = fact.advisor.name;
          proof.push({
            advisor: advisor.assignment.id,
            revision: advisor.revision,
          });
        } catch (e) {
          issue(e);
        }
        if (c) fact.eligible = true;
        else if (await s.eligibilitySchemaReady()) {
          const row = await s.eligibility(p.id);
          if (row?.finalizedBy)
            try {
              const view = await this.eligibility.forCommittee(
                s,
                row.finalizedBy,
                m.id,
                f.termId,
              );
              fact.eligible = view.effective ? true : null;
              proof.push(view.effective);
            } catch (e) {
              issue(e);
            }
        }
        if (c && (await s.scReady())) {
          const schedule = await currentGradeSchedule(s, this.schedules, {
            termId: f.termId,
            committeeId: c.committeeId,
            termStudentId: m.id,
            proposalId: p.id,
          });
          if (schedule) {
            const slot = schedule.slots.find((x) => x.termStudentId === m.id)!,
              room = (await s.scRooms()).find((r) => r.id === schedule.roomId);
            fact.sessionId = schedule.sessionId;
            cells.DATE = slot.startAt;
            cells.PERIOD = schedule.period;
            cells.ROOM = room?.name ?? "";
            cells.ORDER = String(slot.order);
            proof.push(schedule);
          }
        }
        if (reviewerReady) {
          const assignments = (await s.rgAssignments(f.termId)).filter(
              (r) =>
                r.termStudentId === m.id && r.proposalId === p.id && r.selected,
            ),
            actor = assignments[0]?.finalizedBy;
          if (actor)
            try {
              const w = await this.reviewers.workspaceInSession(
                  s,
                  actor,
                  f.termId,
                ),
                v = w.students.find((v) => v.id === m.id);
              if (v?.downstream) {
                const effective = await this.reviewers.effectiveInSession(
                  s,
                  actor,
                  f.termId,
                  m.id,
                  v.revision,
                  v.evidenceHash,
                );
                proof.push(effective);
                fact.reviewers = effective.map((r) => ({
                  id: r.lecturerId,
                  name: name(r.lecturerId),
                }));
                cells.REVIEWERS = fact.reviewers.map((r) => r.name).join("; ");
                if (gradeRead)
                  for (const r of effective) {
                    const score = await s.rgScore(p.id, r.lecturerId),
                      who = (score?.context as { finalizedBy?: string } | null)
                        ?.finalizedBy;
                    if (!score || !who) continue;
                    try {
                      const g = await this.reviewerGrades.effectiveInSession(
                        s,
                        who,
                        f.termId,
                        m.id,
                        r.lecturerId,
                        score.revision,
                      );
                      fact.reviewerSheets!++;
                      proof.push(g);
                      if (
                        template?.code === "PDF_REVIEWER_GRADE" &&
                        (!f.lecturerId || r.lecturerId === f.lecturerId)
                      ) {
                        if (
                          (a.role === "LECTURER" &&
                            a.u.lecturer?.id !== r.lecturerId) ||
                          (a.role === "FACULTY" &&
                            !this.has(
                              a.u,
                              "FACULTY",
                              "comment-read",
                              "defense-reviewer-grade",
                            ))
                        )
                          groupError(
                            403,
                            "AUTH_004",
                            "Thiếu quyền nội dung phiếu phản biện.",
                          );
                        const ctx = score.context as {
                          command: {
                            comment: string;
                            strengths: string;
                            weaknesses: string;
                            questions: string;
                          };
                        };
                        reviewerRows.push({
                          cells: {
                            ...cells,
                            LECTURER: name(r.lecturerId),
                            REVIEWER_SCORE: g.totalScore,
                            COMMENTS: [
                              ctx.command.comment,
                              ctx.command.strengths,
                              ctx.command.weaknesses,
                            ]
                              .filter(Boolean)
                              .join("\n"),
                            QUESTIONS: ctx.command.questions,
                          },
                          missing: [],
                          sourceState: "CURRENT",
                        });
                      }
                    } catch (e) {
                      if (e instanceof HttpException && e.getStatus() === 403)
                        throw e;
                      issue(e);
                    }
                  }
              }
            } catch (e) {
              if (e instanceof HttpException && e.getStatus() === 403) throw e;
              issue(e);
            }
        }
        if (gradeRead && c && cgPolicy)
          for (const member of c.members.filter((x) =>
            cgPolicy.gradingRoles.includes(x.role),
          )) {
            const grades = await s.cgScores(p.id, member.lecturerId),
              score = grades.length === 1 ? grades[0] : null,
              actor = (score?.context as { finalizedBy?: string } | null)
                ?.finalizedBy;
            if (score && actor)
              try {
                const g = await this.committeeGrades.effectiveInSession(
                  s,
                  actor,
                  f.termId,
                  c.committeeId,
                  m.id,
                  member.lecturerId,
                  score.revision,
                );
                fact.committeeSheets!++;
                proof.push(g);
              } catch (e) {
                issue(e);
              }
          }
        if (resultsRead || f.state) {
          if (!this.has(a.u, a.role, "components-read", "defense-result"))
            groupError(403, "AUTH_004", "Cần quyền đọc kết quả UC24.");
          if (a.role === "LECTURER" && !memberResults)
            groupError(
              403,
              "AUTH_004",
              "Policy chưa cho thành viên hội đồng xuất kết quả.",
            );
          if (await s.frReady()) {
            const row = await s.frRow(p.id);
            if (row) {
              try {
                const actor = a.role === "FACULTY" ? a.u.id : row.finalizedBy;
                if (!actor) throw new HttpException({}, 409);
                const r = await this.results.effectiveInSession(
                  s,
                  actor,
                  f.termId,
                  m.id,
                  row.revision,
                );
                if (
                  r.proposalId !== p.id ||
                  r.termStudentId !== m.id ||
                  r.committeeId !== c?.committeeId
                )
                  throw new HttpException({}, 409);
                fact.result = r;
                fact.state =
                  r.publicationStatus === "PUBLISHED"
                    ? "PUBLISHED"
                    : "FINALIZED";
                proof.push(r);
                cells.FINAL_SCORE = r.calculation.finalScore;
                cells.RESULT =
                  r.calculation.isPassed === null
                    ? "CHƯA ÁP DỤNG QUY ĐỊNH ĐẠT"
                    : r.calculation.isPassed
                      ? "Đạt"
                      : "Chưa đạt";
                if (
                  this.has(a.u, a.role, "components-export") ||
                  this.has(a.u, a.role, "score-statistics")
                ) {
                  cells.ADVISOR_SCORE =
                    r.calculation.components.ADVISOR_UC17 ?? "";
                  cells.REVIEWER_SCORE = r.calculation.reviewerScore ?? "";
                  cells.COMMITTEE_SCORE = r.calculation.committeeScore ?? "";
                  cells.MEMBER_SCORES = r.sources
                    .filter((source) => source.source === "COMMITTEE")
                    .map(
                      (source) =>
                        name(source.lecturerId) +
                        " (" +
                        source.role +
                        "): " +
                        source.totalScore,
                    )
                    .join("\n");
                  cells.REVIEWER_SCORES = r.sources
                    .filter((source) => source.source === "REVIEWER")
                    .map(
                      (source) =>
                        name(source.lecturerId) + ": " + source.totalScore,
                    )
                    .join("\n");
                }
              } catch (e) {
                issue(e);
                fact.state = "STALE";
              }
            }
          }
        }
        if (template?.code === "PDF_ADVISOR_GRADE")
          try {
            if (
              a.role !== "FACULTY" ||
              !this.has(a.u, "FACULTY", "comment-read", "defense-confirmation")
            )
              groupError(403, "AUTH_004", "Thiếu quyền nội dung GVHD.");
            const g = await this.advisors.effectiveInSession(
                s,
                f.termId,
                m.id,
                p.id,
              ),
              score = await s.advisorScore(p.id, g.lecturerId);
            proof.push(g);
            cells.ADVISOR_SCORE = g.totalScore;
            cells.COMMENTS = score!.comment!;
            fact.row.sourceState = "CURRENT";
          } catch (e) {
            if (e instanceof HttpException && e.getStatus() === 403) throw e;
            issue(e);
            missingSources.push("ADVISOR_GRADE");
          }
        if (template?.code === "PDF_DOSSIER")
          try {
            if (!this.has(a.u, a.role, "export", "dossier"))
              groupError(403, "AUTH_004", "Thiếu quyền xuất đề cương B1–B8.");
            const official = await this.roles.official(s, p),
              valid = await this.roles.finalized(s, p),
              snapshot = this.dossierValidator.snapshotIntegrity(
                valid.f.printSnapshot,
                valid.f.contentHash,
              );
            if (
              snapshot.assignmentId !== official.assignment.id ||
              snapshot.assignmentRevision !== official.revision ||
              template.dossierTemplateVersion !== valid.f.templateVersion
            )
              groupError(
                409,
                "DOSSIER_TEMPLATE_MISMATCH",
                "Mẫu đề cương không khớp bản chốt.",
              );
            dossier = {
              snapshot,
              version: valid.f.templateVersion,
              id: valid.f.id,
              at: valid.f.finalizedAt.toISOString(),
            };
            proof.push(dossier);
          } catch (e) {
            if (e instanceof HttpException && e.getStatus() === 403) throw e;
            issue(e);
            missingSources.push("DOSSIER");
          }
        const progress = await s.progressEvidence(p.id);
        if (
          progress &&
          fact.advisor &&
          progress.advisorId === fact.advisor.id &&
          progress.pr2bGuidancePlanWorkflowPlanId?.state === "ACTIVE"
        ) {
          const official = await this.review.advisor(s, p);
          const tasks = progress.tasks.filter(
            (t) => t.pr2bTaskWorkflowTaskId?.state !== "CANCELLED",
          );
          if (
            progress.pr2bGuidancePlanWorkflowPlanId.assignmentId ===
              official.assignment.id &&
            progress.pr2bGuidancePlanWorkflowPlanId.assignmentRevision ===
              official.revision &&
            tasks.every((t) => !!t.pr2bTaskWorkflowTaskId)
          )
            fact.progress = {
              active: tasks.length,
              completed: tasks.filter(
                (t) => t.pr2bTaskWorkflowTaskId?.state === "COMPLETED",
              ).length,
            };
        }
      }
      if (resultReport(template?.code ?? "XLSX_STUDENTS")) {
        fact.row.sourceState =
          fact.state === "FINALIZED" || fact.state === "PUBLISHED"
            ? "CURRENT"
            : fact.state;
        if (!fact.result) missingSources.push("FINAL_RESULT");
        if (
          template?.requirePublished &&
          fact.result?.publicationStatus !== "PUBLISHED"
        )
          missingSources.push("RESULT_NOT_PUBLISHED");
      }
      if (template?.code === "PDF_MINUTES") {
        missingSources.push(
          "CONCLUSION",
          "DEFENSE_REMARKS",
          "REVISION_REQUESTS",
        );
        cells.CONCLUSION = "MISSING_SOURCE — chưa có kết luận được xác nhận";
        cells.COMMENTS =
          "MISSING_SOURCE — chưa có nguồn ghi nhận phát biểu tại buổi bảo vệ";
        cells.REVISION_REQUESTS =
          "MISSING_SOURCE — chưa có yêu cầu chỉnh sửa được xác nhận";
        if (!fact.sessionId) missingSources.push("SCHEDULE");
      }
      if (template?.code === "XLSX_COMMITTEE_STUDENTS" && !c)
        missingSources.push("COMMITTEE");
      if (template?.code === "XLSX_REVIEWERS" && !fact.reviewers.length)
        missingSources.push("REVIEWER_ASSIGNMENT");
      if (
        (f.state && fact.state !== f.state) ||
        (f.from &&
          (!cells.DATE || Date.parse(cells.DATE) < Date.parse(f.from))) ||
        (f.to && (!cells.DATE || Date.parse(cells.DATE) >= Date.parse(f.to)))
      )
        continue;
      cells.STATE = fact.row.sourceState;
      facts.push(fact);
      if (template?.code === "PDF_REVIEWER_GRADE") {
        rows.push(...reviewerRows);
        for (const reviewer of fact.reviewers.filter(
          (r) => !f.lecturerId || r.id === f.lecturerId,
        ))
          if (!reviewerRows.some((r) => r.cells.LECTURER === reviewer.name))
            rows.push({
              cells: { ...cells, LECTURER: reviewer.name },
              missing: ["REVIEWER_GRADE"],
              sourceState: "MISSING",
            });
      }
      if (
        template?.code !== "PDF_REVIEWER_GRADE" &&
        !committeeReport(template?.code ?? "XLSX_STUDENTS")
      )
        rows.push(fact.row);
    }
    const selectedCommittees =
      f.className || f.termStudentId || f.from || f.to || f.state
        ? [...ef.values()].filter((c) =>
            facts.some((fact) => fact.committee?.committeeId === c.committeeId),
          )
        : [...ef.values()];
    if (template && committeeReport(template.code))
      for (const c of selectedCommittees)
        for (const m of c.members)
          rows.push({
            cells: {
              COMMITTEE: c.code,
              LECTURER: name(m.lecturerId),
              ROLE: m.role,
              STATE: "CURRENT",
            },
            sourceState: "CURRENT",
            missing: [],
          });
    if (rows.length > max)
      groupError(
        409,
        "REPORT_LIMIT_EXCEEDED",
        "Số dòng vượt giới hạn báo cáo.",
      );
    if (template?.code === "PDF_DOSSIER" && facts.length !== 1)
      blockers.push("ONE_STUDENT_REQUIRED");
    if (template?.code === "PDF_REVIEWER_GRADE" && !rows.length)
      blockers.push("MISSING_SOURCE:REVIEWER_GRADE");
    if (template && !rows.length) blockers.push("NO_DATA");
    const snapshot = {
      termId: f.termId,
      termCode: term.code,
      termName: term.name,
      facts,
      committees: selectedCommittees,
      rows,
      blockers,
      dossier,
      capabilities: {
        committees: await s.ccReady(),
        schedules: await s.scReady(),
        reviewers: reviewerReady,
        grades: !!cgPolicy && reviewerReady,
        results: await s.frReady(),
      },
      committeeMembers: selectedCommittees.flatMap((c) =>
        c.members.map((m) => ({
          committeeId: c.committeeId,
          name: name(m.lecturerId),
          role: m.role,
        })),
      ),
    };
    return { ...snapshot, hash: reviewHash(snapshot) };
  }
}
