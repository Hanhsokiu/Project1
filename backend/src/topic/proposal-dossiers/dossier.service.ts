import { HttpException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID, createHash } from "crypto";
import { DOSSIER_TEMPLATE_VERSION } from "@doan/shared";
import type {
  DossierFinalize,
  DossierReceiptInput,
  DossierView,
  DossierPrintSnapshot,
} from "@doan/shared";
import {
  DossierRepository,
  DossierSession,
  DossierRecord,
} from "./dossier.repository";
import { DossierValidator } from "./dossier.validator";
import { DossierPdfService } from "./dossier-pdf.service";
import {
  ProposalReviewValidator,
  reviewHash,
} from "../proposal-reviews/proposal-review.validator";
import type {
  ReviewPrincipal,
  ReviewProposal,
} from "../proposal-reviews/proposal-review.repository";
import { groupError } from "../review-groups/review-group.errors";
const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const checksum = (bytes: Buffer | Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
@Injectable()
export class DossierService {
  constructor(
    private readonly repo: DossierRepository,
    private readonly validator: DossierValidator,
    private readonly review: ProposalReviewValidator,
    private readonly pdf: DossierPdfService,
  ) {}
  private async load(s: DossierSession, userId: string, proposalId: string) {
    const user = this.review.principal(await s.principal(userId)),
      p = await s.proposal(proposalId);
    if (!p) groupError(404, "COMMON_001", "Không tìm thấy hồ sơ.");
    return { user, p };
  }
  private async faculty(
    s: DossierSession,
    u: ReviewPrincipal,
    p: ReviewProposal,
    action: string,
    resource = "proposal",
  ) {
    const permitted = u.userRoles.some(
      (r) =>
        r.role.name === "FACULTY" &&
        r.role.rolePermissions.some(
          (v) =>
            v.permission.resource === resource &&
            v.permission.action === action,
        ),
    );
    if (!permitted) return false;
    const department =
      p.topic.researchArea?.pr2bResearchAreaWorkflowResearchAreaId
        ?.departmentId;
    const [grant] = await s.grants(u.id, p.topic.termId);
    return (
      !!department &&
      !!grant &&
      (grant.allDepartments ||
        grant.pr2bGrantDepartmentGrantId.some(
          (d) => d.departmentId === department,
        ))
    );
  }
  private async access(
    s: DossierSession,
    u: ReviewPrincipal,
    p: ReviewProposal,
    action: string,
  ) {
    if (action === "receive")
      return this.faculty(s, u, p, "receive", "dossier");
    if (await this.faculty(s, u, p, action)) return true;
    if (action === "finalize") return false;
    if (
      this.review.role(u, "STUDENT", action) &&
      u.student?.isActive &&
      u.student.id === p.studentId
    ) {
      this.review.ownership(p);
      return true;
    }
    if (this.review.role(u, "LECTURER", action) && u.lecturer?.isActive) {
      const assignment = await s.advisor(p.topic.termId, p.studentId);
      if (assignment?.advisorAssignment?.advisorId === u.lecturer.id) {
        await this.review.advisor(s, p);
        return true;
      }
    }
    return false;
  }
  private async requireAccess(
    s: DossierSession,
    u: ReviewPrincipal,
    p: ReviewProposal,
    action: string,
  ) {
    if (!(await this.access(s, u, p, action)))
      groupError(
        404,
        "COMMON_001",
        "Không tìm thấy hồ sơ trong phạm vi được cấp.",
      );
  }
  private current(d: DossierRecord | null, finalizationId?: string) {
    const w = d?.pr2bDossierWorkflowDossierId;
    const f = d?.pr2bDossierFinalizationDossierId.find(
      (f) => f.id === w?.currentFinalizationId,
    );
    if (
      !w ||
      !["FINALIZED", "RECEIVED"].includes(w.state ?? "") ||
      !f ||
      f.supersededAt
    )
      groupError(
        409,
        "DOSSIER_NOT_FINALIZED",
        "Hồ sơ chưa có bản chốt hiện hành.",
      );
    if (finalizationId && finalizationId !== f.id)
      groupError(
        409,
        "STALE_FINALIZATION",
        "Bản chốt đã thay đổi hoặc không thuộc hồ sơ.",
      );
    this.validator.snapshotIntegrity(f.printSnapshot, f.contentHash);
    return f;
  }
  private async view(
    s: DossierSession,
    u: ReviewPrincipal,
    p: ReviewProposal,
  ): Promise<DossierView> {
    const d = await s.dossier(p.id),
      w = d?.pr2bDossierWorkflowDossierId,
      f = d?.pr2bDossierFinalizationDossierId.find(
        (f) => f.id === w?.currentFinalizationId,
      ),
      receipt = f?.pr2bDossierReceiptFinalizationId;
    const readiness: string[] = [],
      actions: DossierView["allowedActions"] = [];
    let previewSnapshot: DossierPrintSnapshot | null = null;
    if (await this.access(s, u, p, "finalize"))
      try {
        await this.review.phase(s, p.topic.termId);
        this.validator.open(d, w?.revision ?? 0);
        const approved = await this.validator.approval(
          s,
          p,
          p.pr2bProposalWorkflowProposalId?.submittedVersionId ?? "",
        );
        previewSnapshot = await this.validator.snapshot(s, p, approved);
        actions.push("finalize");
      } catch (e) {
        if (!(e instanceof HttpException)) throw e;
        readiness.push(
          (e.getResponse() as { error?: { code?: string } }).error?.code ??
            "INPUT_NOT_READY",
        );
      }
    if (
      f &&
      !f.supersededAt &&
      ["FINALIZED", "RECEIVED"].includes(w?.state ?? "") &&
      f.printSnapshot
    ) {
      this.validator.snapshotIntegrity(f.printSnapshot, f.contentHash);
      if (await this.access(s, u, p, "export")) actions.push("download");
      if (
        w?.state === "FINALIZED" &&
        !receipt &&
        (await this.access(s, u, p, "receive"))
      )
        try {
          await this.review.phase(s, p.topic.termId);
          actions.push("receive");
        } catch (e) {
          if (!(e instanceof HttpException)) throw e;
          readiness.push(
            (e.getResponse() as { error?: { code?: string } }).error?.code ??
              "INPUT_NOT_READY",
          );
        }
    }
    return {
      proposalId: p.id,
      title: p.topic.title,
      proposalStatus: p.status,
      proposalRevision: p.pr2bProposalWorkflowProposalId?.revision ?? 0,
      submittedVersionId:
        p.pr2bProposalWorkflowProposalId?.submittedVersionId ?? null,
      submittedVersionNumber:
        p.pr2bProposalWorkflowProposalId?.refSubmittedVersionId?.version ??
        null,
      state: w?.state ?? (d ? null : "DRAFT"),
      revision: w?.revision ?? 0,
      readiness,
      previewSnapshot,
      allowedActions: actions,
      currentFinalization: f?.printSnapshot
        ? {
            id: f.id,
            approvedVersionId: f.versionId,
            versionNumber: f.refVersionId.version,
            finalizedAt: f.finalizedAt.toISOString(),
            finalizedByUserId: f.finalizedByUserId,
            templateVersion: f.templateVersion,
            pdfGeneratedAt: f.refPdfAssetId?.createdAt.toISOString() ?? null,
            pdfChecksum: f.refPdfAssetId?.checksum ?? null,
            snapshot: f.printSnapshot as unknown as DossierPrintSnapshot,
          }
        : null,
      receipt: receipt
        ? {
            id: receipt.id,
            finalizationId: receipt.finalizationId,
            receivedAt: receipt.receivedAt.toISOString(),
            receivedByUserId: receipt.receivedByUserId,
            note: receipt.note,
          }
        : null,
      history: (d?.pr2bDossierHistoryDossierId ?? []).map((h) => ({
        id: h.id,
        action: h.action,
        actorId: h.actorId,
        createdAt: h.createdAt.toISOString(),
      })),
    };
  }
  async detail(userId: string, proposalId: string) {
    return this.repo.transaction(async (s) => {
      const { user, p } = await this.load(s, userId, proposalId);
      await this.requireAccess(s, user, p, "read");
      return this.view(s, user, p);
    });
  }
  private async command(
    userId: string,
    proposalId: string,
    action: string,
    path: string,
    input: unknown,
    key: string,
    work: (
      s: DossierSession,
      u: ReviewPrincipal,
      p: ReviewProposal,
    ) => Promise<void>,
    phase = true,
  ) {
    if (!key || key.length > 200 || !/^[\w.-]+$/.test(key))
      groupError(400, "COMMON_003", "Thiếu hoặc sai Idempotency-Key.");
    return this.repo.transaction(async (s) => {
      let { user, p } = await this.load(s, userId, proposalId);
      await this.requireAccess(s, user, p, action);
      await s.lock(p.topic.termId, [], p.id);
      ({ user, p } = await this.load(s, userId, proposalId));
      await this.requireAccess(s, user, p, action);
      const hash = reviewHash(input),
        replay = await s.replay(user.id, path, key);
      if (replay) {
        if (replay.payloadHash !== hash)
          groupError(
            409,
            "IDEMPOTENCY_CONFLICT",
            "Idempotency-Key đã dùng với nội dung khác.",
          );
        return replay.result as unknown as DossierView;
      }
      if (phase) await this.review.phase(s, p.topic.termId);
      await work(s, user, p);
      if (phase) await this.review.phase(s, p.topic.termId);
      const result = await this.view(s, user, (await s.proposal(p.id))!);
      await s.remember(user.id, path, key, hash, json(result));
      return result;
    }, true);
  }
  async finalize(
    userId: string,
    proposalId: string,
    input: DossierFinalize,
    key: string,
  ) {
    return this.command(
      userId,
      proposalId,
      "finalize",
      `/proposals/${proposalId}/finalize`,
      input,
      key,
      async (s, u, p) => {
        if (input.templateVersion !== DOSSIER_TEMPLATE_VERSION)
          groupError(409, "TEMPLATE_NOT_READY", "Mẫu in không được hỗ trợ.");
        const existing = await s.dossier(p.id);
        this.validator.open(existing, input.expectedDossierRevision);
        if (!p.pr2bProposalWorkflowProposalId)
          groupError(409, "INPUT_NOT_READY", "Thiếu metadata đề cương.");
        this.review.revision(
          p.pr2bProposalWorkflowProposalId.revision,
          input.expectedProposalRevision,
        );
        const approved = await this.validator.approval(
            s,
            p,
            input.approvedVersionId,
          ),
          owner = this.review.ownership(p);
        await s.lockPrintInputs(
          p.studentId,
          approved.assignment.advisorId,
          owner.termStudentId!,
        );
        const snapshot = await this.validator.snapshot(s, p, approved),
          d = existing ?? (await s.createDossier(p.id)),
          now = new Date();
        const f = await s.addFinalization({
          id: randomUUID(),
          dossierId: d.id,
          proposalId: p.id,
          versionId: input.approvedVersionId,
          sequence:
            Math.max(
              0,
              ...d.pr2bDossierFinalizationDossierId.map((v) => v.sequence),
            ) + 1,
          templateVersion: input.templateVersion,
          printSnapshot: json(snapshot),
          contentHash: reviewHash(snapshot),
          approvalDecisionId: approved.decision.id,
          finalizedAt: now,
          finalizedByUserId: u.id,
        });
        const updated = await s.updateDossier(
          d.id,
          input.expectedDossierRevision,
          { state: "FINALIZED", currentFinalizationId: f.id },
        );
        if (updated.count !== 1)
          groupError(409, "REVISION_CONFLICT", "Hồ sơ đã thay đổi.");
        const changed = await s.advance(
          p.id,
          input.expectedProposalRevision,
          {},
        );
        if (changed.count !== 1)
          groupError(409, "REVISION_CONFLICT", "Đề cương đã thay đổi.");
        await this.evidence(s, u.id, d.id, "FINALIZED", {
          finalizationId: f.id,
          versionId: f.versionId,
          approvalDecisionId: approved.decision.id,
          contentHash: f.contentHash,
        });
      },
    );
  }
  private async evidence(
    s: DossierSession,
    userId: string,
    dossierId: string,
    action: string,
    metadata: unknown,
  ) {
    await s.dossierHistory({
      dossierId,
      actorId: userId,
      action,
      reason: action,
      snapshot: json(metadata),
    });
    await s.dossierAudit(userId, dossierId, action, json(metadata));
  }
  async receive(
    userId: string,
    proposalId: string,
    input: DossierReceiptInput,
    key: string,
  ) {
    return this.command(
      userId,
      proposalId,
      "receive",
      `/proposals/${proposalId}/dossier/receipt`,
      input,
      key,
      async (s, u, p) => {
        const d = await s.dossier(p.id),
          f = this.current(d, input.finalizationId),
          w = d!.pr2bDossierWorkflowDossierId!;
        this.review.revision(w.revision, input.expectedRevision);
        if (w.state !== "FINALIZED" || f.pr2bDossierReceiptFinalizationId)
          groupError(
            409,
            "STATE_TRANSITION_INVALID",
            "Bản chốt đã được ghi nhận tiếp nhận.",
          );
        const receipt = await s.addReceipt({
          finalizationId: f.id,
          receivedAt: new Date(),
          receivedByUserId: u.id,
          note: input.note || null,
        });
        const updated = await s.updateDossier(d!.id, input.expectedRevision, {
          state: "RECEIVED",
        });
        if (updated.count !== 1)
          groupError(409, "REVISION_CONFLICT", "Hồ sơ đã thay đổi.");
        await this.evidence(s, u.id, d!.id, "PHYSICAL_RECEIVED", {
          finalizationId: f.id,
          receiptId: receipt.id,
        });
      },
    );
  }
  async generate(
    userId: string,
    proposalId: string,
    input: { finalizationId: string; expectedRevision: number },
    key: string,
  ) {
    return this.command(
      userId,
      proposalId,
      "export",
      `/proposals/${proposalId}/dossier/pdf`,
      input,
      key,
      async (s, u, p) => {
        const d = await s.dossier(p.id),
          f = this.current(d, input.finalizationId),
          w = d!.pr2bDossierWorkflowDossierId!;
        this.review.revision(w.revision, input.expectedRevision);
        if (f.pdfAssetId) return;
        const snapshot = this.validator.snapshotIntegrity(
          f.printSnapshot,
          f.contentHash,
        );
        const rendered = await this.pdf.render(snapshot, f.id, f.finalizedAt),
          assetId = randomUUID();
        await s.addAsset({
          id: assetId,
          kind: "DOSSIER_PDF",
          state: "READY",
          storageKey: `db:dossier-pdf/${assetId}`,
          originalName: "de-cuong.pdf",
          sizeBytes: rendered.bytes.length,
          mimeType: "application/pdf",
          checksum: checksum(rendered.bytes),
          createdByUserId: u.id,
        });
        await s.addPdf(assetId, rendered.bytes);
        await s.linkPdf(f.id, assetId);
        const updated = await s.updateDossier(d!.id, w.revision, {});
        if (updated.count !== 1)
          groupError(409, "REVISION_CONFLICT", "Hồ sơ đã thay đổi.");
        await this.evidence(s, u.id, d!.id, "PDF_GENERATED", {
          finalizationId: f.id,
          assetId,
          pages: rendered.pages,
          checksum: checksum(rendered.bytes),
        });
      },
      false,
    );
  }
  async download(userId: string, proposalId: string, finalizationId?: string) {
    return this.repo.transaction(async (s) => {
      const { user, p } = await this.load(s, userId, proposalId);
      await this.requireAccess(s, user, p, "export");
      const f = this.current(await s.dossier(p.id), finalizationId),
        asset = f.refPdfAssetId;
      if (!asset || asset.kind !== "DOSSIER_PDF" || asset.state !== "READY")
        groupError(
          409,
          "PDF_NOT_GENERATED",
          "Hãy tạo PDF cho bản chốt trước khi tải.",
        );
      const content = await s.pdf(asset.id);
      if (
        !content ||
        checksum(content.bytes) !== asset.checksum ||
        content.bytes.length !== asset.sizeBytes
      )
        groupError(409, "FILE_NOT_READY", "File PDF không khớp metadata.");
      return {
        bytes: Buffer.from(content.bytes),
        filename: `de-cuong-${encodeURIComponent(f.id)}.pdf`,
      };
    });
  }
}
