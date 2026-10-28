import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { ApiResponse } from "../../common/dto/api-response.dto";
import {
  CurrentUser,
  CurrentUserPayload,
} from "../../common/security/current-user.decorator";
import { RequirePermission } from "../../common/security/require-permission.decorator";
import { ZodValidationPipe } from "../../common/validation/zod.pipe";
import {
  defenseConfirmationParamsSchema,
  defenseConfirmationHistoryQuerySchema,
  type DefenseConfirmationParams,
  type DefenseConfirmationHistoryQuery,
} from "./defense-confirmation.dto";
import { DefenseConfirmationReadService } from "./defense-confirmation-read.service";

@ApiTags("defense-confirmation")
@ApiBearerAuth()
@Controller("proposals/:proposalId")
export class DefenseConfirmationReadController {
  constructor(
    @Inject(DefenseConfirmationReadService)
    private readonly service: DefenseConfirmationReadService,
  ) {}
  @Get("defense-confirmation-context")
  @RequirePermission("defense-confirmation", "read")
  @ApiOperation({
    summary:
      "Current official advisor only; verified context and exact PUT expectations",
  })
  async context(
    @Param(new ZodValidationPipe(defenseConfirmationParamsSchema))
    params: DefenseConfirmationParams,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return ApiResponse.ok(
      await this.service.context(user.userId, params.proposalId),
    );
  }
  @Get("defense-confirmation")
  @RequirePermission("defense-confirmation", "read")
  @ApiOperation({
    summary:
      "Current decision only: current advisor, own student, or faculty with matching term/department grant",
  })
  async current(
    @Param(new ZodValidationPipe(defenseConfirmationParamsSchema))
    params: DefenseConfirmationParams,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return ApiResponse.ok(
      await this.service.current(user.userId, params.proposalId),
    );
  }
  @Get("defense-confirmation/history")
  @RequirePermission("defense-confirmation", "read")
  @ApiOperation({
    summary:
      "Current advisor/scoped faculty history; ascending revision cursor; no private PDF evidence",
  })
  @ApiQuery({ name: "afterRevision", required: false, type: Number })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Default 50, maximum 100",
  })
  async history(
    @Param(new ZodValidationPipe(defenseConfirmationParamsSchema))
    params: DefenseConfirmationParams,
    @Query(new ZodValidationPipe(defenseConfirmationHistoryQuerySchema))
    query: DefenseConfirmationHistoryQuery,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return ApiResponse.ok(
      await this.service.history(user.userId, params.proposalId, query),
    );
  }
}
