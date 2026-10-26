import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuthController } from "./controller/auth.controller";
import { AccountController } from "./controller/account.controller";
import { AuthService } from "./service/auth.service";
import { AccountService } from "./service/account.service";
import { RbacService } from "./service/rbac.service";
import { UserAccountRepository } from "./repository/user-account.repository";

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow("JWT_SECRET"),
        signOptions: { expiresIn: config.get("JWT_EXPIRES_IN", "8h") },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController, AccountController],
  providers: [AuthService, AccountService, RbacService, UserAccountRepository],
  exports: [AuthService, RbacService, JwtModule, UserAccountRepository],
})
export class AuthModule {}
