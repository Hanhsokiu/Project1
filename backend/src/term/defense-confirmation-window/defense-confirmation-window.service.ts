import { Injectable, NotFoundException } from "@nestjs/common";
import { AuditService } from "../../common/audit/audit.service";
import {
  DefenseConfirmationWindowRepository,
  WindowTransaction,
} from "./defense-confirmation-window.repository";
import {
  DefenseConfirmationWindowValidator,
  defenseConfirmationWindowConflict,
} from "./defense-confirmation-window.validator";
import {
  DefenseConfirmationWindowPut,
  defenseConfirmationWindowResponse,
} from "./defense-confirmation-window.dto";

@Injectable()
export class DefenseConfirmationWindowService {
  constructor(
    private readonly repository: DefenseConfirmationWindowRepository,
    private readonly validator: DefenseConfirmationWindowValidator,
    private readonly audit: AuditService,
  ) {}

  private async access(
    userId: string,
    termId: string,
    action: "read" | "plan",
    tx: WindowTransaction,
  ) {
    const principal = await this.repository.principal(userId, tx);
    const grant = await this.repository.grant(userId, termId, tx);
    this.validator.access(userId, termId, principal, grant, action);
  }

  private async term(termId: string, tx: WindowTransaction) {
    const term = await this.repository.term(termId, tx);
    if (!term) throw new NotFoundException("Không tìm thấy đợt đồ án.");
    return term;
  }

  get(userId: string, termId: string) {
    return this.repository.transaction(async (tx) => {
      await this.access(userId, termId, "read", tx);
      await this.term(termId, tx);
      return defenseConfirmationWindowResponse(
        termId,
        await this.repository.window(termId, tx),
      );
    });
  }

  put(userId: string, termId: string, input: DefenseConfirmationWindowPut) {
    return this.repository.transaction(async (tx) => {
      await this.access(userId, termId, "plan", tx);
      await this.repository.lockTerm(termId, tx);
      const term = await this.term(termId, tx);
      this.validator.editable(term);
      const dates = this.validator.dates(input, term);
      const current = await this.repository.window(termId, tx);
      this.validator.revision(input.expectedRevision, current?.revision ?? 0);
      const before = defenseConfirmationWindowResponse(termId, current);
      // Every successful PUT is a revisioned, audited configuration write.

      const values = { ...dates, isLocked: input.locked };
      let saved;
      if (current) {
        const result = await this.repository.update(
          termId,
          input.expectedRevision,
          values,
          tx,
        );
        if (result.count !== 1) throw defenseConfirmationWindowConflict();
        saved = await this.repository.window(termId, tx);
        if (!saved) throw defenseConfirmationWindowConflict();
      } else {
        saved = await this.repository.create(termId, values, tx);
      }
      const after = defenseConfirmationWindowResponse(termId, saved);
      await this.audit.log(
        {
          userId,
          action: current
            ? "UPDATE_DEFENSE_CONFIRMATION_WINDOW"
            : "CREATE_DEFENSE_CONFIRMATION_WINDOW",
          resource: "defense-confirmation-window",
          resourceId: termId,
          oldValue: before,
          newValue: after,
        },
        tx,
      );
      return after;
    });
  }
}
