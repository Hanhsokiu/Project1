import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import type { ProposalReviewView } from '@doan/shared';
import {
  ProposalContent,
  ReviewEvidence,
  ReviewState,
  DecisionForm,
} from './components';
describe('Step 5 UI rendering and data separation', () => {
  it('renders loading/error/empty states', () => {
    expect(renderToStaticMarkup(<ReviewState loading />)).toContain(
      'role="status"',
    );
    expect(
      renderToStaticMarkup(<ReviewState error="Ngoài phạm vi" />),
    ).toContain('role="alert"');
    expect(renderToStaticMarkup(<ReviewState empty />)).toContain(
      'Chưa có đề cương',
    );
  });
  it('renders submitted content as escaped text, not executable HTML', () => {
    const html = renderToStaticMarkup(
      <ProposalContent content={{ objectives: '<script>alert(1)</script>' }} />,
    );
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
  it('separates member comments from the single common decision', () => {
    const review = {
      comments: [
        {
          id: 'c',
          authorName: 'GV A',
          createdAt: '2026-01-01Z',
          text: 'Nhận xét',
        },
      ],
      decision: {
        decision: 'REVISION_REQUIRED',
        deciderName: 'GV B',
        decidedAt: '2026-01-01Z',
        comment: 'Bổ sung phạm vi',
      },
    } as ProposalReviewView;
    const html = renderToStaticMarkup(<ReviewEvidence review={review} />);
    expect(html).toContain('Kết luận chung của vòng');
    expect(html).toContain('Nhận xét thành viên');
    expect(html).toContain('Chưa áp dụng tiêu chí');
  });
  it('shows the exact version/round and warns approval is not dossier finalization', () => {
    const review = {
      proposalRevision: 2,
      revision: 3,
      versionId: 'v',
      versionNumber: 4,
      roundNumber: 2,
    } as ProposalReviewView;
    const html = renderToStaticMarkup(
      <DecisionForm review={review} busy={false} onSubmit={() => {}} />,
    );
    expect(html).toContain('phiên bản 4');
    expect(html).toContain('vòng 2');
    expect(html).toContain('APPROVED chưa phải là Khoa chốt hồ sơ');
  });
});
