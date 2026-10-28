import { HttpException, Injectable } from "@nestjs/common";
import type { DefenseList } from "@prisma/client";
import {
  defenseListOpenSchema,
  type DefenseListOpen,
} from "./defense-list.dto";

export type DefenseListPrincipal = {
  id: string;
  status: string;
  mustChangePassword: boolean;
  userRoles: Array<{
    role: {
      rolePermissions: Array<{
        permission: { resource: string; action: string };
      }>;
    };
  }>;
};
export type DefenseListGrant = {
  userId: string;
  termId: string;
  allDepartments: boolean;
  pr2bGrantDepartmentGrantId: Array<{ departmentId: string }>;
};
export type DefenseListTerm = { id: string; status: string; isLocked: boolean };

export function defenseListError(
  status: number,
  code: string,
  message: string,
): never {
  throw new HttpException({ error: { code, message } }, status);
}

@Injectable()
export class DefenseListValidator {
  access(
    userId: string,
    termId: string,
    principal: DefenseListPrincipal | null,
    grant: DefenseListGrant | null,
    action: "read" | "manage",
  ) {
    const permitted = principal?.userRoles.some((r) =>
      r.role.rolePermissions.some(
        (p) =>
          p.permission.resource === "defense-list" &&
          p.permission.action === action,
      ),
    );
    if (
      !principal ||
      principal.id !== userId ||
      principal.status !== "ACTIVE" ||
      principal.mustChangePassword ||
      !permitted ||
      !grant ||
      grant.userId !== userId ||
      grant.termId !== termId ||
      (!grant.allDepartments &&
        (action === "manage" ||
          !grant.pr2bGrantDepartmentGrantId.some(
            (d) => d.departmentId.trim().length > 0,
          )))
    )
      defenseListError(
        403,
        "DEFENSE_LIST_FORBIDDEN",
        "Cần quyền danh sách bảo vệ và phạm vi đợt phù hợp; tạo/mở xét yêu cầu toàn đợt.",
      );
  }

  editable(term: DefenseListTerm) {
    // Same lifecycle boundary as the existing per-term window configuration.
    // No inference from FINAL, UC17 deadlines, PDFs or eligibility.
    if (
      term.isLocked ||
      ![
        "DRAFT",
        "OPEN_REGISTRATION",
        "CLOSED_REGISTRATION",
        "IN_PROGRESS",
        "DEFENDING",
      ].includes(term.status)
    )
      defenseListError(
        409,
        "TERM_003",
        "Đợt đã khóa, hoàn thành, hủy hoặc không hợp lệ.",
      );
  }

  openInput(input: DefenseListOpen) {
    const parsed = defenseListOpenSchema.safeParse(input);
    if (!parsed.success)
      defenseListError(
        422,
        "DEFENSE_LIST_INPUT_INVALID",
        "Cần expectedRevision nguyên không âm và không có trường dư.",
      );
    return parsed.data;
  }

  openable(row: DefenseList, expected: number) {
    if (
      !Number.isInteger(row.revision) ||
      row.revision < 0 ||
      row.revision > 2147483646 ||
      row.revision !== expected
    )
      defenseListError(
        409,
        "REVISION_CONFLICT",
        "Danh sách vừa thay đổi; hãy tải lại revision.",
      );
    if (row.state !== "DRAFT")
      defenseListError(
        409,
        "DEFENSE_LIST_TRANSITION_INVALID",
        "Endpoint này chỉ cho phép DRAFT chuyển sang OPEN.",
      );
    if (
      row.openedAt !== null ||
      row.openedByUserId !== null ||
      row.currentFinalizationId !== null
    )
      defenseListError(
        409,
        "DEFENSE_LIST_STATE_INVALID",
        "Metadata DRAFT không nhất quán.",
      );
  }
}
