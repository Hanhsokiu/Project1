import 'reflect-metadata';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { RequestMethod } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { CommitteeController } from './committee.controller';
import { CommitteeService } from '../service/committee.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { UserAccountRepository } from '../../auth/repository/user-account.repository';
import type { RbacService } from '../../auth/service/rbac.service';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import { PermissionsGuard } from '../../common/security/permissions.guard';
import { GlobalExceptionHandler } from '../../common/exception/global-exception.handler';

describe('Legacy committee reader temporary fail-closed protection', () => {
  // Only in-memory doubles are provided; no PrismaModule or database connection.
  // HTTP requests exercise the actual controller, JWT/permission guards/filter.
  const privateCommittee = {
    id: 'private-committee-id',
    name: 'private-committee-name',
    members: [{ lecturer: { email: 'private-lecturer@example.invalid' } }],
    defenseSessions: [{ room: { name: 'private-room-name' } }],
  };
  const database = {
    defenseCommittee: { findMany: vi.fn().mockResolvedValue([privateCommittee]) },
    committeeMember: { findMany: vi.fn() },
    defenseSession: { findMany: vi.fn() },
    lecturer: { findMany: vi.fn() },
    room: { findMany: vi.fn() },
  };
  const reader = new CommitteeService(database as unknown as PrismaService);
  const readCommittees = vi.spyOn(reader, 'findByTerm');
  const users = { findById: vi.fn(), session: vi.fn() };
  const rbac = { hasPermission: vi.fn().mockResolvedValue(true) };
  const jwt = new JwtService({ secret: 'isolated-committee-reader-test-secret' });
  const termId = '00000000-0000-4000-8000-000000000001';
  let app: INestApplication;
  let baseUrl: string;

  function identity(role: string) {
    return {
      id: 'test-user',
      username: 'test-user',
      displayName: 'Test user',
      email: 'test@example.invalid',
      phone: '0900000000',
      status: 'ACTIVE',
      mustChangePassword: false,
      student: null,
      lecturer: null,
      userRoles: [{ role: { name: role, rolePermissions: [] } }],
    };
  }

  async function getCommittees(id = termId, token?: string) {
    const response = await fetch(`${baseUrl}/api/committees/term/${id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return { status: response.status, body: await response.json() };
  }

  async function tokenFor(role: string) {
    users.findById.mockResolvedValue(identity(role));
    return jwt.signAsync({ sub: 'test-user', sid: 'test-session' });
  }

  function expectNoCommitteeReads() {
    expect(readCommittees).not.toHaveBeenCalled();
    for (const model of Object.values(database))
      expect(model.findMany).not.toHaveBeenCalled();
  }

  function expectDisabled(result: { status: number; body: unknown }) {
    expect(result.status).toBe(403);
    expect(result.body).toMatchObject({
      success: false,
      data: null,
      error: {
        code: 'COMMITTEE_READING_NOT_ENABLED',
        message: 'Chức năng đọc hội đồng chưa được mở.',
      },
    });
    const body = JSON.stringify(result.body);
    for (const secret of [
      privateCommittee.id,
      privateCommittee.name,
      privateCommittee.members[0].lecturer.email,
      privateCommittee.defenseSessions[0].room.name,
    ])
      expect(body).not.toContain(secret);
    expectNoCommitteeReads();
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [CommitteeController],
      providers: [{ provide: CommitteeService, useValue: reader }],
    }).compile();
    app = module.createNestApplication({ logger: false });
    const reflector = new Reflector();
    app.setGlobalPrefix('api');
    app.useGlobalGuards(
      new JwtAuthGuard(
        reflector,
        jwt,
        users as unknown as UserAccountRepository,
      ),
      new PermissionsGuard(reflector, rbac as unknown as RbacService),
    );
    app.useGlobalFilters(new GlobalExceptionHandler());
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    users.session.mockResolvedValue({
      id: 'test-session',
      userId: 'test-user',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('preserves the existing GET route', () => {
    expect(Reflect.getMetadata(PATH_METADATA, CommitteeController)).toBe(
      'committees',
    );
    expect(
      Reflect.getMetadata(
        PATH_METADATA,
        CommitteeController.prototype.getCommittees,
      ),
    ).toBe('term/:termId');
    expect(
      Reflect.getMetadata(
        METHOD_METADATA,
        CommitteeController.prototype.getCommittees,
      ),
    ).toBe(RequestMethod.GET);
  });

  it('returns 401 for unauthenticated requests without reading committees', async () => {
    const result = await getCommittees();
    expect(result.status).toBe(401);
    expect(result.body).toMatchObject({ success: false, data: null });
    expect(users.findById).not.toHaveBeenCalled();
    expectNoCommitteeReads();
  });

  it('rejects an invalid JWT before the locked handler', async () => {
    const result = await getCommittees(termId, 'invalid-token');
    expect(result.status).toBe(401);
    expect(result.body.data).toBeNull();
    expectNoCommitteeReads();
  });

  it.each(['STUDENT', 'LECTURER', 'COMMITTEE', 'FACULTY', 'ADMIN'])(
    'returns 403 for authenticated %s without calling the reader or leaking data',
    async (role) => {
      const result = await getCommittees(termId, await tokenFor(role));
      expectDisabled(result);
      expect(users.findById).toHaveBeenCalledWith('test-user');
      expect(users.session).toHaveBeenCalledWith('test-session');
    },
  );

  it('does not probe whether a term exists, even for ADMIN', async () => {
    expectDisabled(
      await getCommittees(
        '00000000-0000-4000-8000-000000000099',
        await tokenFor('ADMIN'),
      ),
    );
  });

  it('keeps revoked sessions behind the existing JWT guard', async () => {
    const token = await tokenFor('ADMIN');
    users.session.mockResolvedValueOnce(null);
    const result = await getCommittees(termId, token);
    expect(result.status).toBe(401);
    expect(result.body.data).toBeNull();
    expectNoCommitteeReads();
  });
});
