import { Injectable, CanActivate, ExecutionContext, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from './require-permission.decorator';
import { IS_PUBLIC_KEY } from './public.decorator';
import { RbacService } from '../../auth/service/rbac.service';
import { BusinessException } from '../exception/business.exception';
import { ErrorCode } from '../exception/error-code.enum';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbacService: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const requiredPermission = this.reflector.getAllAndOverride<{ resource: string; action: string }>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermission) {
      return true; // Không yêu cầu quyền cụ thể, chỉ cần đăng nhập
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || (!user.userId && !user.sub)) {
      throw new BusinessException(
        ErrorCode.INSUFFICIENT_PERMISSION,
        'Yêu cầu đăng nhập để thực hiện chức năng này',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const userId = user.userId || user.sub;
    const hasPermission = await this.rbacService.hasPermission(
      userId,
      requiredPermission.resource,
      requiredPermission.action,
    );

    if (!hasPermission) {
      throw new BusinessException(
        ErrorCode.INSUFFICIENT_PERMISSION,
        `Bạn không có quyền [${requiredPermission.resource}:${requiredPermission.action}] để thực hiện thao tác này`,
        HttpStatus.FORBIDDEN,
      );
    }

    return true;
  }
}
