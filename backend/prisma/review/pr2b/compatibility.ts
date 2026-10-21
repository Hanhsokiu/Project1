import { Prisma as Legacy } from '../../../node_modules/.pr2b-legacy';
import { Prisma as Expanded } from '../../../node_modules/.pr2b-client';
import type { UserAccountRepository } from '../../../src/auth/repository/user-account.repository';

// Bidirectional type compatibility for raw API payloads already in use.
type TopicInclude = { include: { proposals: true; researchArea: true } };
type StudentInclude = { include: { proposal: true; trainingSystem: true } };
type RegistrationInclude = { include: { student: true; preferences: true; advisorAssignment: { include: { advisor: true } } } };
type TermInclude = { include: { phases: true; parameters: true; termLecturers: true } };
type TaskInclude = { include: { submissions: true } };
type Compatible<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const topic: Compatible<Legacy.TopicGetPayload<TopicInclude>, Expanded.TopicGetPayload<TopicInclude>> = true;
const student: Compatible<Legacy.StudentGetPayload<StudentInclude>, Expanded.StudentGetPayload<StudentInclude>> = true;
const registration: Compatible<Legacy.RegistrationGetPayload<RegistrationInclude>, Expanded.RegistrationGetPayload<RegistrationInclude>> = true;
const term: Compatible<Legacy.ThesisTermGetPayload<TermInclude>, Expanded.ThesisTermGetPayload<TermInclude>> = true;
const task: Compatible<Legacy.TaskGetPayload<TaskInclude>, Expanded.TaskGetPayload<TaskInclude>> = true;
// Test the actual repository input; arbitrary cross-client nested-write types
// are not a public API contract and change recursively when relations expand.
const writeInput: Expanded.UserAccountCreateInput = {} as Parameters<UserAccountRepository['create']>[0];
void [topic, student, registration, term, task, writeInput];
