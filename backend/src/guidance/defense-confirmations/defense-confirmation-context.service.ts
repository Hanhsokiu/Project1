import { HttpException, Inject, Injectable } from "@nestjs/common";
import { FileStorageService } from "../../common/storage/file-storage.service";
import { Uc18FinalizationReader } from "../../common/contracts/uc18-finalization.port";
import { DefenseConfirmationRepository } from "./defense-confirmation.repository";
import {
  DefenseConfirmationValidator,
  UC17_PDF_READ_MAX_BYTES,
} from "./defense-confirmation.validator";
import { DefenseConfirmationProgressValidator } from "./defense-confirmation-progress.validator";
import type { DefenseConfirmationContext } from "./defense-confirmation.types";
import type { Prisma } from "@prisma/client";
import type { DefenseConfirmationSession } from "./defense-confirmation.repository";

/** Shared context loader; the command supplies its already locked transaction. */
@Injectable()
export class DefenseConfirmationContextService {
  constructor(
    @Inject(DefenseConfirmationRepository)
    private readonly repo: DefenseConfirmationRepository,
    @Inject(DefenseConfirmationValidator)
    private readonly validator: DefenseConfirmationValidator,
    @Inject(DefenseConfirmationProgressValidator)
    private readonly progress: DefenseConfirmationProgressValidator,
    @Inject(FileStorageService)
    private readonly storage: FileStorageService,
    @Inject(Uc18FinalizationReader)
    private readonly finalization: Uc18FinalizationReader,
  ) {}

  read(
    userId: string,
    proposalId: string,
  ): Promise<DefenseConfirmationContext> {
    return this.repo.read((s, tx) =>
      this.readInTransaction(userId, proposalId, s, tx),
    );
  }

  async readInTransaction(
    userId: string,
    proposalId: string,
    s: DefenseConfirmationSession,
    tx: Prisma.TransactionClient,
  ): Promise<DefenseConfirmationContext> {
    const actor = this.validator.principal(await s.principal(userId), userId);
    const proposal = await s.proposal(proposalId);
    if (!proposal)
      throw new HttpException(
        {
          error: {
            code: "UC17_NOT_FOUND",
            message: "Không tìm thấy hồ sơ trong phạm vi.",
          },
        },
        404,
      );
    const term = await s.term(proposal.topic.termId),
      registration = await s.advisor(proposal.topic.termId, proposal.studentId),
      at = await s.now();
    const assignment = registration?.advisorAssignment;
    const roster = assignment
      ? await s.roster(proposal.topic.termId, assignment.advisorId)
      : null;
    const advisor = this.validator.official(
      proposal,
      term,
      registration,
      roster,
      at,
    );
    this.validator.advisorAccess(actor, advisor);
    if (!term) throw new Error("Official advisor requires an existing term");
    // Load private data only after checking the current official assignment.
    const [window, row, report, plan, uc18] = await Promise.all([
      s.window(term.id),
      s.currentDecision(proposalId),
      s.report(proposalId),
      s.planFor(proposalId),
      this.finalization.read(term.id, tx),
    ]);
    let pdf = this.validator.pdfMetadata(
      report,
      proposalId,
      proposal.student.userId,
      at,
    );
    if (pdf.state === "UNVERIFIED" && report?.fileAsset) {
      let bytes: Buffer | null = null;
      try {
        bytes = await this.storage.readPrivateFinalReport(
          report.fileAsset.storageKey,
          UC17_PDF_READ_MAX_BYTES,
        );
      } catch {
        pdf = this.validator.pdfUnavailable(pdf);
      }
      if (bytes) pdf = this.validator.pdfBytes(pdf, bytes);
    }
    const decision = this.validator.decision(row, at);
    const progress = this.progress.summarize(
      plan,
      plan ? await s.monitorTasks(plan.id) : [],
      plan ? await s.evaluations(plan.id) : [],
      advisor,
      at,
      plan ? await s.taskProgress(plan.id) : [],
    );
    const facts = {
      proposal: {
        id: proposal.id,
        status: proposal.status,
        studentId: proposal.studentId,
      },
      advisor,
      window: this.validator.window(term, window, at),
      decision,
      pdf,
      uc18,
      student: {
        id: proposal.student.id,
        code: proposal.student.studentCode,
        name: proposal.student.fullName,
        active: proposal.student.isActive,
      },
      term: {
        id: term.id,
        status: term.status,
        locked: term.isLocked,
        startsAt: term.startDate.toISOString(),
        endsAt: term.endDate.toISOString(),
      },
    };
    return {
      code: "DEFENSE_CONFIRMATION",
      ...facts,
      asOf: at.toISOString(),
      progress,
      ...this.validator.changed(decision, pdf, advisor),
      legacy: {
        decision: decision.state === "LEGACY",
        pdf: pdf.state === "LEGACY",
        plan: progress.plan?.legacy ?? false,
        tasks: progress.tasks.filter((t) => t.dataState === "LEGACY").length,
        evaluations: progress.evaluations.filter(
          (e) => e.dataState === "LEGACY",
        ).length,
      },
      readiness: {
        confirm: this.validator.readiness(facts, "CONFIRMED"),
        reject: this.validator.readiness(facts, "REJECTED"),
      },
    };
  }
}
