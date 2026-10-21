import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { TermModule } from './term/term.module';
import { RegistrationModule } from './registration/registration.module';
import { TopicModule } from './topic/topic.module';
import { GuidanceModule } from './guidance/guidance.module';
import { DefenseModule } from './defense/defense.module';
import { GradingModule } from './grading/grading.module';
import { ReportModule } from './report/report.module';
import { NotificationModule } from './notification/notification.module';
import { JwtAuthGuard } from './common/security/jwt-auth.guard';
import { PermissionsGuard } from './common/security/permissions.guard';
import { resolve } from 'path';
import { validateEnvironment } from './config/environment';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolve(__dirname, '../.env'),
      validate: validateEnvironment,
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    CommonModule,
    AuthModule,
    CatalogModule,
    TermModule,
    RegistrationModule,
    TopicModule,
    GuidanceModule,
    DefenseModule,
    GradingModule,
    ReportModule,
    NotificationModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class AppModule {}
