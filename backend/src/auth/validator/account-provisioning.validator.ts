import { ForbiddenException } from "@nestjs/common";

export class AccountProvisioningValidator {
  static admin(roles: string[]) {
    if (!roles.includes("ADMIN"))
      throw new ForbiddenException("Chỉ Admin được tạo tài khoản.");
  }
}
