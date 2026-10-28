import { applyDecorators } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiProperty,
  ApiResponse,
  getSchemaPath,
} from '@nestjs/swagger';

class ReviewGroupMemberResponse {
  @ApiProperty() lecturerId!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty() lecturerCode!: string;
  @ApiProperty({ enum: ['MEMBER'] }) role!: 'MEMBER';
}
class ReviewGroupResponse {
  @ApiProperty() id!: string;
  @ApiProperty() termId!: string;
  @ApiProperty() departmentId!: string;
  @ApiProperty() departmentName!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ minimum: 0 }) revision!: number;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
  @ApiProperty() activeReviewCount!: number;
  @ApiProperty() canManage!: boolean;
  @ApiProperty({ type: [ReviewGroupMemberResponse] })
  members!: ReviewGroupMemberResponse[];
}
export const ApiGroupResponse = (status = 200, list = false) =>
  applyDecorators(
    ApiExtraModels(ReviewGroupResponse, ReviewGroupMemberResponse),
    ApiResponse({
      status,
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          timestamp: { type: 'string', format: 'date-time' },
          data: list
            ? {
                type: 'object',
                properties: {
                  data: {
                    type: 'array',
                    items: { $ref: getSchemaPath(ReviewGroupResponse) },
                  },
                  total: { type: 'integer' },
                  page: { type: 'integer' },
                  limit: { type: 'integer' },
                  totalPages: { type: 'integer' },
                },
              }
            : { $ref: getSchemaPath(ReviewGroupResponse) },
        },
      },
    }),
  );
