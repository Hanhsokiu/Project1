import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Put,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import {
  academicEvidenceCommandSchema,
  defenseStageSchema,
  stageSaveSchema,
  scheduleAmendSchema,
  workflowCommandSchema,
  workflowPolicyCommandSchema,
  workflowReopenSchema,
  type AcademicEvidenceInput,
  type DefenseStage,
  type StageSaveInput,
  type WorkflowCommand,
  type WorkflowPolicyInput,
} from "@doan/shared";
import { ApiResponse } from "../../common/dto/api-response.dto";
import {
  CurrentUser,
  type CurrentUserPayload,
} from "../../common/security/current-user.decorator";
import { RequirePermission } from "../../common/security/require-permission.decorator";
import { ZodValidationPipe } from "../../common/validation/zod.pipe";
import { DefenseWorkflowService } from "./defense-workflow.service";
const paramsSchema = z
  .object({ termId: z.string().trim().min(1).max(36) })
  .strict();
const stageParams = paramsSchema.extend({ stage: defenseStageSchema }).strict();
@ApiTags("defense-workflow")
@ApiBearerAuth()
@Controller("terms/:termId")
export class DefenseWorkflowController {
  constructor(
    @Inject(DefenseWorkflowService)
    private readonly service: DefenseWorkflowService,
  ) {}
  @Get("defense-workflow")
  @RequirePermission("defense-workflow", "read")
  async context(
    @CurrentUser() u: CurrentUserPayload,
    @Param(new ZodValidationPipe(paramsSchema)) p: { termId: string },
  ) {
    return ApiResponse.ok(await this.service.context(u.userId, p.termId));
  }
  @Get("defense-workflow/history")
  @RequirePermission("defense-workflow", "read")
  async history(
    @CurrentUser() u: CurrentUserPayload,
    @Param(new ZodValidationPipe(paramsSchema)) p: { termId: string },
  ) {
    return ApiResponse.ok(await this.service.history(u.userId, p.termId));
  }
  @Put("defense-list/workflow-policy")
  @RequirePermission("defense-workflow", "configure")
  async policy(
    @CurrentUser() u: CurrentUserPayload,
    @Param(new ZodValidationPipe(paramsSchema)) p: { termId: string },
    @Body(new ZodValidationPipe(workflowPolicyCommandSchema))
    b: WorkflowPolicyInput,
  ) {
    return ApiResponse.ok(await this.service.configure(u.userId, p.termId, b));
  }
  @Post("defense-list/academic-evidence")
  @RequirePermission("defense-workflow", "verify-academic")
  async academic(
    @CurrentUser() u: CurrentUserPayload,
    @Param(new ZodValidationPipe(paramsSchema)) p: { termId: string },
    @Body(new ZodValidationPipe(academicEvidenceCommandSchema))
    b: AcademicEvidenceInput,
  ) {
    return ApiResponse.ok(await this.service.academic(u.userId, p.termId, b));
  }
  @Get("defense-list/academic-evidence/:termStudentId")
  @RequirePermission("defense-workflow", "read")
  async evidenceHistory(
    @CurrentUser() u: CurrentUserPayload,
    @Param(
      new ZodValidationPipe(
        paramsSchema
          .extend({ termStudentId: z.string().trim().min(1).max(36) })
          .strict(),
      ),
    )
    p: { termId: string; termStudentId: string },
  ) {
    return ApiResponse.ok(
      await this.service.academicHistory(u.userId, p.termId, p.termStudentId),
    );
  }
  @Post("defense-list/finalize")
  @RequirePermission("defense-workflow", "finalize")
  async finalizeList(
    @CurrentUser() u: CurrentUserPayload,
    @Param(new ZodValidationPipe(paramsSchema)) p: { termId: string },
    @Body(new ZodValidationPipe(workflowCommandSchema)) b: WorkflowCommand,
  ) {
    return ApiResponse.ok(
      await this.service.finalizeList(u.userId, p.termId, b),
    );
  }
  @Post("defense-list/reopen")
  @RequirePermission("defense-workflow", "reopen")
  async reopen(
    @CurrentUser() u: CurrentUserPayload,
    @Param(new ZodValidationPipe(paramsSchema)) p: { termId: string },
    @Body(new ZodValidationPipe(workflowReopenSchema))
    b: WorkflowCommand & { reason: string },
  ) {
    return ApiResponse.ok(await this.service.reopenList(u.userId, p.termId, b));
  }
  @Put("defense-workflow/:stage/draft")
  @RequirePermission("defense-workflow", "manage")
  async save(
    @CurrentUser() u: CurrentUserPayload,
    @Param(new ZodValidationPipe(stageParams))
    p: { termId: string; stage: DefenseStage },
    @Body(new ZodValidationPipe(stageSaveSchema)) b: StageSaveInput,
  ) {
    return ApiResponse.ok(
      await this.service.saveStage(u.userId, p.termId, p.stage, b),
    );
  }
  @Post("defense-workflow/:stage/finalize")
  @RequirePermission("defense-workflow", "finalize")
  async finalizeStage(
    @CurrentUser() u: CurrentUserPayload,
    @Param(new ZodValidationPipe(stageParams))
    p: { termId: string; stage: DefenseStage },
    @Body(new ZodValidationPipe(workflowCommandSchema)) b: WorkflowCommand,
  ) {
    return ApiResponse.ok(
      await this.service.sealStage(u.userId, p.termId, p.stage, "finalize", b),
    );
  }
  @Post("defense-workflow/SCHEDULE/publish")
  @RequirePermission("defense-workflow", "publish")
  async publish(
    @CurrentUser() u: CurrentUserPayload,
    @Param(new ZodValidationPipe(paramsSchema)) p: { termId: string },
    @Body(new ZodValidationPipe(workflowCommandSchema)) b: WorkflowCommand,
  ) {
    return ApiResponse.ok(
      await this.service.sealStage(
        u.userId,
        p.termId,
        "SCHEDULE",
        "publish",
        b,
      ),
    );
  }
  @Post("defense-workflow/SCHEDULE/amend")
  @RequirePermission("defense-workflow", "publish")
  async amend(
    @CurrentUser() u: CurrentUserPayload,
    @Param(new ZodValidationPipe(paramsSchema)) p: { termId: string },
    @Body(new ZodValidationPipe(scheduleAmendSchema))
    b: StageSaveInput & { reason: string },
  ) {
    return ApiResponse.ok(
      await this.service.sealStage(u.userId, p.termId, "SCHEDULE", "amend", b),
    );
  }
  @Get("defense-schedule/published")
  @RequirePermission("defense-schedule", "read")
  async published(
    @CurrentUser() u: CurrentUserPayload,
    @Param(new ZodValidationPipe(paramsSchema)) p: { termId: string },
  ) {
    return ApiResponse.ok(await this.service.published(u.userId, p.termId));
  }
}
