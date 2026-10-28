import { Inject, Injectable } from "@nestjs/common";
import { Prisma, type DefenseStage } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { DefensePlanningSession } from "../planning/defense-planning.repository";
import { planningError } from "../planning/defense-planning.policy";

export class DefenseWorkflowSession extends DefensePlanningSession {
  constructor(readonly workflowDb: Prisma.TransactionClient) {
    super(workflowDb);
  }
  list(termId: string) {
    return this.workflowDb.defenseList.findUnique({ where: { termId } });
  }
  stages(termId: string) {
    return this.workflowDb.defenseStageWorkflow.findMany({
      where: { termId },
      orderBy: { stage: "asc" },
    });
  }
  evidence(termId: string) {
    return this.workflowDb.defenseAcademicEvidence.findMany({
      where: { termId },
      orderBy: [{ termStudentId: "asc" }, { revision: "desc" }],
    });
  }
  artifact(id: string) {
    return this.workflowDb.defenseStageArtifact.findUnique({ where: { id } });
  }
  artifacts(termId: string) {
    return this.workflowDb.defenseStageArtifact.findMany({
      where: { termId },
      orderBy: [{ stage: "asc" }, { version: "asc" }],
    });
  }
  async lock(termId: string) {
    await this.workflowDb
      .$queryRaw`SELECT set_config('lock_timeout', '5s', true)`;
    await this.workflowDb
      .$queryRaw`SELECT id FROM public."THESIS_TERM" WHERE id=${termId} FOR UPDATE`;
    await this.workflowDb
      .$queryRaw`SELECT term_id FROM public."DEFENSE_LIST" WHERE term_id=${termId} FOR UPDATE`;
    await this.workflowDb
      .$queryRaw`SELECT term_id FROM public."DEFENSE_STAGE_WORKFLOW" WHERE term_id=${termId} ORDER BY stage FOR UPDATE`;
    // Existing producer writers do not all use the parent protocol. Also lock
    // the authoritative rows they mutate; every query remains parameterized.
    await this.workflowDb
      .$queryRaw`SELECT "termId" FROM public."TERM_WORKFLOW" WHERE "termId"=${termId} FOR UPDATE`;
    await this.workflowDb
      .$queryRaw`SELECT id FROM public."ASSIGNMENT_PLAN" WHERE term_id=${termId} ORDER BY id FOR UPDATE`;
    await this.workflowDb
      .$queryRaw`SELECT w."planId" FROM public."ASSIGNMENT_PLAN_WORKFLOW" w JOIN public."ASSIGNMENT_PLAN" p ON p.id=w."planId" WHERE p.term_id=${termId} ORDER BY w."planId" FOR UPDATE OF w`;
    await this.workflowDb
      .$queryRaw`SELECT id FROM public."REGISTRATION" WHERE term_id=${termId} ORDER BY id FOR UPDATE`;
    await this.workflowDb
      .$queryRaw`SELECT a.id FROM public."ADVISOR_ASSIGNMENT" a JOIN public."REGISTRATION" r ON r.id=a.registration_id WHERE r.term_id=${termId} ORDER BY a.id FOR UPDATE OF a`;
    await this.workflowDb
      .$queryRaw`SELECT c.id FROM public."ASSIGNMENT_CHANGE" c JOIN public."ADVISOR_ASSIGNMENT" a ON a.id=c."assignmentId" JOIN public."REGISTRATION" r ON r.id=a.registration_id WHERE r.term_id=${termId} ORDER BY c.id FOR UPDATE OF c`;
    await this.workflowDb
      .$queryRaw`SELECT id FROM public."TERM_STUDENT" WHERE term_id=${termId} ORDER BY id FOR UPDATE`;
    await this.workflowDb
      .$queryRaw`SELECT lecturer_id FROM public."TERM_LECTURER" WHERE term_id=${termId} ORDER BY lecturer_id FOR UPDATE`;
    await this.workflowDb
      .$queryRaw`SELECT id FROM public."PROPOSAL" WHERE term_id=${termId} ORDER BY id FOR UPDATE`;
    await this.workflowDb
      .$queryRaw`SELECT c.id FROM public."DEFENSE_CONFIRMATION" c JOIN public."PROPOSAL" p ON p.id=c.proposal_id WHERE p.term_id=${termId} ORDER BY c.id FOR UPDATE OF c`;
    await this.workflowDb
      .$queryRaw`SELECT f.id FROM public."FINAL_REPORT" f JOIN public."PROPOSAL" p ON p.id=f.proposal_id WHERE p.term_id=${termId} ORDER BY f.id FOR UPDATE OF f`;
  }
  async now() {
    const [row] = await this.workflowDb.$queryRaw<
      { at: Date }[]
    >`SELECT clock_timestamp() AS at`;
    return row.at;
  }
  async pdfLock(key: string) {
    await this.workflowDb
      .$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
  }
  async resources(keys: string[]) {
    for (const key of [...new Set(keys)].sort())
      await this.workflowDb
        .$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`defense-booking:${key}`}, 0))::text`;
    const rooms = [
      ...new Set(
        keys.filter((k) => k.startsWith("ROOM:")).map((k) => k.slice(5)),
      ),
    ].sort();
    if (rooms.length)
      await this.workflowDb
        .$queryRaw`SELECT id FROM public."ROOM" WHERE id IN (${Prisma.join(rooms)}) ORDER BY id FOR UPDATE`;
  }
  async officialBookings() {
    // All current FINALIZED/PUBLISHED schedules reserve resources. Old immutable
    // publications remain historical and are not double-counted on amendment.
    return this.workflowDb.defenseStageWorkflow.findMany({
      where: { stage: "SCHEDULE", state: { in: ["FINALIZED", "PUBLISHED"] } },
      include: { currentArtifact: true },
    });
  }
  newEvidence(data: Prisma.DefenseAcademicEvidenceUncheckedCreateInput) {
    return this.workflowDb.defenseAcademicEvidence.create({ data });
  }
  policy(
    termId: string,
    revision: number,
    data: Prisma.DefenseListUncheckedUpdateManyInput,
  ) {
    return this.workflowDb.defenseList.updateMany({
      where: { termId, workflowPolicyRevision: revision },
      data,
    });
  }
  listCas(
    termId: string,
    revision: number,
    data: Prisma.DefenseListUncheckedUpdateManyInput,
  ) {
    return this.workflowDb.defenseList.updateMany({
      where: { termId, revision },
      data,
    });
  }
  finalization(data: Prisma.DefenseListFinalizationUncheckedCreateInput) {
    return this.workflowDb.defenseListFinalization.create({ data });
  }
  async finalizationVersion(termId: string) {
    const row = await this.workflowDb.defenseListFinalization.findFirst({
      where: { termId },
      orderBy: { version: "desc" },
    });
    return row?.version ?? 0;
  }
  listFinalizations(termId: string) {
    return this.workflowDb.defenseListFinalization.findMany({
      where: { termId },
      orderBy: { version: "asc" },
    });
  }
  createStage(data: Prisma.DefenseStageWorkflowUncheckedCreateInput) {
    return this.workflowDb.defenseStageWorkflow.create({ data });
  }
  stageCas(
    termId: string,
    stage: DefenseStage,
    revision: number,
    data: Prisma.DefenseStageWorkflowUncheckedUpdateManyInput,
  ) {
    return this.workflowDb.defenseStageWorkflow.updateMany({
      where: { termId, stage, revision },
      data,
    });
  }
  newArtifact(data: Prisma.DefenseStageArtifactUncheckedCreateInput) {
    return this.workflowDb.defenseStageArtifact.create({ data });
  }
  idempotency(actorId: string, method: string, route: string, key: string) {
    return this.workflowDb.idempotencyRecord.findUnique({
      where: {
        actorId_method_route_key: { actorId, method, route, key },
      },
    });
  }
  rememberCommand(data: Prisma.IdempotencyRecordUncheckedCreateInput) {
    return this.workflowDb.idempotencyRecord.create({ data });
  }
  async notifyRecipients(
    userIds: string[],
    termId: string,
    title: string,
    link: string,
  ) {
    // Existing in-app Notification consumer, not a new mail transport. Delivery
    // and audit are atomic with the stage seal; client reads notifications normally.
    const users = await this.workflowDb.userAccount.findMany({
      where: {
        id: { in: [...new Set(userIds)] },
        status: "ACTIVE",
        mustChangePassword: false,
      },
      select: { id: true },
    });
    if (users.length)
      await this.workflowDb.notification.createMany({
        data: users.map((u) => ({
          userId: u.id,
          termId,
          title,
          body: "Thông tin bảo vệ đã thay đổi. Mở trang để tra cứu theo quyền hiện hành.",
          link,
        })),
      });
  }
  publicTerms() {
    return this.workflowDb.defenseStageWorkflow.findMany({
      where: { stage: "SCHEDULE", state: "PUBLISHED" },
      select: { termId: true },
    });
  }
  lecturerUsers(ids: string[]) {
    return this.workflowDb.lecturer.findMany({
      where: { id: { in: ids }, isActive: true },
      select: { id: true, userId: true },
    });
  }
}

@Injectable()
export class DefenseWorkflowRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async transaction<T>(
    write: boolean,
    work: (
      s: DefenseWorkflowSession,
      tx: Prisma.TransactionClient,
    ) => Promise<T>,
  ) {
    try {
      return await this.prisma.$transaction(
        (tx) => work(new DefenseWorkflowSession(tx), tx),
        {
          isolationLevel: write ? "ReadCommitted" : "RepeatableRead",
          maxWait: 10000,
          timeout: 60000,
        },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        const sqlCode = String(error.meta?.code ?? "");
        if (
          ["P2021", "P2022"].includes(error.code) ||
          (error.code === "P2010" && ["42P01", "42703"].includes(sqlCode))
        )
          planningError(
            503,
            "DEFENSE_WORKFLOW_UNAVAILABLE",
            "Schema workflow chưa sẵn sàng; không thể lưu dữ liệu.",
          );
        if (
          ["P2002", "P2034", "P2028"].includes(error.code) ||
          (error.code === "P2010" &&
            ["55P03", "40P01", "57014", "40001"].includes(sqlCode))
        )
          planningError(
            409,
            "DEFENSE_WORKFLOW_CONFLICT",
            "Nguồn đang thay đổi hoặc chờ khóa quá lâu; hãy tải lại.",
          );
      }
      throw error;
    }
  }
}
