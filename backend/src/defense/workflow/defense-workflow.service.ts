import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Prisma, type DefenseStageArtifact } from "@prisma/client";
import {
  academicEvidenceCommandSchema,
  committeeDraftSchema,
  defenseWorkflowPolicySchema,
  reviewerDraftSchema,
  scheduleDraftSchema,
  scheduleAmendSchema,
  stageSaveSchema,
  workflowCommandSchema,
  workflowPolicyCommandSchema,
  workflowReopenSchema,
  type AcademicEvidenceInput,
  type CommitteePlan,
  type DefenseStage,
  type DefenseWorkflowContext,
  type ReviewerPlan,
  type ScheduleSlot,
  type StageDraft,
  type StageSaveInput,
  type WorkflowCommand,
  type WorkflowPolicyInput,
  type WorkflowStudent,
  type PublishedDefenseSchedule,
  type DefenseWorkflowHistory,
} from "@doan/shared";
import { AuditService } from "../../common/audit/audit.service";
import { Uc18FinalizationReader } from "../../common/contracts/uc18-finalization.port";
import { academicTermScope } from "../../common/security/academic-term-scope.policy";
import { FileStorageService } from "../../common/storage/file-storage.service";
import {
  academicProofHash,
  academicProofSchema,
  defenseListSnapshotSchema,
  defenseListSnapshotV2Schema,
  type AcademicProof,
  type DefenseListSnapshotV2,
} from "../../common/uc18-finalization/defense-list-snapshot";
import { DefenseConfirmationValidator } from "../../guidance/defense-confirmations/defense-confirmation.validator";
import type {
  DecisionContext,
  OfficialAdvisorContext,
  PdfContext,
} from "../../guidance/defense-confirmations/defense-confirmation.types";
import type { ReviewPrincipal } from "../../topic/proposal-reviews/proposal-review.repository";
import {
  planningError,
  type BusySlot,
} from "../planning/defense-planning.policy";
import {
  DefenseWorkflowRepository,
  DefenseWorkflowSession,
} from "./defense-workflow.repository";
import {
  hashJson,
  structuralPolicyHash,
  json,
  requireContext,
  requireRevision,
  stages,
  stageSnapshotSchema,
  validateOfficialPlan,
  validatePolicyDates,
  workflowWindow,
  type StageSnapshot,
} from "./defense-workflow.policy";

type CommandResult = {
  changed: boolean;
  revision: number;
  expectedContext: string;
  artifactId?: string;
  version?: number;
};
type LiveStudent = {
  member: Awaited<ReturnType<DefenseWorkflowSession["members"]>>[number];
  p:
    Awaited<ReturnType<DefenseWorkflowSession["dossiers"]>>[number] | undefined;
  advisor: OfficialAdvisorContext | null;
  pdf: PdfContext;
  decision: DecisionContext;
  proof: AcademicProof | null;
  student: WorkflowStudent;
};
@Injectable()
export class DefenseWorkflowService {
  constructor(
    @Inject(DefenseWorkflowRepository)
    private readonly repo: DefenseWorkflowRepository,
    @Inject(Uc18FinalizationReader)
    private readonly reader: Uc18FinalizationReader,
    @Inject(DefenseConfirmationValidator)
    private readonly rules: DefenseConfirmationValidator,
    @Inject(FileStorageService) private readonly storage: FileStorageService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}
  private permission(
    user: ReviewPrincipal,
    action: string,
    resource = "defense-workflow",
  ) {
    return user.userRoles.some((r) =>
      r.role.rolePermissions.some(
        (p) =>
          p.permission.resource === resource && p.permission.action === action,
      ),
    );
  }
  private async access(
    s: DefenseWorkflowSession,
    userId: string,
    termId: string,
    action: string,
  ) {
    const user = await s.principal(userId);
    if (
      !user ||
      user.id !== userId ||
      user.status !== "ACTIVE" ||
      user.mustChangePassword ||
      !this.permission(user, "read") ||
      !this.permission(user, action)
    )
      planningError(
        403,
        "DEFENSE_WORKFLOW_FORBIDDEN",
        "Cần tài khoản hoạt động và permission workflow phù hợp.",
      );
    if (
      !academicTermScope(await s.grants(userId, termId), userId, termId)
        .allDepartments
    )
      planningError(
        403,
        "DEFENSE_WORKFLOW_SCOPE_FORBIDDEN",
        "Command/dữ liệu toàn đợt yêu cầu grant allDepartments=true đúng đợt.",
      );
    return user;
  }
  private artifact(
    row: DefenseStageArtifact | null | undefined,
  ): StageSnapshot | null {
    if (!row) return null;
    const p = stageSnapshotSchema.safeParse(row.snapshot);
    if (
      !p.success ||
      row.snapshotSchemaVersion !== 1 ||
      hashJson(row.snapshot) !== row.contentHash
    )
      return null;
    const a = p.data;
    return a.termId === row.termId &&
      a.stage === row.stage &&
      a.state === row.state &&
      a.version === row.version &&
      a.workflowRevision === row.workflowRevision &&
      a.sealedAt === row.sealedAt.toISOString() &&
      a.sealedByUserId === row.sealedByUserId
      ? a
      : null;
  }
  private proof(
    row:
      | Awaited<ReturnType<DefenseWorkflowSession["evidence"]>>[number]
      | undefined,
  ): AcademicProof | null {
    if (!row) return null;
    const p = academicProofSchema.safeParse({
      ...row,
      verifiedAt: row.verifiedAt.toISOString(),
    });
    if (!p.success) return null;
    const { contentHash, ...data } = p.data;
    return academicProofHash(data) === contentHash ? p.data : null;
  }
  private async load(
    s: DefenseWorkflowSession,
    tx: Prisma.TransactionClient,
    userId: string,
    termId: string,
    verifyFiles = true,
  ) {
    const actor = await this.access(s, userId, termId, "read");
    const term = await s.term(termId);
    if (!term)
      planningError(
        404,
        "DEFENSE_TERM_NOT_FOUND",
        "Không tìm thấy đợt trong phạm vi được phép.",
      );
    const [
      list,
      members,
      proposals,
      registrations,
      lecturers,
      evidence,
      rows,
      artifacts,
      candidates,
      rooms,
      uc18,
      at,
    ] = await Promise.all([
      s.list(termId),
      s.members(termId),
      s.dossiers(termId),
      s.assignments(termId),
      s.lecturerRoster(termId),
      s.evidence(termId),
      s.stages(termId),
      s.artifacts(termId),
      s.candidates(termId),
      s.rooms(),
      this.reader.read(termId, tx),
      s.now(),
    ]);
    const parsedPolicy = defenseWorkflowPolicySchema.safeParse(
      list?.workflowPolicy,
    );
    let policy =
      parsedPolicy.success &&
      list &&
      list.workflowPolicyRevision > 0 &&
      list.workflowPolicyUpdatedAt &&
      list.workflowPolicyUpdatedByUserId
        ? parsedPolicy.data
        : null;
    if (policy) {
      try {
        validatePolicyDates(policy, term);
      } catch {
        policy = null;
      }
    }
    const latest = new Map<string, (typeof evidence)[number]>();
    for (const e of evidence)
      if (!latest.has(e.termStudentId)) latest.set(e.termStudentId, e);
    const proofByMember = new Map(
      members.map((m) => {
        const proof = this.proof(latest.get(m.id));
        return [
          m.id,
          proof?.studentId === m.studentId &&
          proof.termId === termId &&
          new Date(proof.verifiedAt) <= at
            ? proof
            : null,
        ] as const;
      }),
    );
    const live: LiveStudent[] = [];
    if (verifyFiles) {
      // Readers also take file locks for cleanup safety. A global sorted order
      // avoids deadlocks if student names/codes change between two snapshots.
      const keys = proposals
        .filter((p) => p.termId === termId && p.topic.termId === termId)
        .flatMap((p) =>
          p.finalReport?.fileAsset ? [p.finalReport.fileAsset.storageKey] : [],
        );
      for (const key of [...new Set(keys)].sort()) await s.pdfLock(key);
    }
    for (const member of members) {
      const p = proposals.find(
        (p) =>
          p.studentId === member.studentId &&
          p.termId === termId &&
          p.topic.termId === termId &&
          p.student.userId === member.student.userId,
      );
      const registration = registrations.find(
        (r) => r.studentId === member.studentId,
      );
      const a =
        registration?.advisorAssignments.find(
          (a) =>
            a.assignmentPlanId ===
            term.pr2bTermWorkflowTermId?.officialAssignmentPlanId,
        ) ?? null;
      const advisor = p
        ? this.rules.official(
            p,
            term,
            registration ? { ...registration, advisorAssignment: a } : null,
            lecturers.find((l) => l.lecturerId === a?.advisorId) ?? null,
            at,
          )
        : null;
      let pdf = this.rules.pdfMetadata(
        p?.finalReport ?? null,
        p?.id ?? "",
        member.student.userId,
        at,
      );
      if (
        verifyFiles &&
        pdf.snapshot &&
        p?.finalReport?.fileAsset &&
        ["UNVERIFIED", "READY"].includes(pdf.state)
      ) {
        try {
          const asset = p.finalReport.fileAsset;
          pdf = this.rules.pdfBytes(
            pdf,
            await this.storage.readPrivateFinalReport(
              asset.storageKey,
              100 * 1024 * 1024,
            ),
          );
        } catch {
          pdf = { ...pdf, state: "INVALID" };
        }
      }
      const decision = this.rules.decision(p?.defenseConfirmation ?? null, at);
      const changes = this.rules.changed(
        decision,
        pdf,
        advisor ?? { state: "NOT_READY", issues: [] },
      );
      const proof = proofByMember.get(member.id) ?? null;
      const reasons: string[] = [];
      if (!member.student.isActive) reasons.push("STUDENT_INACTIVE");
      if (!p) reasons.push("PROPOSAL_MISSING");
      else if (p.status !== "APPROVED") reasons.push("PROPOSAL_NOT_APPROVED");
      if (advisor?.state !== "OFFICIAL")
        reasons.push("OFFICIAL_ASSIGNMENT_MISSING");
      if (
        decision.state === "RECORDED" &&
        advisor?.state === "OFFICIAL" &&
        decision.decidedByUserId !== advisor.userId
      )
        reasons.push("UC17_ACTOR_NOT_CURRENT_ADVISOR");
      if (!proof) reasons.push("ACADEMIC_UNKNOWN");
      else if (proof.verdict !== "SATISFIED")
        reasons.push(
          proof.verdict === "SPECIAL"
            ? "SPECIAL_REVIEW_REQUIRED"
            : "ACADEMIC_NOT_SATISFIED",
        );
      if (decision.state !== "RECORDED")
        reasons.push(
          ["ABSENT", "PENDING"].includes(decision.state)
            ? "ADVISOR_CONFIRMATION_MISSING"
            : "ADVISOR_CONFIRMATION_UNVERIFIED",
        );
      else if (decision.status !== "CONFIRMED")
        reasons.push("ADVISOR_REJECTED");
      if (pdf.state !== "READY") reasons.push("PDF_NOT_VERIFIED");
      if (changes.confirmationApplicableToCurrentContext !== true)
        reasons.push("UC17_EVIDENCE_STALE_OR_UNKNOWN");
      const student: WorkflowStudent = {
        termStudentId: member.id,
        studentId: member.studentId,
        studentCode: member.student.studentCode,
        studentName: member.student.fullName,
        proposalId: p?.id ?? null,
        title: p?.topic.title ?? null,
        departmentId:
          p?.topic.researchArea?.pr2bResearchAreaWorkflowResearchAreaId
            ?.departmentId ?? null,
        advisorId: advisor?.state === "OFFICIAL" ? advisor.advisorId : null,
        advisorUserId: advisor?.state === "OFFICIAL" ? advisor.userId : null,
        admitted: reasons.length === 0,
        reasons,
        academicRevision: latest.get(member.id)?.revision ?? 0,
        academic: proof
          ? {
              id: proof.id,
              revision: proof.revision,
              verdict: proof.verdict,
              sourceReference: proof.sourceReference,
              note: proof.note,
              verifiedAt: proof.verifiedAt,
              verifiedByUserId: proof.verifiedByUserId,
            }
          : null,
      };
      live.push({ member, p, advisor, pdf, decision, proof, student });
    }
    const sealRow =
      uc18.state === "FINALIZED" && uc18.evidence
        ? await s.readFinalization(uc18.evidence.finalizationId)
        : null;
    const parsedSeal = defenseListSnapshotV2Schema.safeParse(sealRow?.snapshot);
    const seal =
      parsedSeal.success &&
      sealRow?.snapshotSchemaVersion === 2 &&
      hashJson(sealRow.snapshot) === sealRow.contentHash
        ? parsedSeal.data
        : null;
    const sourceFresh =
      !!seal &&
      uc18.state === "FINALIZED" &&
      uc18.revision === seal.listRevision &&
      seal.policyRevision <= (list?.workflowPolicyRevision ?? 0) &&
      !!policy &&
      structuralPolicyHash(seal.policy) === structuralPolicyHash(policy) &&
      seal.roster.count === live.length &&
      seal.students.every((old) => {
        const current = live.find(
          (l) =>
            l.member.id === old.termStudentId &&
            l.member.studentId === old.studentId,
        );
        const academic = seal.academicEvidence.find(
          (a) => a.termStudentId === old.termStudentId,
        );
        return (
          !!current &&
          academic?.proof?.id === current.proof?.id &&
          academic?.proof?.revision === current.proof?.revision &&
          (!old.admitted ||
            (current.student.admitted &&
              current.pdf.snapshot?.finalReportId === old.pdf?.finalReportId &&
              current.pdf.snapshot?.revision === old.pdf?.revision &&
              current.pdf.snapshot?.checksum === old.pdf?.checksum &&
              current.decision.id === old.confirmation?.id &&
              current.decision.revision === old.confirmation?.revision))
        );
      });
    const artifactMap = new Map(artifacts.map((a) => [a.id, a]));
    const snapshots = new Map<DefenseStage, StageSnapshot>();
    for (const row of rows) {
      const artifact = artifactMap.get(row.currentArtifactId ?? ""),
        a = this.artifact(artifact);
      if (
        a &&
        a.termId === termId &&
        a.stage === row.stage &&
        a.workflowRevision === row.revision &&
        a.state === row.state
      )
        snapshots.set(row.stage, a);
    }
    const rowMap = new Map(rows.map((r) => [r.stage, r]));
    const upstreamCurrent = (stage: DefenseStage) => {
      const row = rowMap.get(stage),
        a = snapshots.get(stage);
      if (
        !row ||
        !a ||
        row.sourceFinalizationId !== sealRow?.id ||
        row.sourceListRevision !== seal?.listRevision ||
        a.source.id !== sealRow?.id ||
        a.source.hash !== sealRow?.contentHash ||
        a.source.revision !== seal?.listRevision ||
        a.policyRevision > (list?.workflowPolicyRevision ?? 0) ||
        !policy ||
        structuralPolicyHash(a.policy) !== structuralPolicyHash(policy)
      )
        return false;
      if (stage === "COMMITTEES")
        return (
          a.upstream === null &&
          row.upstreamArtifactId === null &&
          row.upstreamStage === null &&
          row.upstreamRevision === null
        );
      const prev = stage === "REVIEWERS" ? "COMMITTEES" : "REVIEWERS";
      const p = rowMap.get(prev),
        pa = snapshots.get(prev);
      return (
        !!pa &&
        !!p &&
        !!a.upstream &&
        row.upstreamArtifactId === a.upstream.id &&
        row.upstreamStage === a.upstream.stage &&
        row.upstreamRevision === a.upstream.revision &&
        a.upstream.id === p.currentArtifactId &&
        a.upstream.revision === p.revision &&
        a.upstream.hash === artifactMap.get(p.currentArtifactId!)?.contentHash
      );
    };
    const expectedContext = hashJson({
      actor: {
        id: actor.id,
        permissions: actor.userRoles
          .flatMap((r) =>
            r.role.rolePermissions.map(
              (p) => `${p.permission.resource}:${p.permission.action}`,
            ),
          )
          .sort(),
      },
      term,
      list,
      members,
      evidence,
      rows,
      artifacts,
      // Dates/Decimal values become plain JSON. Never return this private hash input.
      proposals,
      registrations,
      lecturers,
      candidates,
      rooms,
    });
    const sourceFingerprint = hashJson({
      term,
      members,
      proposals,
      registrations,
      lecturers,
      candidates,
      rooms,
    });
    const windowOpen = (key: "UC18" | DefenseStage) => {
      try {
        workflowWindow(policy, key, at, term);
        return true;
      } catch {
        return false;
      }
    };
    const official = (stage: DefenseStage): boolean =>
      sourceFresh &&
      upstreamCurrent(stage) &&
      (stage === "COMMITTEES" ||
        official(stage === "REVIEWERS" ? "COMMITTEES" : "REVIEWERS"));
    const view: DefenseWorkflowContext = {
      termId,
      termName: term.name,
      serverNow: at.toISOString(),
      expectedContext,
      list: {
        state: list?.state ?? "ABSENT",
        revision: list?.revision ?? 0,
        finalizationId: list?.currentFinalizationId ?? null,
        version: sealRow?.version ?? null,
      },
      policy,
      policyRevision: list?.workflowPolicyRevision ?? 0,
      students: live.map((l) => l.student),
      blockers: [
        ...(!list ? ["DEFENSE_LIST_NOT_CONFIGURED"] : []),
        ...(!policy ? ["WORKFLOW_POLICY_MISSING"] : []),
        ...(uc18.state === "UNKNOWN" ? ["UC18_UNKNOWN"] : []),
        ...(uc18.state === "FINALIZED" && !sourceFresh
          ? ["UC18_EVIDENCE_STALE_OR_V1"]
          : []),
      ],
      stages: stages.map((stage) => {
        const row = rowMap.get(stage),
          a = snapshots.get(stage);
        const upstreamReady =
          stage === "COMMITTEES" ||
          (stage === "REVIEWERS"
            ? official("COMMITTEES")
            : official("COMMITTEES"));
        const can = (action: string) =>
          this.permission(actor, action) &&
          sourceFresh &&
          windowOpen(stage) &&
          upstreamReady;
        return {
          stage,
          state: row?.state ?? "ABSENT",
          revision: row?.revision ?? 0,
          draft: (row?.draft as StageDraft | null) ?? null,
          artifactId: row?.currentArtifactId ?? null,
          version: a?.version ?? null,
          sourceCurrent: official(stage),
          capabilities: {
            save: can("manage") && (!row || row.state === "DRAFT"),
            finalize:
              can("finalize") &&
              row?.state === "DRAFT" &&
              (stage !== "SCHEDULE" || official("REVIEWERS")),
            publish:
              can("publish") && row?.state === "FINALIZED" && official(stage),
            amend:
              can("publish") && row?.state === "PUBLISHED" && official(stage),
          },
        };
      }),
      warnings: [],
      workload: [],
      suggestions: [],
      capabilities: {
        configure:
          this.permission(actor, "configure") &&
          !!list &&
          !term.isLocked &&
          !["COMPLETED", "CANCELLED"].includes(term.status),
        verifyAcademic:
          this.permission(actor, "verify-academic") &&
          windowOpen("UC18") &&
          list?.state === "OPEN",
        finalize:
          this.permission(actor, "finalize") &&
          windowOpen("UC18") &&
          list?.state === "OPEN" &&
          uc18.state === "OPEN",
        reopen:
          this.permission(actor, "reopen") &&
          windowOpen("UC18") &&
          uc18.state === "FINALIZED" &&
          !rows.some((r) => r.state !== "DRAFT") &&
          artifacts.length === 0,
      },
    };
    const reviewDraft =
      snapshots.get("REVIEWERS")?.reviewers ??
      (() => {
        const p = reviewerDraftSchema.safeParse(rowMap.get("REVIEWERS")?.draft);
        return p.success ? p.data.reviewers : [];
      })();
    const loads = new Map(candidates.map((c) => [c.lecturer.id, 0]));
    for (const r of reviewDraft)
      for (const id of r.reviewerIds) loads.set(id, (loads.get(id) ?? 0) + 1);
    view.workload = [...loads].map(([lecturerId, count]) => ({
      lecturerId,
      count,
    }));
    if (policy?.reviewerWarningLoad)
      view.warnings = view.workload
        .filter((w) => w.count > policy.reviewerWarningLoad!)
        .map(
          (w) =>
            `GVPB ${w.lecturerId}: ${w.count} hồ sơ, vượt ngưỡng cảnh báo ${policy.reviewerWarningLoad}. Đây không phải hard quota.`,
        );
    const suggestionLoads = new Map(candidates.map((c) => [c.lecturer.id, 0]));
    if (seal)
      for (const old of seal.students.filter((s) => s.admitted)) {
        const current = live.find(
          (l) => l.student.proposalId === old.proposalId,
        );
        const choice = [...suggestionLoads]
          .filter(([id]) => id !== current?.student.advisorId)
          .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))[0];
        if (choice && old.proposalId) {
          view.suggestions.push({
            proposalId: old.proposalId,
            reviewerIds: [choice[0]],
          });
          suggestionLoads.set(choice[0], choice[1] + 1);
        }
      }
    return {
      s,
      tx,
      actor,
      term,
      list,
      live,
      evidence,
      policy,
      seal,
      sealRow,
      rows,
      rowMap,
      artifactMap,
      artifacts,
      snapshots,
      uc18,
      sourceFresh,
      official,
      sourceFingerprint,
      view,
      candidates,
      rooms,
    };
  }
  context(userId: string, termId: string) {
    return this.repo.transaction(false, (s, tx) =>
      this.load(s, tx, userId, termId).then((c) => c.view),
    );
  }
  private async command(
    userId: string,
    termId: string,
    route: string,
    action: string,
    window: "UC18" | DefenseStage | null,
    input: WorkflowCommand,
    payload: unknown,
    work: (
      c: Awaited<ReturnType<DefenseWorkflowService["load"]>>,
    ) => Promise<Omit<CommandResult, "expectedContext" | "changed">>,
  ) {
    return this.repo.transaction(true, async (s, tx) => {
      await s.lock(termId);
      const c = await this.load(s, tx, userId, termId);
      await this.access(s, userId, termId, action);
      const checkTime = async () => {
        const at = await s.now();
        if (window) workflowWindow(c.policy, window, at, c.term);
        else if (
          c.term.isLocked ||
          ["COMPLETED", "CANCELLED"].includes(c.term.status)
        )
          planningError(
            409,
            "DEFENSE_TERM_CLOSED",
            "Đợt đã khóa hoặc kết thúc.",
          );
        return at;
      };
      await checkTime();
      const recordRoute = `${termId}:${route}`;
      const method =
        route.startsWith("SAVE_") || route === "CONFIGURE_DEFENSE_WORKFLOW"
          ? "PUT"
          : "POST";
      const payloadHash = hashJson(payload),
        prior = await s.idempotency(
          userId,
          method,
          recordRoute,
          input.requestId,
        );
      if (prior) {
        if (
          ((window !== null && window !== "UC18") ||
            route === "FINALIZE_DEFENSE_LIST") &&
          !c.sourceFresh
        )
          planningError(
            409,
            "DEFENSE_SOURCE_STALE",
            "Không thể trả kết quả lặp khi chứng cứ nguồn không còn được xác minh.",
          );
        const result = prior.result as CommandResult | null;
        if (
          prior.payloadHash !== payloadHash ||
          !result ||
          prior.expiresAt <= (await s.now())
        )
          planningError(
            409,
            "IDEMPOTENCY_CONFLICT",
            "Request ID đã dùng cho nội dung khác hoặc hết hiệu lực.",
          );
        requireContext(result.expectedContext, c.view.expectedContext);
        // Context includes source pointers and file identities, access/window were
        // rechecked above. No audit/notification is repeated for this exact result.
        return { ...result, changed: false };
      }
      requireContext(input.expectedContext, c.view.expectedContext);
      const result = await work(c);
      await this.audit.log(
        {
          userId,
          action: route,
          resource: "defense-workflow",
          resourceId: termId,
          oldValue: { revision: input.expectedRevision },
          newValue: result,
        },
        tx,
      );
      await this.access(s, userId, termId, action);
      await checkTime();
      const after = await this.load(s, tx, userId, termId, false);
      requireContext(c.sourceFingerprint, after.sourceFingerprint);
      const response: CommandResult = {
        ...result,
        changed: true,
        expectedContext: after.view.expectedContext,
      };
      await s.rememberCommand({
        id: randomUUID(),
        actorId: userId,
        method,
        route: recordRoute,
        key: input.requestId,
        payloadHash,
        result: json(response),
        expiresAt: new Date((await s.now()).getTime() + 86400000),
      });
      await checkTime();
      return response;
    });
  }
  async configure(userId: string, termId: string, raw: WorkflowPolicyInput) {
    const input = workflowPolicyCommandSchema.parse(raw);
    return this.command(
      userId,
      termId,
      "CONFIGURE_DEFENSE_WORKFLOW",
      "configure",
      null,
      input,
      input,
      async (c) => {
        if (!c.list)
          planningError(
            409,
            "DEFENSE_LIST_NOT_CONFIGURED",
            "Tạo DRAFT danh sách trước khi cấu hình policy.",
          );
        const sealed =
          c.list.state === "FINALIZED" ||
          c.rows.some((r) => r.state !== "DRAFT") ||
          c.artifacts.length > 0;
        if (
          sealed &&
          c.policy &&
          structuralPolicyHash(c.policy) !== structuralPolicyHash(input.policy)
        )
          planningError(
            409,
            "DEFENSE_POLICY_SEALED",
            "Chỉ được điều chỉnh mốc thời gian; cần mở lại hợp lệ trước khi đổi cấu trúc policy đã chốt.",
          );
        if (
          sealed &&
          !c.policy &&
          (c.rows.some((r) => r.state !== "DRAFT") || c.artifacts.length > 0)
        )
          planningError(
            409,
            "DEFENSE_POLICY_SEALED",
            "Nguồn policy không đủ xác minh; không được sửa khi đã có downstream chính thức.",
          );
        requireRevision(input.expectedRevision, c.list.workflowPolicyRevision);
        validatePolicyDates(input.policy, c.term);
        const at = await c.s.now();
        const result = await c.s.policy(termId, input.expectedRevision, {
          workflowPolicy: json(input.policy),
          workflowPolicyRevision: input.expectedRevision + 1,
          workflowPolicyUpdatedAt: at,
          workflowPolicyUpdatedByUserId: userId,
          updatedAt: at,
        });
        if (result.count !== 1)
          planningError(409, "REVISION_CONFLICT", "Policy vừa thay đổi.");
        await this.audit.log(
          {
            userId,
            action: "DEFENSE_WORKFLOW_POLICY_CHANGED",
            resource: "defense-list",
            resourceId: termId,
            oldValue: {
              policy: c.list.workflowPolicy,
              revision: c.list.workflowPolicyRevision,
            },
            newValue: {
              policy: input.policy,
              revision: input.expectedRevision + 1,
            },
          },
          c.tx,
        );
        return { revision: input.expectedRevision + 1 };
      },
    );
  }
  async academic(userId: string, termId: string, raw: AcademicEvidenceInput) {
    const input = academicEvidenceCommandSchema.parse(raw);
    return this.command(
      userId,
      termId,
      "VERIFY_DEFENSE_ACADEMIC",
      "verify-academic",
      "UC18",
      input,
      input,
      async (c) => {
        if (c.uc18.state !== "OPEN")
          planningError(
            409,
            "UC18_NOT_OPEN",
            "Chỉ ghi chứng cứ khi UC18 OPEN đã xác minh.",
          );
        const live = c.live.find((l) => l.member.id === input.termStudentId);
        if (!live)
          planningError(
            404,
            "DEFENSE_ROSTER_NOT_FOUND",
            "Không tìm thấy TermStudent trong đợt.",
          );
        const previous = c.evidence.find(
          (e) => e.termStudentId === input.termStudentId,
        );
        requireRevision(input.expectedRevision, previous?.revision ?? 0);
        const data = {
          id: randomUUID(),
          termId,
          termStudentId: live.member.id,
          studentId: live.member.studentId,
          revision: input.expectedRevision + 1,
          verdict: input.verdict,
          sourceReference: input.sourceReference,
          note: input.note,
          schemaVersion: 1 as const,
          verifiedAt: (await c.s.now()).toISOString(),
          verifiedByUserId: userId,
        };
        await c.s.newEvidence({
          ...data,
          verifiedAt: new Date(data.verifiedAt),
          contentHash: academicProofHash(data),
        });
        return { revision: data.revision, artifactId: data.id };
      },
    );
  }
  academicHistory(userId: string, termId: string, termStudentId: string) {
    return this.repo.transaction(false, async (s) => {
      await this.access(s, userId, termId, "read");
      if (!(await s.members(termId)).some((m) => m.id === termStudentId))
        planningError(
          404,
          "DEFENSE_ROSTER_NOT_FOUND",
          "Không tìm thấy hồ sơ thuộc đợt.",
        );
      return {
        items: (await s.evidence(termId))
          .filter((e) => e.termStudentId === termStudentId)
          .map((e) => ({
            id: e.id,
            revision: e.revision,
            verdict: e.verdict,
            sourceReference: e.sourceReference,
            note: e.note,
            verifiedAt: e.verifiedAt.toISOString(),
            verifiedByUserId: e.verifiedByUserId,
            integrity: this.proof(e) ? "VERIFIED" : "UNKNOWN",
          })),
      };
    });
  }
  async finalizeList(userId: string, termId: string, raw: WorkflowCommand) {
    const input = workflowCommandSchema.parse(raw);
    return this.command(
      userId,
      termId,
      "FINALIZE_DEFENSE_LIST",
      "finalize",
      "UC18",
      input,
      input,
      async (c) => {
        if (!c.list || c.uc18.state !== "OPEN")
          planningError(
            409,
            "UC18_NOT_OPEN",
            "Danh sách phải ở OPEN đã xác minh.",
          );
        requireRevision(input.expectedRevision, c.list.revision);
        const at = await c.s.now(),
          revision = c.list.revision + 1,
          version = (await c.s.finalizationVersion(termId)) + 1;
        const snapshot: DefenseListSnapshotV2 = {
          schemaVersion: 2,
          termId,
          listRevision: revision,
          finalizationVersion: version,
          finalizedAt: at.toISOString(),
          finalizedByUserId: userId,
          policyRevision: c.list.workflowPolicyRevision,
          policy: c.policy!,
          roster: {
            count: c.live.length,
            members: c.live.map((l) => ({
              termStudentId: l.member.id,
              studentId: l.member.studentId,
            })),
          },
          students: c.live.map((l) => ({
            termStudentId: l.member.id,
            studentId: l.member.studentId,
            proposalId: l.p?.id ?? null,
            pdf: l.pdf.state === "READY" ? l.pdf.snapshot : null,
            confirmation:
              l.p?.defenseConfirmation &&
              ["PENDING", "CONFIRMED", "REJECTED"].includes(
                l.p.defenseConfirmation.status,
              )
                ? {
                    id: l.p.defenseConfirmation.id,
                    revision: l.decision.revision,
                    status: l.p.defenseConfirmation.status as
                      "PENDING" | "CONFIRMED" | "REJECTED",
                    advisorId: l.p.defenseConfirmation.advisorId,
                    decidedAt: l.decision.decidedAt,
                    decidedByUserId: l.decision.decidedByUserId,
                    snapshot: l.decision.snapshot,
                  }
                : null,
            eligibility: null,
            admitted: l.student.admitted,
            exclusionReasons: l.student.reasons,
          })),
          academicEvidence: c.live.map((l) => ({
            termStudentId: l.member.id,
            studentId: l.member.studentId,
            proposalStatus: l.p?.status ?? null,
            proof: l.proof,
            advisorUserId:
              l.advisor?.state === "OFFICIAL" ? l.advisor.userId : null,
            assignment:
              l.advisor?.state === "OFFICIAL"
                ? {
                    assignmentId: l.advisor.assignmentId,
                    revision: l.advisor.revision,
                  }
                : null,
          })),
        };
        const parsed = defenseListSnapshotV2Schema.safeParse(snapshot);
        if (!parsed.success)
          planningError(
            409,
            "UC18_CAPTURE_INVALID",
            "Nguồn dữ liệu không thể tạo bản chốt hợp lệ; cần đối soát.",
          );
        const artifactId = randomUUID();
        await c.s.finalization({
          id: artifactId,
          termId,
          version,
          listRevision: revision,
          snapshotSchemaVersion: 2,
          snapshot: json(snapshot),
          contentHash: hashJson(snapshot),
          finalizedAt: at,
          finalizedByUserId: userId,
        });
        const saved = await c.s.listCas(termId, input.expectedRevision, {
          state: "FINALIZED",
          revision,
          currentFinalizationId: artifactId,
          updatedAt: at,
        });
        if (saved.count !== 1)
          planningError(409, "REVISION_CONFLICT", "Danh sách vừa thay đổi.");
        const verified = await this.reader.read(termId, c.tx);
        if (
          verified.state !== "FINALIZED" ||
          verified.evidence?.finalizationId !== artifactId
        )
          planningError(
            409,
            "UC18_SEAL_NOT_VERIFIED",
            "Không xác minh được bản chốt vừa ghi.",
          );
        return { revision, artifactId, version };
      },
    );
  }
  async reopenList(
    userId: string,
    termId: string,
    raw: WorkflowCommand & { reason: string },
  ) {
    const input = workflowReopenSchema.parse(raw);
    return this.command(
      userId,
      termId,
      "REOPEN_DEFENSE_LIST",
      "reopen",
      "UC18",
      input,
      input,
      async (c) => {
        if (!c.list || c.uc18.state !== "FINALIZED")
          planningError(
            409,
            "UC18_NOT_FINALIZED",
            "Chỉ mở lại bản chốt UC18 hợp lệ.",
          );
        requireRevision(input.expectedRevision, c.list.revision);
        // MVP intentionally has no downstream cascade or silent schedule withdrawal.
        if (c.rows.some((r) => r.state !== "DRAFT") || c.artifacts.length > 0)
          planningError(
            409,
            "DEFENSE_DOWNSTREAM_FINALIZED",
            "Đã có hội đồng/phản biện/lịch được chốt; MVP không cho mở lại UC18.",
          );
        const result = await c.s.listCas(termId, input.expectedRevision, {
          state: "OPEN",
          revision: input.expectedRevision + 1,
          currentFinalizationId: null,
          openedAt: await c.s.now(),
          openedByUserId: userId,
        });
        if (result.count !== 1)
          planningError(409, "REVISION_CONFLICT", "Danh sách vừa thay đổi.");
        await this.audit.log(
          {
            userId,
            action: "DEFENSE_LIST_REOPEN_REASON",
            resource: "defense-list",
            resourceId: termId,
            newValue: {
              reason: input.reason,
              previousFinalizationId: c.list.currentFinalizationId,
            },
          },
          c.tx,
        );
        return { revision: input.expectedRevision + 1 };
      },
    );
  }

  private plan(
    c: Awaited<ReturnType<DefenseWorkflowService["load"]>>,
    stage: DefenseStage,
    draft: StageDraft,
  ) {
    if (!c.seal || !c.sealRow || !c.sourceFresh)
      planningError(
        409,
        "UC18_SOURCE_STALE",
        "Cần UC18 FINALIZED V2 có chứng cứ hiện hành; không dùng preview/legacy làm nguồn.",
      );
    const committees =
      stage === "COMMITTEES"
        ? committeeDraftSchema.parse(draft).committees
        : c.snapshots.get("COMMITTEES")?.committees;
    if (!committees || (stage !== "COMMITTEES" && !c.official("COMMITTEES")))
      planningError(
        409,
        "UC19_NOT_FINALIZED",
        "Cần hội đồng đã chốt từ nguồn hiện hành.",
      );
    const reviewers =
      stage === "COMMITTEES"
        ? []
        : stage === "REVIEWERS"
          ? reviewerDraftSchema.parse(draft).reviewers
          : (c.snapshots.get("REVIEWERS")?.reviewers ?? []);
    const slots =
      stage === "SCHEDULE" ? scheduleDraftSchema.parse(draft).slots : [];
    return { committees, reviewers, slots };
  }
  private facts(c: Awaited<ReturnType<DefenseWorkflowService["load"]>>) {
    return {
      term: {
        id: c.term.id,
        name: c.term.name,
        status: c.term.status,
        locked: c.term.isLocked,
        startsAt: c.term.startDate.toISOString(),
        endsAt: c.term.endDate.toISOString(),
      },
      source: {
        kind: "UC18_FINALIZED" as const,
        finalizationId: c.sealRow!.id,
        version: c.sealRow!.version,
        rosterCount: c.seal!.roster.count,
        admittedCount: c.seal!.students.filter((s) => s.admitted).length,
      },
      students: c
        .seal!.students.filter((s) => s.admitted)
        .map((old) => {
          const l = c.live.find(
            (l) => l.student.proposalId === old.proposalId,
          )!;
          return {
            termStudentId: l.member.id,
            studentId: l.member.studentId,
            proposalId: l.p!.id,
            code: l.student.studentCode,
            name: l.student.studentName,
            title: l.student.title,
            admitted: true,
            advisor:
              l.advisor?.state === "OFFICIAL"
                ? {
                    id: l.advisor.advisorId,
                    name: l.advisor.name,
                    assignmentId: l.advisor.assignmentId,
                    revision: l.advisor.revision,
                  }
                : null,
            evidence: "UNCHANGED_METADATA" as const,
          };
        }),
      lecturers: c.candidates.map((r) => ({
        id: r.lecturer.id,
        name: r.lecturer.fullName,
        departmentId: r.lecturer.departmentId,
      })),
      rooms: c.rooms,
    };
  }
  private async busy(
    c: Awaited<ReturnType<DefenseWorkflowService["load"]>>,
    committees: CommitteePlan[],
    reviewers: ReviewerPlan[],
    slots: ScheduleSlot[],
  ) {
    if (!slots.length) return [];
    const resourceKeys = (ss: ScheduleSlot[]) =>
      ss.flatMap((slot) => {
        const student = c.live.find(
          (l) => l.student.proposalId === slot.proposalId,
        );
        const people = [
          ...(committees
            .find((c) => c.key === slot.committeeKey)
            ?.members.map((m) => m.lecturerId) ?? []),
          ...(reviewers.find((r) => r.proposalId === slot.proposalId)
            ?.reviewerIds ?? []),
        ];
        return [
          `ROOM:${slot.roomId}`,
          `COMMITTEE:${c.term.id}:${slot.committeeKey}`,
          ...people.map((id) => `LECTURER:${id}`),
          ...(student ? [`STUDENT:${student.member.studentId}`] : []),
        ];
      });
    const old = c.snapshots.get("SCHEDULE")?.slots ?? [];
    await c.s.resources([...resourceKeys(slots), ...resourceKeys(old)]);
    const start = new Date(
        Math.min(...slots.map((s) => Date.parse(s.startsAt))),
      ),
      end = new Date(Math.max(...slots.map((s) => Date.parse(s.endsAt))));
    const legacy = await c.s.busySessions(start, end);
    const proposalIds = [
      ...new Set(
        legacy.flatMap((b) => b.committeeStudents.map((p) => p.proposalId)),
      ),
    ];
    const [students, reviewerRows, officialRows] = await Promise.all([
      c.s.bookingStudents(proposalIds),
      c.s.reviewers(proposalIds),
      c.s.officialBookings(),
    ]);
    const busy: BusySlot[] = legacy.map((b) => ({
      roomId: b.roomId,
      startsAt: b.scheduledAt.toISOString(),
      endsAt: new Date(
        b.scheduledAt.getTime() + b.durationMin * 60000,
      ).toISOString(),
      proposalIds: b.committeeStudents.map((p) => p.proposalId),
      studentIds: students
        .filter((s) => b.committeeStudents.some((p) => p.proposalId === s.id))
        .map((s) => s.studentId),
      lecturerIds: [
        ...b.committee.members.map((m) => m.lecturerId),
        ...reviewerRows
          .filter((r) =>
            b.committeeStudents.some((p) => p.proposalId === r.proposalId),
          )
          .map((r) => r.reviewerId),
      ],
    }));
    for (const row of officialRows) {
      if (row.termId === c.term.id) continue;
      const a = this.artifact(row.currentArtifact);
      if (
        !a ||
        a.stage !== "SCHEDULE" ||
        a.workflowRevision !== row.revision ||
        a.termId !== row.termId ||
        a.state !== row.state
      )
        planningError(
          503,
          "DEFENSE_BOOKING_UNVERIFIED",
          "Không xác minh được nguồn đặt lịch; không thể chốt lịch mới.",
        );
      for (const slot of a.slots)
        busy.push({
          roomId: slot.roomId,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          proposalIds: [slot.proposalId],
          studentIds: a.students
            .filter((s) => s.proposalId === slot.proposalId)
            .map((s) => s.studentId),
          lecturerIds: [
            ...(a.committees
              .find((c) => c.key === slot.committeeKey)
              ?.members.map((m) => m.lecturerId) ?? []),
            ...(a.reviewers.find((r) => r.proposalId === slot.proposalId)
              ?.reviewerIds ?? []),
          ],
        });
    }
    return busy;
  }
  async saveStage(
    userId: string,
    termId: string,
    stage: DefenseStage,
    raw: StageSaveInput,
  ) {
    const input = stageSaveSchema.parse(raw);
    return this.command(
      userId,
      termId,
      `SAVE_DEFENSE_${stage}`,
      "manage",
      stage,
      input,
      input,
      async (c) => {
        const row = c.rowMap.get(stage);
        requireRevision(input.expectedRevision, row?.revision ?? 0);
        if (row && row.state !== "DRAFT")
          planningError(
            409,
            "DEFENSE_STAGE_SEALED",
            "Đã chốt; không sửa bản hiện hành bằng save draft.",
          );
        const plan = this.plan(c, stage, input.draft);
        // Drafts may be incomplete, but never accept another term's proposal or
        // lecturer as a plausible official reference.
        const allowed = new Set(
          c.seal!.students.filter((s) => s.admitted).map((s) => s.proposalId),
        );
        const ids =
          stage === "COMMITTEES"
            ? plan.committees.flatMap((c) => c.proposalIds)
            : stage === "REVIEWERS"
              ? plan.reviewers.map((r) => r.proposalId)
              : plan.slots.map((s) => s.proposalId);
        if (ids.some((id) => !allowed.has(id)))
          planningError(
            422,
            "PROPOSAL_OUT_OF_SCOPE",
            "Draft chứa hồ sơ ngoài tập UC18 admitted.",
          );
        const lecturerIds = new Set(c.candidates.map((c) => c.lecturer.id));
        if (
          (stage === "COMMITTEES" &&
            plan.committees.some((c) =>
              c.members.some((m) => !lecturerIds.has(m.lecturerId)),
            )) ||
          (stage === "REVIEWERS" &&
            plan.reviewers.some((r) =>
              r.reviewerIds.some((id) => !lecturerIds.has(id)),
            ))
        )
          planningError(
            422,
            "LECTURER_OUT_OF_TERM",
            "Giảng viên không thuộc roster hoạt động của đợt.",
          );
        const upstreamStage =
          stage === "COMMITTEES"
            ? null
            : stage === "REVIEWERS" || !c.official("REVIEWERS")
              ? ("COMMITTEES" as const)
              : ("REVIEWERS" as const);
        const upstream = upstreamStage ? c.rowMap.get(upstreamStage)! : null;
        const at = await c.s.now();
        const data = {
          state: "DRAFT" as const,
          revision: input.expectedRevision + 1,
          draft: json(input.draft),
          sourceFinalizationId: c.sealRow!.id,
          sourceListRevision: c.seal!.listRevision,
          upstreamArtifactId: upstream?.currentArtifactId ?? null,
          upstreamStage,
          upstreamRevision: upstream?.revision ?? null,
          currentArtifactId: null,
          updatedByUserId: userId,
          updatedAt: at,
        };
        if (!row)
          await c.s.createStage({ ...data, termId, stage, createdAt: at });
        else if (
          (await c.s.stageCas(termId, stage, input.expectedRevision, data))
            .count !== 1
        )
          planningError(409, "REVISION_CONFLICT", "Draft vừa thay đổi.");
        return { revision: input.expectedRevision + 1 };
      },
    );
  }
  async sealStage(
    userId: string,
    termId: string,
    stage: DefenseStage,
    operation: "finalize" | "publish" | "amend",
    raw: WorkflowCommand | (StageSaveInput & { reason: string }),
  ) {
    const input =
      operation === "amend"
        ? scheduleAmendSchema.parse(raw)
        : workflowCommandSchema.parse(raw);
    if (stage !== "SCHEDULE" && operation !== "finalize")
      planningError(
        400,
        "DEFENSE_STAGE_ACTION_INVALID",
        "Chỉ lịch có công bố/amendment.",
      );
    return this.command(
      userId,
      termId,
      `${operation.toUpperCase()}_DEFENSE_${stage}`,
      operation === "finalize" ? "finalize" : "publish",
      stage,
      input,
      input,
      async (c) => {
        const row = c.rowMap.get(stage);
        if (!row)
          planningError(
            409,
            "DEFENSE_STAGE_NOT_SAVED",
            "Cần lưu draft server trước khi chốt.",
          );
        requireRevision(input.expectedRevision, row.revision);
        const expected =
          operation === "finalize"
            ? "DRAFT"
            : operation === "publish"
              ? "FINALIZED"
              : "PUBLISHED";
        if (row.state !== expected)
          planningError(
            409,
            "DEFENSE_STAGE_TRANSITION_INVALID",
            `Thao tác yêu cầu trạng thái ${expected}.`,
          );
        if (stage === "SCHEDULE" && !c.official("REVIEWERS"))
          planningError(
            409,
            "UC20_NOT_FINALIZED",
            "Chỉ chốt/công bố khi phản biện hiện hành đã chốt.",
          );
        if (operation !== "finalize" && !c.official(stage))
          planningError(
            409,
            "DEFENSE_STAGE_SOURCE_STALE",
            "Bản chốt nguồn đã thay đổi.",
          );
        const draft =
          operation === "amend" ? (input as StageSaveInput).draft : row.draft;
        const plan = this.plan(c, stage, draft as StageDraft);
        const facts = this.facts(c);
        // Validate before querying global bookings, so malformed/out-of-term dates
        // cannot cause an unbounded scan. Then validate again under resource locks.
        validateOfficialPlan(
          stage,
          facts,
          c.policy!,
          plan.committees,
          plan.reviewers,
          plan.slots,
        );
        if (stage === "SCHEDULE")
          validateOfficialPlan(
            stage,
            facts,
            c.policy!,
            plan.committees,
            plan.reviewers,
            plan.slots,
            await this.busy(c, plan.committees, plan.reviewers, plan.slots),
          );
        const at = await c.s.now(),
          revision = row.revision + 1,
          version =
            Math.max(
              0,
              ...c.artifacts
                .filter((a) => a.stage === stage)
                .map((a) => a.version),
            ) + 1;
        workflowWindow(c.policy, stage, at, c.term);
        const upstreamStage =
          stage === "COMMITTEES"
            ? null
            : stage === "REVIEWERS"
              ? "COMMITTEES"
              : "REVIEWERS";
        const upstreamRow = upstreamStage ? c.rowMap.get(upstreamStage)! : null;
        const upstreamArtifact = upstreamRow
          ? c.artifactMap.get(upstreamRow.currentArtifactId!)!
          : null;
        const snapshot: StageSnapshot = {
          schemaVersion: 1,
          termId,
          stage,
          state: operation === "finalize" ? "FINALIZED" : "PUBLISHED",
          version,
          workflowRevision: revision,
          sealedAt: at.toISOString(),
          sealedByUserId: userId,
          source: {
            id: c.sealRow!.id,
            revision: c.seal!.listRevision,
            hash: c.sealRow!.contentHash,
          },
          upstream: upstreamArtifact
            ? {
                id: upstreamArtifact.id,
                stage: upstreamArtifact.stage as "COMMITTEES" | "REVIEWERS",
                revision: upstreamArtifact.workflowRevision,
                hash: upstreamArtifact.contentHash,
              }
            : null,
          policyRevision: c.list!.workflowPolicyRevision,
          policy: c.policy!,
          ...plan,
          rooms:
            stage === "SCHEDULE"
              ? c.rooms.filter((r) => plan.slots.some((s) => s.roomId === r.id))
              : [],
          students: c
            .seal!.students.filter((s) => s.admitted)
            .map((old) => {
              const live = c.live.find((l) => l.p?.id === old.proposalId)!;
              return {
                proposalId: live.p!.id,
                studentId: live.member.studentId,
                studentUserId: live.member.student.userId,
                studentName: live.member.student.fullName,
                title: live.p!.topic.title,
                departmentId: live.student.departmentId,
                advisorId: live.student.advisorId!,
                advisorUserId: live.student.advisorUserId!,
              };
            }),
        };
        stageSnapshotSchema.parse(snapshot);
        const artifactId = randomUUID();
        await c.s.newArtifact({
          id: artifactId,
          termId,
          stage,
          state: snapshot.state,
          version,
          workflowRevision: revision,
          snapshotSchemaVersion: 1,
          snapshot: json(snapshot),
          contentHash: hashJson(snapshot),
          sealedAt: at,
          sealedByUserId: userId,
        });
        const saved = await c.s.stageCas(termId, stage, row.revision, {
          state: snapshot.state,
          revision,
          currentArtifactId: artifactId,
          sourceFinalizationId: c.sealRow!.id,
          sourceListRevision: c.seal!.listRevision,
          upstreamArtifactId: upstreamRow?.currentArtifactId ?? null,
          upstreamStage: upstreamStage as DefenseStage | null,
          upstreamRevision: upstreamRow?.revision ?? null,
          updatedByUserId: userId,
          updatedAt: at,
          draft: json(
            stage === "COMMITTEES"
              ? { committees: plan.committees }
              : stage === "REVIEWERS"
                ? { reviewers: plan.reviewers }
                : { slots: plan.slots },
          ),
        });
        if (saved.count !== 1)
          planningError(409, "REVISION_CONFLICT", "Workflow vừa thay đổi.");
        if (operation === "amend")
          await this.audit.log(
            {
              userId,
              action: "AMEND_DEFENSE_SCHEDULE_REASON",
              resource: "defense-workflow",
              resourceId: artifactId,
              newValue: {
                reason: (input as StageSaveInput & { reason: string }).reason,
                previousArtifactId: row.currentArtifactId,
              },
            },
            c.tx,
          );
        if (
          stage === "REVIEWERS" ||
          (stage === "SCHEDULE" && operation !== "finalize")
        ) {
          const changedProposals =
            operation === "amend"
              ? new Set(
                  plan.slots
                    .filter((slot) => {
                      const old = c.snapshots
                        .get("SCHEDULE")
                        ?.slots.find((s) => s.proposalId === slot.proposalId);
                      return !old || hashJson(old) !== hashJson(slot);
                    })
                    .map((s) => s.proposalId),
                )
              : new Set(snapshot.students.map((s) => s.proposalId));
          const notifiedCommittees =
            stage === "REVIEWERS"
              ? plan.committees
              : plan.committees.filter((c) =>
                  c.proposalIds.some((id) => changedProposals.has(id)),
                );
          const notifiedReviewers =
            stage === "REVIEWERS"
              ? plan.reviewers
              : plan.reviewers.filter((r) =>
                  changedProposals.has(r.proposalId),
                );
          const people = await c.s.lecturerUsers([
            ...new Set([
              ...notifiedCommittees.flatMap((c) =>
                c.members.map((m) => m.lecturerId),
              ),
              ...notifiedReviewers.flatMap((r) => r.reviewerIds),
            ]),
          ]);
          const recipients =
            stage === "REVIEWERS"
              ? people
                  .filter((p) =>
                    plan.reviewers.some((r) => r.reviewerIds.includes(p.id)),
                  )
                  .map((p) => p.userId)
              : [
                  ...people.map((p) => p.userId),
                  ...snapshot.students
                    .filter((s) => changedProposals.has(s.proposalId))
                    .flatMap((s) => [s.studentUserId, s.advisorUserId]),
                ];
          await c.s.notifyRecipients(
            recipients,
            termId,
            stage === "REVIEWERS"
              ? "Phân công phản biện đã chốt"
              : `Lịch bảo vệ ${operation === "amend" ? "được điều chỉnh" : "được công bố"} (v${version})`,
            `/defense/published?termId=${encodeURIComponent(termId)}`,
          );
        }
        return { revision, artifactId, version };
      },
    );
  }
  history(userId: string, termId: string): Promise<DefenseWorkflowHistory> {
    return this.repo.transaction(false, async (s) => {
      await this.access(s, userId, termId, "read");
      const [seals, artifacts] = await Promise.all([
        s.listFinalizations(termId),
        s.artifacts(termId),
      ]);
      return {
        items: [
          ...seals.map((r) => {
            const parsed = defenseListSnapshotSchema.safeParse(r.snapshot);
            const valid =
              parsed.success &&
              parsed.data.schemaVersion === r.snapshotSchemaVersion &&
              parsed.data.termId === r.termId &&
              parsed.data.listRevision === r.listRevision &&
              parsed.data.finalizationVersion === r.version &&
              parsed.data.finalizedAt === r.finalizedAt.toISOString() &&
              parsed.data.finalizedByUserId === r.finalizedByUserId &&
              hashJson(r.snapshot) === r.contentHash;
            return {
              id: r.id,
              stage: "UC18" as const,
              state: "FINALIZED",
              version: r.version,
              revision: r.listRevision,
              sealedAt: r.finalizedAt.toISOString(),
              actorId: r.finalizedByUserId,
              integrity: valid ? ("VERIFIED" as const) : ("UNKNOWN" as const),
            };
          }),
          ...artifacts.map((r) => ({
            id: r.id,
            stage: r.stage,
            state: r.state,
            version: r.version,
            revision: r.workflowRevision,
            sealedAt: r.sealedAt.toISOString(),
            actorId: r.sealedByUserId,
            integrity: this.artifact(r)
              ? ("VERIFIED" as const)
              : ("UNKNOWN" as const),
          })),
        ],
      };
    });
  }
  published(userId: string, termId: string): Promise<PublishedDefenseSchedule> {
    return this.repo.transaction(false, async (s, tx) => {
      const user = await s.principal(userId);
      if (
        !user ||
        user.id !== userId ||
        user.status !== "ACTIVE" ||
        user.mustChangePassword ||
        !this.permission(user, "read", "defense-schedule")
      )
        planningError(
          403,
          "DEFENSE_SCHEDULE_FORBIDDEN",
          "Không có quyền tra cứu lịch.",
        );
      const rows = await s.stages(termId),
        schedule = rows.find((r) => r.stage === "SCHEDULE");
      if (!schedule || schedule.state !== "PUBLISHED")
        return { termId, state: "NOT_PUBLISHED", version: null, items: [] };
      const artifacts = await s.artifacts(termId),
        map = new Map(artifacts.map((a) => [a.id, a]));
      const current = (stage: DefenseStage) => {
        const row = rows.find((r) => r.stage === stage),
          artifact = map.get(row?.currentArtifactId ?? ""),
          a = this.artifact(artifact);
        if (
          !row ||
          !a ||
          a.termId !== termId ||
          a.stage !== stage ||
          a.workflowRevision !== row.revision ||
          a.state !== row.state
        )
          planningError(
            503,
            "DEFENSE_PUBLICATION_UNVERIFIED",
            "Không xác minh được lịch chính thức.",
          );
        return { row, artifact: artifact!, snapshot: a };
      };
      const a = current("SCHEDULE"),
        r = current("REVIEWERS"),
        c = current("COMMITTEES"),
        uc18 = await this.reader.read(termId, tx);
      if (
        uc18.state !== "FINALIZED" ||
        uc18.evidence?.snapshotSchemaVersion !== 2 ||
        [a, r, c].some(
          (v) =>
            v.snapshot.source.id !== uc18.evidence?.finalizationId ||
            v.snapshot.source.hash !== uc18.evidence?.contentHash,
        ) ||
        a.snapshot.upstream?.id !== r.artifact.id ||
        a.snapshot.upstream.hash !== r.artifact.contentHash ||
        r.snapshot.upstream?.id !== c.artifact.id ||
        r.snapshot.upstream.hash !== c.artifact.contentHash
      )
        planningError(
          503,
          "DEFENSE_PUBLICATION_SOURCE_INVALID",
          "Nguồn công bố lịch không nhất quán.",
        );
      const scope = academicTermScope(
        await s.grants(userId, termId),
        userId,
        termId,
      );
      const faculty = this.permission(user, "read") && scope.configured;
      const snapshot = a.snapshot;
      const currentAdvisorProposals = new Set<string>();
      const currentDepartments = new Map<string, string>();
      if (user.lecturer?.isActive || (faculty && !scope.allDepartments)) {
        const [term, proposals, registrations, roster, at] = await Promise.all([
          s.term(termId),
          s.dossiers(termId),
          s.assignments(termId),
          s.lecturerRoster(termId),
          s.now(),
        ]);
        for (const p of proposals) {
          if (p.termId !== termId || p.topic.termId !== termId) continue;
          if (
            !snapshot.students.some(
              (s) => s.proposalId === p.id && s.studentId === p.studentId,
            )
          )
            continue;
          const department =
            p.topic.researchArea?.pr2bResearchAreaWorkflowResearchAreaId
              ?.departmentId;
          if (department) currentDepartments.set(p.id, department);
          const reg = registrations.find((r) => r.studentId === p.studentId),
            assignment =
              reg?.advisorAssignments.find(
                (a) =>
                  a.assignmentPlanId ===
                  term?.pr2bTermWorkflowTermId?.officialAssignmentPlanId,
              ) ?? null;
          const advisor = this.rules.official(
            p,
            term,
            reg ? { ...reg, advisorAssignment: assignment } : null,
            roster.find((r) => r.lecturerId === assignment?.advisorId) ?? null,
            at,
          );
          if (
            advisor.state === "OFFICIAL" &&
            advisor.advisorId === user.lecturer?.id &&
            advisor.userId === userId
          )
            currentAdvisorProposals.add(p.id);
        }
      }
      const items = snapshot.slots.flatMap((slot) => {
        const student = snapshot.students.find(
            (s) => s.proposalId === slot.proposalId,
          ),
          committee = snapshot.committees.find(
            (c) => c.key === slot.committeeKey,
          );
        if (!student || !committee)
          planningError(
            503,
            "DEFENSE_PUBLICATION_UNVERIFIED",
            "Thiếu dữ liệu lịch chính thức.",
          );
        const own =
          user.student?.isActive && user.student.id === student.studentId;
        const assigned =
          user.lecturer?.isActive &&
          (committee.members.some((m) => m.lecturerId === user.lecturer?.id) ||
            snapshot.reviewers.some(
              (r) =>
                r.proposalId === slot.proposalId &&
                r.reviewerIds.includes(user.lecturer!.id),
            ) ||
            currentAdvisorProposals.has(slot.proposalId));
        if (!(
          own ||
          assigned ||
          (faculty &&
            (scope.allDepartments ||
              scope.contains(currentDepartments.get(slot.proposalId))))
        ))
          return [];
        return [
          {
            key: slot.key,
            proposalId: slot.proposalId,
            studentName: student.studentName,
            title: student.title,
            committeeName: committee.name,
            roomCode:
              snapshot.rooms.find((r) => r.id === slot.roomId)?.code ??
              "Phòng cần đối soát",
            startsAt: slot.startsAt,
            endsAt: slot.endsAt,
          },
        ];
      });
      return { termId, state: "PUBLISHED", version: snapshot.version, items };
    });
  }
}
