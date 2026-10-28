import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnprocessableEntityException,
} from "@nestjs/common";
import type { FinalReportWindowPut } from "./final-report-window.dto";

export type WindowPrincipal = {
  id: string;
  status: string;
  userRoles: Array<{
    role: {
      rolePermissions: Array<{
        permission: { resource: string; action: string };
      }>;
    };
  }>;
};
export type WindowGrant = {
  userId: string;
  termId: string;
  allDepartments: boolean;
};
export type WindowTerm = {
  id: string;
  startDate: Date;
  endDate: Date;
  status: string;
  isLocked: boolean;
};

export function finalReportWindowConflict() {
  return new ConflictException({
    error: {
      code: "REVISION_CONFLICT",
      message: "Cấu hình vừa thay đổi. Hãy tải lại trước khi lưu.",
    },
  });
}

@Injectable()
export class FinalReportWindowValidator {
  access(
    userId: string,
    termId: string,
    principal: WindowPrincipal | null,
    grant: WindowGrant | null,
    action: "read" | "plan",
  ) {
    const permitted = principal?.userRoles.some((r) =>
      r.role.rolePermissions.some(
        (p) =>
          p.permission.resource === "term" && p.permission.action === action,
      ),
    );
    if (
      !principal ||
      principal.id !== userId ||
      principal.status !== "ACTIVE" ||
      !permitted ||
      !grant ||
      grant.userId !== userId ||
      grant.termId !== termId ||
      !grant.allDepartments
    ) {
      throw new ForbiddenException({
        error: {
          code: "FINAL_REPORT_WINDOW_FORBIDDEN",
          message:
            "Cần quyền quản lý toàn bộ đợt được chỉ định để truy cập cấu hình.",
        },
      });
    }
  }

  editable(term: WindowTerm) {
    if (term.isLocked || ["COMPLETED", "CANCELLED"].includes(term.status)) {
      throw new ConflictException({
        error: {
          code: "TERM_003",
          message: "Đợt đã khóa, hoàn thành hoặc hủy.",
        },
      });
    }
  }

  dates(input: FinalReportWindowPut, term: WindowTerm) {
    const opensAt = new Date(input.opensAt),
      closesAt = new Date(input.closesAt);
    if (
      !Number.isFinite(opensAt.getTime()) ||
      !Number.isFinite(closesAt.getTime()) ||
      !Number.isFinite(term.startDate.getTime()) ||
      !Number.isFinite(term.endDate.getTime()) ||
      term.startDate >= term.endDate ||
      opensAt >= closesAt ||
      opensAt < term.startDate ||
      closesAt > term.endDate
    ) {
      throw new UnprocessableEntityException({
        error: {
          code: "FINAL_REPORT_WINDOW_DATES_INVALID",
          message:
            "Thời gian mở phải trước thời gian đóng và nằm trong thời gian của đợt.",
        },
      });
    }
    return { opensAt, closesAt };
  }

  revision(expected: number, current: number) {
    if (expected !== current) throw finalReportWindowConflict();
  }
}
