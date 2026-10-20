/**
 * BR-Auth: Chính sách mật khẩu
 * - Tối thiểu 8 ký tự
 * - Có chữ hoa, chữ thường, số
 * - Có ký tự đặc biệt
 */
export class PasswordPolicyValidator {
  static validate(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!password || password.length < 8) errors.push('Mật khẩu phải có ít nhất 8 ký tự');
    if (!/[A-Z]/.test(password)) errors.push('Phải có ít nhất 1 chữ hoa');
    if (!/[a-z]/.test(password)) errors.push('Phải có ít nhất 1 chữ thường');
    if (!/[0-9]/.test(password)) errors.push('Phải có ít nhất 1 chữ số');
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) errors.push('Phải có ký tự đặc biệt (!@#$%^&*...)');

    return { valid: errors.length === 0, errors };
  }
}
