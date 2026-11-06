import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../prisma/prisma.service";
import { TermRepository, type TermTransaction } from "./term.repository";

describe("term creator academic scope", () => {
  it("grants only the active faculty creator in the term creation transaction", async () => {
    const tx = {
      userAccount: { findFirst: vi.fn().mockResolvedValue({ id: "faculty" }) },
      academicTermGrant: { upsert: vi.fn().mockResolvedValue({}) },
    };
    const repo = new TermRepository({} as PrismaService);
    await repo.grantCreatorAcademicAccess(
      "new-term",
      "faculty",
      tx as unknown as TermTransaction,
    );
    expect(tx.userAccount.findFirst).toHaveBeenCalledWith({
      where: {
        id: "faculty",
        status: "ACTIVE",
        userRoles: { some: { role: { name: "FACULTY" } } },
      },
      select: { id: true },
    });
    expect(tx.academicTermGrant.upsert).toHaveBeenCalledWith({
      where: { userId_termId: { userId: "faculty", termId: "new-term" } },
      create: { userId: "faculty", termId: "new-term", allDepartments: true },
      update: {},
    });
  });

  it("does not give academic scope to administrators or inactive/non-faculty creators", async () => {
    const tx = {
      userAccount: { findFirst: vi.fn().mockResolvedValue(null) },
      academicTermGrant: { upsert: vi.fn() },
    };
    const repo = new TermRepository({} as PrismaService);
    await repo.grantCreatorAcademicAccess(
      "new-term",
      "admin",
      tx as unknown as TermTransaction,
    );
    expect(tx.academicTermGrant.upsert).not.toHaveBeenCalled();
  });
});
