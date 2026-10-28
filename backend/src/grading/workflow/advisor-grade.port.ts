import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type {
  VerifiedAdvisorGrade,
  VerifiedCouncilConfirmation,
} from "./grading-evidence";
export type AdvisorGrade = { state: "UNKNOWN" } | VerifiedAdvisorGrade;
export abstract class AdvisorGradeReader {
  abstract read(
    termId: string,
    proposalId: string,
    transaction: Prisma.TransactionClient,
  ): Promise<AdvisorGrade>;
}
/** UC16 weekly evaluations are not an authoritative end-of-thesis advisor grade.
 * Never promote ScoreEntry/EvaluationWorkflow legacy numbers into that grade. */
@Injectable()
export class UnknownAdvisorGradeReader extends AdvisorGradeReader {
  async read(
    _termId: string,
    _proposalId: string,
    _transaction: Prisma.TransactionClient,
  ): Promise<AdvisorGrade> {
    return { state: "UNKNOWN" };
  }
}

export type CouncilResultConfirmation =
  { state: "UNKNOWN" } | VerifiedCouncilConfirmation;
export abstract class CouncilResultConfirmationReader {
  abstract read(
    termId: string,
    proposalId: string,
    transaction: Prisma.TransactionClient,
  ): Promise<CouncilResultConfirmation>;
}
@Injectable()
export class UnknownCouncilResultConfirmationReader extends CouncilResultConfirmationReader {
  async read(
    _termId: string,
    _proposalId: string,
    _transaction: Prisma.TransactionClient,
  ): Promise<CouncilResultConfirmation> {
    return { state: "UNKNOWN" };
  }
}
