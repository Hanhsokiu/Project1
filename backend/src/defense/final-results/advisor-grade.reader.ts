import { Injectable } from "@nestjs/common";
import {
  addScoreFraction,
  scoreFraction,
  scoreFractionMatches,
  weightedScoreFraction,
} from "@doan/shared";
import type { EffectiveAdvisorGrade } from "@doan/shared";
import { FinalDefenseValidator } from "../../guidance/final-defense/final-defense.validator";
import {
  ProposalReviewValidator,
  reviewHash,
} from "../../topic/proposal-reviews/proposal-review.validator";
import { GuidanceValidator } from "../../guidance/tasks/guidance.validator";
import { FileStorageService } from "../../common/storage/file-storage.service";
import { readGradePdf } from "../grading/grade-evidence";
import { groupError } from "../../topic/review-groups/review-group.errors";
import { FinalResultSession } from "./final-result.repository";
const fail = (): never =>
  groupError(
    409,
    "ADVISOR_GRADE_UNVERIFIED",
    "Cần điểm tổng kết UC17 hiện hành và provenance đầy đủ; không suy từ điểm tiến độ.",
  );
@Injectable()
export class AdvisorGradeReader {
  constructor(
    private readonly review: ProposalReviewValidator,
    private readonly guidance: GuidanceValidator,
    private readonly v: FinalDefenseValidator,
    private readonly storage: FileStorageService,
  ) {}
  // Internal only, after UC24 scoped authorization, within the caller transaction.
  async effectiveInSession(
    s: FinalResultSession,
    termId: string,
    memberId: string,
    proposalId: string,
  ): Promise<EffectiveAdvisorGrade> {
    if (!(await s.schemaReady())) return fail();
    const p = await s.proposal(proposalId);
    if (
      !p ||
      p.termId !== termId ||
      p.status !== "APPROVED" ||
      this.review.ownership(p).termStudentId !== memberId
    )
      return fail();
    const official = await this.guidance.official(s, p),
      a = official.assignment,
      policy = this.v.policy((await s.policy(termId))?.value),
      pdf = await readGradePdf(s, this.storage, proposalId),
      score = await s.advisorScore(proposalId, a.advisorId),
      decision = await s.finalDecision(proposalId);
    if (
      !policy ||
      !score ||
      score.totalScore === null ||
      !score.comment?.trim() ||
      !decision ||
      decision.status !== "CONFIRMED" ||
      !decision.confirmedAt ||
      decision.confirmedAt > new Date() ||
      decision.advisorId !== a.advisorId ||
      score.reportVersionId !== pdf.version.id ||
      decision.reportVersionId !== pdf.version.id
    )
      return fail();
    const binding = {
        assignmentId: a.id,
        assignmentRevision: official.revision,
        topicRevision: p.topic.pr2bTopicWorkflowTopicId!.revision,
        policyHash: reviewHash(policy),
      },
      ctx = score.context as {
        binding?: unknown;
        policy?: unknown;
        criterionScores?: Record<string, number>;
      } | null;
    if (
      !ctx ||
      !this.v.current(ctx.binding, binding) ||
      !this.v.current(decision.context, binding) ||
      reviewHash(ctx.policy) !== reviewHash(policy)
    )
      return fail();
    const value = score.totalScore.toString(),
      v = scoreFraction(value),
      step = scoreFraction(String(policy.scoreStep));
    if (v.n * 1n > 10n * v.d || (v.n * step.d) % (v.d * step.n) !== 0n)
      return fail();
    if (policy.rubric) {
      const cs = ctx.criterionScores ?? {};
      if (
        Object.keys(cs).length !== policy.rubric.length ||
        policy.rubric.some(
          (c) =>
            !(c.key in cs) ||
            !Number.isFinite(cs[c.key]) ||
            cs[c.key] < 0 ||
            cs[c.key] > c.maxScore,
        )
      )
        return fail();
      const total = policy.rubric.reduce(
        (n, c) =>
          addScoreFraction(
            n,
            weightedScoreFraction(
              String(cs[c.key]),
              String(c.maxScore),
              String(c.weight),
            ),
          ),
        scoreFraction("0"),
      );
      if (!scoreFractionMatches(value, total)) return fail();
    } else if (Object.keys(ctx.criterionScores ?? {}).length) return fail();
    const events = await s.events(proposalId),
      summary = events.find(
        (e) =>
          e.action === "ADVISOR_SUMMARY_RECORDED" &&
          reviewHash((e.newValue as { score?: unknown } | null)?.score) ===
            reviewHash(score),
      ),
      confirm = events.find(
        (e) =>
          e.action === "ADVISOR_DEFENSE_DECIDED" &&
          reviewHash(e.newValue) === reviewHash(decision),
      );
    if (
      !summary?.userId ||
      !confirm?.userId ||
      summary.userId !== confirm.userId ||
      summary.createdAt > decision.confirmedAt ||
      confirm.createdAt > new Date()
    )
      return fail();
    const actor = this.review.principal(await s.principal(summary.userId));
    if (
      !actor.lecturer?.isActive ||
      actor.lecturer.id !== a.advisorId ||
      !["read", "review", "decide"].every((action) =>
        this.guidance.role(actor, "LECTURER", "defense-confirmation", action),
      )
    )
      return fail();
    return {
      source: "ADVISOR_UC17",
      termId,
      termStudentId: memberId,
      proposalId,
      lecturerId: a.advisorId,
      role: "ADVISOR",
      scoreEntryId: score.id,
      revision: score.revision,
      totalScore: value,
      reportVersionId: pdf.version.id,
      reportChecksum: pdf.asset.checksum,
      policyHash: reviewHash(policy),
      decisionId: decision.id,
      decisionRevision: decision.revision,
      evidenceHash: reviewHash({
        score,
        decision,
        binding,
        summaryId: summary.id,
        decisionAuditId: confirm.id,
      }),
      effectiveStatus: "CURRENT",
    };
  }
}
