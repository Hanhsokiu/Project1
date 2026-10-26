import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import * as bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { ImportRepository } from "../repository/import.repository";
import { ImportService } from "./import.service";
import type { ImportFile } from "../dto/catalog.dto";
const envLine = readFileSync(".env", "utf8")
  .split(/\r?\n/)
  .find((line) => line.startsWith("DATABASE_URL="));
if (!process.env.DATABASE_URL && envLine)
  process.env.DATABASE_URL = envLine
    .slice("DATABASE_URL=".length)
    .replace(/^['"]|['"]$/g, "");
const prisma = new PrismaService();
const service = new ImportService(
  new ImportRepository(prisma, new AuditService(prisma)),
);
const tag = randomUUID().replace(/-/g, "").slice(0, 12);
const prefix = `00${tag}`;
let systemId: string;
let termId: string;
let otherTermId: string;
let actorId: string;
const jobIds: string[] = [];
const codes: string[] = [];
function file(rows: string[]): ImportFile {
  const buffer = Buffer.from(
    "studentCode,fullName,className,cohort,trainingSystemCode,gpa,email,phone,academicEligible\n" +
      rows.join("\n"),
    "utf8",
  );
  return {
    originalname: "integration-students.csv",
    mimetype: "text/csv",
    size: buffer.length,
    buffer,
  };
}
async function preview(source: ImportFile, target = termId) {
  const job = await service.preview(source, target, actorId);
  jobIds.push(job.id);
  return job;
}
beforeAll(async () => {
  await prisma.$connect();
  const actor = await prisma.userAccount.create({
    data: {
      username: `import_actor_${tag}`,
      status: "ACTIVE",
      mustChangePassword: false,
      passwordHash: await bcrypt.hash(randomUUID(), 4),
    },
  });
  actorId = actor.id;
  const system = await prisma.trainingSystem.create({
    data: { code: `QA_${tag}`, name: `Hệ kiểm thử ${tag}` },
  });
  systemId = system.id;
  const base = {
    name: `Đợt kiểm thử import ${tag}`,
    academicYear: "2026-2027",
    semester: 1,
    trainingSystemId: systemId,
    status: "DRAFT" as const,
    startDate: new Date("2026-10-01T00:00:00+07:00"),
    endDate: new Date("2027-04-01T00:00:00+07:00"),
  };
  termId = (
    await prisma.thesisTerm.create({
      data: { ...base, code: `QA_IMPORT_${tag}` },
    })
  ).id;
  otherTermId = (
    await prisma.thesisTerm.create({
      data: { ...base, code: `QA_IMPORT2_${tag}` },
    })
  ).id;
  await prisma.termParameter.createMany({
    data: [termId, otherTermId].map((id) => ({
      termId: id,
      key: "passing_gpa_threshold",
      value: "2.0",
    })),
  });
}, 30000);
afterAll(async () => {
  const students = await prisma.student.findMany({
    where: { studentCode: { in: codes } },
    select: { id: true, userId: true },
  });
  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { resource: "import", resourceId: { in: jobIds } },
        { resource: "student", resourceId: { in: students.map((s) => s.id) } },
      ],
    },
  });
  await prisma.importJob.deleteMany({ where: { id: { in: jobIds } } });
  await prisma.termStudent.deleteMany({
    where: { termId: { in: [termId, otherTermId].filter(Boolean) } },
  });
  await prisma.student.deleteMany({
    where: { id: { in: students.map((s) => s.id) } },
  });
  await prisma.userAccount.deleteMany({
    where: { id: { in: students.map((s) => s.userId) } },
  });
  await prisma.termParameter.deleteMany({
    where: { termId: { in: [termId, otherTermId].filter(Boolean) } },
  });
  await prisma.thesisTerm.deleteMany({
    where: { id: { in: [termId, otherTermId].filter(Boolean) } },
  });
  if (systemId) await prisma.trainingSystem.delete({ where: { id: systemId } });
  if (actorId) await prisma.userAccount.delete({ where: { id: actorId } });
  await prisma.$disconnect();
}, 30000);
describe("student import against PostgreSQL", () => {
  it("persists physical CSV row numbers in preview, validation errors and the confirmed job report", async () => {
    const a = `${prefix}8`,
      b = `${prefix}9`;
    codes.push(a, b);
    const buffer = Buffer.from(
      "studentCode,fullName,className,cohort,trainingSystemCode,gpa,email,phone,academicEligible\r\n\r\n" +
        `${a},"Nguyễn Văn\r\nMẫu",CNTT,K64,,3.2,,,true\r\n\r\n${b},Sinh Viên Thiếu GPA,CNTT,K64,,,,,true`,
      "utf8",
    );
    const job = await preview({
      originalname: "physical-rows.csv",
      mimetype: "text/csv",
      size: buffer.length,
      buffer,
    });
    expect(job.rows.map((r) => r.rowNumber)).toEqual([3, 6]);
    expect(job.rows[1].errors.some((e) => e.field === "gpa")).toBe(true);
    const saved = await prisma.importJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    expect(saved.errorReport).toEqual(
      expect.arrayContaining([expect.objectContaining({ rowNumber: 6 })]),
    );
    const result = await service.confirm(job.id, "VALID_ONLY", actorId);
    expect(result.rows[0]).toMatchObject({ rowNumber: 3, status: "IMPORTED" });
    expect(result.rows[1]).toMatchObject({ rowNumber: 6, status: "ERROR" });
    expect((await service.detail(job.id)).rows.map((r) => r.rowNumber)).toEqual(
      [3, 6],
    );
  }, 30000);
  it("returns per-row duplicate-email errors before attempting database writes", async () => {
    const a = `${prefix}6`,
      b = `${prefix}7`;
    codes.push(a, b);
    const address = `duplicate.${tag}@example.com`;
    const job = await preview(
      file([
        `${a},Sinh Viên Trùng Email Một,CNTT,K64,,3.3,${address},,true`,
        `${b},Sinh Viên Trùng Email Hai,CNTT,K64,,3.1,${address},,true`,
      ]),
    );
    expect(job.invalidRows).toBe(2);
    expect(
      job.rows.every((r) =>
        r.errors.some((e) => e.code === "EMAIL_DUPLICATE_IN_FILE"),
      ),
    ).toBe(true);
    await expect(service.confirm(job.id, "STRICT", actorId)).rejects.toThrow();
    expect(
      await prisma.student.count({ where: { studentCode: { in: [a, b] } } }),
    ).toBe(0);
  });
  it("persists a preview with row errors; strict mode rolls back and valid-only is explicit", async () => {
    const a = `${prefix}1`,
      b = `${prefix}2`;
    codes.push(a, b);
    const job = await preview(
      file([
        `${a},Nguyễn Văn Hợp Lệ,CNTT,K64,,3.3,,,true`,
        `${b},Nguyễn Văn Thiếu GPA,CNTT,K64,,,,,true`,
      ]),
    );
    expect(job.status).toBe("VALIDATED");
    expect(job.invalidRows).toBe(1);
    expect(
      (await service.detail(job.id)).rows[1].errors.some(
        (e) => e.field === "gpa",
      ),
    ).toBe(true);
    await expect(service.confirm(job.id, "STRICT", actorId)).rejects.toThrow();
    expect(
      await prisma.student.count({ where: { studentCode: { in: [a, b] } } }),
    ).toBe(0);
    const result = await service.confirm(job.id, "VALID_ONLY", actorId);
    expect(result.status).toBe("PARTIAL");
    expect(result.successRows).toBe(1);
    expect(result.errorRows).toBe(1);
    expect(await prisma.student.count({ where: { studentCode: b } })).toBe(0);
    const user = await prisma.userAccount.findUniqueOrThrow({
      where: { username: a },
    });
    expect(user.email).toBeNull();
    expect(user.mustChangePassword).toBe(true);
    expect(await bcrypt.compare(a, user.passwordHash)).toBe(true);
  }, 30000);
  it("keeps changed passwords and nonblank contact values when reusing an existing student", async () => {
    const code = `${prefix}3`;
    codes.push(code);
    const first = await preview(
      file([
        `${code},Sinh Viên Tài Khoản Cũ,CNTT,K64,,3.5,old.${tag}@example.com,0912345678,true`,
      ]),
    );
    await service.confirm(first.id, "STRICT", actorId);
    const changedHash = await bcrypt.hash("AlreadyChanged@2026", 10);
    await prisma.userAccount.update({
      where: { username: code },
      data: { passwordHash: changedHash, mustChangePassword: false },
    });
    const next = await preview(
      file([`${code},Sinh Viên Cập Nhật,CNTT mới,K65,,3.7,,,true`]),
      otherTermId,
    );
    expect(next.rows[0].action).toBe("UPDATE");
    const result = await service.confirm(next.id, "STRICT", actorId);
    expect(result.successRows).toBe(1);
    const student = await prisma.student.findUniqueOrThrow({
      where: { studentCode: code },
      include: { user: true },
    });
    expect(student.user.passwordHash).toBe(changedHash);
    expect(student.user.mustChangePassword).toBe(false);
    expect(student.user.email).toBe(`old.${tag}@example.com`);
    expect(student.phone).toBe("0912345678");
    expect(student.fullName).toBe("Sinh Viên Cập Nhật");
    expect(
      await prisma.termStudent.count({ where: { studentId: student.id } }),
    ).toBe(2);
  }, 30000);
  it("treats reimport and repeated confirmation as idempotent without duplicate roster or notifications", async () => {
    const code = `${prefix}4`;
    codes.push(code);
    const source = file([`${code},Sinh Viên Nhập Lại,CNTT,K64,,3.1,,,true`]);
    const job = await preview(source);
    await Promise.all([
      service.confirm(job.id, "STRICT", actorId),
      service.confirm(job.id, "STRICT", actorId),
    ]);
    expect(await prisma.student.count({ where: { studentCode: code } })).toBe(
      1,
    );
    expect(
      await prisma.auditLog.count({
        where: {
          resource: "import",
          resourceId: job.id,
          action: "STUDENT_IMPORT_CONFIRMED",
        },
      }),
    ).toBe(1);
    const again = await preview(source);
    expect(again.rows[0].action).toBe("SKIP");
    const skipped = await service.confirm(again.id, "STRICT", actorId);
    expect(skipped.skippedRows).toBe(1);
    expect(skipped.successRows).toBe(0);
    expect(
      await prisma.termStudent.count({
        where: { termId, student: { studentCode: code } },
      }),
    ).toBe(1);
  }, 30000);
  it("revalidates the target lock at confirmation and leaves the job and roster unchanged", async () => {
    const code = `${prefix}5`;
    codes.push(code);
    const job = await preview(
      file([`${code},Sinh Viên Đợt Khóa,CNTT,K64,,3.0,,,true`]),
    );
    await prisma.thesisTerm.update({
      where: { id: termId },
      data: { isLocked: true },
    });
    try {
      await expect(service.confirm(job.id, "STRICT", actorId)).rejects.toThrow(
        "chưa khóa",
      );
      expect(await prisma.student.count({ where: { studentCode: code } })).toBe(
        0,
      );
      expect((await service.detail(job.id)).confirmedAt).toBeNull();
    } finally {
      await prisma.thesisTerm.update({
        where: { id: termId },
        data: { isLocked: false },
      });
    }
  }, 30000);
});
