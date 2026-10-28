import { vi } from "vitest";
import {
  Prisma,
  type DefenseList,
  type DefenseListFinalization,
} from "@prisma/client";
import { AuditService } from "../../common/audit/audit.service";
import { PrismaUc18FinalizationReader } from "../../common/uc18-finalization/prisma-uc18-finalization.reader";
import { Uc18FinalizationRepository } from "../../common/uc18-finalization/uc18-finalization.repository";
import { Uc18FinalizationValidator } from "../../common/uc18-finalization/uc18-finalization.validator";
import { PrismaService } from "../../prisma/prisma.service";
import { DefenseListRepository } from "./defense-list.repository";
import { DefenseListService } from "./defense-list.service";
import {
  DefenseListValidator,
  type DefenseListPrincipal,
  type DefenseListGrant,
  type DefenseListTerm,
} from "./defense-list.validator";

export const defenseListAt = new Date("2026-10-27T00:00:00.000Z");
export function defenseListFixture() {
  const state: {
    actor: DefenseListPrincipal | null;
    grant: DefenseListGrant | null;
    term: (DefenseListTerm & { startDate: Date; endDate: Date }) | null;
    row: DefenseList | null;
    finalization: DefenseListFinalization | null;
    audit: unknown[];
  } = {
    actor: {
      id: "manager",
      status: "ACTIVE",
      mustChangePassword: false,
      userRoles: [
        {
          role: {
            rolePermissions: [
              { permission: { resource: "defense-list", action: "read" } },
              { permission: { resource: "defense-list", action: "manage" } },
            ],
          },
        },
      ],
    },
    grant: {
      userId: "manager",
      termId: "term",
      allDepartments: true,
      pr2bGrantDepartmentGrantId: [],
    },
    term: {
      id: "term",
      status: "IN_PROGRESS",
      isLocked: false,
      startDate: new Date("2026-09-01T00:00:00Z"),
      endDate: new Date("2027-01-01T00:00:00Z"),
    },
    row: null,
    finalization: null,
    audit: [],
  };
  const events: string[] = [];
  const untouched = vi.fn(() => {
    throw new Error("Out-of-scope data access");
  });
  const raw = {
    $queryRaw: vi.fn(
      async (query: TemplateStringsArray, ..._values: unknown[]) => {
        if (query.join("?").includes('"THESIS_TERM"')) {
          events.push("lockTerm");
          return state.term ? [{ id: state.term.id }] : [];
        }
        events.push("now");
        return [{ at: defenseListAt }];
      },
    ),
    userAccount: {
      findUnique: vi.fn(async () => {
        events.push("principal");
        return state.actor;
      }),
    },
    academicTermGrant: { findUnique: vi.fn(async () => state.grant) },
    thesisTerm: { findUnique: vi.fn(async () => state.term) },
    defenseList: {
      findUnique: vi.fn(async () => structuredClone(state.row)),
      create: vi.fn(async ({ data }: { data: DefenseList }) => {
        events.push("create");
        if (state.row)
          throw new Prisma.PrismaClientKnownRequestError("duplicate", {
            code: "P2002",
            clientVersion: "5.22.0",
          });
        state.row = structuredClone(data);
        return structuredClone(state.row);
      }),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { termId: string; state: string; revision: number };
          data: {
            state: "OPEN";
            openedAt: Date;
            openedByUserId: string;
            revision: { increment: number };
            updatedAt: Date;
          };
        }) => {
          events.push("open");
          if (
            !state.row ||
            state.row.termId !== where.termId ||
            state.row.state !== where.state ||
            state.row.revision !== where.revision
          )
            return { count: 0 };
          state.row = {
            ...state.row,
            ...data,
            revision: state.row.revision + data.revision.increment,
          };
          return { count: 1 };
        },
      ),
    },
    defenseListFinalization: {
      findUnique: vi.fn(async () => state.finalization),
    },
    auditLog: {
      create: vi.fn(
        async (entry: { data: Prisma.AuditLogUncheckedCreateInput }) => {
          events.push("audit");
          state.audit.push(entry);
          return entry;
        },
      ),
    },
    termStudent: { findMany: untouched },
    finalReport: { findUnique: untouched, update: untouched },
    fileAsset: { findUnique: untouched },
    defenseEligibility: { update: untouched, findMany: untouched },
    defenseConfirmation: { update: untouched, findMany: untouched },
  };
  const tx = raw as unknown as Prisma.TransactionClient;
  let queue = Promise.resolve();
  const prisma = {
    $transaction: vi.fn(
      (
        operation: (tx: Prisma.TransactionClient) => Promise<unknown>,
        _options: unknown,
      ) => {
        // Unit-level transaction/parent-lock simulation, not a PostgreSQL assertion.
        const run = queue.then(async () => {
          const before = structuredClone({
            row: state.row,
            audit: state.audit,
          });
          try {
            return await operation(tx);
          } catch (e) {
            state.row = before.row;
            state.audit = before.audit;
            throw e;
          }
        });
        queue = run.then(
          () => undefined,
          () => undefined,
        );
        return run;
      },
    ),
  };
  const repo = new DefenseListRepository(prisma as unknown as PrismaService);
  const validator = new DefenseListValidator();
  const reader = new PrismaUc18FinalizationReader(
    new Uc18FinalizationRepository(),
    new Uc18FinalizationValidator(),
  );
  const audit = new AuditService({} as PrismaService);
  const auditLog = vi.spyOn(audit, "log");
  const service = new DefenseListService(repo, validator, audit, reader);
  const draft = (): DefenseList => ({
    // Test arrangement: a DRAFT whose policy was explicitly configured earlier.
    // Production create() still creates no policy or window defaults.
    workflowPolicy: {
      schemaVersion: 1,
      committeeSize: 3,
      committeeCapacity: 10,
      windows: Object.fromEntries(
        ["UC18", "COMMITTEES", "REVIEWERS", "SCHEDULE"].map((k) => [
          k,
          {
            opensAt: "2026-10-01T00:00:00Z",
            closesAt: "2026-12-01T00:00:00Z",
            isLocked: false,
          },
        ]),
      ),
    },
    workflowPolicyRevision: 1,
    workflowPolicyUpdatedAt: defenseListAt,
    workflowPolicyUpdatedByUserId: "manager",
    termId: "term",
    state: "DRAFT",
    revision: 0,
    openedAt: null,
    openedByUserId: null,
    currentFinalizationId: null,
    createdAt: defenseListAt,
    updatedAt: defenseListAt,
  });
  return {
    state,
    events,
    raw,
    tx,
    prisma,
    repo,
    reader,
    audit,
    auditLog,
    validator,
    service,
    draft,
    untouched,
  };
}
