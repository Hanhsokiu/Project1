import { BadRequestException } from "@nestjs/common";
import { PasswordPolicyValidator } from "./password-policy.validator";
export class AuthValidator {
  static password(oldPassword: string, newPassword: string) {
    const result = PasswordPolicyValidator.validate(newPassword);
    if (!result.valid || newPassword === oldPassword)
      throw new BadRequestException({
        error: {
          code: "PASSWORD_POLICY_VIOLATED",
          message: result.valid
            ? "Mật khẩu mới phải khác mật khẩu hiện tại"
            : result.errors.join("; "),
        },
      });
  }
}
