import { HttpException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { AdvisorConfirmationSchema, AdvisorSummarySchema } from "@doan/shared";
import type {
  AdvisorConfirmation,
  AdvisorSummary,
  FinalDefenseQuery,
  FinalDefenseRow,
  FinalDefenseView,
} from "@doan/shared";
import {
  FinalDefenseRepository,
  FinalDefenseSession,
} from "./final-defense.repository";
import { FinalDefenseValidator, FinalContext } from "./final-defense.validator";
import {
  ProposalReviewValidator,
  reviewHash,
} from "../../topic/proposal-reviews/proposal-review.validator";
import type {
  ReviewPrincipal,
  ReviewProposal,
} from "../../topic/proposal-reviews/proposal-review.repository";
import { groupError } from "../../topic/review-groups/review-group.errors";
import {
  SubmissionValidator,
  digest,
} from "../submissions/submission.validator";
import { approvedSubmissionPolicy } from "../submissions/submission-policy";
import { FileStorageService } from "../../common/storage/file-storage.service";
import { operationWindow } from "../../term/service/term-window.service";
import { GuidanceValidator } from "../tasks/guidance.validator";

const json = (v: unknown) =>
  JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
type Access = {
  u: ReviewPrincipal;
  p: ReviewProposal;
  role: "STUDENT" | "LECTURER" | "FACULTY";
};
type UploadTicket = { assetId: string; storageKey: string; reportId: string };
function notFound(): never {
  return groupError(
    404,
    "COMMON_001",
    "Không tìm thấy hồ sơ trong phạm vi được cấp quyền.",
  );
}

@Injectable()
export class FinalDefenseService {
  constructor(
    private readonly repo: FinalDefenseRepository,
    private readonly review: ProposalReviewValidator,
    private readonly v: FinalDefenseValidator,
    private readonly files: SubmissionValidator,
    private readonly storage: FileStorageService,
    private readonly config: ConfigService,
    private readonly guidance: GuidanceValidator,
  ) {}
  private has(
    u: ReviewPrincipal,
    role: string,
    resource: string,
    action: string,
  ) {
    return u.userRoles.some(
      (r) =>
        r.role.name === role &&
        r.role.rolePermissions.some(
          (p) =>
            p.permission.resource === resource &&
            p.permission.action === action,
        ),
    );
  }
  private permitted(a: Access, resource: string, action: string) {
    return this.has(a.u, a.role, resource, action);
  }
  private async access(
    s: FinalDefenseSession,
    userId: string,
    proposalId: string,
    principal?: ReviewPrincipal,
  ): Promise<Access> {
    const u = principal ?? this.review.principal(await s.principal(userId)),
      p = await s.proposal(proposalId);
    if (!p) notFound();
    if (p.termId !== p.topic.termId)
      groupError(409, "INPUT_NOT_READY", "Đề tài không khớp đợt của hồ sơ.");
    this.review.ownership(p);
    if (
      this.has(u, "LECTURER", "defense-confirmation", "read") &&
      u.lecturer?.isActive
    ) {
      try {
        const official = await this.review.advisor(s, p);
        if (official.assignment.advisorId === u.lecturer.id)
          return { u, p, role: "LECTURER" };
      } catch (e) {
        if (!(e instanceof HttpException)) throw e;
      }
    }
    if (
      this.has(u, "STUDENT", "defense-confirmation", "read") &&
      u.student?.isActive &&
      p.studentId === u.student.id
    )
      return { u, p, role: "STUDENT" };
    if (this.has(u, "FACULTY", "defense-confirmation", "read")) {
      const dept =
        p.topic.researchArea?.pr2bResearchAreaWorkflowResearchAreaId
          ?.departmentId;
      const [grant] = await s.grants(u.id, p.termId);
      if (
        dept &&
        grant &&
        (grant.allDepartments ||
          grant.pr2bGrantDepartmentGrantId.some((d) => d.departmentId === dept))
      )
        return { u, p, role: "FACULTY" };
    }
    notFound();
  }
  private async context(
    s: FinalDefenseSession,
    a: Access,
  ): Promise<FinalContext> {
    const official = await this.guidance.official(s, a.p);
    return {
      assignmentId: official.assignment.id,
      assignmentRevision: official.revision,
      topicRevision: a.p.topic.pr2bTopicWorkflowTopicId!.revision,
      policyHash: reviewHash(
        this.v.policy((await s.policy(a.p.termId))?.value),
      ),
    };
  }
  private async ready(s: FinalDefenseSession, a: Access) {
    if (this.config.get("UC17_WRITES_ENABLED", "false") !== "true")
      groupError(
        409,
        "UC17_NOT_ENABLED",
        "UC17 chưa được nhóm phê duyệt bật ghi.",
      );
    if (!(await s.schemaReady()))
      groupError(
        409,
        "UC17_SCHEMA_REQUIRED",
        "Cần review và triển khai migration UC17 trước khi ghi.",
      );
    const policy = this.v.policy((await s.policy(a.p.termId))?.value);
    if (!policy)
      groupError(
        409,
        "UC17_POLICY_REQUIRED",
        "Chưa có UC17_POLICY hợp lệ được phê duyệt cho đợt.",
      );
    const term = await s.windowTerm(a.p.termId);
    if (!term) notFound();
    const window = operationWindow(term, "FINAL");
    if (!window.canWrite) groupError(409, "TERM_003", window.reason!);
    if (a.p.status !== "APPROVED")
      groupError(409, "INPUT_NOT_READY", "Đề cương chưa được duyệt.");
    await this.guidance.official(s, a.p);
    return policy;
  }
  private assertAction(a: Access, action: "upload" | "review" | "decide") {
    const role = action === "upload" ? "STUDENT" : "LECTURER";
    if (
      a.role !== role ||
      !this.permitted(
        a,
        action === "upload" ? "final-report" : "defense-confirmation",
        action === "upload" ? "create" : action,
      )
    )
      groupError(
        403,
        "AUTH_004",
        "Không có quyền thực hiện thao tác với hồ sơ này.",
      );
  }
  private async locked(
    s: FinalDefenseSession,
    userId: string,
    id: string,
    action: "upload" | "review" | "decide",
  ) {
    let a = await this.access(s, userId, id);
    this.assertAction(a, action);
    await s.lock(a.p.termId, [], id);
    a = await this.access(s, userId, id);
    this.assertAction(a, action);
    return a;
  }
  private row(a: Access, status: string): FinalDefenseRow {
    return {
      proposalId: a.p.id,
      termId: a.p.termId,
      studentCode: a.p.student.studentCode,
      studentName: a.p.student.fullName,
      title: a.p.topic.title,
      status,
    };
  }
  async options(userId: string) {
    return this.repo.read(async (s) => {
      const u = this.review.principal(await s.principal(userId)),
        ids = new Set<string>();
      if (
        this.has(u, "STUDENT", "defense-confirmation", "read") &&
        u.student?.isActive
      )
        for (const t of await s.studentTerms(u.student.id)) ids.add(t.termId);
      if (
        this.has(u, "LECTURER", "defense-confirmation", "read") &&
        u.lecturer?.isActive
      )
        for (const t of await s.advisorTerms(u.lecturer.id))
          if (t.advisorAssignment) ids.add(t.termId);
      if (this.has(u, "FACULTY", "defense-confirmation", "read"))
        for (const g of await s.grants(userId))
          if (g.allDepartments || g.pr2bGrantDepartmentGrantId.length)
            ids.add(g.termId);
      return s.terms({ id: { in: [...ids] } });
    });
  }
  async list(userId: string, query: FinalDefenseQuery) {
    return this.repo.read(async (s) => {
      const u = this.review.principal(await s.principal(userId));
      const roles = ["STUDENT", "LECTURER", "FACULTY"].filter((r) =>
        this.has(u, r, "defense-confirmation", "read"),
      );
      if (!roles.length)
        groupError(403, "AUTH_004", "Không có quyền xem xác nhận bảo vệ.");
      const ready = await s.schemaReady();
      const items: FinalDefenseRow[] = [];
      const scope: Prisma.ProposalWhereInput[] = [];
      if (roles.includes("STUDENT") && u.student?.isActive)
        scope.push({ studentId: u.student.id });
      if (roles.includes("LECTURER") && u.lecturer?.isActive) {
        const officialPlanId = (await s.term(query.termId))
          ?.pr2bTermWorkflowTermId?.officialAssignmentPlanId;
        if (officialPlanId)
          scope.push({
            student: {
              registrations: {
                some: {
                  termId: query.termId,
                  advisorAssignments: {
                    some: {
                      advisorId: u.lecturer.id,
                      assignmentPlanId: officialPlanId,
                    },
                  },
                },
              },
            },
          });
      }
      if (roles.includes("FACULTY")) {
        const [grant] = await s.grants(userId, query.termId);
        if (grant)
          scope.push({
            topic: {
              researchArea: {
                pr2bResearchAreaWorkflowResearchAreaId: {
                  departmentId: grant.allDepartments
                    ? { not: null }
                    : {
                        in: grant.pr2bGrantDepartmentGrantId.map(
                          (d) => d.departmentId,
                        ),
                      },
                },
              },
            },
          });
      }
      // Reuse canonical ownership + official-assignment/grant validation, before paging/counting.
      const candidates = scope.length
        ? await s.candidateIds({ termId: query.termId, OR: scope })
        : [];
      for (const p of candidates) {
        try {
          const a = await this.access(s, userId, p.id, u);
          let status = "HIDDEN";
          if (this.permitted(a, "defense-confirmation", "status-read")) {
            const legacy = await s.legacyDecision(p.id);
            status = legacy ? "LEGACY_UNVERIFIED" : "PENDING";
            if (ready) {
              const d = await s.finalDecision(p.id),
                report = await s.report(p.id);
              if (d?.reportVersionId) {
                let current = false;
                try {
                  current =
                    d.reportVersionId === report?.versions[0]?.id &&
                    this.v.current(d.context, await this.context(s, a));
                } catch (e) {
                  if (!(e instanceof HttpException)) throw e;
                }
                status = current ? d.status : "STALE";
              }
            }
          }
          items.push(this.row(a, status));
        } catch (e) {
          if (
            !(e instanceof HttpException) ||
            ![404, 409].includes(e.getStatus())
          )
            throw e;
        }
      }
      items.sort((a, b) => a.studentCode.localeCompare(b.studentCode));
      return {
        items: items.slice(
          (query.page - 1) * query.limit,
          query.page * query.limit,
        ),
        total: items.length,
        page: query.page,
        limit: query.limit,
      };
    });
  }
  async detail(userId: string, proposalId: string) {
    return this.repo.read((s) => this.view(s, userId, proposalId));
  }
  private async view(
    s: FinalDefenseSession,
    userId: string,
    proposalId: string,
  ): Promise<FinalDefenseView> {
    const a = await this.access(s, userId, proposalId),
      ready = await s.schemaReady();
    const policy = this.v.policy((await s.policy(a.p.termId))?.value),
      blockers: string[] = [];
    if (!ready) blockers.push("UC17_SCHEMA_REQUIRED");
    if (!policy) blockers.push("UC17_POLICY_REQUIRED");
    if (this.config.get("UC17_WRITES_ENABLED", "false") !== "true")
      blockers.push("UC17_NOT_ENABLED");
    const term = await s.windowTerm(a.p.termId);
    const writeWindow = term ? operationWindow(term, "FINAL") : null;
    if (!writeWindow?.canWrite) blockers.push("TERM_003");
    if (a.p.status !== "APPROVED") blockers.push("INPUT_NOT_READY");
    let context: FinalContext | null = null;
    try {
      context = await this.context(s, a);
    } catch (e) {
      if (!(e instanceof HttpException)) throw e;
      const error = e.getResponse() as { error?: { code?: string } };
      blockers.push(error.error?.code ?? "OFFICIAL_ADVISOR_REQUIRED");
    }
    const report = ready ? await s.report(proposalId) : null;
    const legacy = await s.legacyReport(proposalId);
    if (legacy && !report?.versions.length)
      blockers.push("LEGACY_REPORT_RECONCILIATION_REQUIRED");
    const decision = ready ? await s.finalDecision(proposalId) : null;
    // A topic that needs agreement again invalidates the binding, while the
    // authorized current advisor can still read the previously saved summary.
    let advisor: Awaited<
      ReturnType<ProposalReviewValidator["advisor"]>
    > | null = null;
    try {
      advisor = await this.review.advisor(s, a.p);
    } catch (e) {
      if (!(e instanceof HttpException)) throw e;
    }
    const score =
      ready && advisor
        ? await s.advisorScore(proposalId, advisor.assignment.advisorId)
        : null;
    const canReadProgress =
      this.permitted(a, "guidance", "read") ||
      (a.role === "FACULTY" && this.permitted(a, "guidance", "monitor"));
    const evidence = canReadProgress
      ? await s.progressEvidence(proposalId)
      : null;
    const activeTasks =
      evidence?.tasks.filter(
        (t) => t.pr2bTaskWorkflowTaskId?.state !== "CANCELLED",
      ) ?? [];
    const reviews = activeTasks
      .map(
        (t) =>
          t.pr2bTaskWorkflowTaskId?.refCurrentSubmissionId
            ?.pr2bSubmissionWorkflowSubmissionId?.refEffectiveReviewId,
      )
      .filter((r) => r?.state === "RECORDED");
    const progress = evidence
      ? {
          currentAssignment: !!(
            advisor &&
            evidence.advisorId === advisor.assignment.advisorId &&
            evidence.pr2bGuidancePlanWorkflowPlanId?.assignmentId ===
              advisor.assignment.id &&
            evidence.pr2bGuidancePlanWorkflowPlanId.assignmentRevision ===
              advisor.revision
          ),
          activeTasks: activeTasks.length,
          completed: activeTasks.filter(
            (t) => t.pr2bTaskWorkflowTaskId?.state === "COMPLETED",
          ).length,
          overdue: activeTasks.filter(
            (t) =>
              t.deadline < new Date() &&
              t.pr2bTaskWorkflowTaskId?.state !== "COMPLETED",
          ).length,
          pendingReviews: activeTasks.filter(
            (t) => t.pr2bTaskWorkflowTaskId?.state === "SUBMITTED",
          ).length,
          unknownTasks: activeTasks.filter(
            (t) => !t.pr2bTaskWorkflowTaskId?.state,
          ).length,
          pass: reviews.filter((r) => r?.decision === "PASS").length,
          fail: reviews.filter((r) => r?.decision === "FAIL").length,
          revisionRequired: reviews.filter(
            (r) => r?.decision === "REVISION_REQUIRED",
          ).length,
        }
      : null;
    const scoreContext = score?.context as {
      binding?: unknown;
      criterionScores?: Record<string, number>;
    } | null;
    const scoreCurrent = !!(
      score?.reportVersionId &&
      score.reportVersionId === report?.versions[0]?.id &&
      context &&
      this.v.current(scoreContext?.binding, context)
    );
    const decisionCurrent = !!(
      decision?.reportVersionId &&
      decision.reportVersionId === report?.versions[0]?.id &&
      context &&
      this.v.current(decision.context, context)
    );
    const canStatus = this.permitted(a, "defense-confirmation", "status-read");
    const status = !canStatus
      ? "HIDDEN"
      : decision?.reportVersionId
        ? decisionCurrent
          ? decision.status
          : "STALE"
        : (await s.legacyDecision(proposalId))
          ? "LEGACY_UNVERIFIED"
          : "PENDING";
    const canDownload = this.permitted(a, "final-report", "download");
    const uploadBlockers = [...blockers],
      reviewBlockers = [...blockers],
      decideBlockers = [...blockers];
    if (a.role !== "STUDENT") uploadBlockers.push("OWNER_STUDENT_REQUIRED");
    else if (!this.permitted(a, "final-report", "create"))
      uploadBlockers.push("UPLOAD_PERMISSION_REQUIRED");
    if (
      decision &&
      decision.status !== "PENDING" &&
      policy?.replacementAfterDecision === "BLOCK"
    )
      uploadBlockers.push("REPORT_LOCKED");
    for (const [action, target] of [
      ["review", reviewBlockers],
      ["decide", decideBlockers],
    ] as const) {
      if (a.role !== "LECTURER") target.push("OFFICIAL_ADVISOR_REQUIRED");
      else if (!this.permitted(a, "defense-confirmation", action))
        target.push("ADVISOR_PERMISSION_REQUIRED");
      if (!report?.versions.length) target.push("FINAL_PDF_REQUIRED");
    }
    if (a.role === "LECTURER" && score?.isLocked)
      reviewBlockers.push("SCORE_LOCKED");
    if (a.role === "LECTURER" && !scoreCurrent)
      decideBlockers.push("ADVISOR_SUMMARY_REQUIRED");
    const downloadBlockers = canDownload
      ? []
      : ["DOWNLOAD_PERMISSION_REQUIRED"];
    if (!ready) downloadBlockers.push("UC17_SCHEMA_REQUIRED");
    if (!report?.versions.length) downloadBlockers.push("FINAL_PDF_REQUIRED");
    const actionBlockers = {
      upload: [...new Set(uploadBlockers)],
      review: [...new Set(reviewBlockers)],
      decide: [...new Set(decideBlockers)],
      download: downloadBlockers,
    };
    return {
      ...this.row(a, status),
      revision: report?.revision ?? 0,
      policy,
      blockers,
      actionBlockers,
      writeWindow,
      progress,
      progressBlocker: !canReadProgress
        ? "GUIDANCE_READ_PERMISSION_REQUIRED"
        : !evidence
          ? "PLAN_MISSING"
          : null,
      versions: this.permitted(a, "final-report", "read")
        ? (report?.versions.map((v) => ({
            id: v.id,
            sequence: v.sequence,
            name: v.fileAsset.originalName,
            sizeBytes: v.fileAsset.sizeBytes,
            checksum: v.fileAsset.checksum,
            submittedAt: v.submittedAt.toISOString(),
          })) ?? [])
        : [],
      permissions: {
        upload: !actionBlockers.upload.length,
        review: !actionBlockers.review.length,
        decide: !actionBlockers.decide.length,
        download: !actionBlockers.download.length,
      },
      summary:
        score &&
        (this.permitted(a, "defense-confirmation", "score-read") ||
          this.permitted(a, "defense-confirmation", "comment-read"))
          ? {
              current: scoreCurrent,
              ...(this.permitted(a, "defense-confirmation", "score-read") &&
              score.totalScore !== null
                ? {
                    score: Number(score.totalScore),
                    ...(scoreContext?.criterionScores
                      ? { criterionScores: scoreContext.criterionScores }
                      : {}),
                  }
                : {}),
              ...(this.permitted(a, "defense-confirmation", "comment-read")
                ? { comment: score.comment ?? "" }
                : {}),
            }
          : null,
      decision:
        decision && canStatus
          ? {
              status,
              current: decisionCurrent,
              ...(this.permitted(a, "defense-confirmation", "rejection-read")
                ? { reason: decision.note ?? "" }
                : {}),
            }
          : null,
      // Audit snapshots contain score/comments/reasons. Only the current official advisor with all disclosure rights may read them.
      history:
        a.role === "LECTURER" &&
        ["score-read", "comment-read", "rejection-read"].every((p) =>
          this.permitted(a, "defense-confirmation", p),
        )
          ? (await s.events(proposalId)).map((e) => ({
              id: e.id,
              action: e.action,
              at: e.createdAt.toISOString(),
              snapshot: e.newValue,
            }))
          : [],
    };
  }
  async preflight(userId: string, proposalId: string) {
    return this.repo.read(async (s) => {
      const a = await this.access(s, userId, proposalId);
      this.assertAction(a, "upload");
      return this.ready(s, a);
    });
  }
  private replay(
    record: Awaited<ReturnType<FinalDefenseSession["replay"]>>,
    hash: string,
  ) {
    if (!record) return null;
    if (record.payloadHash !== hash)
      groupError(
        409,
        "IDEMPOTENCY_CONFLICT",
        "Idempotency-Key đã dùng cho nội dung khác.",
      );
    return record.result as {
      pending?: boolean;
      assetId?: string;
      storageKey?: string;
      reportId?: string;
      revision?: number;
    } | null;
  }
  async upload(
    userId: string,
    proposalId: string,
    expectedRevision: number,
    file: Express.Multer.File,
    key: string,
  ) {
    this.v.key(key);
    if (!file) groupError(400, "FILE_REQUIRED", "Cần PDF đồ án cuối.");
    const policy = await this.preflight(userId, proposalId);
    const metadata = this.files.file("REPORT", file, {
      ...approvedSubmissionPolicy,
      maxFileBytes: policy.maxPdfBytes,
      roles: {
        ...approvedSubmissionPolicy.roles,
        REPORT: {
          extensions: ["pdf"],
          maxFiles: 1,
          maxBytes: policy.maxPdfBytes,
        },
      },
    });
    const route = `/proposals/${proposalId}/final-report/pdf`,
      hash = reviewHash({ expectedRevision, ...metadata });
    const ticket = await this.repo.write(async (s) => {
      const a = await this.locked(s, userId, proposalId, "upload"),
        activePolicy = await this.ready(s, a);
      const replay = this.replay(await s.replay(userId, route, key), hash);
      if (replay) {
        if (replay.pending)
          groupError(
            409,
            "UPLOAD_PENDING",
            "Lần nộp trước chưa hoàn tất; cần đối soát staging, không tự ghi đè.",
          );
        return { replay: true as const, result: replay };
      }
      const old = await s.report(proposalId),
        decision = await s.finalDecision(proposalId);
      this.review.revision(old?.revision ?? 0, expectedRevision);
      if (old && !old.versions.length)
        groupError(
          409,
          "LEGACY_REPORT_RECONCILIATION_REQUIRED",
          "Cần đối soát file legacy trước khi tạo phiên bản.",
        );
      if (
        decision &&
        decision.status !== "PENDING" &&
        activePolicy.replacementAfterDecision === "BLOCK"
      )
        groupError(
          409,
          "REPORT_LOCKED",
          "Chính sách không cho thay PDF sau quyết định.",
        );
      const report =
        old ?? (await s.finalDb.finalReport.create({ data: { proposalId } }));
      const assetId = randomUUID(),
        storageKey = `guidance/${assetId}`;
      // Persist ownership before any bytes. QUARANTINED prevents download of a partial upload.
      await s.finalDb.fileAsset.create({
        data: {
          id: assetId,
          ...metadata,
          storageKey,
          state: "QUARANTINED",
          createdByUserId: userId,
        },
      });
      await s.remember(
        userId,
        route,
        key,
        hash,
        json({ pending: true, assetId, storageKey, reportId: report.id }),
      );
      await s.event(
        userId,
        proposalId,
        "FINAL_PDF_STAGED",
        {},
        {
          assetId,
          storageKey,
          reportId: report.id,
          checksum: metadata.checksum,
        },
      );
      return {
        replay: false as const,
        assetId,
        storageKey,
        reportId: report.id,
      };
    });
    if (ticket.replay) return ticket.result;
    const owned: UploadTicket = ticket;
    // If interrupted, durable quarantined metadata + audit retain exact ownership.
    // Never delete on an ambiguous DB commit; a failed request never claims success.
    await this.storage.savePrivateGuidance(owned.storageKey, file.buffer);
    return this.repo.write(async (s) => {
      const a = await this.locked(s, userId, proposalId, "upload"),
        activePolicy = await this.ready(s, a);
      if (reviewHash(policy) !== reviewHash(activePolicy))
        groupError(
          409,
          "POLICY_CHANGED",
          "Chính sách vừa thay đổi; hãy tải lại.",
        );
      const report = await s.report(proposalId),
        oldDecision = await s.finalDecision(proposalId);
      if (!report || report.id !== owned.reportId)
        groupError(409, "REVISION_CONFLICT", "Hồ sơ đã đổi.");
      this.review.revision(report.revision, expectedRevision);
      if (
        oldDecision &&
        oldDecision.status !== "PENDING" &&
        activePolicy.replacementAfterDecision === "BLOCK"
      )
        groupError(409, "REPORT_LOCKED", "Không được thay PDF sau quyết định.");
      await s.finalDb.fileAsset.update({
        where: { id: owned.assetId },
        data: { state: "READY" },
      });
      const version = await s.finalDb.finalReportVersion.create({
        data: {
          reportId: report.id,
          sequence: (report.versions[0]?.sequence ?? 0) + 1,
          fileAssetId: owned.assetId,
        },
      });
      await s.advanceReport(report.id, expectedRevision);
      await s.finalDb.finalReport.update({
        where: { id: report.id },
        data: { submittedAt: version.submittedAt },
      });
      if (oldDecision)
        await s.finalDb.defenseConfirmation.update({
          where: { proposalId },
          data: {
            status: "PENDING",
            confirmedAt: null,
            revision: { increment: 1 },
          },
        });
      const result = { revision: expectedRevision + 1, versionId: version.id };
      await s.event(
        userId,
        proposalId,
        "FINAL_PDF_SUBMITTED",
        { decision: oldDecision },
        {
          ...result,
          assetId: owned.assetId,
          invalidatedDecision: !!oldDecision,
        },
      );
      await s.finalDb.idempotencyRecord.update({
        where: {
          actorId_method_route_key: {
            actorId: userId,
            method: "POST",
            route,
            key,
          },
        },
        data: { result: json(result) },
      });
      return result;
    });
  }
  async summarize(
    userId: string,
    proposalId: string,
    input: AdvisorSummary,
    key: string,
  ) {
    const body = AdvisorSummarySchema.parse(input);
    return this.mutate(
      userId,
      proposalId,
      "review",
      body,
      key,
      async (s, a, report, policy, context) => {
        this.v.summary(body, policy);
        const scorerId = a.u.lecturer!.id,
          old = await s.advisorScore(proposalId, scorerId);
        if (old?.isLocked) groupError(409, "SCORE_LOCKED", "Điểm đã khóa.");
        const data = {
          totalScore: body.score,
          comment: body.comment,
          reportVersionId: body.reportVersionId,
          context: json({
            binding: context,
            policy,
            criterionScores: body.criterionScores,
          }),
        };
        const score = await s.finalDb.scoreEntry.upsert({
          where: {
            proposalId_scorerId_role: { proposalId, scorerId, role: "ADVISOR" },
          },
          create: { proposalId, scorerId, role: "ADVISOR", ...data },
          update: { ...data, revision: { increment: 1 } },
        });
        const oldDecision = await s.finalDecision(proposalId);
        if (oldDecision && oldDecision.status !== "PENDING")
          await s.finalDb.defenseConfirmation.update({
            where: { proposalId },
            data: {
              status: "PENDING",
              confirmedAt: null,
              revision: { increment: 1 },
            },
          });
        await s.event(
          userId,
          proposalId,
          "ADVISOR_SUMMARY_RECORDED",
          { score: old, decision: oldDecision },
          {
            score,
            invalidatedDecision: !!oldDecision,
            reportRevision: report.revision + 1,
          },
        );
      },
    );
  }
  async confirm(
    userId: string,
    proposalId: string,
    input: AdvisorConfirmation,
    key: string,
  ) {
    const body = AdvisorConfirmationSchema.parse(input);
    return this.mutate(
      userId,
      proposalId,
      "decide",
      body,
      key,
      async (s, a, _report, _policy, context) => {
        const score = await s.advisorScore(proposalId, a.u.lecturer!.id);
        const sc = score?.context as { binding?: unknown } | null;
        if (
          !score ||
          score.reportVersionId !== body.reportVersionId ||
          !this.v.current(sc?.binding, context) ||
          !score.comment ||
          score.totalScore === null
        )
          groupError(
            409,
            "ADVISOR_SUMMARY_REQUIRED",
            "Cần nhận xét và điểm GVHD cho đúng PDF, đề tài, phân công và policy hiện hành.",
          );
        const old = await s.finalDecision(proposalId);
        const data = {
          advisorId: a.u.lecturer!.id,
          reportVersionId: body.reportVersionId,
          status: body.status,
          note: body.reason ?? null,
          confirmedAt: new Date(),
          context: json(context),
        };
        const decision = await s.finalDb.defenseConfirmation.upsert({
          where: { proposalId },
          create: { proposalId, ...data },
          update: { ...data, revision: { increment: 1 } },
        });
        await s.event(
          userId,
          proposalId,
          "ADVISOR_DEFENSE_DECIDED",
          old,
          decision,
        );
      },
    );
  }
  private async mutate(
    userId: string,
    proposalId: string,
    action: "review" | "decide",
    body: AdvisorSummary | AdvisorConfirmation,
    key: string,
    apply: (
      s: FinalDefenseSession,
      a: Access,
      report: NonNullable<Awaited<ReturnType<FinalDefenseSession["report"]>>>,
      policy: NonNullable<ReturnType<FinalDefenseValidator["policy"]>>,
      context: FinalContext,
    ) => Promise<void>,
  ) {
    this.v.key(key);
    const route = `/proposals/${proposalId}/final-report/${action}`,
      hash = reviewHash(body);
    return this.repo.write(async (s) => {
      const a = await this.locked(s, userId, proposalId, action),
        policy = await this.ready(s, a);
      const replay = this.replay(await s.replay(userId, route, key), hash);
      if (replay) return replay;
      const report = await s.report(proposalId);
      if (!report?.versions.length)
        groupError(
          409,
          "FINAL_PDF_REQUIRED",
          "Sinh viên chưa nộp PDF đồ án cuối.",
        );
      this.review.revision(report.revision, body.expectedRevision);
      if (report.versions[0].id !== body.reportVersionId)
        groupError(
          409,
          "STALE_VERSION",
          "PDF đã thay đổi; cần đọc lại bản mới.",
        );
      await apply(s, a, report, policy, await this.context(s, a));
      await s.advanceReport(report.id, body.expectedRevision);
      const result = { revision: body.expectedRevision + 1 };
      await s.remember(userId, route, key, hash, json(result));
      return result;
    });
  }
  async download(userId: string, proposalId: string, versionId: string) {
    const asset = await this.repo.read(async (s) => {
      const a = await this.access(s, userId, proposalId);
      if (!this.permitted(a, "final-report", "download"))
        groupError(403, "AUTH_004", "Không có quyền tải PDF.");
      if (!(await s.schemaReady()))
        groupError(
          409,
          "UC17_SCHEMA_REQUIRED",
          "Chưa có schema phiên bản PDF cuối.",
        );
      const version = (await s.report(proposalId))?.versions.find(
        (v) => v.id === versionId,
      );
      if (!version || version.fileAsset.state !== "READY") notFound();
      return version.fileAsset;
    });
    if (asset.kind !== "REPORT" || asset.mimeType !== "application/pdf")
      groupError(
        409,
        "FILE_INTEGRITY_FAILED",
        "Asset không phải PDF đồ án cuối.",
      );
    let bytes: Buffer;
    try {
      bytes = await this.storage.readPrivateGuidance(
        asset.storageKey,
        Math.min(asset.sizeBytes, 50 * 1024 * 1024),
      );
    } catch {
      groupError(
        409,
        "FILE_NOT_AVAILABLE",
        "PDF chưa có trên storage; cần đối soát file đã lưu.",
      );
    }
    if (bytes.length !== asset.sizeBytes || digest(bytes) !== asset.checksum)
      groupError(
        409,
        "FILE_INTEGRITY_FAILED",
        "PDF không khớp checksum đã lưu.",
      );
    return { bytes, name: asset.originalName };
  }
}
