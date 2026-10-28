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
  AssignReviewSchema,
  ReviewQuerySchema,
  ReviewStartSchema,
  ReviewCommentSchema,
  ReviewDecisionSchema,
} from '@doan/shared';
import type {
  AssignReview,
  ReviewQuery,
  ReviewStart,
  ReviewCommentInput,
  ReviewDecisionInput,
} from '@doan/shared';
import { RequirePermission } from '../../common/security/require-permission.decorator';
import { ReviewGroupPipe } from '../review-groups/review-group.dto';
import {
  ReviewGroupExceptionFilter,
  groupError,
} from '../review-groups/review-group.errors';
import { ProposalReviewService } from './proposal-review.service';
type PrincipalRequest = { user: { sub?: string; userId?: string } };
const success = (data: unknown) => ({
  success: true,
  data,
  timestamp: new Date().toISOString(),
});
const revision = { type: 'integer' as const, minimum: 0 };
const revisions = {
  expectedProposalRevision: revision,
  expectedReviewRevision: revision,
};
@ApiTags('proposal-reviews')
@ApiBearerAuth()
@ApiResponse({ status: 400, description: 'COMMON_003: strict DTO validation' })
@ApiResponse({ status: 401, description: 'AUTH_003' })
@ApiResponse({ status: 403, description: 'AUTH_002 / AUTH_004' })
@ApiResponse({
  status: 404,
  description: 'COMMON_001: missing or outside term/department/group scope',
})
@ApiResponse({
  status: 409,
  description:
    'INPUT_NOT_READY / TERM_003 / TOPIC_NOT_AGREED / ROUTING_NOT_CONFIGURED / ROUTING_MISMATCH / MEMBER_INELIGIBLE / ACTIVE_REVIEW_EXISTS / STALE_VERSION / REVIEW_ALREADY_DECIDED / STATE_TRANSITION_INVALID / REVISION_CONFLICT / IDEMPOTENCY_CONFLICT',
})
@UseFilters(ReviewGroupExceptionFilter)
@Controller()
export class ProposalReviewController {
  constructor(private readonly service: ProposalReviewService) {}
  private user(req: PrincipalRequest) {
    const id = req.user?.sub ?? req.user?.userId;
    if (
      !id ||
      (req.user.sub && req.user.userId && req.user.sub !== req.user.userId)
    )
      groupError(401, 'AUTH_003', 'Không xác định được người dùng.');
    return id;
  }
  @Get('proposal-review-options/terms')
  @RequirePermission('proposal', 'read')
  terms(@Req() req: PrincipalRequest) {
    return this.service.terms(this.user(req)).then(success);
  }
  @Get('terms/:termId/proposal-review-options')
  @RequirePermission('proposal', 'read')
  options(@Req() req: PrincipalRequest, @Param('termId') termId: string) {
    return this.service.options(this.user(req), termId).then(success);
  }
  @Get('terms/:termId/proposals')
  @RequirePermission('proposal', 'read')
  @ApiOperation({
    summary:
      'Scoped faculty queue / reviewer inbox; page, limit, status, departmentId, groupId, search, unassigned',
  })
  list(
    @Req() req: PrincipalRequest,
    @Param('termId') termId: string,
    @Query(new ReviewGroupPipe(ReviewQuerySchema)) query: ReviewQuery,
  ) {
    return this.service.list(this.user(req), termId, query).then(success);
  }
  @Get('proposals/:id')
  @RequirePermission('proposal', 'read')
  @ApiOperation({
    summary:
      'Faculty/owner/current official advisor read submitted SEALED content; reviewers only if the current version is assigned to them',
  })
  proposal(@Req() req: PrincipalRequest, @Param('id') id: string) {
    return this.service.proposal(this.user(req), id).then(success);
  }
  @Get('proposals/:id/review-candidates')
  @RequirePermission('proposal', 'assign')
  @ApiOperation({
    summary:
      'Candidates in the routed department; specialty counts are advisory, never auto assign',
  })
  candidates(@Req() req: PrincipalRequest, @Param('id') id: string) {
    return this.service.candidates(this.user(req), id).then(success);
  }
  @Get('proposals/:id/review-history')
  @RequirePermission('proposal', 'read')
  history(@Req() req: PrincipalRequest, @Param('id') id: string) {
    return this.service.history(this.user(req), id).then(success);
  }
  @Get('proposal-reviews/:id')
  @RequirePermission('proposal', 'read')
  detail(@Req() req: PrincipalRequest, @Param('id') id: string) {
    return this.service.detail(this.user(req), id).then(success);
  }
  @Post('proposals/:id/review-assignments')
  @RequirePermission('proposal', 'assign')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['groupId', 'proposalVersionId', 'expectedProposalRevision'],
      properties: {
        groupId: { type: 'string' },
        proposalVersionId: { type: 'string' },
        ...revisions,
        replacesReviewId: { type: 'string' },
        reason: { type: 'string', minLength: 1 },
      },
    },
  })
  assign(
    @Req() req: PrincipalRequest,
    @Param('id') id: string,
    @Body(new ReviewGroupPipe(AssignReviewSchema)) body: AssignReview,
    @Headers('idempotency-key') key: string,
  ) {
    return this.service.assign(this.user(req), id, body, key).then(success);
  }
  @Post('proposal-reviews/:id/start')
  @HttpCode(200)
  @RequirePermission('proposal', 'review')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: false,
      required: Object.keys(revisions),
      properties: revisions,
    },
  })
  start(
    @Req() req: PrincipalRequest,
    @Param('id') id: string,
    @Body(new ReviewGroupPipe(ReviewStartSchema)) body: ReviewStart,
    @Headers('idempotency-key') key: string,
  ) {
    return this.service
      .reviewCommand(this.user(req), id, 'start', body, key)
      .then(success);
  }
  @Post('proposal-reviews/:id/comments')
  @RequirePermission('proposal', 'comment')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['expectedReviewRevision', 'versionId', 'text'],
      properties: {
        expectedReviewRevision: revision,
        versionId: { type: 'string' },
        text: { type: 'string', minLength: 1, maxLength: 10000 },
      },
    },
  })
  comment(
    @Req() req: PrincipalRequest,
    @Param('id') id: string,
    @Body(new ReviewGroupPipe(ReviewCommentSchema)) body: ReviewCommentInput,
    @Headers('idempotency-key') key: string,
  ) {
    return this.service
      .reviewCommand(this.user(req), id, 'comment', body, key)
      .then(success);
  }
  @Post('proposal-reviews/:id/decision')
  @HttpCode(200)
  @RequirePermission('proposal', 'review')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: false,
      required: [...Object.keys(revisions), 'versionId', 'decision'],
      properties: {
        ...revisions,
        versionId: { type: 'string' },
        decision: { type: 'string', enum: ['APPROVED', 'REVISION_REQUIRED'] },
        comment: {
          type: 'string',
          maxLength: 10000,
          description: 'Required for REVISION_REQUIRED',
        },
      },
    },
  })
  decision(
    @Req() req: PrincipalRequest,
    @Param('id') id: string,
    @Body(new ReviewGroupPipe(ReviewDecisionSchema)) body: ReviewDecisionInput,
    @Headers('idempotency-key') key: string,
  ) {
    return this.service
      .reviewCommand(this.user(req), id, 'decision', body, key)
      .then(success);
  }
}
