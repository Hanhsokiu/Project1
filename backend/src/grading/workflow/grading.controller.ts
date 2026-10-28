import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  Post,
  Put,
  Query,
  Res,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { z } from "zod";
import {
  gradingHistoryQuerySchema,
  gradingKindSchema,
  gradingParamsSchema,
  gradingPdfIdentitySchema,
  gradingPolicyInputSchema,
  gradingSaveSchema,
  workflowCommandSchema,
  type GradingCommand,
  type GradingKind,
  type GradingPolicyInput,
  type GradingSave,
} from "@doan/shared";
import { ApiResponse } from "../../common/dto/api-response.dto";
import {
  CurrentUser,
  type CurrentUserPayload,
} from "../../common/security/current-user.decorator";
import { RequirePermission } from "../../common/security/require-permission.decorator";
import { ZodValidationPipe } from "../../common/validation/zod.pipe";
import { GradingService } from "./grading.service";
const term = z.object({ termId: z.string().trim().min(1).max(36) }).strict(),
  proposal = term
    .extend({ proposalId: z.string().trim().min(1).max(36) })
    .strict(),
  inboxQuery = z.object({ kind: gradingKindSchema }).strict();
type Params = z.infer<typeof gradingParamsSchema>;
type History = z.infer<typeof gradingHistoryQuerySchema>;
@ApiBearerAuth()
@ApiTags("official-grading")
@Controller("terms/:termId")
export class GradingController {
  constructor(
    @Inject(GradingService) private readonly service: GradingService,
  ) {}
  @Get("grading/inbox")
  @Header("Cache-Control", "private, no-store")
  @RequirePermission("grading", "read")
  async inbox(
    @CurrentUser() u: CurrentUserPayload,
    @Param(new ZodValidationPipe(term)) p: { termId: string },
    @Query(new ZodValidationPipe(inboxQuery)) q: { kind: GradingKind },
  ) {
    return ApiResponse.ok(await this.service.inbox(u.userId, p.termId, q.kind));
  }
  @Get("grading/policy")
  @Header("Cache-Control", "private, no-store")
  @RequirePermission("grading", "configure")
  async policy(
    @CurrentUser() u: CurrentUserPayload,
    @Param(new ZodValidationPipe(term)) p: { termId: string },
  ) {
    return ApiResponse.ok(await this.service.policy(u.userId, p.termId));
  }
  @Get("grading/policy/history")
  @Header("Cache-Control", "private, no-store")
  @RequirePermission("grading", "configure")
  async policyHistory(
    @CurrentUser() u: CurrentUserPayload,
    @Param(new ZodValidationPipe(term)) p: { termId: string },
    @Query(new ZodValidationPipe(gradingHistoryQuerySchema)) q: History,
  ) {
    return ApiResponse.ok(
      await this.service.policyHistory(
        u.userId,
        p.termId,
        q.afterRevision,
        q.limit,
      ),
    );
  }
  @Put("grading/policy")
  @RequirePermission("grading", "configure")
  async configure(
    @CurrentUser() u: CurrentUserPayload,
    @Param(new ZodValidationPipe(term)) p: { termId: string },
    @Body(new ZodValidationPipe(gradingPolicyInputSchema))
    b: GradingPolicyInput,
  ) {
    return ApiResponse.ok(await this.service.configure(u.userId, p.termId, b));
  }
  @Get("grading/proposals/:proposalId/:kind")
  @Header("Cache-Control", "private, no-store")
  @RequirePermission("grading", "read")
  async context(
    @CurrentUser() u: CurrentUserPayload,
    @Param(new ZodValidationPipe(gradingParamsSchema)) p: Params,
  ) {
    return ApiResponse.ok(
      await this.service.context(u.userId, p.termId, p.proposalId, p.kind),
    );
  }
  @Put("grading/proposals/:proposalId/:kind/draft")
  @RequirePermission("grading", "write")
  async save(
    @CurrentUser() u: CurrentUserPayload,
    @Param(new ZodValidationPipe(gradingParamsSchema)) p: Params,
    @Body(new ZodValidationPipe(gradingSaveSchema)) b: GradingSave,
  ) {
    return ApiResponse.ok(
      await this.service.save(
        u.userId,
        p.termId,
        p.proposalId,
        p.kind,
        b,
        false,
      ),
    );
  }
  @Post("grading/proposals/:proposalId/:kind/seal")
  @RequirePermission("grading", "seal")
  async seal(
    @CurrentUser() u: CurrentUserPayload,
    @Param(new ZodValidationPipe(gradingParamsSchema)) p: Params,
    @Body(new ZodValidationPipe(workflowCommandSchema)) b: GradingCommand,
  ) {
    return ApiResponse.ok(
      await this.service.save(
        u.userId,
        p.termId,
        p.proposalId,
        p.kind,
        b,
        true,
      ),
    );
  }
  @Get("grading/proposals/:proposalId/:kind/history")
  @Header("Cache-Control", "private, no-store")
  @RequirePermission("grading", "read")
  async history(
    @CurrentUser() u: CurrentUserPayload,
    @Param(new ZodValidationPipe(gradingParamsSchema)) p: Params,
    @Query(new ZodValidationPipe(gradingHistoryQuerySchema)) q: History,
  ) {
    return ApiResponse.ok(
      await this.service.history(
        u.userId,
        p.termId,
        p.proposalId,
        p.kind,
        q.afterRevision,
        q.limit,
      ),
    );
  }
  @Get("grading/proposals/:proposalId/:kind/report")
  @RequirePermission("grading", "read")
  async pdf(
    @CurrentUser() u: CurrentUserPayload,
    @Param(new ZodValidationPipe(gradingParamsSchema)) p: Params,
    @Query(new ZodValidationPipe(gradingPdfIdentitySchema))
    q: z.infer<typeof gradingPdfIdentitySchema>,
    @Res() response: Response,
  ) {
    const file = await this.service.download(
      u.userId,
      p.termId,
      p.proposalId,
      p.kind,
      q,
    );
    response.set({
      "Content-Type": "application/pdf",
      "Content-Length": String(file.bytes.length),
      "Content-Disposition": `attachment; filename="final-report.pdf"; filename*=UTF-8''${encodeURIComponent(file.name).replace(/['()*]/g, (c) => "%" + c.charCodeAt(0).toString(16))}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    });
    response.send(file.bytes);
  }
  @Get("grading/results/preview")
  @Header("Cache-Control", "private, no-store")
  @RequirePermission("grading", "read-results")
  async preview(
    @CurrentUser() u: CurrentUserPayload,
    @Param(new ZodValidationPipe(term)) p: { termId: string },
  ) {
    return ApiResponse.ok(await this.service.preview(u.userId, p.termId));
  }
  @Get("grading/my-results")
  @Header("Cache-Control", "private, no-store")
  @RequirePermission("grading", "read-published")
  async myResults(
    @CurrentUser() u: CurrentUserPayload,
    @Param(new ZodValidationPipe(term)) p: { termId: string },
  ) {
    return ApiResponse.ok(await this.service.myResults(u.userId, p.termId));
  }
  @Post("grading/results/:proposalId/seal")
  @RequirePermission("grading", "seal-results")
  async sealResult(
    @CurrentUser() u: CurrentUserPayload,
    @Param(new ZodValidationPipe(proposal))
    p: { termId: string; proposalId: string },
    @Body(new ZodValidationPipe(workflowCommandSchema)) b: GradingCommand,
  ) {
    return ApiResponse.ok(
      await this.service.resultCommand(
        u.userId,
        p.termId,
        p.proposalId,
        b,
        false,
      ),
    );
  }
  @Post("grading/results/:proposalId/publish")
  @RequirePermission("grading", "publish")
  async publish(
    @CurrentUser() u: CurrentUserPayload,
    @Param(new ZodValidationPipe(proposal))
    p: { termId: string; proposalId: string },
    @Body(new ZodValidationPipe(workflowCommandSchema)) b: GradingCommand,
  ) {
    return ApiResponse.ok(
      await this.service.resultCommand(
        u.userId,
        p.termId,
        p.proposalId,
        b,
        true,
      ),
    );
  }
  @Get("grading/results/:proposalId/history")
  @Header("Cache-Control", "private, no-store")
  @RequirePermission("grading", "read-results")
  async resultHistory(
    @CurrentUser() u: CurrentUserPayload,
    @Param(new ZodValidationPipe(proposal))
    p: { termId: string; proposalId: string },
    @Query(new ZodValidationPipe(gradingHistoryQuerySchema)) q: History,
  ) {
    return ApiResponse.ok(
      await this.service.resultHistory(
        u.userId,
        p.termId,
        p.proposalId,
        q.afterRevision,
        q.limit,
      ),
    );
  }
  @Get("grading/results/:proposalId")
  @Header("Cache-Control", "private, no-store")
  @RequirePermission("grading", "read-published")
  async published(
    @CurrentUser() u: CurrentUserPayload,
    @Param(new ZodValidationPipe(proposal))
    p: { termId: string; proposalId: string },
  ) {
    return ApiResponse.ok(
      await this.service.published(u.userId, p.termId, p.proposalId),
    );
  }
}
