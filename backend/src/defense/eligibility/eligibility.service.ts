import { HttpException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "crypto";
import {
  EligibilityDecisionSchema,
  EligibilityFinalizeSchema,
  EligibilityReviewSchema,
} from "@doan/shared";
import type {
  AcademicAttestation,
  EligibilityCheck,
  EligibilityDecision,
  EligibilityFinalize,
  EligibilityList,
  EligibilityPreview,
  EligibilityQuery,
  EligibilityReview,
  EligibilityView,
} from "@doan/shared";
import {
  EligibilityRepository,
  EligibilitySession,
  eligibilityJson,
} from "./eligibility.repository";
import {
  EligibilityValidator,
  evaluateEligibility,
} from "./eligibility.validator";
import {
  ProposalReviewValidator,
  reviewHash,
} from "../../topic/proposal-reviews/proposal-review.validator";
import type {
  ReviewPrincipal,
  ReviewProposal,
} from "../../topic/proposal-reviews/proposal-review.repository";
import { GuidanceValidator } from "../../guidance/tasks/guidance.validator";
import { FinalDefenseValidator } from "../../guidance/final-defense/final-defense.validator";
import { FileStorageService } from "../../common/storage/file-storage.service";
import { digest } from "../../guidance/submissions/submission.validator";
import { operationWindow } from "../../term/service/term-window.service";
import { groupError } from "../../topic/review-groups/review-group.errors";

type Context = {
  schemaVersion: 1;
  termId: string;
  termStudentId: string;
  policyHash: string;
  policyVersion: string;
  evidenceHash: string;
  evidence: unknown;
  academic: AcademicAttestation | null;
  batchId?: string;
};
const missing = (): never =>
  groupError(
    404,
    "COMMON_001",
    "Không tìm thấy hồ sơ trong phạm vi được cấp quyền.",
  );
const deny = (): never =>
  groupError(403, "AUTH_004", "Thiếu quyền UC18 của Khoa/Giáo vụ.");
type Access = {
  u: ReviewPrincipal;
  role: "FACULTY" | "LECTURER" | "STUDENT";
  member: NonNullable<Awaited<ReturnType<EligibilitySession["member"]>>>;
  p: ReviewProposal | null;
  ambiguous: boolean;
};
@Injectable()
export class EligibilityService {
  constructor(
    private readonly repo: EligibilityRepository,
    private readonly review: ProposalReviewValidator,
    private readonly guidance: GuidanceValidator,
    private readonly final: FinalDefenseValidator,
    private readonly v: EligibilityValidator,
    private readonly storage: FileStorageService,
    private readonly config: ConfigService,
  ) {}
  private has(
    u: ReviewPrincipal,
    role: string,
    action: string,
    resource = "defense-eligibility",
  ) {
    return this.guidance.role(u, role, resource, action);
  }
  private async access(
    s: EligibilitySession,
    actor: string,
    memberId: string,
    termId: string,
    principal?: ReviewPrincipal,
  ): Promise<Access> {
    const u = principal ?? this.review.principal(await s.principal(actor)),
      member = await s.member(memberId);
    if (!member || member.termId !== termId) return missing();
    const { proposals } = await s.memberProposal(memberId);
    const matching = proposals.filter(
      (p) =>
        p.termId === termId &&
        p.studentId === member.studentId &&
        p.topic.termId === termId,
    );
    const p = matching.length === 1 ? matching[0] : null;
    if (this.has(u, "FACULTY", "read")) {
      const dept =
        p?.topic.researchArea?.pr2bResearchAreaWorkflowResearchAreaId
          ?.departmentId;
      const grants = await s.grants(u.id, termId);
      if (
        grants.some(
          (g) =>
            g.allDepartments ||
            (dept &&
              g.pr2bGrantDepartmentGrantId.some(
                (d) => d.departmentId === dept,
              )),
        )
      )
        return {
          u,
          member,
          p,
          role: "FACULTY",
          ambiguous: proposals.length > 0 && !p,
        };
    }
    if (
      this.has(u, "STUDENT", "read") &&
      u.student?.isActive &&
      u.student.id === member.studentId
    )
      return {
        u,
        member,
        p,
        role: "STUDENT",
        ambiguous: proposals.length > 0 && !p,
      };
    if (p && this.has(u, "LECTURER", "read") && u.lecturer?.isActive) {
      try {
        const official = await this.review.advisor(s, p);
        if (official.assignment.advisorId === u.lecturer.id)
          return { u, member, p, role: "LECTURER", ambiguous: false };
      } catch (e) {
        if (!(e instanceof HttpException)) throw e;
      }
    }
    return missing();
  }
  async options(actor: string) {
    return this.repo.read(async (s) => {
      const u = this.review.principal(await s.principal(actor)),
        ids = new Set<string>();
      if (this.has(u, "FACULTY", "read"))
        for (const g of await s.grants(actor)) ids.add(g.termId);
      if (this.has(u, "STUDENT", "read") && u.student?.isActive)
        for (const t of await s.studentTerms(u.student.id)) ids.add(t.termId);
      if (this.has(u, "LECTURER", "read") && u.lecturer?.isActive)
        for (const t of await s.advisorTerms(u.lecturer.id))
          if (t.advisorAssignment) ids.add(t.termId);
      if (
        !["FACULTY", "STUDENT", "LECTURER"].some((r) => this.has(u, r, "read"))
      )
        deny();
      return s.terms({ id: { in: [...ids] } });
    });
  }
  async list(actor: string, query: EligibilityQuery): Promise<EligibilityList> {
    // Scope and preview filters precede paging. No implicit eligibility upserts.
    return this.repo.read(async (s) => {
      const u = this.review.principal(await s.principal(actor));
      if (
        !["FACULTY", "STUDENT", "LECTURER"].some((r) => this.has(u, r, "read"))
      )
        deny();
      const allowed = await this.optionsInSession(s, u, query.termId);
      if (!allowed) missing();
      const items: EligibilityView[] = [];
      for (const member of await s.members(query.termId)) {
        let a: Access;
        try {
          a = await this.access(s, actor, member.id, query.termId, u);
        } catch (e) {
          if (e instanceof HttpException && e.getStatus() === 404) continue;
          throw e;
        }
        const needle = query.search.normalize("NFC").toLocaleLowerCase("vi");
        if (
          needle &&
          ![
            a.member.student.studentCode,
            a.member.student.fullName,
            a.p?.topic.title ?? "",
          ].some((v) =>
            v.normalize("NFC").toLocaleLowerCase("vi").includes(needle),
          )
        )
          continue;
        const { view } = await this.inspect(s, a);
        if (query.preview && view.preview !== query.preview) continue;
        if (query.official && view.official.state !== query.official) continue;
        items.push(view);
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
  private async optionsInSession(
    s: EligibilitySession,
    u: ReviewPrincipal,
    termId: string,
  ) {
    if (this.has(u, "FACULTY", "read") && (await s.grants(u.id, termId)).length)
      return true;
    if (
      this.has(u, "STUDENT", "read") &&
      u.student?.isActive &&
      (await s.studentTerms(u.student.id)).some((t) => t.termId === termId)
    )
      return true;
    return (
      this.has(u, "LECTURER", "read") &&
      u.lecturer?.isActive &&
      (await s.advisorTerms(u.lecturer.id)).some(
        (t) => t.termId === termId && t.advisorAssignment,
      )
    );
  }
  detail(actor: string, member: string, term: string) {
    return this.repo.read(
      async (s) =>
        (await this.inspect(s, await this.access(s, actor, member, term))).view,
    );
  }
  // UC19 reuses the caller's transaction. Never open a nested read transaction
  // or expose grade/comment/audit snapshots to the committee workflow.
  async committeePolicyReady(s: EligibilitySession, term: string) {
    return !!(
      this.v.policy((await s.eligibilityPolicy(term))?.value) &&
      this.final.policy((await s.policy(term))?.value)
    );
  }
  async forCommittee(
    s: EligibilitySession,
    actor: string,
    member: string,
    term: string,
  ) {
    const a = await this.access(s, actor, member, term);
    if (a.role !== "FACULTY") return deny();
    const { view } = await this.inspect(s, a);
    let advisor: {
      id: string;
      assignmentId: string;
      revision: number;
      name: string;
    } | null = null;
    if (a.p) {
      try {
        const official = await this.review.advisor(s, a.p);
        const lecturer = await s.eligibilityAdvisor(
          official.assignment.advisorId,
        );
        advisor = {
          id: official.assignment.advisorId,
          assignmentId: official.assignment.id,
          revision: official.revision,
          name: lecturer?.fullName ?? "",
        };
      } catch (e) {
        if (!(e instanceof HttpException)) throw e;
      }
    }
    return {
      effective: view.downstream,
      advisor,
      departmentId:
        a.p?.topic.researchArea?.pr2bResearchAreaWorkflowResearchAreaId
          ?.departmentId ?? null,
      proposalId: view.proposalId,
      studentCode: view.studentCode,
      studentName: view.studentName,
      title: view.title,
      blockers: view.downstream
        ? []
        : view.checks
            .filter((c) => c.state !== "QUALIFIED")
            .map((c) => c.message)
            .concat(`UC18: ${view.official.state}`),
    };
  }
  private async inspect(s: EligibilitySession, a: Access) {
    const p = a.p,
      termId = a.member.termId,
      memberId = a.member.id;
    const ready = await s.eligibilitySchemaReady(),
      uc17Ready = await s.schemaReady();
    const policy = this.v.policy((await s.eligibilityPolicy(termId))?.value),
      policyHash = reviewHash(policy);
    const row = p && ready ? await s.eligibility(p.id) : null;
    const legacy =
      p && !ready && (await s.eligibilityLegacyReady())
        ? await s.legacyEligibility(p.id)
        : null;
    const oldContext = row?.context as Context | null;
    const academic = this.v.academic(
      oldContext?.academic,
      policy,
      policyHash,
      termId,
      memberId,
    );
    const checks: EligibilityCheck[] = [];
    const add = (key: string, state: EligibilityPreview, message: string) =>
      checks.push({ key, state, message });
    add(
      "policy",
      policy ? "QUALIFIED" : "UNVERIFIED",
      policy ? "Policy UC18 đã duyệt." : "Thiếu UC18_POLICY được duyệt.",
    );
    add(
      "schema",
      ready && uc17Ready ? "QUALIFIED" : "UNVERIFIED",
      ready && uc17Ready
        ? "Schema UC17/UC18 sẵn sàng."
        : "Cần migration UC17 và UC18 đã review.",
    );
    add(
      "membership",
      a.member.student.isActive ? "QUALIFIED" : "NEGATIVE",
      a.member.student.isActive
        ? "Sinh viên đúng đợt."
        : "Sinh viên không hoạt động.",
    );
    add(
      "proposal",
      p ? "QUALIFIED" : a.ambiguous ? "UNVERIFIED" : "MISSING",
      p
        ? "Hồ sơ đúng sinh viên/đợt."
        : "Thiếu hoặc không xác định duy nhất hồ sơ đúng sinh viên/đợt.",
    );
    let official: Awaited<ReturnType<GuidanceValidator["official"]>> | null =
      null;
    let dossier: Awaited<ReturnType<GuidanceValidator["finalized"]>> | null =
      null;
    const validated = async <T>(
      key: string,
      work: () => Promise<T>,
    ): Promise<T | null> => {
      try {
        const result = await work();
        add(key, "QUALIFIED", "Chứng cứ hiện hành hợp lệ.");
        return result;
      } catch (e) {
        if (!(e instanceof HttpException)) throw e;
        add(
          key,
          "STALE",
          "Chứng cứ chưa chốt hoặc không còn khớp hồ sơ hiện hành.",
        );
        return null;
      }
    };
    if (p) {
      official = await validated("advisor", () => this.guidance.official(s, p));
      dossier = await validated("dossier", () => this.guidance.finalized(s, p));
    }
    const advisor = official
      ? await s.eligibilityAdvisor(official.assignment.advisorId)
      : null;
    const finalPolicy = this.final.policy((await s.policy(termId))?.value);
    const binding =
      official && p
        ? {
            assignmentId: official.assignment.id,
            assignmentRevision: official.revision,
            topicRevision: p.topic.pr2bTopicWorkflowTopicId!.revision,
            policyHash: reviewHash(finalPolicy),
          }
        : null;
    const report = p && uc17Ready ? await s.report(p.id) : null,
      version = report?.versions[0];
    const asset = version?.fileAsset;
    let pdfValid = !!(
      version &&
      asset &&
      asset.kind === "REPORT" &&
      asset.state === "READY" &&
      asset.createdByUserId === a.member.student.userId &&
      asset.mimeType === "application/pdf" &&
      asset.sizeBytes > 0 &&
      asset.sizeBytes <= (finalPolicy?.maxPdfBytes ?? 0) &&
      /^guidance\/[a-f0-9-]{36}$/i.test(asset.storageKey) &&
      /^[a-f0-9]{64}$/.test(asset.checksum) &&
      version.submittedAt <= new Date()
    );
    if (pdfValid && asset) {
      try {
        const bytes = await this.storage.readPrivateGuidance(
          asset.storageKey,
          finalPolicy!.maxPdfBytes,
        );
        pdfValid =
          bytes.length === asset.sizeBytes && digest(bytes) === asset.checksum;
      } catch {
        pdfValid = false;
      }
    }
    add(
      "pdf",
      pdfValid ? "QUALIFIED" : "MISSING",
      pdfValid
        ? "PDF cuối có phiên bản, đúng owner và checksum."
        : "PDF cuối thiếu, không đọc được hoặc metadata/checksum chưa hợp lệ.",
    );
    const decision = p && uc17Ready ? await s.finalDecision(p.id) : null;
    const score =
      p && official && uc17Ready
        ? await s.advisorScore(p.id, official.assignment.advisorId)
        : null;
    const sc = score?.context as { binding?: unknown } | null;
    const uc17Events = p && uc17Ready ? await s.events(p.id) : [];
    const scoreProvenance =
      score &&
      uc17Events.some(
        (e) =>
          e.action === "ADVISOR_SUMMARY_RECORDED" &&
          e.userId === advisor?.userId &&
          reviewHash(
            (e.newValue as { score?: unknown } | null)?.score ?? null,
          ) === reviewHash(score),
      );
    const provenance =
      decision && p
        ? uc17Events.some((e) => {
            const d = e.newValue as unknown as typeof decision;
            return (
              e.action === "ADVISOR_DEFENSE_DECIDED" &&
              e.userId === advisor?.userId &&
              d?.id === decision.id &&
              d.revision === decision.revision &&
              d.status === decision.status &&
              d.reportVersionId === decision.reportVersionId &&
              d.confirmedAt &&
              new Date(d.confirmedAt).getTime() ===
                decision.confirmedAt?.getTime() &&
              reviewHash(d.context ?? null) ===
                reviewHash(decision.context ?? null)
            );
          })
        : false;
    const currentDecision = !!(
      finalPolicy &&
      pdfValid &&
      binding &&
      decision?.reportVersionId === version?.id &&
      decision?.advisorId === official?.assignment.advisorId &&
      decision?.confirmedAt &&
      decision.confirmedAt <= new Date() &&
      score?.reportVersionId === version?.id &&
      score?.comment &&
      score.totalScore !== null &&
      sc?.binding &&
      decision.context &&
      this.final.current(sc?.binding, binding) &&
      this.final.current(decision.context, binding) &&
      provenance &&
      scoreProvenance
    );
    const uc17 = !uc17Ready
      ? "UNVERIFIED"
      : !decision
        ? "MISSING"
        : !decision.reportVersionId
          ? "LEGACY_UNVERIFIED"
          : decision.status === "PENDING"
            ? "PENDING"
            : !currentDecision
              ? "STALE"
              : decision.status;
    add(
      "uc17",
      uc17 === "CONFIRMED"
        ? "QUALIFIED"
        : uc17 === "REJECTED"
          ? "NEGATIVE"
          : uc17 === "STALE"
            ? "STALE"
            : uc17 === "PENDING"
              ? "PENDING"
              : uc17.includes("UNVERIFIED")
                ? "UNVERIFIED"
                : "MISSING",
      `UC17: ${uc17}. GVHD đồng ý không thay thế quyết định của Khoa.`,
    );
    let progress: unknown = null;
    if (p && policy?.progressRule === "ALL_ACTIVE_TASKS_PASSED") {
      const plan = await s.eligibilityProgress(p.id),
        obligations = (await s.obligations(memberId)).sort((a, b) =>
          a.id.localeCompare(b.id),
        );
      const required = await s.eligibilityCoverage(termId, memberId);
      progress = { plan, obligations, required };
      const w = plan?.pr2bGuidancePlanWorkflowPlanId;
      const tasks =
        plan?.tasks.filter(
          (t) => t.pr2bTaskWorkflowTaskId?.state !== "CANCELLED",
        ) ?? [];
      const currentPlan = !!(
        w &&
        official &&
        dossier &&
        w.state === "ACTIVE" &&
        w.assignmentId === official.assignment.id &&
        plan?.advisorId === official.assignment.advisorId &&
        w.assignmentRevision === official.revision &&
        w.finalizationId === dossier.f.id
      );
      const taskStates = tasks.map((t): EligibilityPreview => {
        if (!plan || !official) return "MISSING";
        const tw = t.pr2bTaskWorkflowTaskId,
          sub = tw?.refCurrentSubmissionId,
          sw = sub?.pr2bSubmissionWorkflowSubmissionId,
          r = sw?.refEffectiveReviewId;
        const snapshot = sw?.contextSnapshot as {
          studentId?: string;
          planId?: string;
          periodId?: string;
          files?: { fileId: string; checksum: string }[];
        } | null;
        const valid = !!(
          tw?.state &&
          ["COMPLETED", "REVISION_REQUESTED"].includes(tw.state) &&
          tw.kind &&
          tw.startsAt &&
          tw.expectedDeliverables?.trim() &&
          tw.planId === plan.id &&
          tw.assignedAdvisorId === official.assignment.advisorId &&
          tw.currentSubmissionId === sub?.id &&
          sub?.taskId === t.id &&
          sw?.taskId === t.id &&
          sw.state === "REVIEWED" &&
          sw.submittedByUserId === a.member.student.userId &&
          sw.submittedAt &&
          sw.submittedAt <= new Date() &&
          snapshot?.planId === plan.id &&
          snapshot.studentId === p.studentId &&
          snapshot.periodId === tw.periodId &&
          Array.isArray(snapshot.files) &&
          snapshot.files.length ===
            sub.pr2bSubmissionAssetSubmissionId.length &&
          ["REPORT", "SOURCE"].every((k) =>
            sub.pr2bSubmissionAssetSubmissionId.some(
              (a) => a.refFileId.kind === k,
            ),
          ) &&
          sub.pr2bSubmissionAssetSubmissionId.every(
            (a) =>
              a.refFileId.state === "READY" &&
              snapshot.files!.some(
                (f) =>
                  f.fileId === a.fileId && f.checksum === a.refFileId.checksum,
              ),
          ) &&
          sw.effectiveReviewId === r?.id &&
          r?.state === "RECORDED" &&
          r.submissionId === sub.id &&
          r.assignmentRevision === official.revision &&
          r.reviewerUserId === advisor?.userId &&
          r.recordedAt <= new Date()
        );
        if (!valid || !r || !tw) return "MISSING";
        if (r.decision === "PASS" && tw.state === "COMPLETED")
          return "QUALIFIED";
        if (tw.state === "REVISION_REQUESTED")
          return r.decision === "FAIL"
            ? "NEGATIVE"
            : r.decision === "REVISION_REQUIRED"
              ? "PENDING"
              : "MISSING";
        return "MISSING";
      });
      let coverage =
        required.length > 0 &&
        required.length === obligations.length &&
        required.every((r) =>
          obligations.some((o) => o.periodId === r.periodId),
        );
      for (const o of obligations) {
        try {
          this.guidance.obligation(o, memberId, termId);
        } catch (e) {
          if (!(e instanceof HttpException)) throw e;
          coverage = false;
        }
        if (
          o.planId !== plan?.id ||
          !o.currentTaskId ||
          !tasks.some((t) => t.id === o.currentTaskId)
        )
          coverage = false;
      }
      const progressState = !plan
        ? "MISSING"
        : !currentPlan
          ? "STALE"
          : evaluateEligibility([
              ...taskStates.map((state, index) => ({
                key: String(index),
                state,
                message: "",
              })),
              {
                key: "coverage",
                state: coverage && tasks.length ? "QUALIFIED" : "MISSING",
                message: "",
              },
            ]);
      add(
        "progress",
        progressState,
        progressState === "QUALIFIED"
          ? "Tiến độ/đánh giá và nghĩa vụ tuần hiện hành đạt."
          : progressState === "NEGATIVE"
            ? "Có đánh giá Không đạt còn hiệu lực theo policy tiến độ."
            : progressState === "PENDING"
              ? "Có báo cáo còn cần sửa và đánh giá lại."
              : "Thiếu tiến độ hiện hành hoặc coverage tuần; cần kiểm tra lại kế hoạch và đánh giá.",
      );
    } else if (policy)
      add(
        "progress",
        currentDecision ? "QUALIFIED" : "PENDING",
        "Policy yêu cầu GVHD xác nhận tổng kết quá trình qua UC17.",
      );
    add(
      "academic",
      academic
        ? academic.evidence.outcome === "PASS"
          ? "QUALIFIED"
          : "NEGATIVE"
        : oldContext?.academic
          ? "STALE"
          : "UNVERIFIED",
      academic
        ? "Chứng cứ học vụ do Khoa xác minh theo nguồn được duyệt."
        : "Chưa có chứng cứ học vụ còn hiệu lực từ nguồn được duyệt; không dùng academicEligible/GPA.",
    );
    const term = await s.windowTerm(termId);
    const window =
      term && policy ? operationWindow(term, policy.phaseCode) : null;
    const preview = evaluateEligibility(checks);
    const evidence = {
      termId,
      memberId,
      studentActive: a.member.student.isActive,
      proposal: p
        ? {
            id: p.id,
            status: p.status,
            topic: p.topic.pr2bTopicWorkflowTopicId,
          }
        : null,
      binding,
      dossier: dossier
        ? {
            id: dossier.f.id,
            hash: dossier.f.contentHash,
            versionId: dossier.f.versionId,
          }
        : null,
      reportRevision: report?.revision ?? null,
      version: version
        ? { id: version.id, checksum: asset?.checksum, state: asset?.state }
        : null,
      pdfValid,
      decision,
      score,
      provenance,
      scoreProvenance: !!scoreProvenance,
      progress,
      academic: oldContext?.academic ?? null,
      policyHash,
    };
    const evidenceHash = reviewHash(evidence);
    const events = p && ready ? await s.eligibilityEvents(p.id) : [];
    const facultyProvenance =
      row &&
      events.some((e) => {
        const value = e.newValue as unknown as { row?: unknown } | null;
        const snapshot =
          e.action === "ELIGIBILITY_FINALIZED" ? value?.row : value;
        const expectedActor =
          e.action === "ELIGIBILITY_FINALIZED"
            ? row.finalizedBy
            : e.action === "ELIGIBILITY_DECIDED"
              ? row.decidedBy
              : e.action === "ELIGIBILITY_REVIEWED"
                ? row.reviewedBy
                : null;
        return (
          expectedActor &&
          e.userId === expectedActor &&
          reviewHash(snapshot ?? null) === reviewHash(row)
        );
      });
    const bound = !!(
      row?.revision &&
      facultyProvenance &&
      oldContext?.schemaVersion === 1 &&
      oldContext.termId === termId &&
      oldContext.termStudentId === memberId &&
      oldContext.evidenceHash === evidenceHash &&
      oldContext.policyHash === policyHash &&
      (!row.finalizedAt || preview === "QUALIFIED")
    );
    const state: EligibilityView["official"]["state"] =
      legacy || (row && !row.revision)
        ? "LEGACY_UNVERIFIED"
        : !row
          ? "NONE"
          : !bound
            ? "STALE"
            : row.finalizedAt
              ? "FINALIZED"
              : row.decidedAt
                ? "DECIDED"
                : "REVIEWED";
    const blockers: string[] = [];
    if (this.config.get("UC18_WRITES_ENABLED", "false") !== "true")
      blockers.push("UC18_NOT_ENABLED");
    if (!ready || !uc17Ready) blockers.push("UC18_SCHEMA_REQUIRED");
    if (!policy) blockers.push("UC18_POLICY_REQUIRED");
    if (!window?.canWrite)
      blockers.push(window?.reason ?? "Chưa có cửa sổ xét theo kế hoạch.");
    if (!p || a.ambiguous) blockers.push("PROPOSAL_REQUIRED");
    if (legacy || (row && row.revision === 0))
      blockers.push("LEGACY_RECONCILIATION_REQUIRED");
    if (row?.finalizedAt) blockers.push("ELIGIBILITY_FINALIZED");
    const actionBlockers = {
      review: [...blockers],
      decide: [...blockers],
      finalize: [...blockers],
    };
    for (const action of ["review", "decide", "finalize"] as const)
      if (a.role !== "FACULTY" || !this.has(a.u, "FACULTY", action))
        actionBlockers[action].push("FACULTY_PERMISSION_REQUIRED");
    if (!row?.reviewedBy || !bound) {
      actionBlockers.decide.push("CURRENT_REVIEW_REQUIRED");
      actionBlockers.finalize.push("CURRENT_REVIEW_REQUIRED");
    }
    if (preview !== "QUALIFIED")
      actionBlockers.finalize.push("VERIFIED_QUALIFIED_EVIDENCE_REQUIRED");
    if (row?.status !== "ELIGIBLE" || !row.decidedAt || !row.decidedBy)
      actionBlockers.finalize.push("FACULTY_ELIGIBLE_DECISION_REQUIRED");
    const view: EligibilityView = {
      termId,
      termStudentId: memberId,
      proposalId: p?.id ?? null,
      studentCode: a.member.student.studentCode,
      studentName: a.member.student.fullName,
      title: p?.topic.title ?? "Chưa có hồ sơ xác định",
      advisor: advisor?.fullName ?? null,
      revision: row?.revision ?? 0,
      evidenceHash,
      preview,
      checks,
      uc17,
      pdf: pdfValid ? "VERIFIED" : "UNVERIFIED",
      policy,
      official: {
        state,
        status: row?.status ?? legacy?.status ?? "PENDING",
        ...(a.role === "FACULTY" && row
          ? {
              reason: row.note ?? undefined,
              reviewedBy: row.reviewedBy ?? undefined,
              reviewedAt: row.checkedAt?.toISOString(),
              decidedBy: row.decidedBy ?? undefined,
              decidedAt: row.decidedAt?.toISOString(),
              finalizedBy: row.finalizedBy ?? undefined,
              finalizedAt: row.finalizedAt?.toISOString(),
            }
          : {}),
      },
      academic: a.role === "FACULTY" ? academic : null,
      advisorSummary:
        score && currentDecision
          ? {
              ...(this.has(a.u, a.role, "score-read", "defense-confirmation")
                ? { score: Number(score.totalScore) }
                : {}),
              ...(this.has(a.u, a.role, "comment-read", "defense-confirmation")
                ? { comment: score.comment ?? undefined }
                : {}),
            }
          : null,
      history:
        a.role === "FACULTY"
          ? events.map((e) => {
              const value = e.newValue as {
                row?: unknown;
                reason?: string;
              } | null;
              const snapshot = (
                e.action === "ELIGIBILITY_FINALIZED" ? value?.row : value
              ) as { status?: string; note?: string; revision?: number } | null;
              return {
                id: e.id,
                action: e.action,
                at: e.createdAt.toISOString(),
                actor: e.userId,
                status: snapshot?.status,
                reason:
                  e.action === "ELIGIBILITY_FINALIZED"
                    ? value?.reason
                    : snapshot?.note,
                revision: snapshot?.revision,
              };
            })
          : [],
      actionBlockers,
      downstream:
        a.role === "FACULTY" &&
        state === "FINALIZED" &&
        preview === "QUALIFIED" &&
        row?.status === "ELIGIBLE" &&
        row.decidedBy &&
        row.decidedAt &&
        row.finalizedBy &&
        row.finalizedAt &&
        oldContext?.batchId &&
        p &&
        policy
          ? {
              termId,
              termStudentId: memberId,
              proposalId: p.id,
              decision: "ELIGIBLE",
              revision: row.revision,
              approvedBy: row.decidedBy,
              approvedAt: row.decidedAt.toISOString(),
              finalizedBy: row.finalizedBy,
              finalizedAt: row.finalizedAt.toISOString(),
              evidenceHash,
              policyVersion: policy.version,
              policyHash,
              batchId: oldContext.batchId,
              effectiveStatus: "CURRENT",
            }
          : null,
    };
    const context: Context = {
      schemaVersion: 1,
      termId,
      termStudentId: memberId,
      policyHash,
      policyVersion: policy?.version ?? "",
      evidenceHash,
      evidence,
      academic: oldContext?.academic ?? null,
    };
    return { view, context, row, a };
  }
  private requireAction(a: Access, action: "review" | "decide" | "finalize") {
    if (a.role !== "FACULTY" || !this.has(a.u, "FACULTY", action)) deny();
  }
  private expect(view: EligibilityView, revision: number, hash: string) {
    this.review.revision(view.revision, revision);
    if (view.evidenceHash !== hash)
      groupError(
        409,
        "EVIDENCE_CHANGED",
        "Chứng cứ đã đổi; tải lại và xét lại.",
      );
  }
  private unblocked(
    view: EligibilityView,
    action: "review" | "decide" | "finalize",
  ) {
    if (view.actionBlockers[action].length)
      groupError(
        409,
        "ELIGIBILITY_BLOCKED",
        view.actionBlockers[action].join("; "),
      );
  }
  reviewDossier(
    actor: string,
    member: string,
    input: EligibilityReview,
    key: string,
  ) {
    return this.command(
      actor,
      member,
      "review",
      EligibilityReviewSchema.parse(input),
      key,
    );
  }
  decide(
    actor: string,
    member: string,
    input: EligibilityDecision,
    key: string,
  ) {
    return this.command(
      actor,
      member,
      "decide",
      EligibilityDecisionSchema.parse(input),
      key,
    );
  }
  private command(
    actor: string,
    member: string,
    action: "review" | "decide",
    body: EligibilityReview | EligibilityDecision,
    key: string,
  ) {
    this.v.key(key);
    const route = `/defense-eligibility/${member}/${action}`,
      payloadHash = reviewHash(body);
    return this.repo.write(async (s) => {
      let a = await this.access(s, actor, member, body.termId);
      this.requireAction(a, action);
      if (!a.p) groupError(409, "PROPOSAL_REQUIRED", "Chưa xác định hồ sơ.");
      await s.lock(body.termId, [], a.p.id);
      a = await this.access(s, actor, member, body.termId);
      this.requireAction(a, action);
      const replay = await s.replay(actor, route, key);
      if (replay) {
        if (replay.payloadHash !== payloadHash)
          groupError(
            409,
            "IDEMPOTENCY_CONFLICT",
            "Key đã dùng cho nội dung khác.",
          );
        return replay.result;
      }
      const inspected = await this.inspect(s, a),
        { view, row, context } = inspected;
      this.expect(view, body.expectedRevision, body.evidenceHash);
      this.unblocked(view, action);
      const now = new Date();
      if (action === "review") {
        const academicInput = (body as EligibilityReview).academic;
        if (academicInput) {
          const candidate: AcademicAttestation = {
            evidence: academicInput,
            verifiedBy: actor,
            verifiedAt: now.toISOString(),
            policyHash: context.policyHash,
            termId: body.termId,
            termStudentId: member,
          };
          if (
            !this.v.academic(
              candidate,
              view.policy,
              context.policyHash,
              body.termId,
              member,
            )
          )
            groupError(
              400,
              "ACADEMIC_SOURCE_INVALID",
              "Nguồn hoặc thời hạn chứng cứ học vụ chưa được duyệt/hợp lệ.",
            );
          context.academic = candidate;
          // Evidence is rebuilt after persistence; never bind the pre-attestation hash.
          const nextEvidence = {
            ...(context.evidence as Record<string, unknown>),
            academic: candidate,
          };
          context.evidence = nextEvidence;
          context.evidenceHash = reviewHash(nextEvidence);
        }
        await s.saveEligibility(a.p!.id, view.revision, {
          status: "PENDING",
          note: body.reason,
          checkedAt: now,
          reviewedBy: actor,
          decidedBy: null,
          decidedAt: null,
          context: eligibilityJson(context),
        });
      } else {
        const status = (body as EligibilityDecision).status;
        if (status === "ELIGIBLE" && view.preview !== "QUALIFIED")
          groupError(
            409,
            "NOT_QUALIFIED",
            "Chỉ duyệt đủ điều kiện khi toàn bộ chứng cứ hợp lệ.",
          );
        if (
          status === "INELIGIBLE" &&
          !view.checks.some((c) => c.state === "NEGATIVE")
        )
          groupError(
            409,
            "NEGATIVE_EVIDENCE_REQUIRED",
            "Thiếu chứng cứ phủ định có hiệu lực; dùng hoãn/chờ xét.",
          );
        await s.saveEligibility(a.p!.id, view.revision, {
          status,
          note: body.reason,
          decidedBy: actor,
          decidedAt: now,
          context: eligibilityJson(context),
        });
      }
      const saved = await s.eligibility(a.p!.id);
      await s.eligibilityEvent(
        actor,
        a.p!.id,
        action === "review" ? "ELIGIBILITY_REVIEWED" : "ELIGIBILITY_DECIDED",
        row,
        saved,
      );
      const result = {
        termStudentId: member,
        revision: saved!.revision,
        status: saved!.status,
      };
      await s.remember(actor, route, key, payloadHash, eligibilityJson(result));
      return result;
    });
  }
  finalize(actor: string, input: EligibilityFinalize, key: string) {
    const body = EligibilityFinalizeSchema.parse(input);
    this.v.key(key);
    const route = "/defense-eligibility/finalize",
      payloadHash = reviewHash(body);
    return this.repo.write(async (s) => {
      const members = [...body.members].sort((a, b) =>
        a.termStudentId.localeCompare(b.termStudentId),
      );
      // Term lock first, then all proposal locks in stable order; reauthorize inside the transaction.
      for (const m of members) {
        const a = await this.access(s, actor, m.termStudentId, body.termId);
        this.requireAction(a, "finalize");
        if (!a.p) groupError(409, "PROPOSAL_REQUIRED", "Chưa có hồ sơ.");
        await s.lock(body.termId, [], a.p.id);
      }
      const replay = await s.replay(actor, route, key);
      if (replay) {
        if (replay.payloadHash !== payloadHash)
          groupError(
            409,
            "IDEMPOTENCY_CONFLICT",
            "Key đã dùng cho nội dung khác.",
          );
        return replay.result;
      }
      const batchId = randomUUID(),
        now = new Date(),
        result: { termStudentId: string; revision: number }[] = [];
      for (const m of members) {
        const a = await this.access(s, actor, m.termStudentId, body.termId);
        this.requireAction(a, "finalize");
        const { view, context, row } = await this.inspect(s, a);
        this.expect(view, m.expectedRevision, m.evidenceHash);
        this.unblocked(view, "finalize");
        await s.saveEligibility(a.p!.id, view.revision, {
          finalizedBy: actor,
          finalizedAt: now,
          context: eligibilityJson({ ...context, batchId }),
        });
        const saved = await s.eligibility(a.p!.id);
        await s.eligibilityEvent(actor, a.p!.id, "ELIGIBILITY_FINALIZED", row, {
          row: saved,
          batchId,
          reason: body.reason,
        });
        result.push({
          termStudentId: m.termStudentId,
          revision: saved!.revision,
        });
      }
      const response = {
        batchId,
        termId: body.termId,
        members: result,
        finalizedAt: now.toISOString(),
      };
      await s.remember(
        actor,
        route,
        key,
        payloadHash,
        eligibilityJson(response),
      );
      return response;
    });
  }
}
