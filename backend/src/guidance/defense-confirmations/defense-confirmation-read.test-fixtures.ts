import { vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { DefenseConfirmationRepository } from "./defense-confirmation.repository";
import { DefenseConfirmationReadService } from "./defense-confirmation-read.service";
import { DefenseConfirmationReadValidator } from "./defense-confirmation-read.validator";
import { commandFixture } from "./defense-confirmation-command.test-fixtures";

export function readFixture() {
  const f = commandFixture();
  f.state.user!.displayName = "GVHD hiện hành";
  f.state.user!.userRoles[0].role.rolePermissions.push({
    permission: { resource: "defense-confirmation", action: "read" },
  } as (typeof f.facts.user.userRoles)[0]["role"]["rolePermissions"][number]);
  const accessState = {
    grants: [] as Array<{
      userId: string;
      termId: string;
      allDepartments: boolean;
      pr2bGrantDepartmentGrantId: Array<{ departmentId: string }>;
    }>,
  };
  const raw = Object.assign(f.raw, {
    academicTermGrant: { findMany: vi.fn(async () => accessState.grants) },
  });
  raw.defenseConfirmation.findUnique.mockImplementation(async () =>
    f.state.decision
      ? {
          ...structuredClone(f.state.decision),
          decidedBy: f.state.decision.decidedByUserId
            ? {
                id: f.state.decision.decidedByUserId,
                displayName: "Người quyết định",
              }
            : null,
          advisor: {
            id: f.state.decision.advisorId,
            fullName: "GVHD ra quyết định",
          },
        }
      : null,
  );
  const history = Object.assign(raw.defenseConfirmationHistory, {
    findMany: vi.fn(
      async (args: { where: { revision: { gt: number } }; take: number }) =>
        [...f.state.history]
          .filter((h) => h.revision > args.where.revision.gt)
          .sort(
            (a, b) =>
              a.revision - b.revision ||
              String(a.id).localeCompare(String(b.id)),
          )
          .slice(0, args.take)
          .map((h) => ({
            ...structuredClone(h),
            note: h.note ?? null,
            changeReason: h.changeReason ?? null,
            actor: { id: h.actorId, displayName: "Người quyết định" },
            advisor: { id: h.advisorId, fullName: "GVHD ra quyết định" },
          })),
    ),
  });
  const repo = new DefenseConfirmationRepository(
    f.prisma as unknown as PrismaService,
  );
  const access = new DefenseConfirmationReadValidator(f.validator);
  const read = new DefenseConfirmationReadService(
    repo,
    f.contexts,
    f.validator,
    access,
  );
  const viewer = (role: "STUDENT" | "FACULTY" | "ADMIN") => {
    const ownStudent = role === "STUDENT";
    f.state.user = {
      ...f.state.user!,
      id: ownStudent ? "student-user" : "faculty-user",
      lecturer: null,
      student: ownStudent
        ? { id: "student", userId: "student-user", isActive: true }
        : null,
      userRoles: [
        {
          role: {
            name: role,
            rolePermissions: [
              {
                permission: {
                  resource: "defense-confirmation",
                  action: "read",
                },
              },
            ],
          },
        },
      ],
    } as unknown as NonNullable<typeof f.state.user>;
  };
  const fullGrant = () => {
    accessState.grants = [
      {
        userId: f.state.user!.id,
        termId: "term",
        allDepartments: true,
        pr2bGrantDepartmentGrantId: [],
      },
    ];
  };
  const departmentGrant = () => {
    f.state.proposal!.topic.researchArea = {
      pr2bResearchAreaWorkflowResearchAreaId: { departmentId: "department" },
    } as typeof f.facts.proposal.topic.researchArea;
    accessState.grants = [
      {
        userId: f.state.user!.id,
        termId: "term",
        allDepartments: false,
        pr2bGrantDepartmentGrantId: [{ departmentId: "department" }],
      },
    ];
  };
  return {
    ...f,
    raw,
    history,
    read,
    access,
    accessState,
    viewer,
    fullGrant,
    departmentGrant,
    readRepo: repo,
    tx: raw as unknown as Prisma.TransactionClient,
  };
}
