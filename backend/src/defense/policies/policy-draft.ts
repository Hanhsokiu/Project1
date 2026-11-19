import { policyKeys, PolicySetSchema } from "./policy-release";

/** An editable specification, never a value accepted by any runtime reader. */
export function createOfficialPolicyDraft() {
  const required = "__REQUIRED_DECISION__";
  const metadata = { version: required, status: "DRAFT", approvedBy: null, approvedAt: null };
  const referenced = { ...metadata, reference: required };
  const rounding = { mode: required, decimalPlaces: required };
  const criterion = { id: required, name: required, maxScore: required, weight: required, step: required };
  return {
    kind: "OFFICIAL_POLICY_DRAFT", termId: required, purpose: "OFFICIAL",
    authority: { decisionId: null, reference: null, actorId: null, approvedAt: null, contentHash: null },
    policies: {
      UC17_POLICY: { ...metadata, scoreStep: required, maxPdfBytes: required, replacementAfterDecision: required, rubric: required },
      UC18_POLICY: { ...metadata, phaseCode: required, progressRule: required,
        academicSources: [{ key: required, label: required, mode: "FACULTY_ATTESTATION" }] },
      UC19_POLICY: { ...referenced, phaseCode: required, chairCount: required, secretaryCount: required,
        distinctOfficers: true, allowEmptyFinalization: required, memberScope: required, studentScope: "SAME_DEPARTMENT",
        allowedTitleIds: required, maxCommitteesPerLecturer: required, maxStudentsPerCommittee: required, maxStudentsPerLecturer: required },
      UC20_POLICY: { ...referenced, phaseCode: required, reviewersPerStudent: required, maxReviewsPerLecturer: required,
        maxTotalStudentDuties: required, totalLoadRule: "ADVISOR_PLUS_COMMITTEE_PLUS_REVIEW", departmentRule: required,
        allowedTitleIds: required, expertiseRule: required, committeeMembership: required, formerAdvisorRule: required },
      UC21_POLICY: { ...referenced, phaseCode: required, timezone: "Asia/Ho_Chi_Minh", allowedDates: [required],
        periods: { MORNING: { start: required, end: required, breaks: [] }, AFTERNOON: { start: required, end: required, breaks: [] } },
        durationMin: required, bufferMin: required, sessionBufferMin: required, startStepMin: required,
        maxStudentsPerSession: required, minRoomCapacity: required, roomAccess: [{ roomId: required, departmentIds: [required] }],
        reviewerAttendance: required, nameRule: "LAST_TOKEN_MIDDLE_THEN_FAMILY", compoundFamilyNames: [],
        manualOrderAllowed: required, studentVisibility: required, lecturerVisibility: required, advisorCanView: required,
        publishNotBefore: required, crossTermConflicts: "ALL_TERMS", legacyRule: "BLOCK_SHARED_RESOURCES_UNTIL_RECONCILED" },
      UC22_POLICY: { ...referenced, phaseCode: required, scoreStep: required, draftAllowed: required,
        requiredFeedback: required, minimumQuestions: required, sourceChange: "BLOCK", afterFinalize: "IMMUTABLE",
        studentRelease: "WITHHELD", schedule: { required: required, requirePublished: required, window: required },
        rubric: { version: required, calculation: "WEIGHTED_NORMALIZED_10_EXACT", criteria: [{ ...criterion }] } },
      UC23_POLICY: { ...referenced, effectiveFrom: required, effectiveUntil: required, effectiveScope: "GRADING_WINDOW",
        phaseCode: "DEFENSE", gradingRoles: required, draftAllowed: required, commentRequired: required,
        sourceChange: "BLOCK", afterFinalize: "IMMUTABLE", studentRelease: "WITHHELD",
        schedule: { required: true, requirePublished: required, anchor: required }, defenseEvidence: required,
        rubric: { version: required, calculation: "WEIGHTED_NORMALIZED_10", missingOptional: required, rounding: { ...rounding },
          totalStep: required, criteria: [{ ...criterion, description: required, minScore: required, required: required }] } },
      UC24_POLICY: { ...referenced, formula: "WEIGHTED_SUM", advisorSource: required,
        components: [{ source: required, weight: required }], reviewerAggregate: { mode: required, rounding: { ...rounding } },
        committeeAggregate: { mode: required, rounding: { ...rounding } }, finalRounding: { ...rounding },
        finalStep: required, storageDecimalPlaces: required, passRule: required, classifications: [],
        confirmation: { scope: "STUDENT", rule: "ONE_PER_ROLE", roles: required, distinctActors: required, reasonRequired: required },
        separation: { finalizerNotConfirmer: required, publisherNotFinalizer: required },
        finalizeWindow: { phaseCode: "DEFENSE", notBefore: required, before: required },
        publication: { phaseCode: "DEFENSE", notBefore: required, before: required, studentFinal: required, studentComponents: required },
        sourceChange: "BLOCK", afterFinalize: "IMMUTABLE", sourceLock: "PRESERVE_PRODUCER_LOCKS" },
      UC25_POLICY: { ...referenced, memberResults: required, statisticsRelease: required, incompleteDraft: required,
        retentionDays: required, distribution: [], templates: [{ code: required, version: required, name: required,
          format: required, engineVersion: "UC25_V1", owner: required, status: "DRAFT", approval: null,
          effectiveFrom: required, effectiveUntil: required, roles: required, columns: required, draftAllowed: required,
          requirePublished: required, allowMissing: [], signatureRoles: required,
          institution: { school: required, faculty: required }, dossierTemplateVersion: required }], signature: "UNSIGNED_ONLY" },
    },
  };
}

/** Field paths can be shown to a human; no replacement or approval is inferred. */
export function unresolvedPolicyFields(value: unknown): string[] {
  const paths: string[] = [];
  function visit(v: unknown, path: string) {
    if (v === "__REQUIRED_DECISION__" || v === null) paths.push(path);
    else if (Array.isArray(v)) v.forEach((x, i) => visit(x, `${path}.${i}`));
    else if (v && typeof v === "object") Object.entries(v).forEach(([k, x]) => visit(x, path ? `${path}.${k}` : k));
  }
  visit(value, "");
  return paths;
}

export function officialPolicyDraftSummary() {
  const draft = createOfficialPolicyDraft();
  return { draft, policyKeys, unresolved: unresolvedPolicyFields(draft), runtimeValid: PolicySetSchema.safeParse(draft.policies).success };
}
