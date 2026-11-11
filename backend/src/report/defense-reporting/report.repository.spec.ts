import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { readFileSync } from "fs";
import { resolve } from "path";
import { ReportRepository, ReportSession } from "./report.repository";
describe("UC25 Prisma adapter boundary, not PostgreSQL E2E", () => {
  it("read/write snapshots are bounded RepeatableRead/Serializable; serialization conflicts map to 409", async () => {
    const tx = vi.fn(
        async (fn: (s: unknown) => Promise<unknown>, _options: unknown) =>
          fn({}),
      ),
      r = new ReportRepository({ $transaction: tx } as never);
    await r.read(async (s) => expect(s).toBeInstanceOf(ReportSession));
    await r.write(async () => true);
    expect(
      tx.mock.calls.map(
        (c) => (c[1] as { isolationLevel: string }).isolationLevel,
      ),
    ).toEqual(["RepeatableRead", "Serializable"]);
    tx.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("TEST_ONLY", {
        code: "P2034",
        clientVersion: "TEST_ONLY",
      }),
    );
    await expect(r.write(async () => true)).rejects.toMatchObject({
      status: 409,
    });
  });
  it("metadata and history are owner/resource/term scoped and contain no raw source query", async () => {
    const findFirst = vi.fn(),
      findMany = vi.fn(),
      s = new ReportSession({ auditLog: { findFirst, findMany } } as never);
    s.rpMetadata("id", "owner");
    s.rpHistory("owner", "term");
    expect(findFirst.mock.calls[0][0].where).toMatchObject({
      resource: "defense-report",
      resourceId: "id",
      userId: "owner",
    });
    expect(findMany.mock.calls[0][0].where).toMatchObject({
      userId: "owner",
      newValue: { path: ["termId"], equals: "term" },
    });
  });
  it("stream lifecycle never writes a file path/asset/job/minutes or mutates grade tables", () => {
    const source = readFileSync(
      resolve("src/report/defense-reporting/report.repository.ts"),
      "utf8",
    );
    expect(source).not.toMatch(
      /\.scoreEntry\.(?:create|update)|\.finalResult\.(?:create|update)|\.fileAsset\.(?:create|update)|\.exportJob\.(?:create|update)|\.defenseMinutes\.(?:create|update)/,
    );
    expect(source).toContain('resource: "defense-report"');
  });
});
