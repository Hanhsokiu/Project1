import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { GroupState, GroupForm, MemberTable } from './components';
import { GroupCreateSchema, GroupUpdateSchema } from '@doan/shared';
import type { GroupOptions } from '@doan/shared';
describe('Review group frontend validation and render smoke', () => {
  it('renders loading, empty and error states', () => {
    expect(renderToStaticMarkup(<GroupState loading />)).toContain(
      'role="status"',
    );
    expect(renderToStaticMarkup(<GroupState empty />)).toContain(
      'Chưa có nhóm duyệt',
    );
    expect(
      renderToStaticMarkup(<GroupState error="Không đủ quyền" />),
    ).toContain('role="alert"');
  });
  it('renders members and the single member role without inventing a chair', () => {
    const html = renderToStaticMarkup(
      <MemberTable
        members={[
          {
            lecturerId: 'gv-a',
            fullName: 'Nguyễn An',
            lecturerCode: 'GV01',
            role: 'MEMBER',
          },
        ]}
      />,
    );
    expect(html).toContain('Nguyễn An');
    expect(html).toContain('Thành viên duyệt');
    expect(html).not.toContain('Trưởng nhóm');
  });
  it('renders accessible form and blocks controls for read-only user', () => {
    const options: GroupOptions = {
      term: { id: 't', name: 'Đợt 1', status: 'DRAFT' },
      canManage: false,
      departments: [],
      lecturers: { data: [], total: 0, page: 1, limit: 20, totalPages: 0 },
    };
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <GroupForm
          options={options}
          busy={false}
          onSubmit={() => {}}
          search=""
          onSearch={() => {}}
          onPage={() => {}}
          currentPage={1}
        />
      </MemoryRouter>,
    );
    expect(html).toContain('aria-label="Tên nhóm"');
    expect(html).toContain('disabled');
    expect(html).toContain('không có quyền quản lý');
  });
  it('uses the same strict schema for names, duplicate members and update reasons', () => {
    expect(
      GroupCreateSchema.safeParse({
        name: ' ',
        departmentId: 'd',
        memberLecturerIds: [],
      }).success,
    ).toBe(false);
    expect(
      GroupCreateSchema.safeParse({
        name: 'N',
        departmentId: 'd',
        memberLecturerIds: ['x', 'x'],
      }).success,
    ).toBe(false);
    expect(
      GroupUpdateSchema.safeParse({
        name: 'N',
        expectedRevision: 0,
        reason: '',
      }).success,
    ).toBe(false);
    expect(
      GroupCreateSchema.safeParse({
        name: 'N',
        departmentId: 'dept-opaque',
        memberLecturerIds: [],
      }).success,
    ).toBe(true);
  });
});
