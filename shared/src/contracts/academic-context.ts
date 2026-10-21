/** PR1 §3 integration contracts. Types only; producers/policies are not implemented here. */
export type Id = string; // Opaque identifier; legacy seeds are not necessarily UUIDs.
export type Instant = string; // ISO-8601 with offset; output UTC Z.
export type Revision = number; // Integer >= 0, checked at API boundaries.

export type CurrentUserResponse = {
  userId: Id;
  username: string;
  roles: string[];
  permissions: string[];
  studentId: Id | null;
  lecturerId: Id | null;
  termGrants: Array<{ termId: Id; departmentIds: Id[] | null }>;
  reviewMemberships: Array<{ groupId: Id; termId: Id }>;
};

export type OfficialAdvisorContext = {
  termId: Id;
  termStudentId: Id;
  registrationId: Id;
  assignmentPlanId: Id;
  planStatus: 'FINALIZED';
  planRevision: Revision;
  advisorAssignmentId: Id;
  advisorId: Id;
  revision: Revision;
  finalizedAt: Instant;
  effectiveAt: Instant;
};

export type TopicAgreement = {
  topicRevision: Revision;
  confirmedByAdvisorId: Id;
  advisorAssignmentRevision: Revision;
  confirmedAt: Instant;
};

export type SubmittedProposalContext = {
  termId: Id;
  termStudentId: Id;
  topicId: Id;
  proposalId: Id;
  proposalRevision: Revision;
  status: 'SUBMITTED';
  submittedVersionId: Id;
  versionNumber: number;
  submittedAt: Instant;
  submittedByUserId: Id;
  submissionKind: 'INITIAL' | 'RESUBMISSION';
  contentSchemaVersion: 1;
  contentHash: string;
  agreement: TopicAgreement;
  officialAdvisor: OfficialAdvisorContext;
};

export type GuidancePeriodContext = {
  periodId: Id;
  termId: Id;
  ordinal: number;
  label: string;
  startsAt: Instant;
  endsAt: Instant;
  reportDueAt: Instant;
  revision: Revision;
  requiredTermStudentIds: Id[];
};
