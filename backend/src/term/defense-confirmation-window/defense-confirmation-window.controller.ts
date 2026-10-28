import { Body, Controller, Get, Param, Put } from "@nestjs/common";
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
  DefenseConfirmationWindowParams,
  DefenseConfirmationWindowPut,
  defenseConfirmationWindowParamsSchema,
  defenseConfirmationWindowPutSchema,
} from "./defense-confirmation-window.dto";
import { DefenseConfirmationWindowService } from "./defense-confirmation-window.service";

@ApiTags("defense-confirmation-window")
@ApiBearerAuth()
@ApiResponse({
  status: 403,
  description: "Requires explicit permission and full-term academic grant",
})
@ApiResponse({
  status: 409,
  description: "REVISION_CONFLICT or locked/completed/cancelled term",
})
@ApiResponse({
  status: 422,
  description: "Window must be ordered and contained within the term",
})
@Controller("terms/:termId/defense-confirmation-window")
export class DefenseConfirmationWindowController {
  constructor(private readonly service: DefenseConfirmationWindowService) {}

  @Get()
  @RequirePermission("term", "read")
  @ApiOperation({
    summary:
      "Read scoped UC17 confirmation window; configured=false when absent",
  })
  async get(
    @Param(new ZodValidationPipe(defenseConfirmationWindowParamsSchema))
    params: DefenseConfirmationWindowParams,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return Envelope.ok(await this.service.get(user.userId, params.termId));
  }

  @Put()
  @RequirePermission("term", "plan")
  @ApiOperation({
    summary:
      "Create/update scoped window; expectedRevision=0 for first creation; independent from PDF/FINAL; no advisor decisions",
  })
  @ApiBody({
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["opensAt", "closesAt", "locked", "expectedRevision"],
      properties: {
        opensAt: { type: "string", format: "date-time" },
        closesAt: { type: "string", format: "date-time" },
        locked: { type: "boolean" },
        expectedRevision: { type: "integer", minimum: 0, maximum: 2147483646 },
      },
    },
  })
  async put(
    @Param(new ZodValidationPipe(defenseConfirmationWindowParamsSchema))
    params: DefenseConfirmationWindowParams,
    @Body(new ZodValidationPipe(defenseConfirmationWindowPutSchema))
    input: DefenseConfirmationWindowPut,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return Envelope.ok(
      await this.service.put(user.userId, params.termId, input),
    );
  }
}
