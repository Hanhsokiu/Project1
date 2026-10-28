import { Inject, Injectable } from "@nestjs/common";
import {
  DefenseConfirmationRepository,
  DefenseConfirmationSession,
} from "./defense-confirmation.repository";
import { DefenseConfirmationContextService } from "./defense-confirmation-context.service";
import { DefenseConfirmationValidator } from "./defense-confirmation.validator";
import {
  DefenseConfirmationReadValidator,
  type ConfirmationViewer,
} from "./defense-confirmation-read.validator";
import {
  confirmationError,
  defenseConfirmationHistoryQuerySchema,
  type DefenseConfirmationHistoryQuery,
} from "./defense-confirmation.dto";
import {
  confirmationContextDto,
  confirmationDecisionDto,
  confirmationHistoryItem,
  type DefenseConfirmationHistoryResponse,
} from "./defense-confirmation-read.dto";

@Injectable()
export class DefenseConfirmationReadService {
  constructor(
    @Inject(DefenseConfirmationRepository)
    private readonly repo: DefenseConfirmationRepository,
    @Inject(DefenseConfirmationContextService)
    private readonly contexts: DefenseConfirmationContextService,
    @Inject(DefenseConfirmationValidator)
    private readonly validator: DefenseConfirmationValidator,
    @Inject(DefenseConfirmationReadValidator)
    private readonly access: DefenseConfirmationReadValidator,
  ) {}

  context(userId: string, proposalId: string) {
    return this.repo.read(async (s, tx) => {
      const actor = this.access.principal(await s.principal(userId), userId);
      this.access.requireAdvisorReader(actor);
      const context = await this.contexts.readInTransaction(
        userId,
        proposalId,
        s,
        tx,
      );
      return confirmationContextDto(
        context,
        this.access.permitted(actor, "decide"),
      );
    });
  }

  private async scope(
    userId: string,
    proposalId: string,
    history: boolean,
    s: DefenseConfirmationSession,
  ): Promise<ConfirmationViewer> {
    const actor = this.access.principal(await s.principal(userId), userId);
    const proposal = await s.proposal(proposalId);
    if (!proposal)
      confirmationError(
        404,
        "UC17_NOT_FOUND",
        "Không tìm thấy hồ sơ trong phạm vi.",
      );
    if (!history && this.access.studentOwn(actor, proposal)) return "STUDENT";
    // A dual-role faculty/advisor still needs the advisor view for the dossiers
    // they currently supervise. Verify the assignment before selecting that view.
    if (this.access.role(actor, "LECTURER") && actor.lecturer?.isActive) {
      const term = await s.term(proposal.termId),
        registration = await s.advisor(proposal.termId, proposal.studentId);
      const assignment = registration?.advisorAssignment;
      const roster = assignment
        ? await s.roster(proposal.termId, assignment.advisorId)
        : null;
      const advisor = this.validator.official(
        proposal,
        term,
        registration,
        roster,
        await s.now(),
      );
      if (this.access.advisor(actor, advisor)) return "ADVISOR";
    }
    if (
      this.access.role(actor, "FACULTY") ||
      this.access.role(actor, "ADMIN")
    ) {
      if (
        this.access.faculty(
          actor,
          proposal,
          await s.grants(actor.id, proposal.termId),
        )
      )
        return "FACULTY";
    }
    confirmationError(
      404,
      "UC17_NOT_FOUND",
      "Không tìm thấy hồ sơ trong phạm vi đọc UC17.",
    );
  }

  current(userId: string, proposalId: string) {
    return this.repo.read(async (s) => {
      const viewer = await this.scope(userId, proposalId, false, s);
      const row = await s.decisionRecord(proposalId);
      return confirmationDecisionDto(
        proposalId,
        row,
        this.validator.decision(row, await s.now()),
        viewer,
      );
    });
  }

  history(
    userId: string,
    proposalId: string,
    query: DefenseConfirmationHistoryQuery,
  ): Promise<DefenseConfirmationHistoryResponse> {
    const parsed = defenseConfirmationHistoryQuerySchema.safeParse(query);
    if (!parsed.success)
      confirmationError(
        422,
        "UC17_HISTORY_QUERY_INVALID",
        "Phân trang lịch sử không hợp lệ.",
      );
    const { afterRevision = 0, limit } = parsed.data;
    return this.repo.read(async (s) => {
      const viewer = await this.scope(userId, proposalId, true, s);
      if (viewer === "STUDENT")
        confirmationError(
          403,
          "UC17_READ_FORBIDDEN",
          "Sinh viên chỉ được xem quyết định hiện hành.",
        );
      const row = await s.decisionRecord(proposalId);
      const decision = this.validator.decision(row, await s.now());
      const rows = await s.decisionHistory(proposalId, afterRevision, limit);
      const hasMore = rows.length > limit,
        items = rows.slice(0, limit).map(confirmationHistoryItem);
      return {
        code: "DEFENSE_CONFIRMATION_HISTORY",
        proposalId,
        viewer,
        currentRevision: row?.revision ?? null,
        historyState:
          rows.length > 0
            ? "AVAILABLE"
            : !row
              ? "NO_DECISION"
              : afterRevision > 0
                ? "EMPTY"
                : decision.state === "LEGACY"
                  ? "LEGACY_WITHOUT_HISTORY"
                  : row.revision > 0
                    ? "UNKNOWN"
                    : "EMPTY",
        items,
        hasMore,
        nextAfterRevision: hasMore ? items[items.length - 1].revision : null,
      };
    });
  }
}
