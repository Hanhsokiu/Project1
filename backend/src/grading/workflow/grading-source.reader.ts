import { Inject, Injectable } from "@nestjs/common";
import type { DefenseStageArtifact, Prisma } from "@prisma/client";
import type { GradingKind } from "@doan/shared";
import { Uc18FinalizationReader } from "../../common/contracts/uc18-finalization.port";
import {
  defenseListSnapshotV2Schema,
  academicProofSchema,
  academicProofHash,
} from "../../common/uc18-finalization/defense-list-snapshot";
import { FileStorageService } from "../../common/storage/file-storage.service";
import { DefenseConfirmationValidator } from "../../guidance/defense-confirmations/defense-confirmation.validator";
import {
  stageSnapshotSchema,
  structuralPolicyHash,
  type StageSnapshot,
} from "../../defense/workflow/defense-workflow.policy";
import {
  gradeSourceSchema,
  gradingError,
  hashJson,
  type GradeSource,
} from "./grading.policy";
import type { GradingSession } from "./grading.repository";

@Injectable()
export class GradingSourceReader {
  constructor(
    @Inject(Uc18FinalizationReader)
    private readonly uc18: Uc18FinalizationReader,
    @Inject(DefenseConfirmationValidator)
    private readonly rules: DefenseConfirmationValidator,
    @Inject(FileStorageService) private readonly storage: FileStorageService,
  ) {}
  artifact(row: DefenseStageArtifact | undefined): StageSnapshot | null {
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
  async chain(
    s: GradingSession,
    tx: Prisma.TransactionClient,
    termId: string,
    requireSchedule: boolean,
  ) {
    const uc18 = await this.uc18.read(termId, tx);
    if (uc18.state !== "FINALIZED" || !uc18.evidence)
      gradingError(
        409,
        "GRADING_UC18_REQUIRED",
        "Cần bản chốt UC18 hiện hành hợp lệ.",
      );
    const rootRow = await s.readFinalization(uc18.evidence.finalizationId),
      root = defenseListSnapshotV2Schema.safeParse(rootRow?.snapshot);
    if (
      !root.success ||
      !rootRow ||
      rootRow.snapshotSchemaVersion !== 2 ||
      hashJson(rootRow.snapshot) !== rootRow.contentHash
    )
      gradingError(
        409,
        "GRADING_SOURCE_UNVERIFIED",
        "UC18 cần provenance V2; dữ liệu legacy không được dùng chấm điểm.",
      );
    const [rows, artifacts] = await Promise.all([
      s.stages(termId),
      s.artifacts(termId),
    ]);
    const get = (stage: "COMMITTEES" | "REVIEWERS" | "SCHEDULE") => {
      const r = rows.find((x) => x.stage === stage),
        record = artifacts.find((x) => x.id === r?.currentArtifactId),
        a = this.artifact(record);
      if (
        !r ||
        !record ||
        !a ||
        r.state === "DRAFT" ||
        a.termId !== termId ||
        a.stage !== stage ||
        a.state !== r.state ||
        a.workflowRevision !== r.revision ||
        r.sourceFinalizationId !== rootRow.id ||
        r.sourceListRevision !== root.data.listRevision ||
        a.source.id !== rootRow.id ||
        a.source.revision !== root.data.listRevision ||
        a.source.hash !== rootRow.contentHash
      )
        gradingError(
          409,
          "GRADING_OFFICIAL_SOURCE_REQUIRED",
          `Nguồn ${stage} chưa chốt hoặc không nhất quán.`,
        );
      return { row: r, record, snapshot: a };
    };
    const c = get("COMMITTEES"),
      r = get("REVIEWERS");
    const admitted = root.data.students.filter((x) => x.admitted);
    if (
      c.snapshot.students.length !== admitted.length ||
      structuralPolicyHash(c.snapshot.policy) !==
        structuralPolicyHash(root.data.policy) ||
      c.snapshot.students.some(
        (x) =>
          !admitted.some(
            (a) =>
              a.proposalId === x.proposalId &&
              a.studentId === x.studentId &&
              a.confirmation?.advisorId === x.advisorId &&
              root.data.academicEvidence.some(
                (e) =>
                  e.studentId === a.studentId &&
                  e.advisorUserId === x.advisorUserId,
              ),
          ),
      )
    )
      gradingError(
        409,
        "GRADING_SOURCE_STALE",
        "Hội đồng không bao phủ đúng danh sách UC18 admitted.",
      );
    const linked = (child: typeof r, parent: typeof c) =>
      child.row.upstreamArtifactId === parent.record.id &&
      child.row.upstreamRevision === parent.row.revision &&
      child.row.upstreamStage === parent.row.stage &&
      child.snapshot.upstream?.id === parent.record.id &&
      child.snapshot.upstream.revision === parent.row.revision &&
      child.snapshot.upstream.stage === parent.row.stage &&
      child.snapshot.upstream.hash === parent.record.contentHash;
    if (
      !linked(r, c) ||
      structuralPolicyHash(r.snapshot.policy) !==
        structuralPolicyHash(root.data.policy) ||
      hashJson(c.snapshot.committees) !== hashJson(r.snapshot.committees) ||
      hashJson(c.snapshot.students) !== hashJson(r.snapshot.students)
    )
      gradingError(
        409,
        "GRADING_SOURCE_STALE",
        "Phân công phản biện/hội đồng không cùng nguồn hiện hành.",
      );
    const schedule = requireSchedule ? get("SCHEDULE") : null;
    if (
      schedule &&
      (!linked(schedule, r) ||
        structuralPolicyHash(schedule.snapshot.policy) !==
          structuralPolicyHash(root.data.policy) ||
        hashJson(schedule.snapshot.committees) !==
          hashJson(r.snapshot.committees) ||
        hashJson(schedule.snapshot.reviewers) !==
          hashJson(r.snapshot.reviewers) ||
        hashJson(schedule.snapshot.students) !== hashJson(r.snapshot.students))
    )
      gradingError(
        409,
        "GRADING_SOURCE_STALE",
        "Lịch không cùng nguồn hội đồng/phản biện hiện hành.",
      );
    return { rootRow, root: root.data, committee: c, reviewer: r, schedule };
  }
  async read(
    s: GradingSession,
    tx: Prisma.TransactionClient,
    termId: string,
    proposalId: string,
    kind: GradingKind,
    scorerLecturerId: string,
    verifyBytes = true,
  ) {
    const chain = await this.chain(s, tx, termId, kind === "COMMITTEE"),
      captured = chain.reviewer.snapshot.students.find(
        (x) => x.proposalId === proposalId,
      ),
      committee = chain.committee.snapshot.committees.find((x) =>
        x.proposalIds.includes(proposalId),
      ),
      reviewer = chain.reviewer.snapshot.reviewers.find(
        (x) => x.proposalId === proposalId,
      ),
      role =
        committee?.members.find((m) => m.lecturerId === scorerLecturerId)
          ?.role ?? null;
    if (
      !captured ||
      !committee ||
      !reviewer ||
      (kind === "REVIEWER"
        ? reviewer.reviewerIds[0] !== scorerLecturerId
        : !role)
    )
      gradingError(
        403,
        "GRADING_NOT_ASSIGNED",
        "Không có phân công chính thức cho hồ sơ này.",
      );
    const p = await s.proposal(proposalId);
    if (
      !p ||
      p.termId !== termId ||
      p.topic.termId !== termId ||
      p.studentId !== captured.studentId ||
      p.student.userId !== captured.studentUserId
    )
      gradingError(
        404,
        "GRADING_PROPOSAL_NOT_FOUND",
        "Không tìm thấy hồ sơ trong phạm vi.",
      );
    const term = await s.term(termId),
      at = await s.now(),
      registration = await s.advisor(termId, p.studentId),
      roster = registration?.advisorAssignment
        ? await s.roster(termId, registration.advisorAssignment.advisorId)
        : null,
      official = this.rules.official(p, term, registration, roster, at),
      report = await s.report(proposalId),
      scorerRoster = await s.roster(termId, scorerLecturerId),
      membership = await s.members(termId, p.studentId),
      fullRoster = await s.members(termId),
      evidence = await s.evidence(termId);
    let pdf = this.rules.pdfMetadata(report, proposalId, p.student.userId, at),
      bytes: Buffer | null = null;
    if (
      verifyBytes &&
      pdf.snapshot &&
      report?.fileAsset &&
      ["UNVERIFIED", "READY"].includes(pdf.state)
    ) {
      await s.pdfLock(report.fileAsset.storageKey);
      try {
        bytes = await this.storage.readPrivateFinalReport(
          report.fileAsset.storageKey,
          report.fileAsset.sizeBytes,
        );
        pdf = this.rules.pdfBytes(pdf, bytes);
      } catch {
        pdf = { ...pdf, state: "INVALID" };
      }
    }
    const old = chain.root.students.find((x) => x.proposalId === proposalId),
      academic = chain.root.academicEvidence.find(
        (x) => x.studentId === p.studentId,
      ),
      blockers: string[] = [];
    const latestProof = evidence.find(
        (e) => e.termStudentId === old?.termStudentId,
      ),
      proof = academicProofSchema.safeParse(
        latestProof
          ? { ...latestProof, verifiedAt: latestProof.verifiedAt.toISOString() }
          : null,
      );
    if (
      !proof.success ||
      proof.data.id !== academic?.proof?.id ||
      proof.data.revision !== academic.proof.revision ||
      proof.data.verdict !== "SATISFIED" ||
      proof.data.verifiedAt > at.toISOString()
    )
      blockers.push("ACADEMIC_SOURCE_STALE");
    else {
      const { contentHash, ...body } = proof.data;
      if (academicProofHash(body) !== contentHash)
        blockers.push("ACADEMIC_SOURCE_INVALID");
    }
    const manifest = fullRoster
      .map((m) => ({ termStudentId: m.id, studentId: m.studentId }))
      .sort((a, b) => a.termStudentId.localeCompare(b.termStudentId));
    if (
      hashJson(manifest) !==
      hashJson(
        [...chain.root.roster.members].sort((a, b) =>
          a.termStudentId.localeCompare(b.termStudentId),
        ),
      )
    )
      blockers.push("UC18_ROSTER_CHANGED");
    if (
      !scorerRoster ||
      scorerRoster.termId !== termId ||
      scorerRoster.lecturerId !== scorerLecturerId
    )
      blockers.push("SCORER_NOT_IN_TERM");
    if (
      !membership.some(
        (m) =>
          m.termId === termId &&
          m.studentId === p.studentId &&
          m.id === old?.termStudentId,
      )
    )
      blockers.push("STUDENT_NOT_IN_ROSTER");
    if (p.status !== "APPROVED" || !p.student.isActive)
      blockers.push("PROPOSAL_OR_STUDENT_INVALID");
    if (
      !old?.admitted ||
      !old.pdf ||
      !old.confirmation ||
      official.state !== "OFFICIAL"
    )
      blockers.push("UC18_EVIDENCE_INVALID");
    if (
      official.state === "OFFICIAL" &&
      (official.advisorId === scorerLecturerId ||
        official.advisorId !== captured.advisorId ||
        official.userId !== captured.advisorUserId ||
        hashJson({
          assignmentId: official.assignmentId,
          revision: official.revision,
        }) !== hashJson(academic?.assignment))
    )
      blockers.push("ADVISOR_SOURCE_STALE_OR_CONFLICT");
    if (pdf.state !== "READY") blockers.push("PDF_NOT_VERIFIED");
    if (!pdf.snapshot || hashJson(pdf.snapshot) !== hashJson(old?.pdf))
      blockers.push("PDF_CHANGED_SINCE_UC18");
    const decision = await s.currentDecision(proposalId);
    const decisionContext = this.rules.decision(decision, at);
    const applicability = this.rules.changed(decisionContext, pdf, official);
    if (
      !decision ||
      decision.status !== "CONFIRMED" ||
      decision.proposalId !== proposalId ||
      applicability.confirmationApplicableToCurrentContext !== true ||
      decision.id !== old?.confirmation?.id ||
      decision.revision !== old.confirmation.revision
    )
      blockers.push("UC17_SOURCE_STALE");
    const slot =
      chain.schedule?.snapshot.slots.find((x) => x.proposalId === proposalId) ??
      null;
    const snapshot: GradeSource | null =
      official.state === "OFFICIAL" && pdf.snapshot
        ? gradeSourceSchema.parse({
            uc18: {
              id: chain.rootRow.id,
              revision: chain.root.listRevision,
              hash: chain.rootRow.contentHash,
            },
            committee: {
              id: chain.committee.record.id,
              revision: chain.committee.row.revision,
              hash: chain.committee.record.contentHash,
            },
            reviewer: {
              id: chain.reviewer.record.id,
              revision: chain.reviewer.row.revision,
              hash: chain.reviewer.record.contentHash,
            },
            schedule: chain.schedule
              ? {
                  id: chain.schedule.record.id,
                  revision: chain.schedule.row.revision,
                  hash: chain.schedule.record.contentHash,
                }
              : null,
            assignment: {
              assignmentId: official.assignmentId,
              revision: official.revision,
            },
            advisorId: official.advisorId,
            advisorUserId: official.userId,
            studentId: captured.studentId,
            studentUserId: captured.studentUserId,
            studentName: p.student.fullName,
            title: p.topic.title,
            departmentId:
              p.topic.researchArea?.pr2bResearchAreaWorkflowResearchAreaId
                ?.departmentId ?? null,
            scorerLecturerId,
            committeeRole: role,
            pdf: pdf.snapshot,
            slot: slot
              ? {
                  startsAt: slot.startsAt,
                  endsAt: slot.endsAt,
                  roomId: slot.roomId,
                  committeeKey: slot.committeeKey,
                }
              : null,
          })
        : null;
    return {
      chain,
      p,
      term,
      at,
      snapshot,
      blockers,
      report,
      pdf,
      bytes,
      fingerprint: hashJson({
        term,
        proposal: p,
        official,
        pdf,
        decision,
        latestProof,
        manifest,
        scorerRoster,
        sources: snapshot,
        blockers,
      }),
    };
  }
}
