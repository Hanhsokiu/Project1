import { Inject, Injectable } from "@nestjs/common";
import { isDeepStrictEqual } from "node:util";
import type { ReviewPrincipal } from "../../topic/proposal-reviews/proposal-review.repository";
import { DefenseConfirmationValidator } from "./defense-confirmation.validator";
import {
  confirmationError,
  defenseConfirmationPutSchema,
  type DefenseConfirmationPut,
} from "./defense-confirmation.dto";
import type {
  DecisionSnapshot,
  DefenseConfirmationContext,
} from "./defense-confirmation.types";

@Injectable()
export class DefenseConfirmationCommandValidator {
  constructor(
    @Inject(DefenseConfirmationValidator)
    private readonly context: DefenseConfirmationValidator,
  ) {}

  input(value: unknown) {
    const parsed = defenseConfirmationPutSchema.safeParse(value);
    if (!parsed.success)
      confirmationError(
        422,
        "UC17_INPUT_INVALID",
        "Dữ liệu quyết định/context không hợp lệ hoặc thiếu lý do từ chối.",
      );
    return parsed.data;
  }

  principal(user: ReviewPrincipal | null, userId: string) {
    const actor = this.context.principal(user, userId);
    if (
      !actor.userRoles.some((r) =>
        r.role.rolePermissions.some(
          (p) =>
            p.permission.resource === "defense-confirmation" &&
            p.permission.action === "decide",
        ),
      )
    )
      confirmationError(
        403,
        "UC17_DECISION_FORBIDDEN",
        "Thiếu quyền ra quyết định xác nhận bảo vệ.",
      );
    return actor;
  }

  snapshot(context: DefenseConfirmationContext): DecisionSnapshot {
    if (context.advisor.state !== "OFFICIAL")
      confirmationError(
        409,
        "OFFICIAL_ADVISOR_NOT_READY",
        "Chưa có GVHD chính thức.",
      );
    return {
      schemaVersion: 1,
      assignment: {
        assignmentId: context.advisor.assignmentId,
        revision: context.advisor.revision,
      },
      pdf: context.pdf.state === "READY" ? context.pdf.snapshot : null,
    };
  }

  validate(context: DefenseConfirmationContext, input: DefenseConfirmationPut) {
    if (context.proposal.status !== "APPROVED")
      confirmationError(
        409,
        "UC17_PROPOSAL_NOT_APPROVED",
        "Hồ sơ chưa được duyệt chính thức.",
      );
    this.context.assertWritable(context, input.status, input.expectedContext);
    if (context.advisor.state !== "OFFICIAL")
      confirmationError(
        409,
        "OFFICIAL_ADVISOR_NOT_READY",
        "Chưa có GVHD chính thức.",
      );
    const snapshot = this.snapshot(context),
      current = context.decision;
    const note = input.note?.trim() || null;
    const unchanged =
      current.state === "RECORDED" &&
      current.status === input.status &&
      (current.note?.trim() || null) === note &&
      current.advisorId === context.advisor.advisorId &&
      current.decidedByUserId === context.advisor.userId &&
      isDeepStrictEqual(current.snapshot, snapshot);
    // PENDING is an uninitialized placeholder. Legacy decisions are deliberately
    // replaced only by an explicit new decision/reason, never by fake backfill.
    const existingDecision =
      current.state !== "ABSENT" && current.state !== "PENDING";
    if (!unchanged && existingDecision && !input.changeReason)
      confirmationError(
        422,
        "UC17_CHANGE_REASON_REQUIRED",
        "Thay đổi quyết định đã có phải ghi changeReason.",
      );
    return { unchanged, note, snapshot };
  }
}
