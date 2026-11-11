import { HttpException, Injectable } from "@nestjs/common";
import { calculateFinalResult } from "@doan/shared";
import { readRuntimeFinalResultPolicy } from "../../common/security/application-policy-runtime";
import type {
  EffectiveCommittee,
  FinalResultPolicy,
  ResultSource,
  ResultCalculation,
} from "@doan/shared";
import { CommitteeWorkflowService } from "../committees/committee-workflow.service";
import { ReviewerService } from "../reviewers/reviewer.service";
import { ReviewerGradeService } from "../reviewer-grading/reviewer-grade.service";
import { CommitteeGradeService } from "../committee-grading/committee-grade.service";
import { CommitteeGradeValidator } from "../committee-grading/committee-grade.validator";
import { ScheduleService } from "../scheduling/schedule.service";
import {
  currentGradeSchedule,
  gradeScheduleHash,
} from "../grading/grade-evidence";
import { reviewHash } from "../../topic/proposal-reviews/proposal-review.validator";
import { AdvisorGradeReader } from "./advisor-grade.reader";
import { FinalResultSession } from "./final-result.repository";
export const sourceIssue = (e: unknown) => {
  if (
    e instanceof HttpException &&
    [401, 403, 404, 409].includes(e.getStatus())
  )
    return (
      (e.getResponse() as { error?: { code?: string } }).error?.code ??
      "SOURCE_UNVERIFIED"
    );
  throw e;
};
export type ResultEvidence = {
  committee: EffectiveCommittee | null;
  policy: FinalResultPolicy | null;
  policyHash: string;
  sources: ResultSource[];
  calculation: ResultCalculation | null;
  requiredCount: number | null;
  schedule: { startAt: string; endAt: string; sessionId: string } | null;
  evidence: unknown;
  evidenceHash: string;
  blockers: string[];
};
@Injectable()
export class FinalResultSources {
  constructor(
    private readonly committees: CommitteeWorkflowService,
    private readonly reviewers: ReviewerService,
    private readonly reviewerGrades: ReviewerGradeService,
    private readonly committeeGrades: CommitteeGradeService,
    private readonly committeeValidator: CommitteeGradeValidator,
    private readonly schedules: ScheduleService,
    private readonly advisors: AdvisorGradeReader,
  ) {}
  async collect(
    s: FinalResultSession,
    termId: string,
    memberId: string,
    proposalId: string,
  ): Promise<ResultEvidence> {
    const blockers: string[] = [],
      sources: ResultSource[] = [],
      proof: unknown[] = [];
    let policy: FinalResultPolicy | null = null,
      committee: EffectiveCommittee | null = null,
      requiredCount: number | null = null,
      calculation: ResultCalculation | null = null,
      schedule: ResultEvidence["schedule"] = null;
    const raw = (await s.frPolicy(termId))?.value;
    if (!raw) blockers.push("UC24_POLICY_REQUIRED");
    else
      try {
        policy = readRuntimeFinalResultPolicy(JSON.parse(raw));
      } catch (e) {
        blockers.push(e instanceof Error ? e.message : "UNSUPPORTED_POLICY");
      }
    if (!(await s.cgReady())) blockers.push("UC17_UC23_SCHEMA_REQUIRED");
    if (!blockers.length && policy) {
      const rows = (await s.ccList(termId)).filter((c) =>
        c.studentAssignments.some(
          (a) =>
            a.termStudentId === memberId &&
            a.proposalId === proposalId &&
            a.state === "ACTIVE",
        ),
      );
      if (rows.length !== 1 || !rows[0].finalizedBy)
        blockers.push("COMMITTEE_NOT_CURRENT");
      else
        try {
          const row = rows[0],
            actor = row.finalizedBy!,
            w = await this.committees.workspaceInSession(s, actor, termId),
            view = w.committees.find((c) => c.id === row.id);
          if (!view?.downstream)
            throw new HttpException(
              { error: { code: "COMMITTEE_NOT_CURRENT" } },
              409,
            );
          committee = await this.committees.effectiveInSession(
            s,
            actor,
            termId,
            row.id,
            view.revision,
            view.downstream.evidenceHash,
          );
          if (
            committee.termId !== termId ||
            !committee.students.some(
              (a) =>
                a.termStudentId === memberId && a.proposalId === proposalId,
            )
          )
            throw new HttpException(
              { error: { code: "COMMITTEE_NOT_CURRENT" } },
              409,
            );
        } catch (e) {
          blockers.push(sourceIssue(e));
          committee = null;
        }
      if (committee) {
        const cgPolicy = this.committeeValidator.policy(
            (await s.cgPolicy(termId))?.value,
          ),
          members = cgPolicy
            ? committee.members.filter((m) =>
                cgPolicy.gradingRoles.includes(m.role),
              )
            : [];
        if (!cgPolicy || !members.length) blockers.push("UC23_POLICY_REQUIRED");
        else {
          requiredCount = members.length;
          proof.push({ uc23PolicyHash: reviewHash(cgPolicy) });
          for (const m of members) {
            try {
              const rows = await s.cgScores(proposalId, m.lecturerId),
                score = rows.length === 1 ? rows[0] : null,
                actor = (score?.context as { finalizedBy?: string } | null)
                  ?.finalizedBy;
              if (!score || !actor) {
                blockers.push(`COMMITTEE_GRADE_MISSING:${m.lecturerId}`);
                continue;
              }
              const g = await this.committeeGrades.effectiveInSession(
                s,
                actor,
                termId,
                committee.committeeId,
                memberId,
                m.lecturerId,
                score.revision,
              );
              if (
                g.committeeEvidenceHash !== committee.evidenceHash ||
                g.memberRole !== m.role ||
                g.proposalId !== proposalId
              )
                throw new HttpException(
                  { error: { code: "COMMITTEE_GRADE_BINDING_CHANGED" } },
                  409,
                );
              sources.push({
                source: "COMMITTEE",
                lecturerId: m.lecturerId,
                role: m.role,
                scoreEntryId: g.scoreEntryId,
                revision: g.revision,
                totalScore: g.totalScore,
                evidenceHash: g.evidenceHash,
                reportVersionId: g.reportVersionId,
                reportChecksum: g.reportChecksum,
              });
              proof.push(g);
            } catch (e) {
              blockers.push(
                `COMMITTEE_GRADE_UNVERIFIED:${m.lecturerId}:${sourceIssue(e)}`,
              );
            }
          }
        }
        const sc = await currentGradeSchedule(s, this.schedules, {
          termId,
          committeeId: committee.committeeId,
          termStudentId: memberId,
          proposalId,
        });
        if (!sc) blockers.push("SCHEDULE_NOT_CURRENT");
        else {
          schedule = {
            sessionId: sc.sessionId,
            startAt: sc.startAt,
            endAt: sc.endAt,
          };
          proof.push({ scheduleHash: gradeScheduleHash(sc, false) });
        }
        if (policy.components.some((c) => c.source === "ADVISOR_UC17")) {
          if (requiredCount !== null) requiredCount++;
          try {
            const g = await this.advisors.effectiveInSession(
              s,
              termId,
              memberId,
              proposalId,
            );
            sources.push({
              source: g.source,
              lecturerId: g.lecturerId,
              role: g.role,
              scoreEntryId: g.scoreEntryId,
              revision: g.revision,
              totalScore: g.totalScore,
              evidenceHash: g.evidenceHash,
              reportVersionId: g.reportVersionId,
              reportChecksum: g.reportChecksum,
            });
            proof.push(g);
          } catch (e) {
            blockers.push(sourceIssue(e));
          }
        }
        if (policy.components.some((c) => c.source === "REVIEWER")) {
          try {
            const rows = (await s.rgAssignments(termId)).filter(
                (r) =>
                  r.termStudentId === memberId &&
                  r.proposalId === proposalId &&
                  r.selected,
              ),
              actor = rows[0]?.finalizedBy;
            if (!actor)
              throw new HttpException(
                { error: { code: "REVIEWERS_NOT_CURRENT" } },
                409,
              );
            const w = await this.reviewers.workspaceInSession(s, actor, termId),
              student = w.students.find((c) => c.id === memberId);
            if (!student?.downstream)
              throw new HttpException(
                { error: { code: "REVIEWERS_NOT_CURRENT" } },
                409,
              );
            const assignments = await this.reviewers.effectiveInSession(
              s,
              actor,
              termId,
              memberId,
              student.revision,
              student.evidenceHash,
            );
            if (
              !assignments.length ||
              assignments.length !== rows.length ||
              new Set(assignments.map((a) => a.lecturerId)).size !==
                assignments.length
            )
              throw new HttpException(
                { error: { code: "REVIEWERS_NOT_CURRENT" } },
                409,
              );
            if (requiredCount !== null) requiredCount += assignments.length;
            for (const a of assignments) {
              const score = await s.rgScore(proposalId, a.lecturerId),
                owner = (score?.context as { finalizedBy?: string } | null)
                  ?.finalizedBy;
              if (!score || !owner) {
                blockers.push(`REVIEWER_GRADE_MISSING:${a.lecturerId}`);
                continue;
              }
              const g = await this.reviewerGrades.effectiveInSession(
                s,
                owner,
                termId,
                memberId,
                a.lecturerId,
                score.revision,
              );
              if (
                g.proposalId !== proposalId ||
                g.assignment.assignmentId !== a.assignmentId ||
                g.assignment.evidenceHash !== a.evidenceHash
              )
                throw new HttpException(
                  { error: { code: "REVIEWER_GRADE_BINDING_CHANGED" } },
                  409,
                );
              sources.push({
                source: "REVIEWER",
                lecturerId: a.lecturerId,
                role: "REVIEWER",
                scoreEntryId: g.scoreEntryId,
                revision: g.revision,
                totalScore: g.totalScore,
                evidenceHash: g.evidenceHash,
                reportVersionId: g.reportVersionId,
                reportChecksum: g.reportChecksum,
              });
              proof.push(g);
            }
          } catch (e) {
            requiredCount = null;
            blockers.push(sourceIssue(e));
          }
        }
      }
      if (
        new Set(sources.map((g) => g.reportVersionId + ":" + g.reportChecksum))
          .size > 1
      )
        blockers.push("SOURCE_PDF_MISMATCH");
      if (!blockers.length)
        try {
          calculation = calculateFinalResult(policy, sources);
        } catch (e) {
          blockers.push((e as Error).message);
        }
    }
    sources.sort((a, b) =>
      `${a.source}:${a.lecturerId}`.localeCompare(
        `${b.source}:${b.lecturerId}`,
      ),
    );
    const policyHash = reviewHash(policy),
      evidence = {
        termId,
        memberId,
        proposalId,
        committee,
        policy,
        sources,
        proof,
        schedule,
      };
    return {
      committee,
      policy,
      policyHash,
      sources,
      calculation,
      requiredCount,
      schedule,
      evidence,
      evidenceHash: reviewHash(evidence),
      blockers: [...new Set(blockers)],
    };
  }
}
