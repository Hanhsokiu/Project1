import { httpClient } from '../../shared/api/http-client';
import type {
  AssignReview,
  ReviewQuery,
  ProposalReviewPage,
  ProposalReviewSummary,
  ProposalReviewView,
  ReviewCandidate,
  ReviewStart,
  ReviewCommentInput,
  ReviewDecisionInput,
} from '@doan/shared';
type Envelope<T> = { success: true; data: T; timestamp: string };
const read = async <T>(path: string, params?: object) =>
  (await httpClient.get<Envelope<T>>(path, { params })).data.data;
const post = async <T>(path: string, body: unknown, key: string) =>
  (
    await httpClient.post<Envelope<T>>(path, body, {
      headers: { 'Idempotency-Key': key },
    })
  ).data.data;
export type ReviewOptions = {
  term: { id: string; name: string; status: string };
  departments: Array<{ id: string; name: string }>;
  canAssign: boolean;
  phase: { startsAt: string; endsAt: string; isLocked: boolean } | null;
};
export type ReviewProposalDetail = ProposalReviewSummary & {
  version: {
    id: string;
    versionNumber: number;
    content: unknown;
    contentHash: string;
    submittedAt: string;
  };
};
export const proposalReviewApi = {
  terms: () =>
    read<Array<{ id: string; name: string; status: string }>>(
      '/proposal-review-options/terms',
    ),
  options: (termId: string) =>
    read<ReviewOptions>(
      `/terms/${encodeURIComponent(termId)}/proposal-review-options`,
    ),
  list: (termId: string, q: ReviewQuery) =>
    read<ProposalReviewPage>(
      `/terms/${encodeURIComponent(termId)}/proposals`,
      q,
    ),
  proposal: (id: string) =>
    read<ReviewProposalDetail>(`/proposals/${encodeURIComponent(id)}`),
  candidates: (id: string) =>
    read<ReviewCandidate[]>(
      `/proposals/${encodeURIComponent(id)}/review-candidates`,
    ),
  history: (id: string) =>
    read<ProposalReviewView[]>(
      `/proposals/${encodeURIComponent(id)}/review-history`,
    ),
  detail: (id: string) =>
    read<ProposalReviewView>(`/proposal-reviews/${encodeURIComponent(id)}`),
  assign: (id: string, input: AssignReview, key: string) =>
    post<ProposalReviewView>(
      `/proposals/${encodeURIComponent(id)}/review-assignments`,
      input,
      key,
    ),
  start: (id: string, input: ReviewStart, key: string) =>
    post<ProposalReviewView>(
      `/proposal-reviews/${encodeURIComponent(id)}/start`,
      input,
      key,
    ),
  comment: (id: string, input: ReviewCommentInput, key: string) =>
    post<ProposalReviewView>(
      `/proposal-reviews/${encodeURIComponent(id)}/comments`,
      input,
      key,
    ),
  decision: (id: string, input: ReviewDecisionInput, key: string) =>
    post<ProposalReviewView>(
      `/proposal-reviews/${encodeURIComponent(id)}/decision`,
      input,
      key,
    ),
};
