import { applicationPolicyRuntimeAllowed } from "../../common/security/application-policy-runtime";
import { Injectable } from "@nestjs/common";
import { SchedulePolicySchema } from "@doan/shared";
import type { SchedulePolicy } from "@doan/shared";
@Injectable()
export class ScheduleValidator {
  policy(raw?: string | null): SchedulePolicy | null {
    try {
      const p = SchedulePolicySchema.parse(JSON.parse(raw ?? "null"));
      if (!applicationPolicyRuntimeAllowed(p)) return null;
      return Date.parse(p.approvedAt) <= Date.now() ? p : null;
    } catch {
      return null;
    }
  }
}
