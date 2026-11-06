import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { emptyProposalContent } from '@doan/shared';
import {
  ProposalFields,
  RevisionFeedback,
  VersionChanges,
  localDateTime,
  fromLocalDateTime,
} from './components';
describe('Step 6 editor UI', () => {
  it('renders the content template and disabled fields for a read-only version', () => {
    const html = renderToStaticMarkup(
      <ProposalFields
        content={emptyProposalContent}
        disabled
        onChange={() => {}}
      />,
    );
    expect(html).toContain('<fieldset disabled');
    for (const label of [
      'Mục tiêu',
      'Phạm vi',
      'Nội dung chính',
      'Kết quả dự kiến',
      'Thêm mốc kế hoạch',
    ])
      expect(html).toContain(label);
  });
  it('keeps original feedback separate from a snapshot response and escapes HTML', () => {
    const html = renderToStaticMarkup(
      <RevisionFeedback
        feedback={[
          {
            targetType: 'DECISION',
            targetId: 'd',
            reviewId: 'r',
            sourceVersionId: 'v1',
            versionNumber: 1,
            roundNumber: 1,
            authorUserId: 'gv',
            authorName: 'GV A',
            text: '<script>old</script>',
            createdAt: '2026-01-01Z',
          },
        ]}
        responses={[
          { targetType: 'DECISION', targetId: 'd', text: 'Đã sửa trong v2' },
        ]}
        disabled
        onChange={() => {}}
      />,
    );
    expect(html).toContain('v1');
    expect(html).toContain('Đã sửa trong v2');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
  it('renders actual changed field values and an empty comparison', () => {
    expect(renderToStaticMarkup(<VersionChanges changes={[]} />)).toContain(
      'Không có khác biệt',
    );
    const html = renderToStaticMarkup(
      <VersionChanges
        changes={[
          {
            path: '/content/scope',
            before: 'Cũ',
            after: 'Mới',
            beforeExists: true,
            afterExists: true,
          },
        ]}
      />,
    );
    expect(html).toContain('Cũ');
    expect(html).toContain('Mới');
    expect(html).toContain('/content/scope');
  });
  it('round-trips Vietnam local date/time without silently using machine timezone', () => {
    const value = '2026-10-22T15:30';
    expect(localDateTime(fromLocalDateTime(value))).toBe(value);
    expect(localDateTime('2026-10-22T08:30:00Z')).toBe(value);
    expect(fromLocalDateTime('')).toBe('');
  });
});
