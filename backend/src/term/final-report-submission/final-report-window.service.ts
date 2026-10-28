import { Injectable, NotFoundException } from "@nestjs/common";
import { AuditService } from "../../common/audit/audit.service";
import {
  FinalReportWindowRepository,
  WindowTransaction,
} from "./final-report-window.repository";
import {
  FinalReportWindowValidator,
  finalReportWindowConflict,
} from "./final-report-window.validator";
import {
  FinalReportWindowPut,
  finalReportWindowResponse,
} from "./final-report-window.dto";

@Injectable()
export class FinalReportWindowService {
  constructor(
    private readonly repository: FinalReportWindowRepository,
    private readonly validator: FinalReportWindowValidator,
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
      return finalReportWindowResponse(
        termId,
        await this.repository.window(termId, tx),
      );
    });
  }

  put(userId: string, termId: string, input: FinalReportWindowPut) {
    return this.repository.transaction(async (tx) => {
      await this.access(userId, termId, "plan", tx);
      await this.repository.lockTerm(termId, tx);
      const term = await this.term(termId, tx);
      this.validator.editable(term);
      const dates = this.validator.dates(input, term);
      const current = await this.repository.window(termId, tx);
      this.validator.revision(input.expectedRevision, current?.revision ?? 0);
      const before = finalReportWindowResponse(termId, current);
      if (
        current &&
        current.opensAt.getTime() === dates.opensAt.getTime() &&
        current.closesAt.getTime() === dates.closesAt.getTime() &&
        current.isLocked === input.locked
      )
        return before;

      const values = { ...dates, isLocked: input.locked };
      let saved;
      if (current) {
        const result = await this.repository.update(
          termId,
          input.expectedRevision,
          values,
          tx,
        );
        if (result.count !== 1) throw finalReportWindowConflict();
        saved = await this.repository.window(termId, tx);
        if (!saved) throw finalReportWindowConflict();
      } else {
        saved = await this.repository.create(termId, values, tx);
      }
      const after = finalReportWindowResponse(termId, saved);
      await this.audit.log(
        {
          userId,
          action: current
            ? "UPDATE_FINAL_REPORT_SUBMISSION_WINDOW"
            : "CREATE_FINAL_REPORT_SUBMISSION_WINDOW",
          resource: "final-report-submission-window",
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
