import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { defenseWorkflowPolicySchema } from "@doan/shared";
import {
  workflowWindow,
  validatePolicyDates,
} from "../workflow/defense-workflow.policy";
import { AuditService } from "../../common/audit/audit.service";
import { Uc18FinalizationReader } from "../../common/contracts/uc18-finalization.port";
import { defenseListResponse, type DefenseListOpen } from "./defense-list.dto";
import { DefenseListRepository } from "./defense-list.repository";
import {
  DefenseListValidator,
  defenseListError,
} from "./defense-list.validator";

@Injectable()
export class DefenseListService {
  constructor(
    @Inject(DefenseListRepository) private readonly repo: DefenseListRepository,
    @Inject(DefenseListValidator)
    private readonly validator: DefenseListValidator,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(Uc18FinalizationReader)
    private readonly reader: Uc18FinalizationReader,
  ) {}

  private async access(
    userId: string,
    termId: string,
    action: "read" | "manage",
    tx: Prisma.TransactionClient,
  ) {
    const principal = await this.repo.principal(userId, tx);
    const grant = await this.repo.grant(userId, termId, tx);
    this.validator.access(userId, termId, principal, grant, action);
    const term = await this.repo.term(termId, tx);
    if (!term)
      defenseListError(
        404,
        "DEFENSE_LIST_TERM_NOT_FOUND",
        "Không tìm thấy đợt tốt nghiệp.",
      );
    return term;
  }

  get(userId: string, termId: string) {
    return this.repo.transaction(async (tx) => {
      await this.access(userId, termId, "read", tx);
      const row = await this.repo.list(termId, tx);
      return defenseListResponse(
        termId,
        row,
        await this.reader.read(termId, tx),
      );
    }, "read");
  }

  create(userId: string, termId: string) {
    return this.repo.transaction(async (tx) => {
      // First lock is the shared parent, before any child write or access check.
      await this.repo.lockTerm(termId, tx);
      this.validator.editable(await this.access(userId, termId, "manage", tx));
      if (await this.repo.list(termId, tx))
        defenseListError(
          409,
          "DEFENSE_LIST_ALREADY_EXISTS",
          "Đợt đã có danh sách bảo vệ.",
        );
      const at = await this.repo.now(tx);
      const row = await this.repo.create(termId, at, tx);
      const after = defenseListResponse(
        termId,
        row,
        await this.reader.read(termId, tx),
      );
      await this.audit.log(
        {
          userId,
          action: "CREATE_DEFENSE_LIST",
          resource: "defense-list",
          resourceId: termId,
          newValue: after,
        },
        tx,
      );
      return after;
    }, "write");
  }

  open(userId: string, termId: string, input: DefenseListOpen) {
    const { expectedRevision } = this.validator.openInput(input);
    return this.repo.transaction(async (tx) => {
      await this.repo.lockTerm(termId, tx);
      const term = await this.access(userId, termId, "manage", tx);
      this.validator.editable(term);
      const row = await this.repo.list(termId, tx);
      if (!row)
        defenseListError(
          404,
          "DEFENSE_LIST_NOT_CONFIGURED",
          "Chưa tạo danh sách DRAFT cho đợt.",
        );
      this.validator.openable(row, expectedRevision);
      const parsedPolicy = defenseWorkflowPolicySchema.safeParse(
        row.workflowPolicy,
      );
      const policy =
        parsedPolicy.success &&
        row.workflowPolicyRevision > 0 &&
        row.workflowPolicyUpdatedAt &&
        row.workflowPolicyUpdatedByUserId
          ? parsedPolicy.data
          : null;
      if (policy) validatePolicyDates(policy, term);
      workflowWindow(policy, "UC18", await this.repo.now(tx), term);
      const before = defenseListResponse(
        termId,
        row,
        await this.reader.read(termId, tx),
      );
      const at = await this.repo.now(tx);
      const result = await this.repo.open(
        termId,
        expectedRevision,
        userId,
        at,
        tx,
      );
      if (result.count !== 1)
        defenseListError(
          409,
          "REVISION_CONFLICT",
          "Danh sách vừa thay đổi; hãy tải lại revision.",
        );
      const saved = await this.repo.list(termId, tx);
      const verified = await this.reader.read(termId, tx);
      if (
        !saved ||
        verified.state !== "OPEN" ||
        verified.termId !== termId ||
        verified.revision !== expectedRevision + 1
      )
        defenseListError(
          409,
          "DEFENSE_LIST_OPEN_NOT_VERIFIED",
          "Không xác minh được trạng thái OPEN; hủy thao tác.",
        );
      const after = defenseListResponse(termId, saved, verified);
      await this.audit.log(
        {
          userId,
          action: "OPEN_DEFENSE_LIST",
          resource: "defense-list",
          resourceId: termId,
          oldValue: before,
          newValue: after,
        },
        tx,
      );
      workflowWindow(policy, "UC18", await this.repo.now(tx), term);
      return after;
    }, "write");
  }
}
