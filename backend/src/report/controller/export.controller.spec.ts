import 'reflect-metadata';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { RequestMethod } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { ExportController } from './export.controller';
import { ExportService } from '../service/export.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { UserAccountRepository } from '../../auth/repository/user-account.repository';
import type { RbacService } from '../../auth/service/rbac.service';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import { PermissionsGuard } from '../../common/security/permissions.guard';
import { GlobalExceptionHandler } from '../../common/exception/global-exception.handler';

describe('Legacy report statistics temporary fail-closed protection', () => {
  // No PrismaModule/database connection is used. The real HTTP controller,
  // JWT/permission guards and exception filter run with in-memory test doubles.
  const database = {
    thesisTerm: { count: vi.fn().mockResolvedValue(11) },
    student: { count: vi.fn().mockResolvedValue(222) },
    lecturer: { count: vi.fn().mockResolvedValue(33) },
    proposal: { count: vi.fn().mockResolvedValue(444) },
  };
  const reader = new ExportService(database as unknown as PrismaService);
  const readStats = vi.spyOn(reader, 'getGeneralStats');
  const users = { findById: vi.fn(), session: vi.fn() };
  const rbac = { hasPermission: vi.fn().mockResolvedValue(true) };
  const jwt = new JwtService({ secret: 'isolated-report-stats-test-secret' });
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

  async function getStats(token?: string, query = '') {
    const response = await fetch(`${baseUrl}/api/reports/stats${query}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return { status: response.status, body: await response.json() };
  }

  async function tokenFor(role: string) {
    users.findById.mockResolvedValue(identity(role));
    return jwt.signAsync({ sub: 'test-user', sid: 'test-session' });
  }

  function expectNoStatsReads() {
    expect(readStats).not.toHaveBeenCalled();
    for (const model of Object.values(database))
      expect(model.count).not.toHaveBeenCalled();
  }

  function expectDisabled(result: { status: number; body: unknown }) {
    expect(result.status).toBe(403);
    expect(result.body).toMatchObject({
      success: false,
      data: null,
      error: {
        code: 'REPORT_STATS_NOT_ENABLED',
        message: 'Chức năng thống kê toàn hệ thống chưa được mở.',
      },
    });
    for (const field of ['terms', 'students', 'lecturers', 'proposals'])
      expect(JSON.stringify(result.body)).not.toContain(`"${field}":`);
    expectNoStatsReads();
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ExportController],
      providers: [{ provide: ExportService, useValue: reader }],
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

  it('preserves the registered GET /reports/stats route', () => {
    expect(Reflect.getMetadata(PATH_METADATA, ExportController)).toBe('reports');
    expect(
      Reflect.getMetadata(PATH_METADATA, ExportController.prototype.getStats),
    ).toBe('stats');
    expect(
      Reflect.getMetadata(METHOD_METADATA, ExportController.prototype.getStats),
    ).toBe(RequestMethod.GET);
  });

  it('returns 401 before the handler when authentication is missing', async () => {
    const result = await getStats();
    expect(result.status).toBe(401);
    expect(result.body).toMatchObject({ success: false, data: null });
    expect(users.findById).not.toHaveBeenCalled();
    expectNoStatsReads();
  });

  it('rejects invalid JWTs without reading statistics', async () => {
    const result = await getStats('invalid-token');
    expect(result.status).toBe(401);
    expect(result.body.data).toBeNull();
    expectNoStatsReads();
  });

  it.each(['STUDENT', 'LECTURER', 'COMMITTEE', 'FACULTY', 'ADMIN'])(
    'returns 403 for authenticated %s without service calls or statistics',
    async (role) => {
      const result = await getStats(await tokenFor(role));
      expectDisabled(result);
      expect(users.findById).toHaveBeenCalledWith('test-user');
      expect(users.session).toHaveBeenCalledWith('test-session');
    },
  );

  it('does not allow query filters to bypass the lock', async () => {
    expectDisabled(
      await getStats(
        await tokenFor('ADMIN'),
        '?termId=test-term&trainingSystemId=test-system',
      ),
    );
  });

  it('keeps revoked sessions behind the existing JWT guard', async () => {
    const token = await tokenFor('ADMIN');
    users.session.mockResolvedValueOnce(null);
    const result = await getStats(token);
    expect(result.status).toBe(401);
    expect(result.body.data).toBeNull();
    expectNoStatsReads();
  });
});
