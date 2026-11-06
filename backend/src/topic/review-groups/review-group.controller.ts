import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
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
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  GroupCreateSchema,
  GroupUpdateSchema,
  GroupMutationSchema,
  GroupMemberSchema,
  GroupQuerySchema,
} from '@doan/shared';
import type {
  GroupCreate,
  GroupUpdate,
  GroupMutation,
  GroupQuery,
} from '@doan/shared';
import { RequirePermission } from '../../common/security/require-permission.decorator';
import { ReviewGroupService } from './review-group.service';
import { ReviewGroupPipe } from './review-group.dto';
import { ReviewGroupExceptionFilter, groupError } from './review-group.errors';
import { ApiGroupResponse } from './review-group.response';

type PrincipalRequest = { user: { sub?: string; userId?: string } };
const mutationSchema = {
  type: 'object' as const,
  required: ['expectedRevision', 'reason'],
  additionalProperties: false,
  properties: {
    expectedRevision: { type: 'integer' as const, minimum: 0 },
    reason: { type: 'string' as const, minLength: 1 },
  },
};
const success = (data: unknown) => ({
  success: true,
  data,
  timestamp: new Date().toISOString(),
});

@ApiTags('review-groups')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'AUTH_003' })
@ApiResponse({ status: 403, description: 'AUTH_002 / AUTH_004' })
@ApiResponse({
  status: 404,
  description: 'COMMON_001: not found or outside scope',
})
@ApiResponse({
  status: 409,
  description:
    'REVISION_CONFLICT / IDEMPOTENCY_CONFLICT / ACTIVE_REVIEW_EXISTS / GROUP_IN_USE / TERM_003',
})
@UseFilters(ReviewGroupExceptionFilter)
@Controller()
export class ReviewGroupController {
  constructor(private readonly service: ReviewGroupService) {}
  private user(req: PrincipalRequest) {
    const id = req.user?.sub ?? req.user?.userId;
    if (
      !id ||
      (req.user.sub && req.user.userId && req.user.sub !== req.user.userId)
    )
      groupError(401, 'AUTH_003', 'Không xác định được người dùng.');
    return id;
  }
  @Get('review-group-options/terms')
  @RequirePermission('review-group', 'read')
  @ApiOperation({
    summary: 'Các đợt trong phạm vi nhóm duyệt của người đăng nhập',
  })
  async terms(@Req() req: PrincipalRequest) {
    return success(await this.service.terms(this.user(req)));
  }

  @Get('terms/:termId/review-group-options')
  @RequirePermission('review-group', 'read')
  @ApiOperation({
    summary:
      'Bộ môn được cấp và giảng viên hợp lệ trong roster; chỉ Khoa quản lý được chọn roster',
  })
  async options(
    @Req() req: PrincipalRequest,
    @Param('termId') termId: string,
    @Query(new ReviewGroupPipe(GroupQuerySchema)) query: GroupQuery,
  ) {
    return success(await this.service.options(this.user(req), termId, query));
  }

  @Get('terms/:termId/review-groups')
  @ApiGroupResponse(200, true)
  @RequirePermission('review-group', 'read')
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'departmentId', required: false, type: String })
  @ApiOperation({ summary: 'Danh sách nhóm duyệt theo phạm vi quyền' })
  async list(
    @Req() req: PrincipalRequest,
    @Param('termId') termId: string,
    @Query(new ReviewGroupPipe(GroupQuerySchema)) query: GroupQuery,
  ) {
    return success(await this.service.list(this.user(req), termId, query));
  }

  @Get('review-groups/:id')
  @ApiGroupResponse()
  @RequirePermission('review-group', 'read')
  @ApiParam({ name: 'id', description: 'Opaque group ID' })
  async detail(@Req() req: PrincipalRequest, @Param('id') id: string) {
    return success(await this.service.detail(this.user(req), id));
  }

  @Get('review-groups/:id/members')
  @RequirePermission('review-group', 'read')
  async members(@Req() req: PrincipalRequest, @Param('id') id: string) {
    return success((await this.service.detail(this.user(req), id)).members);
  }

  @Post('terms/:termId/review-groups')
  @ApiGroupResponse(201)
  @RequirePermission('review-group', 'manage')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['name', 'departmentId', 'memberLecturerIds'],
      properties: {
        name: { type: 'string', maxLength: 255 },
        departmentId: { type: 'string' },
        memberLecturerIds: {
          type: 'array',
          uniqueItems: true,
          items: { type: 'string' },
        },
      },
    },
  })
  async create(
    @Req() req: PrincipalRequest,
    @Param('termId') termId: string,
    @Body(new ReviewGroupPipe(GroupCreateSchema)) body: GroupCreate,
    @Headers('idempotency-key') key: string,
  ) {
    return success(
      await this.service.mutate(
        this.user(req),
        { termId },
        'create',
        body,
        key,
        `/terms/${termId}/review-groups`,
        'POST',
      ),
    );
  }

  @Patch('review-groups/:id')
  @ApiGroupResponse()
  @RequirePermission('review-group', 'manage')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({
    schema: {
      ...mutationSchema,
      properties: {
        ...mutationSchema.properties,
        name: { type: 'string' },
        memberLecturerIds: {
          type: 'array',
          uniqueItems: true,
          items: { type: 'string' },
        },
      },
    },
  })
  async update(
    @Req() req: PrincipalRequest,
    @Param('id') id: string,
    @Body(new ReviewGroupPipe(GroupUpdateSchema)) body: GroupUpdate,
    @Headers('idempotency-key') key: string,
  ) {
    return success(
      await this.service.mutate(
        this.user(req),
        { id },
        'update',
        body,
        key,
        `/review-groups/${id}`,
        'PATCH',
      ),
    );
  }

  @Post('review-groups/:id/members')
  @ApiGroupResponse(201)
  @RequirePermission('review-group', 'manage')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({
    schema: {
      ...mutationSchema,
      required: [...mutationSchema.required, 'lecturerId'],
      properties: {
        ...mutationSchema.properties,
        lecturerId: { type: 'string' },
      },
    },
  })
  async add(
    @Req() req: PrincipalRequest,
    @Param('id') id: string,
    @Body(new ReviewGroupPipe(GroupMemberSchema))
    body: GroupMutation & { lecturerId: string },
    @Headers('idempotency-key') key: string,
  ) {
    return success(
      await this.service.mutate(
        this.user(req),
        { id },
        'add',
        body,
        key,
        `/review-groups/${id}/members`,
        'POST',
      ),
    );
  }

  @Delete('review-groups/:id/members/:lecturerId')
  @ApiGroupResponse()
  @RequirePermission('review-group', 'manage')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ schema: mutationSchema })
  async remove(
    @Req() req: PrincipalRequest,
    @Param('id') id: string,
    @Param('lecturerId') lecturerId: string,
    @Body(new ReviewGroupPipe(GroupMutationSchema)) body: GroupMutation,
    @Headers('idempotency-key') key: string,
  ) {
    return success(
      await this.service.mutate(
        this.user(req),
        { id, lecturerId },
        'remove',
        body,
        key,
        `/review-groups/${id}/members/${lecturerId}`,
        'DELETE',
      ),
    );
  }

  @Delete('review-groups/:id')
  @ApiGroupResponse()
  @RequirePermission('review-group', 'manage')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ schema: mutationSchema })
  @ApiOperation({
    summary: 'Lưu trữ nhóm chưa được phân đề cương; không xóa lịch sử',
  })
  async archive(
    @Req() req: PrincipalRequest,
    @Param('id') id: string,
    @Body(new ReviewGroupPipe(GroupMutationSchema)) body: GroupMutation,
    @Headers('idempotency-key') key: string,
  ) {
    return success(
      await this.service.mutate(
        this.user(req),
        { id },
        'archive',
        body,
        key,
        `/review-groups/${id}`,
        'DELETE',
      ),
    );
  }
}
