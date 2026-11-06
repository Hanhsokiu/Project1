import { Injectable } from "@nestjs/common";
import { UserAccountRepository } from "../repository/user-account.repository";
@Injectable()
export class RbacService {
  constructor(private readonly users: UserAccountRepository) {}
  async getUserPermissions(userId: string) {
    return [...new Set(await this.users.permissions(userId))];
  }
  async hasPermission(userId: string, resource: string, action: string) {
    return (await this.getUserPermissions(userId)).includes(
      `${resource}:${action}`,
    );
  }
}
