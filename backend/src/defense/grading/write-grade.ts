import type { Prisma } from "@prisma/client";
import { groupError } from "../../topic/review-groups/review-group.errors";
// Shared persistence primitive; role is selected by a trusted service, never browser input.
export async function writeOwnedGrade(
  db: Prisma.TransactionClient,
  role: "REVIEWER" | "COMMITTEE_MEMBER",
  proposalId: string,
  scorerId: string,
  expected: number,
  data: Prisma.ScoreEntryUncheckedCreateInput,
  details: Record<string, string>,
) {
  const id = data.id!;
  if (expected === 0)
    await db.scoreEntry.create({
      data: {
        ...data,
        isLocked: false,
        proposalId,
        scorerId,
        role,
        revision: 1,
      },
    });
  else {
    const changed = await db.scoreEntry.updateMany({
      where: {
        id,
        proposalId,
        scorerId,
        role,
        revision: expected,
        isLocked: false,
      },
      data: {
        totalScore: data.totalScore,
        comment: data.comment,
        context: data.context,
        reportVersionId: data.reportVersionId,
        isLocked: false,
        revision: expected + 1,
      },
    });
    if (changed.count !== 1)
      groupError(409, "REVISION_CONFLICT", "Phiếu đã thay đổi hoặc đã khóa.");
  }
  await db.scoreDetail.deleteMany({ where: { scoreEntryId: id } });
  if (Object.keys(details).length)
    await db.scoreDetail.createMany({
      data: Object.entries(details).map(([rubricCriteriaId, score]) => ({
        scoreEntryId: id,
        rubricCriteriaId,
        score,
      })),
    });
  if (data.isLocked)
    await db.scoreEntry.update({ where: { id }, data: { isLocked: true } });
}
