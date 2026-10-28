import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UseFilters,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import {
  DossierFinalizeSchema,
  DossierReceiptSchema,
  DossierPdfGenerateSchema,
  DossierPdfQuerySchema,
  ProposalPreviewPdfQuerySchema,
} from "@doan/shared";
import type { DossierFinalize, DossierReceiptInput } from "@doan/shared";
import { RequirePermission } from "../../common/security/require-permission.decorator";
import { ReviewGroupPipe } from "../review-groups/review-group.dto";
import {
  ReviewGroupExceptionFilter,
  groupError,
} from "../review-groups/review-group.errors";
import { DossierService } from "./dossier.service";
import type { Response } from "express";
type Request = { user: { sub?: string; userId?: string } };
const success = (data: unknown) => ({
  success: true,
  data,
  timestamp: new Date().toISOString(),
});
@ApiTags("proposal-dossiers")
@ApiBearerAuth()
@ApiResponse({
  status: 409,
  description:
    "STATE_TRANSITION_INVALID / STUDENT_PROFILE_NOT_READY / STALE_VERSION / REVISION_CONFLICT / DOSSIER_LOCKED / PDF_NOT_GENERATED",
})
@UseFilters(ReviewGroupExceptionFilter)
@Controller("proposals/:proposalId")
export class DossierController {
  constructor(private readonly service: DossierService) {}
  private user(req: Request) {
    const id = req.user?.sub ?? req.user?.userId;
    if (
      !id ||
      (req.user.sub && req.user.userId && req.user.sub !== req.user.userId)
    )
      groupError(401, "AUTH_003", "Không xác định được người dùng.");
    return id;
  }
  @Get("dossier")
  @RequirePermission("proposal", "read")
  @ApiOperation({
    summary:
      "Scoped current finalization, print preview, receipt and audit history",
  })
  detail(@Req() req: Request, @Param("proposalId") id: string) {
    return this.service.detail(this.user(req), id).then(success);
  }
  @Get("preview.pdf")
  @Header("Cache-Control", "private, no-store")
  @Header("X-Content-Type-Options", "nosniff")
  @RequirePermission("proposal", "read")
  @ApiProduces("application/pdf")
  @ApiOperation({
    summary:
      "Watermarked preview of a visible proposal version; never finalizes or stores a PDF",
  })
  async preview(
    @Req() req: Request,
    @Param("proposalId") id: string,
    @Query(new ReviewGroupPipe(ProposalPreviewPdfQuerySchema))
    q: { versionId: string },
  ) {
    const file = await this.service.preview(this.user(req), id, q.versionId);
    return new StreamableFile(file.bytes, {
      type: "application/pdf",
      disposition: `attachment; filename="${file.filename}"`,
      length: file.bytes.length,
    });
  }
  @Post("finalize")
  @RequirePermission("proposal", "finalize")
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiBody({
    schema: {
      type: "object",
      additionalProperties: false,
      required: [
        "expectedProposalRevision",
        "expectedDossierRevision",
        "approvedVersionId",
      ],
      properties: {
        expectedProposalRevision: { type: "integer", minimum: 0 },
        expectedDossierRevision: { type: "integer", minimum: 0 },
        approvedVersionId: { type: "string" },
        templateVersion: {
          type: "string",
          enum: ["project1-docx-individual-v1"],
        },
      },
    },
  })
  finalize(
    @Req() req: Request,
    @Param("proposalId") id: string,
    @Body(new ReviewGroupPipe(DossierFinalizeSchema)) input: DossierFinalize,
    @Headers("idempotency-key") key: string,
  ) {
    return this.service.finalize(this.user(req), id, input, key).then(success);
  }
  @Post("dossier/receipt")
  @RequirePermission("dossier", "receive")
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiBody({
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["expectedRevision", "finalizationId"],
      properties: {
        expectedRevision: { type: "integer", minimum: 0 },
        finalizationId: { type: "string" },
        note: { type: "string", maxLength: 2000 },
      },
    },
  })
  receive(
    @Req() req: Request,
    @Param("proposalId") id: string,
    @Body(new ReviewGroupPipe(DossierReceiptSchema)) input: DossierReceiptInput,
    @Headers("idempotency-key") key: string,
  ) {
    return this.service.receive(this.user(req), id, input, key).then(success);
  }
  @Post("dossier/pdf")
  @HttpCode(200)
  @RequirePermission("proposal", "export")
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiOperation({
    summary:
      "Generate and store private PDF from immutable finalization; does not record physical receipt",
  })
  @ApiBody({
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["expectedRevision", "finalizationId"],
      properties: {
        expectedRevision: { type: "integer", minimum: 0 },
        finalizationId: { type: "string" },
      },
    },
  })
  generate(
    @Req() req: Request,
    @Param("proposalId") id: string,
    @Body(new ReviewGroupPipe(DossierPdfGenerateSchema))
    input: { expectedRevision: number; finalizationId: string },
    @Headers("idempotency-key") key: string,
  ) {
    return this.service.generate(this.user(req), id, input, key).then(success);
  }
  @Get("dossier.pdf")
  @Header("Cache-Control", "private, no-store")
  @Header("X-Content-Type-Options", "nosniff")
  @RequirePermission("proposal", "export")
  @ApiProduces("application/pdf")
  @ApiOperation({
    summary:
      "Download current or explicitly selected historical finalization within academic scope",
  })
  async download(
    @Req() req: Request,
    @Param("proposalId") id: string,
    @Query(new ReviewGroupPipe(DossierPdfQuerySchema))
    q: { finalizationId?: string },
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.service.download(
      this.user(req),
      id,
      q.finalizationId,
    );
    response.setHeader("X-Dossier-Status", file.state);
    const result = new StreamableFile(file.bytes, {
      type: "application/pdf",
      disposition: `attachment; filename="${file.filename}"`,
      length: file.bytes.length,
    });
    return result;
  }
}
