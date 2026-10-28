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
  FinalReportWindowParams,
  FinalReportWindowPut,
  finalReportWindowParamsSchema,
  finalReportWindowPutSchema,
} from "./final-report-window.dto";
import { FinalReportWindowService } from "./final-report-window.service";

@ApiTags("final-report-submission-window")
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
@Controller("terms/:termId/final-report-submission-window")
export class FinalReportWindowController {
  constructor(private readonly service: FinalReportWindowService) {}

  @Get()
  @RequirePermission("term", "read")
  @ApiOperation({
    summary: "Read scoped PDF submission window; configured=false when absent",
  })
  async get(
    @Param(new ZodValidationPipe(finalReportWindowParamsSchema))
    params: FinalReportWindowParams,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return Envelope.ok(await this.service.get(user.userId, params.termId));
  }

  @Put()
  @RequirePermission("term", "plan")
  @ApiOperation({
    summary:
      "Create/update scoped window; expectedRevision=0 for first creation; no phase/UC17 changes",
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
    @Param(new ZodValidationPipe(finalReportWindowParamsSchema))
    params: FinalReportWindowParams,
    @Body(new ZodValidationPipe(finalReportWindowPutSchema))
    input: FinalReportWindowPut,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return Envelope.ok(
      await this.service.put(user.userId, params.termId, input),
    );
  }
}
