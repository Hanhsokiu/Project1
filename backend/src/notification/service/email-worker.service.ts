import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Interval } from "@nestjs/schedule";
import * as nodemailer from "nodemailer";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { NotificationRepository } from "../repository/notification.repository";
import { renderTemplate } from "../../common/util/template.util";
@Injectable()
export class EmailWorkerService {
  private running = false;
  private readonly logger = new Logger(EmailWorkerService.name);
  constructor(
    private readonly repo: NotificationRepository,
    private readonly config: ConfigService,
  ) {}
  @Interval(2000)
  async tick(termId?: string) {
    if (this.running || this.config.get("EMAIL_WORKER_ENABLED") === "false")
      return;
    this.running = true;
    try {
      for (let i = 0; i < 20; i++) {
        const row = await this.repo.claim(termId);
        if (!row) break;
        try {
          const host = this.config.get<string>("SMTP_HOST");
          const from = this.config.get<string>("SMTP_FROM");
          if (!host || !from)
            throw new Error(
              "Thiếu cấu hình SMTP_HOST/SMTP_FROM; email chưa được gửi.",
            );
          if (!row.recipient)
            throw new Error("GV chưa có email nhận thông báo.");
          const port = Number(this.config.get("SMTP_PORT") ?? 1025);
          const user = this.config.get<string>("SMTP_USER"),
            pass = this.config.get<string>("SMTP_PASS");
          const transport = nodemailer.createTransport({
            host,
            port,
            secure: this.config.get("SMTP_SECURE") === "true",
            ...(user ? { auth: { user, pass } } : {}),
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 15000,
          });
          const payload = row.payload as {
            lecturerName: string;
            termName: string;
            students: Record<string, string>[];
          };
          const template = await readFile(
            resolve(process.cwd(), "templates/email/phan-cong-gvhd.html"),
            "utf8",
          );
          const info = await transport.sendMail({
            from,
            to: row.recipient,
            subject: row.subject,
            messageId: `<${row.id}@gpms.local>`,
            html: renderTemplate(template, payload, {
              students: payload.students,
            }),
          });
          if (!info.accepted?.length || info.rejected?.length)
            throw new Error("SMTP chưa chấp nhận đầy đủ người nhận.");
          await this.repo.sent(row, info.messageId);
        } catch (error) {
          await this.repo.failed(row, (error as Error).message);
        }
      }
    } catch (error) {
      this.logger.error("Email worker: " + (error as Error).message);
    } finally {
      this.running = false;
    }
  }
}
