import { z } from "zod";
export const proposalContent = z
  .object({
    title: z.string().trim().min(5).max(500),
    objectives: z.string().trim().max(15000),
    scope: z.string().trim().max(20000),
    technology: z.string().trim().max(10000),
    expected: z.string().trim().max(15000),
    plan: z
      .array(
        z
          .object({
            week: z.string().trim().max(100),
            content: z.string().trim().max(3000),
          })
          .strict(),
      )
      .max(100),
  })
  .strict();
export const proposalWrite = z
  .object({
    content: proposalContent,
    expectedVersion: z.number().int().min(0),
  })
  .strict();
export type ProposalContent = z.infer<typeof proposalContent>;
