import { Body, Controller, Inject, Param, Put } from "@nestjs/common";
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
  defenseConfirmationParamsSchema,
  defenseConfirmationPutSchema,
  type DefenseConfirmationParams,
  type DefenseConfirmationPut,
} from "./defense-confirmation.dto";
import { DefenseConfirmationCommandService } from "./defense-confirmation-command.service";

@ApiTags("defense-confirmation")
@ApiBearerAuth()
@Controller("proposals/:proposalId/defense-confirmation")
export class DefenseConfirmationController {
  constructor(
    @Inject(DefenseConfirmationCommandService)
    private readonly service: DefenseConfirmationCommandService,
  ) {}
  @Put()
  @RequirePermission("defense-confirmation", "decide")
  @ApiOperation({
    summary:
      "Current official advisor records/revises UC17; UC18 must be OPEN; no eligibility update",
  })
  @ApiResponse({
    status: 409,
    description:
      "Stale revision/context, closed/locked window, UC18 UNKNOWN/FINALIZED, or invalid PDF",
  })
  @ApiBody({
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["status", "expectedRevision", "expectedContext"],
      properties: {
        status: { type: "string", enum: ["CONFIRMED", "REJECTED"] },
        note: {
          type: "string",
          nullable: true,
          maxLength: 10000,
          description: "Required and nonblank for REJECTED",
        },
        expectedRevision: { type: "integer", minimum: 0, maximum: 2147483646 },
        expectedContext: {
          type: "object",
          additionalProperties: false,
          required: ["revision", "assignment", "pdf"],
          properties: {
            revision: { type: "integer", minimum: 0 },
            assignment: {
              type: "object",
              additionalProperties: false,
              required: ["assignmentId", "revision"],
              properties: {
                assignmentId: { type: "string" },
                revision: { type: "integer", minimum: 0 },
              },
            },
            pdf: {
              type: "object",
              nullable: true,
              additionalProperties: false,
              required: ["finalReportId", "revision", "checksum"],
              properties: {
                finalReportId: { type: "string" },
                revision: { type: "integer", minimum: 0 },
                checksum: { type: "string", pattern: "^[0-9a-f]{64}$" },
              },
            },
          },
        },
        changeReason: {
          type: "string",
          minLength: 1,
          maxLength: 10000,
          description: "Required for actual changes to an existing decision",
        },
      },
    },
  })
  async put(
    @Param(new ZodValidationPipe(defenseConfirmationParamsSchema))
    params: DefenseConfirmationParams,
    @Body(new ZodValidationPipe(defenseConfirmationPutSchema))
    input: DefenseConfirmationPut,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return Envelope.ok(
      await this.service.put(user.userId, params.proposalId, input),
    );
  }
}
