import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { ApiResponse as Envelope } from "../../common/dto/api-response.dto";
import {
  CurrentUser,
  CurrentUserPayload,
} from "../../common/security/current-user.decorator";
import { RequirePermission } from "../../common/security/require-permission.decorator";
import { ZodValidationPipe } from "../../common/validation/zod.pipe";
import {
  defenseListCreateSchema,
  defenseListOpenSchema,
  defenseListParamsSchema,
  type DefenseListOpen,
  type DefenseListParams,
} from "./defense-list.dto";
import { DefenseListService } from "./defense-list.service";

@ApiTags("defense-list")
@ApiBearerAuth()
@ApiResponse({
  status: 403,
  description: "Requires explicit permission and matching academic term grant",
})
@ApiResponse({
  status: 409,
  description: "Duplicate list, revision/state conflict or immutable term",
})
@ApiResponse({
  status: 503,
  description: "UC18 database source unavailable; no implicit OPEN",
})
@Controller("terms/:termId/defense-list")
export class DefenseListController {
  constructor(
    @Inject(DefenseListService) private readonly service: DefenseListService,
  ) {}

  @Get()
  @RequirePermission("defense-list", "read")
  @ApiOperation({
    summary:
      "Read UC18 metadata and verified state without exposing roster or snapshot",
  })
  async get(
    @Param(new ZodValidationPipe(defenseListParamsSchema))
    params: DefenseListParams,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return Envelope.ok(await this.service.get(user.userId, params.termId));
  }

  @Post()
  @RequirePermission("defense-list", "manage")
  @ApiOperation({
    summary:
      "Create DRAFT only; full-term grant required; duplicate returns 409",
  })
  @ApiBody({
    required: false,
    schema: { type: "object", additionalProperties: false },
  })
  async create(
    @Param(new ZodValidationPipe(defenseListParamsSchema))
    params: DefenseListParams,
    @Body(new ZodValidationPipe(defenseListCreateSchema))
    _input: Record<string, never>,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return Envelope.ok(await this.service.create(user.userId, params.termId));
  }

  @Post("open")
  @HttpCode(200)
  @RequirePermission("defense-list", "manage")
  @ApiOperation({
    summary:
      "DRAFT to OPEN only; no PDF/UC17 prerequisites; no finalization or reopen",
  })
  @ApiBody({
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["expectedRevision"],
      properties: {
        expectedRevision: { type: "integer", minimum: 0, maximum: 2147483646 },
      },
    },
  })
  async open(
    @Param(new ZodValidationPipe(defenseListParamsSchema))
    params: DefenseListParams,
    @Body(new ZodValidationPipe(defenseListOpenSchema)) input: DefenseListOpen,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return Envelope.ok(
      await this.service.open(user.userId, params.termId, input),
    );
  }
}
