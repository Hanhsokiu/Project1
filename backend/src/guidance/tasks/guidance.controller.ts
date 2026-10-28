import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseFilters,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import {
  GuidancePlanCreateSchema,
  GuidancePlanUpdateSchema,
  GuidancePlanResumeSchema,
  GuidanceTaskCreateSchema,
  GuidanceTaskUpdateSchema,
  GuidanceTaskCancelSchema,
  GuidanceTaskProgressSchema,
  GuidanceTaskQuerySchema,
  WeeklyCoverageQuerySchema,
  WeeklyTaskEnsureSchema,
} from "@doan/shared";
import type {
  GuidancePlanCreate,
  GuidancePlanUpdate,
  GuidancePlanResume,
  GuidanceTaskCreate,
  GuidanceTaskUpdate,
  GuidanceTaskCancel,
  GuidanceTaskProgress,
  GuidanceTaskQuery,
} from "@doan/shared";
import { RequirePermission } from "../../common/security/require-permission.decorator";
import { ReviewGroupPipe } from "../../topic/review-groups/review-group.dto";
import {
  ReviewGroupExceptionFilter,
  groupError,
} from "../../topic/review-groups/review-group.errors";
import { GuidanceService } from "./guidance.service";
type Request = { user: { sub?: string; userId?: string } };
const success = (data: unknown) => ({
  success: true,
  data,
  timestamp: new Date().toISOString(),
});
@ApiTags("guidance-plans-tasks")
@ApiBearerAuth()
@ApiResponse({
  status: 409,
  description:
    "TERM_003 / DOSSIER_NOT_FINALIZED / PLAN_PAUSED / REBASE_REQUIRED / REVISION_CONFLICT / DEADLINE_OUTSIDE_PHASE / PERIOD_INVALID / REPORTING_SCOPE_NOT_CONFIGURED",
})
@UseFilters(ReviewGroupExceptionFilter)
@Controller()
export class GuidanceController {
  constructor(private readonly service: GuidanceService) {}
  private user(req: Request) {
    const id = req.user?.sub ?? req.user?.userId;
    if (
      !id ||
      (req.user.sub && req.user.userId && req.user.sub !== req.user.userId)
    )
      groupError(401, "AUTH_003", "Không xác định được tài khoản.");
    return id;
  }
  @Get("proposals/:proposalId/guidance-context")
  @RequirePermission("guidance", "read")
  @ApiOperation({
    summary:
      "Scoped plan creation readiness, finalization, configured phase and periods; never creates data",
  })
  context(@Req() r: Request, @Param("proposalId") id: string) {
    return this.service.context(this.user(r), id).then(success);
  }
  @Get("proposals/:proposalId/guidance-plan")
  @RequirePermission("guidance", "read")
  plan(@Req() r: Request, @Param("proposalId") id: string) {
    return this.service.planByProposal(this.user(r), id).then(success);
  }
  @Post("proposals/:proposalId/guidance-plan")
  @RequirePermission("guidance", "manage")
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiBody({
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["finalizationId", "expectedDossierRevision"],
      properties: {
        finalizationId: { type: "string" },
        expectedDossierRevision: { type: "integer", minimum: 0 },
        description: { type: "string", maxLength: 20000 },
      },
    },
  })
  createPlan(
    @Req() r: Request,
    @Param("proposalId") id: string,
    @Body(new ReviewGroupPipe(GuidancePlanCreateSchema))
    body: GuidancePlanCreate,
    @Headers("idempotency-key") key: string,
  ) {
    return this.service.createPlan(this.user(r), id, body, key).then(success);
  }
  @Patch("guidance-plans/:planId")
  @RequirePermission("guidance", "manage")
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiBody({
    schema: {
      type: "object",
      required: ["expectedRevision", "description", "reason"],
      properties: {
        expectedRevision: { type: "integer", minimum: 0 },
        description: { type: "string" },
        reason: { type: "string" },
      },
    },
  })
  updatePlan(
    @Req() r: Request,
    @Param("planId") id: string,
    @Body(new ReviewGroupPipe(GuidancePlanUpdateSchema))
    body: GuidancePlanUpdate,
    @Headers("idempotency-key") key: string,
  ) {
    return this.service.updatePlan(this.user(r), id, body, key).then(success);
  }
  @Post("guidance-plans/:planId/resume")
  @HttpCode(200)
  @RequirePermission("guidance", "manage")
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiBody({
    schema: {
      type: "object",
      required: [
        "expectedRevision",
        "finalizationId",
        "expectedDossierRevision",
        "acknowledgeRebase",
      ],
      properties: {
        expectedRevision: { type: "integer" },
        finalizationId: { type: "string" },
        expectedDossierRevision: { type: "integer" },
        acknowledgeRebase: { type: "boolean", enum: [true] },
      },
    },
  })
  resume(
    @Req() r: Request,
    @Param("planId") id: string,
    @Body(new ReviewGroupPipe(GuidancePlanResumeSchema))
    body: GuidancePlanResume,
    @Headers("idempotency-key") key: string,
  ) {
    return this.service.resume(this.user(r), id, body, key).then(success);
  }
  @Get("guidance-plans/:planId/tasks")
  @RequirePermission("guidance", "read")
  @ApiOperation({
    summary:
      "Paginated tasks; periodId, canonical status, isOverdue and search filters",
  })
  tasks(
    @Req() r: Request,
    @Param("planId") id: string,
    @Query(new ReviewGroupPipe(GuidanceTaskQuerySchema)) q: GuidanceTaskQuery,
  ) {
    return this.service.tasks(this.user(r), q, { planId: id }).then(success);
  }
  @Get("terms/:termId/guidance-tasks")
  @RequirePermission("guidance", "read")
  @ApiOperation({
    summary:
      "Faculty term/department summary; student/advisor scope is intersected with every filter",
  })
  termTasks(
    @Req() r: Request,
    @Param("termId") id: string,
    @Query(new ReviewGroupPipe(GuidanceTaskQuerySchema)) q: GuidanceTaskQuery,
  ) {
    return this.service.tasks(this.user(r), q, { termId: id }).then(success);
  }
  @Get("terms/:termId/guidance-periods")
  @RequirePermission("guidance", "read")
  periods(@Req() r: Request, @Param("termId") id: string) {
    return this.service.periodOptions(this.user(r), id).then(success);
  }
  @Get("terms/:termId/weekly-report-coverage")
  @RequirePermission("guidance", "read")
  @ApiOperation({
    summary:
      "Configured weekly obligations even without plan/task; does not mark completion or create rows",
  })
  coverage(
    @Req() r: Request,
    @Param("termId") id: string,
    @Query(new ReviewGroupPipe(WeeklyCoverageQuerySchema)) q: GuidanceTaskQuery,
  ) {
    return this.service.coverage(this.user(r), id, q).then(success);
  }
  @Post("weekly-report-obligations/:id/task")
  @RequirePermission("task", "ensure-weekly")
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiBody({
    schema: {
      type: "object",
      required: ["expectedObligationRevision", "expectedPlanRevision"],
      properties: {
        expectedObligationRevision: { type: "integer" },
        expectedPlanRevision: { type: "integer" },
      },
    },
  })
  ensure(
    @Req() r: Request,
    @Param("id") id: string,
    @Body(new ReviewGroupPipe(WeeklyTaskEnsureSchema))
    body: { expectedObligationRevision: number; expectedPlanRevision: number },
    @Headers("idempotency-key") key: string,
  ) {
    return this.service.ensureWeekly(this.user(r), id, body, key).then(success);
  }
  @Post("guidance-plans/:planId/tasks")
  @RequirePermission("task", "manage")
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiBody({
    schema: {
      type: "object",
      additionalProperties: false,
      required: [
        "expectedPlanRevision",
        "title",
        "expectedDeliverables",
        "periodId",
        "startDate",
        "dueDate",
      ],
      properties: {
        expectedPlanRevision: { type: "integer", minimum: 0 },
        title: { type: "string", maxLength: 255 },
        description: { type: "string", maxLength: 20000 },
        expectedDeliverables: { type: "string", maxLength: 20000 },
        periodId: { type: "string" },
        startDate: { type: "string", format: "date-time" },
        dueDate: { type: "string", format: "date-time" },
      },
    },
  })
  createTask(
    @Req() r: Request,
    @Param("planId") id: string,
    @Body(new ReviewGroupPipe(GuidanceTaskCreateSchema))
    body: GuidanceTaskCreate,
    @Headers("idempotency-key") key: string,
  ) {
    return this.service.createTask(this.user(r), id, body, key).then(success);
  }
  @Get("tasks/:id")
  @RequirePermission("guidance", "read")
  detail(@Req() r: Request, @Param("id") id: string) {
    return this.service.detailTask(this.user(r), id).then(success);
  }
  @Patch("tasks/:id")
  @RequirePermission("task", "manage")
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiBody({
    schema: {
      type: "object",
      required: ["expectedRevision", "reason"],
      properties: {
        expectedRevision: { type: "integer" },
        reason: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        expectedDeliverables: { type: "string" },
        startDate: { type: "string", format: "date-time" },
        dueDate: { type: "string", format: "date-time" },
        acknowledgeExistingSubmissions: { type: "boolean" },
      },
    },
  })
  updateTask(
    @Req() r: Request,
    @Param("id") id: string,
    @Body(new ReviewGroupPipe(GuidanceTaskUpdateSchema))
    body: GuidanceTaskUpdate,
    @Headers("idempotency-key") key: string,
  ) {
    return this.service.updateTask(this.user(r), id, body, key).then(success);
  }
  @Post("tasks/:id/progress")
  @HttpCode(200)
  @RequirePermission("task", "progress")
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiBody({
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["expectedRevision", "note"],
      properties: {
        expectedRevision: { type: "integer" },
        note: { type: "string", minLength: 1, maxLength: 20000 },
      },
    },
  })
  progress(
    @Req() r: Request,
    @Param("id") id: string,
    @Body(new ReviewGroupPipe(GuidanceTaskProgressSchema))
    body: GuidanceTaskProgress,
    @Headers("idempotency-key") key: string,
  ) {
    return this.service.progressTask(this.user(r), id, body, key).then(success);
  }
  @Post("tasks/:id/cancel")
  @HttpCode(200)
  @RequirePermission("task", "manage")
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiBody({
    schema: {
      type: "object",
      required: ["expectedRevision", "reason"],
      properties: {
        expectedRevision: { type: "integer" },
        reason: { type: "string" },
        acknowledgeExistingSubmissions: { type: "boolean" },
      },
    },
  })
  cancel(
    @Req() r: Request,
    @Param("id") id: string,
    @Body(new ReviewGroupPipe(GuidanceTaskCancelSchema))
    body: GuidanceTaskCancel,
    @Headers("idempotency-key") key: string,
  ) {
    return this.service.cancelTask(this.user(r), id, body, key).then(success);
  }
}
