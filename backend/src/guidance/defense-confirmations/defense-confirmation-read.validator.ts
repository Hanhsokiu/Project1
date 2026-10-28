import { Inject, Injectable } from "@nestjs/common";
import type {
  ReviewPrincipal,
  ReviewProposal,
  ProposalReviewSession,
} from "../../topic/proposal-reviews/proposal-review.repository";
import { DefenseConfirmationValidator } from "./defense-confirmation.validator";
import { confirmationError } from "./defense-confirmation.dto";

export type ConfirmationViewer = "ADVISOR" | "STUDENT" | "FACULTY";
type TermGrant = Awaited<ReturnType<ProposalReviewSession["grants"]>>[number];

@Injectable()
export class DefenseConfirmationReadValidator {
  constructor(
    @Inject(DefenseConfirmationValidator)
    private readonly context: DefenseConfirmationValidator,
  ) {}
  permitted(user: ReviewPrincipal, action: "read" | "decide") {
    return user.userRoles.some((r) =>
      r.role.rolePermissions.some(
        (p) =>
          p.permission.resource === "defense-confirmation" &&
          p.permission.action === action,
      ),
    );
  }
  role(user: ReviewPrincipal, name: string) {
    return user.userRoles.some((r) => r.role.name === name);
  }
  principal(user: ReviewPrincipal | null, userId: string) {
    if (
      !user ||
      user.id !== userId ||
      user.status !== "ACTIVE" ||
      user.mustChangePassword ||
      !this.permitted(user, "read")
    )
      confirmationError(
        403,
        "UC17_READ_FORBIDDEN",
        "Cần tài khoản hoạt động và quyền đọc UC17.",
      );
    return user;
  }
  studentOwn(user: ReviewPrincipal, proposal: ReviewProposal) {
    return (
      this.role(user, "STUDENT") &&
      !!user.student?.isActive &&
      user.student.id === proposal.studentId &&
      proposal.student.id === proposal.studentId &&
      proposal.student.userId === user.id &&
      proposal.termId === proposal.topic.termId
    );
  }
  faculty(
    user: ReviewPrincipal,
    proposal: ReviewProposal,
    grants: TermGrant[],
  ) {
    if (!this.role(user, "FACULTY") && !this.role(user, "ADMIN")) return false;
    if (proposal.termId !== proposal.topic.termId) return false;
    const departmentId =
      proposal.topic.researchArea?.pr2bResearchAreaWorkflowResearchAreaId
        ?.departmentId;
    return grants.some(
      (g) =>
        g.userId === user.id &&
        g.termId === proposal.termId &&
        (g.allDepartments ||
          (!!departmentId &&
            g.pr2bGrantDepartmentGrantId.some(
              (d) => d.departmentId === departmentId,
            ))),
    );
  }
  advisor(
    user: ReviewPrincipal,
    advisor: ReturnType<DefenseConfirmationValidator["official"]>,
  ) {
    return (
      this.role(user, "LECTURER") &&
      !!user.lecturer?.isActive &&
      advisor.state === "OFFICIAL" &&
      advisor.advisorId === user.lecturer.id &&
      advisor.userId === user.id
    );
  }
  requireAdvisorReader(user: ReviewPrincipal) {
    // Full progress/PDF/assignment context is reserved for the current advisor.
    this.context.principal(user, user.id);
  }
}
