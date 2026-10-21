"""Prepare review artifacts only; never connects to a database or applies SQL.

Workflow sidecars preserve existing Prisma scalar/API shapes during expand.
Reads the frozen unexpanded baseline snapshot. Review outputs are overwritten
deterministically, but active schema.prisma and 0_init are never written.
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'backend/prisma/review/pr2b'
SCHEMA = OUT / 'baseline.prisma'
# Frozen compatibility baseline; active schema now includes the expansion.
base = SCHEMA.read_text(encoding='utf-8')
assert 'model TopicWorkflow' not in base, 'Input must be the unexpanded compatibility schema'
OUT.mkdir(parents=True, exist_ok=True)
(OUT / 'legacy-client.prisma').write_text(base.replace('provider = "prisma-client-js"', 'provider = "prisma-client-js"\n  output = "../../../node_modules/.pr2b-legacy"', 1), encoding='utf-8')

enums = {
 'WorkflowPhaseKey': 'PROPOSAL_EDIT PROPOSAL_REVIEW GUIDANCE',
 'ProposalVersionState': 'DRAFT SEALED',
 'ProposalSubmissionKind': 'INITIAL RESUBMISSION',
 'ProposalReviewState': 'ASSIGNED IN_REVIEW DECIDED SUPERSEDED',
 'ProposalReviewResult': 'APPROVED REVISION_REQUIRED',
 'DossierState': 'DRAFT FINALIZED RECEIVED REOPENED',
 'GuidancePlanState': 'ACTIVE PAUSED ARCHIVED',
 'GuidancePeriodType': 'WEEK MILESTONE',
 'TaskWorkflowState': 'TODO IN_PROGRESS SUBMITTED REVISION_REQUESTED COMPLETED CANCELLED',
 'GuidanceTaskKind': 'WEEKLY_REPORT AD_HOC',
 'SubmissionState': 'SUBMITTED REVIEWED SUPERSEDED',
 'ProgressReviewResult': 'PASS FAIL REVISION_REQUIRED',
 'ProgressReviewState': 'RECORDED SUPERSEDED',
 'FileAssetKind': 'REPORT SOURCE EVIDENCE DOSSIER_PDF RECEIPT_SCAN',
 'FileAssetState': 'READY QUARANTINED',
 'OutboxDeliveryState': 'PENDING PROCESSING DELIVERED FAILED',
}
models = {}
def model(name, fields='', refs=(), rules=()):
    models[name] = {'fields': fields.splitlines(), 'refs': refs, 'rules': rules}

# Reference tuple: field name, parent model, nullable, unique.
model('AcademicTermGrant', 'allDepartments Boolean @default(false)\nrevision Int @default(0)', [('userId','UserAccount',False,False),('termId','ThesisTerm',False,False)], ['@@unique([userId, termId])'])
model('GrantDepartment', refs=[('grantId','AcademicTermGrant',False,False),('departmentId','Department',False,False)], rules=['@@unique([grantId, departmentId])'])
model('ResearchAreaWorkflow', 'revision Int @default(0)', [('researchAreaId','ResearchArea',False,True),('departmentId','Department',True,False)])
model('TermWorkflow', 'revision Int @default(0)', [('termId','ThesisTerm',False,True),('officialAssignmentPlanId','AssignmentPlan',True,True)])
model('TermPhaseWorkflow', 'key WorkflowPhaseKey?\nrevision Int @default(0)', [('phaseId','TermPhase',False,True),('termId','ThesisTerm',False,False)], ['@@unique([termId, key])'])
model('AssignmentPlanWorkflow', 'revision Int @default(0)\nfinalizedAt DateTime? @db.Timestamptz(6)', [('planId','AssignmentPlan',False,True),('finalizedByUserId','UserAccount',True,False)])
model('AssignmentChange', 'assignmentRevision Int\neffectiveAt DateTime @db.Timestamptz(6)\nreason String', [('assignmentId','AdvisorAssignment',False,False),('oldAdvisorId','Lecturer',False,False),('newAdvisorId','Lecturer',False,False),('actorId','UserAccount',False,False)], ['@@unique([assignmentId, assignmentRevision])'])
model('TopicWorkflow', 'revision Int @default(0)\nconfirmedTopicRevision Int?\nconfirmedAssignmentRevision Int?\nconfirmedAt DateTime? @db.Timestamptz(6)', [('topicId','Topic',False,True),('termStudentId','TermStudent',True,True),('termId','ThesisTerm',True,False),('confirmedByAdvisorId','Lecturer',True,False)])
model('ProposalWorkflow', 'revision Int @default(0)\nnextVersionNumber Int?\nnextReviewRound Int?\nsubmissionKind ProposalSubmissionKind?', [('proposalId','Proposal',False,True),('workingVersionId','ProposalVersion',True,False),('submittedVersionId','ProposalVersion',True,False)])
model('ProposalVersionWorkflow', 'state ProposalVersionState?\ncontentSchemaVersion Int?\ncontentHash String?\nsubmittedAt DateTime? @db.Timestamptz(6)\nprovenance Json?\nrevision Int @default(0)', [('versionId','ProposalVersion',False,True),('createdByUserId','UserAccount',True,False),('submittedByUserId','UserAccount',True,False),('basedOnVersionId','ProposalVersion',True,False)])
model('ReviewGroupWorkflow', 'revision Int @default(0)', [('groupId','ReviewGroup',False,True),('departmentId','Department',True,False)])
model('ReviewMembershipHistory', 'action String\nreason String?', [('groupId','ReviewGroup',False,False),('lecturerId','Lecturer',False,False),('actorId','UserAccount',False,False)])
model('ProposalReviewWorkflow', 'roundNumber Int?\nstate ProposalReviewState?\nphaseSnapshot Json?\nroutingSnapshot Json?\nstartedAt DateTime? @db.Timestamptz(6)\nrevision Int @default(0)', [('reviewId','ProposalReview',False,True),('proposalId','Proposal',False,False),('versionId','ProposalVersion',True,False),('startedByUserId','UserAccount',True,False),('supersededByReviewId','ProposalReview',True,False)], ['@@unique([proposalId, roundNumber])','@@unique([reviewId, versionId])','@@index([proposalId, state])'])
model('ProposalReviewDecision', 'decision ProposalReviewResult\ncomment String?\ndecidedAt DateTime @db.Timestamptz(6)', [('reviewId','ProposalReview',False,True),('versionId','ProposalVersion',False,False),('decidedByUserId','UserAccount',False,False)])
model('ReviewComment', 'text String', [('reviewId','ProposalReview',False,False),('versionId','ProposalVersion',False,False),('authorUserId','UserAccount',False,False)], ['@@index([reviewId, createdAt])'])
model('DossierWorkflow', 'state DossierState?\nrevision Int @default(0)', [('dossierId','ThesisDossier',False,True),('currentFinalizationId','DossierFinalization',True,True)])
model('DossierFinalization', 'sequence Int\ntemplateVersion String\ncontentHash String\nfinalizedAt DateTime @db.Timestamptz(6)\nsupersededAt DateTime? @db.Timestamptz(6)\nreason String?', [('dossierId','ThesisDossier',False,False),('proposalId','Proposal',False,False),('versionId','ProposalVersion',False,False),('finalizedByUserId','UserAccount',False,False),('pdfAssetId','FileAsset',True,False)], ['@@unique([dossierId, sequence])','@@unique([id, dossierId])','@@unique([id, proposalId])'])
model('DossierReceipt', 'receivedAt DateTime @db.Timestamptz(6)\nnote String?', [('finalizationId','DossierFinalization',False,True),('receivedByUserId','UserAccount',False,False),('scanAssetId','FileAsset',True,False)])
model('DossierHistory', 'action String\nreason String\nsnapshot Json', [('dossierId','ThesisDossier',False,False),('actorId','UserAccount',False,False)])
model('GuidancePlanWorkflow', 'state GuidancePlanState?\nassignmentRevision Int?\nrevision Int @default(0)', [('planId','GuidancePlan',False,True),('proposalId','Proposal',False,False),('finalizationId','DossierFinalization',True,False),('assignmentId','AdvisorAssignment',True,False)])
model('PlanHistory', 'action String\nreason String\nsnapshot Json', [('planId','GuidancePlan',False,False),('actorId','UserAccount',False,False)])
model('GuidancePeriod', 'ordinal Int\nlabel String\ntype GuidancePeriodType\nstartsAt DateTime @db.Timestamptz(6)\nendsAt DateTime @db.Timestamptz(6)\nreportDueAt DateTime? @db.Timestamptz(6)\nrevision Int @default(0)', [('termId','ThesisTerm',False,False)], ['@@unique([termId, ordinal])','@@unique([id, termId])'])
model('PeriodRequiredStudent', refs=[('periodId','GuidancePeriod',False,False),('termStudentId','TermStudent',False,False),('termId','ThesisTerm',False,False)], rules=['@@unique([periodId, termStudentId])'])
model('WeeklyReportObligation', 'revision Int @default(0)\nconfigRevision Int\nconfigSnapshot Json', [('periodId','GuidancePeriod',False,False),('termStudentId','TermStudent',False,False),('planId','GuidancePlan',True,False),('currentTaskId','Task',True,True)], ['@@unique([periodId, termStudentId])','@@unique([id, periodId])','@@index([termStudentId, periodId])'])
model('TaskWorkflow', 'state TaskWorkflowState?\nkind GuidanceTaskKind?\nrequirements Json?\nnextSubmissionNumber Int?\ncancellationReason String?\nrevision Int @default(0)', [('taskId','Task',False,True),('planId','GuidancePlan',True,False),('periodId','GuidancePeriod',True,False),('obligationId','WeeklyReportObligation',True,False),('currentSubmissionId','TaskSubmission',True,False)], ['@@unique([taskId, obligationId])'])
model('TaskProgressEvent', 'note String', [('taskId','Task',False,False),('actorId','UserAccount',False,False)], ['@@index([taskId, createdAt])'])
model('TaskHistory', 'reason String\nsnapshot Json', [('taskId','Task',False,False),('actorId','UserAccount',False,False)])
model('SubmissionWorkflow', 'versionNumber Int?\nstate SubmissionState?\nsubmittedAt DateTime? @db.Timestamptz(6)\ndeadlineSnapshot DateTime? @db.Timestamptz(6)\nisLate Boolean?\nrevision Int @default(0)', [('submissionId','TaskSubmission',False,True),('taskId','Task',False,False),('submittedByUserId','UserAccount',True,False),('effectiveReviewId','ProgressReview',True,True)], ['@@unique([taskId, versionNumber])'])
model('ProgressReview', 'decision ProgressReviewResult\nstate ProgressReviewState\ncomment String?\nassignmentRevision Int\nrecordedAt DateTime @db.Timestamptz(6)\namendmentReason String?\nrevision Int @default(0)', [('submissionId','TaskSubmission',False,False),('reviewerUserId','UserAccount',False,False),('supersedesReviewId','ProgressReview',True,True)], ['@@unique([id, submissionId])','@@index([submissionId, recordedAt])'])
model('FileAsset', 'kind FileAssetKind\nstate FileAssetState\nstorageKey String @unique\noriginalName String\nsizeBytes Int\nmimeType String\nchecksum String', [('createdByUserId','UserAccount',False,False)])
model('SubmissionAsset', refs=[('submissionId','TaskSubmission',False,False),('fileId','FileAsset',False,False)], rules=['@@unique([submissionId, fileId])'])
model('MeetingWorkflow', 'mode String?\ndiscussion String?\nconclusion String?\nrevision Int @default(0)', [('meetingId','GuidanceMeeting',False,True),('authorUserId','UserAccount',True,False)])
model('MeetingHistory', 'reason String\nsnapshot Json', [('meetingId','GuidanceMeeting',False,False),('actorId','UserAccount',False,False)])
model('EvaluationWorkflow', 'criteriaSnapshot Json?\ncriterionScores Json?\nrevision Int @default(0)', [('evaluationId','PhaseEvaluation',False,True),('planId','GuidancePlan',False,False),('milestoneId','GuidancePeriod',True,False),('evaluatorUserId','UserAccount',True,False)], ['@@unique([planId, milestoneId])'])
model('EvaluationEvidence', refs=[('evaluationId','PhaseEvaluation',False,False),('fileId','FileAsset',False,False)], rules=['@@unique([evaluationId, fileId])'])
model('EvaluationHistory', 'reason String\nsnapshot Json', [('evaluationId','PhaseEvaluation',False,False),('actorId','UserAccount',False,False)])
model('OutboxEvent', 'eventId String @unique\ntype String\naggregateId String\npayload Json\nstate OutboxDeliveryState @default(PENDING)\nattempts Int @default(0)\nnextAttemptAt DateTime? @db.Timestamptz(6)', rules=['@@index([state, nextAttemptAt])'])
model('IdempotencyRecord', 'method String\nroute String\nkey String\npayloadHash String\nresult Json?\nexpiresAt DateTime @db.Timestamptz(6)', [('actorId','UserAccount',False,False)], ['@@unique([actorId, method, route, key])'])

inverses = {}
for child, spec in models.items():
    for field, parent, nullable, unique in spec['refs']:
        relation = f'{child}_{field}'
        inv = f'pr2b{child}{field[0].upper() + field[1:]}'
        inverses.setdefault(parent, []).append(f'  {inv} {child}{"?" if unique else "[]"} @relation("{relation}")')

def table_name(name):
    return re.sub(r'(?<!^)(?=[A-Z])', '_', name).upper()

expanded = base
for parent, fields in inverses.items():
    if parent not in models:
        expanded, n = re.subn(r'(model '+parent+r' \{)(.*?)(\n\})', lambda m:m[1]+m[2]+'\n\n'+'\n'.join(fields)+m[3], expanded, count=1, flags=re.S)
        assert n == 1, parent
expanded += '\n// PR2B EXPAND CANDIDATE: sidecars, no legacy scalar/cardinality changes.\n'
for name, values in enums.items(): expanded += f'\nenum {name} {{\n' + '\n'.join('  '+v for v in values.split()) + '\n}\n'
for name, spec in models.items():
    lines = ['  id String @id @default(uuid()) @db.VarChar(36)', '  createdAt DateTime @default(now()) @db.Timestamptz(6)', '  updatedAt DateTime @default(now()) @updatedAt @db.Timestamptz(6)']
    lines += ['  '+f for f in spec['fields'] if f]
    for field, parent, nullable, unique in spec['refs']:
        lines += [f'  {field} String{"?" if nullable else ""} {"@unique " if unique else ""}@db.VarChar(36)', f'  ref{field[0].upper()+field[1:]} {parent}{"?" if nullable else ""} @relation("{name}_{field}", fields: [{field}], references: [id], onDelete: Restrict, onUpdate: Cascade)']
    lines += inverses.get(name, [])
    lines += ['  '+r for r in spec['rules']]
    lines += [f'  @@map("{table_name(name)}")']
    expanded += '\nmodel '+name+' {\n'+'\n'.join(lines)+'\n}\n'
# Generated review client is isolated and ignored, never points application's
# @prisma/client at a schema not yet approved/applied to the shared database.
expanded = expanded.replace('provider = "prisma-client-js"', 'provider = "prisma-client-js"\n  output = "../../../node_modules/.pr2b-client"', 1)
(OUT / 'expand.prisma').write_text(expanded, encoding='utf-8')
print(f'Prepared baseline/expand review schemas: {len(models)} additive models, {len(enums)} new enums. Active schema unchanged.')

# Reconciliation for NEW EMPTY application baseline only, explicitly reviewed.
# No timestamp/onDelete rewrites, no enum value guessing, no legacy backfill.
tables = re.findall(r'@@map\("([A-Z_]+)"\)', base)
bridge = ['-- REVIEW ONLY: apply after unchanged 0_init, on empty application tables only.',
          '-- Converts legacy status VARCHAR to the existing Prisma enum contract.',
          'BEGIN;', 'DO $guard$ DECLARE t text; occupied boolean; BEGIN',
          '  FOREACH t IN ARRAY ARRAY[' + ','.join("'"+t+"'" for t in tables) + '] LOOP',
          "    EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I LIMIT 1)',t) INTO occupied;",
          "    IF occupied THEN RAISE EXCEPTION 'Baseline enum bridge requires empty application tables: %',t; END IF;",
          '  END LOOP;', 'END $guard$;']
old_enums = {m[1]:m[2].split() for m in re.finditer(r'enum (\w+) \{(.*?)\}', base, re.S)}
for name, values in old_enums.items(): bridge.append(f'CREATE TYPE public."{name}" AS ENUM ('+', '.join("'"+v+"'" for v in values)+');')
for block in re.finditer(r'model (\w+) \{(.*?)\n\}', base, re.S):
    table=re.search(r'@@map\("([^"]+)"\)',block[2])[1]
    for line in block[2].splitlines():
        field=re.match(r'\s*(\w+)\s+(\w+)(\?)?\s*(.*)',line)
        if not field or field[2] not in old_enums: continue
        col_match=re.search(r'@map\("([^"]+)"\)',field[4])
        col=col_match[1] if col_match else field[1]
        prefix=f'ALTER TABLE public."{table}" ALTER COLUMN "{col}" '
        bridge += [prefix+'DROP DEFAULT;',prefix+f'TYPE public."{field[2]}" USING "{col}"::text::public."{field[2]}";']
        default=re.search(r'@default\((\w+)\)',field[4])
        if default: bridge.append(prefix+f'SET DEFAULT \'{default[1]}\'::public."{field[2]}";')
bridge.append('COMMIT;')
(OUT/'01-empty-baseline-enum-bridge.sql').write_text('\n'.join(bridge)+'\n',encoding='utf-8',newline='\n')

# No Supabase SDK access to application tables is required by the architecture.
# Limit revocations to precisely these application-owned objects, never auth,
# storage, realtime, vault or unknown tables in the shared project's public schema.
objects = tables + [table_name(n) for n in models] + ['pr2b_weekly_coverage']
security = ['-- REVIEW: isolate application objects from public/Data API grants.', 'DO $api$ DECLARE t text; r text; BEGIN',
    ' FOREACH t IN ARRAY ARRAY['+','.join("'"+t+"'" for t in objects)+'] LOOP',
    "  EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC',t);",
    "  FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP",
    '   IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN',
    "    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I',t,r);",
    '   END IF;', '  END LOOP;', ' END LOOP;', 'END $api$;']
(OUT/'04-data-api-isolation.sql').write_text('\n'.join(security)+'\n',encoding='utf-8',newline='\n')
