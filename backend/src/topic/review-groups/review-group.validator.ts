import { Injectable } from '@nestjs/common';
import { GroupRecord, GroupPrincipal } from './review-group.repository';
import { groupError } from './review-group.errors';
@Injectable()
export class ReviewGroupValidator {
  principal(user: GroupPrincipal | null, action: 'read' | 'manage') {
    if (!user || user.status !== 'ACTIVE')
      groupError(403, 'AUTH_002', 'Tài khoản không hoạt động.');
    const permitted = user.userRoles.some(
      (r) =>
        (r.role.name === 'FACULTY' ||
          (action === 'read' && r.role.name === 'LECTURER')) &&
        r.role.rolePermissions.some(
          (p) =>
            p.permission.resource === 'review-group' &&
            p.permission.action === action,
        ),
    );
    if (!permitted)
      groupError(403, 'AUTH_004', 'Không có quyền với nhóm duyệt.');
    if (
      !user.userRoles.some(
        (r) =>
          r.role.name === 'FACULTY' ||
          (action === 'read' && r.role.name === 'LECTURER'),
      )
    )
      groupError(
        403,
        'AUTH_004',
        'Vai trò không được phép thực hiện thao tác.',
      );
    return user;
  }
  mutable(status: string) {
    if (!['DRAFT', 'CLOSED_REGISTRATION', 'IN_PROGRESS'].includes(status))
      groupError(409, 'TERM_003', 'Đợt không cho phép thay đổi nhóm duyệt.');
  }
  membershipEditable(group: GroupRecord) {
    if (
      group.reviews.some(
        (r) =>
          !r.pr2bProposalReviewWorkflowReviewId?.state ||
          ['ASSIGNED', 'IN_REVIEW'].includes(
            r.pr2bProposalReviewWorkflowReviewId.state,
          ),
      )
    )
      groupError(
        409,
        'ACTIVE_REVIEW_EXISTS',
        'Nhóm có vòng duyệt đang hoạt động hoặc chưa đối soát; cần phân lại trước khi sửa thành viên.',
      );
  }
  eligible(expected: string[], actual: string[]) {
    if (new Set(expected).size !== expected.length)
      groupError(409, 'COMMON_002', 'Thành viên bị trùng.');
    if (expected.some((id) => !actual.includes(id)))
      groupError(
        400,
        'MEMBER_INELIGIBLE',
        'Giảng viên không tồn tại, không hoạt động, thiếu vai trò hoặc không thuộc đợt.',
      );
  }
}
