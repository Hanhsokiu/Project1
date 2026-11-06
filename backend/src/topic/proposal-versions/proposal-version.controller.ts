import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseFilters,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  ProposalVersionSaveSchema,
  ProposalVersionSubmitSchema,
  VersionCompareSchema,
  VersionPageQuerySchema,
  ProposalWithdrawSchema,
  ProposalReturnToDraftSchema,
  ProposalReopenSchema,
} from '@doan/shared';
import type {
  ProposalVersionSave,
  ProposalVersionSubmit,
  VersionPageQuery,
  ProposalWithdraw,
  ProposalReturnToDraft,
  ProposalReopen,
} from '@doan/shared';
import { RequirePermission } from '../../common/security/require-permission.decorator';
import { ReviewGroupPipe } from '../review-groups/review-group.dto';
import {
  ReviewGroupExceptionFilter,
  groupError,
} from '../review-groups/review-group.errors';
import { ProposalVersionService } from './proposal-version.service';
import { ProposalLifecycleService } from './proposal-lifecycle.service';
type PrincipalRequest = { user: { sub?: string; userId?: string } };
const success = (data: unknown) => ({
  success: true,
  data,
  timestamp: new Date().toISOString(),
});
@ApiTags('proposal-versions')
@ApiBearerAuth()
@ApiResponse({
  status: 400,
  description: 'COMMON_003 / PROPOSAL_CONTENT_INVALID / FEEDBACK_SCOPE_INVALID',
})
@ApiResponse({ status: 401, description: 'AUTH_003' })
@ApiResponse({ status: 403, description: 'AUTH_002 / AUTH_004' })
@ApiResponse({
  status: 404,
  description: 'COMMON_001: missing or outside owner/advisor/academic scope',
})
@ApiResponse({
  status: 409,
  description:
    'INPUT_NOT_READY / TERM_003 / DOSSIER_LOCKED / STATE_TRANSITION_INVALID / ACTIVE_REVIEW_EXISTS / REVISION_CONFLICT / STALE_VERSION / TOPIC_NOT_AGREED / IDEMPOTENCY_CONFLICT',
})
@UseFilters(ReviewGroupExceptionFilter)
@Controller('proposals/:proposalId')
export class ProposalVersionController {
  constructor(
    private readonly service: ProposalVersionService,
    private readonly lifecycle: ProposalLifecycleService,
  ) {}
  private user(req: PrincipalRequest) {
    const id = req.user?.sub ?? req.user?.userId;
    if (
      !id ||
      (req.user.sub && req.user.userId && req.user.sub !== req.user.userId)
    )
      groupError(401, 'AUTH_003', 'Không xác định được người dùng.');
    return id;
  }
  @Get('editing-context')
  @RequirePermission('proposal', 'read')
  @ApiOperation({
    summary:
      'Working/submitted snapshots, revision feedback and current allowed actions; scope before content',
  })
  context(@Req() req: PrincipalRequest, @Param('proposalId') id: string) {
    return this.service.context(this.user(req), id).then(success);
  }
  @Get('versions')
  @RequirePermission('proposal', 'read')
  @ApiOperation({
    summary:
      'Version history: page/limit; reviewer sees only assigned SEALED versions',
  })
  list(
    @Req() req: PrincipalRequest,
    @Param('proposalId') id: string,
    @Query(new ReviewGroupPipe(VersionPageQuerySchema)) q: VersionPageQuery,
  ) {
    return this.service.list(this.user(req), id, q).then(success);
  }
  @Get('versions/compare')
  @RequirePermission('proposal', 'read')
  @ApiOperation({
    summary:
      'Actual JSON field differences after checking access to both versions',
  })
  compare(
    @Req() req: PrincipalRequest,
    @Param('proposalId') id: string,
    @Query(new ReviewGroupPipe(VersionCompareSchema))
    q: { fromVersionId: string; toVersionId: string },
  ) {
    return this.service
      .compare(this.user(req), id, q.fromVersionId, q.toVersionId)
      .then(success);
  }
  @Get('versions/:versionId')
  @RequirePermission('proposal', 'read')
  detail(
    @Req() req: PrincipalRequest,
    @Param('proposalId') id: string,
    @Param('versionId') versionId: string,
  ) {
    return this.service.detail(this.user(req), id, versionId).then(success);
  }
  @Post('versions')
  @RequirePermission('proposal', 'edit')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['expectedRevision', 'content'],
      properties: {
        expectedRevision: { type: 'integer', minimum: 0 },
        basedOnVersionId: { type: 'string' },
        changeSummary: { type: 'string', maxLength: 2000 },
        content: {
          type: 'object',
          description:
            'ProposalContentV1: objectives,scope,mainContents,tools,expectedResults,startsAt,endsAt,schedule[]; draft accepts empty strings',
        },
        responses: {
          type: 'array',
          items: {
            type: 'object',
            required: ['targetType', 'targetId', 'text'],
            properties: {
              targetType: { type: 'string', enum: ['COMMENT', 'DECISION'] },
              targetId: { type: 'string' },
              text: { type: 'string' },
            },
          },
        },
      },
    },
  })
  save(
    @Req() req: PrincipalRequest,
    @Param('proposalId') id: string,
    @Body(new ReviewGroupPipe(ProposalVersionSaveSchema))
    body: ProposalVersionSave,
    @Headers('idempotency-key') key: string,
  ) {
    return this.service.save(this.user(req), id, body, key).then(success);
  }
  @Post('submit')
  @HttpCode(200)
  @RequirePermission('proposal', 'submit')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['expectedRevision', 'versionId'],
      properties: {
        expectedRevision: { type: 'integer', minimum: 0 },
        versionId: { type: 'string' },
      },
    },
  })
  submit(
    @Req() req: PrincipalRequest,
    @Param('proposalId') id: string,
    @Body(new ReviewGroupPipe(ProposalVersionSubmitSchema))
    body: ProposalVersionSubmit,
    @Headers('idempotency-key') key: string,
  ) {
    return this.service.submit(this.user(req), id, body, key).then(success);
  }
  @Post('withdraw')
  @HttpCode(200)
  @RequirePermission('proposal', 'submit')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    summary:
      'Owner withdraws SUBMITTED proposal; preserves SEALED source and supersedes assigned review',
  })
  withdraw(
    @Req() req: PrincipalRequest,
    @Param('proposalId') id: string,
    @Body(new ReviewGroupPipe(ProposalWithdrawSchema)) body: ProposalWithdraw,
    @Headers('idempotency-key') key: string,
  ) {
    return this.lifecycle
      .transition(this.user(req), id, 'withdraw', body, key)
      .then(success);
  }
  @Post('return-to-draft')
  @HttpCode(200)
  @RequirePermission('proposal', 'assign')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    summary:
      'Scoped faculty returns UNDER_REVIEW proposal to draft with reason and review CAS',
  })
  returnToDraft(
    @Req() req: PrincipalRequest,
    @Param('proposalId') id: string,
    @Body(new ReviewGroupPipe(ProposalReturnToDraftSchema))
    body: ProposalReturnToDraft,
    @Headers('idempotency-key') key: string,
  ) {
    return this.lifecycle
      .transition(this.user(req), id, 'return-to-draft', body, key)
      .then(success);
  }
  @Post('reopen')
  @HttpCode(200)
  @RequirePermission('proposal', 'reopen')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    summary:
      'Scoped faculty reopens APPROVED proposal; supersedes finalization and pauses guidance atomically',
  })
  reopen(
    @Req() req: PrincipalRequest,
    @Param('proposalId') id: string,
    @Body(new ReviewGroupPipe(ProposalReopenSchema)) body: ProposalReopen,
    @Headers('idempotency-key') key: string,
  ) {
    return this.lifecycle
      .transition(this.user(req), id, 'reopen', body, key)
      .then(success);
  }
}
