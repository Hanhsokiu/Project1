import 'reflect-metadata';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { RequestMethod } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { ScoreController } from './score.controller';
import { ScoreService } from '../service/score.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { UserAccountRepository } from '../../auth/repository/user-account.repository';
import type { RbacService } from '../../auth/service/rbac.service';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import { PermissionsGuard } from '../../common/security/permissions.guard';
import { GlobalExceptionHandler } from '../../common/exception/global-exception.handler';

describe('Legacy score reader temporary fail-closed protection', () => {
  // This test application has no PrismaModule or database connection. The real
  // JWT/permission guards and exception filter exercise the HTTP response path.
  const database = {
    scoreEntry: { findMany: vi.fn().mockResolvedValue([{ totalScore: 9 }]) },
    scoreDetail: { findMany: vi.fn().mockResolvedValue([{ comment: 'private' }]) },
    finalResult: { findUnique: vi.fn().mockResolvedValue({ isPublished: true }) },
  };
  const reader = new ScoreService(database as unknown as PrismaService);
  const readScores = vi.spyOn(reader, 'getScoresByProposal');
  const users = { findById: vi.fn(), session: vi.fn() };
  const rbac = { hasPermission: vi.fn().mockResolvedValue(true) };
  const jwt = new JwtService({ secret: 'isolated-score-reader-unit-test-secret' });
  const proposalId = '00000000-0000-4000-8000-000000000001';
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

  async function getScores(id = proposalId, token?: string) {
    const response = await fetch(`${baseUrl}/api/scores/proposal/${id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return { status: response.status, body: await response.json() };
  }

  async function tokenFor(role: string) {
    users.findById.mockResolvedValue(identity(role));
    return jwt.signAsync({ sub: 'test-user', sid: 'test-session' });
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ScoreController],
      providers: [{ provide: ScoreService, useValue: reader }],
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

  function expectNoScoreReads() {
    expect(readScores).not.toHaveBeenCalled();
    expect(database.scoreEntry.findMany).not.toHaveBeenCalled();
    expect(database.scoreDetail.findMany).not.toHaveBeenCalled();
    expect(database.finalResult.findUnique).not.toHaveBeenCalled();
  }

  it('preserves the existing GET route', () => {
    expect(Reflect.getMetadata(PATH_METADATA, ScoreController)).toBe('scores');
    expect(
      Reflect.getMetadata(PATH_METADATA, ScoreController.prototype.getScores),
    ).toBe('proposal/:proposalId');
    expect(
      Reflect.getMetadata(METHOD_METADATA, ScoreController.prototype.getScores),
    ).toBe(RequestMethod.GET);
  });

  it('keeps unauthenticated requests behind the existing JWT guard', async () => {
    const result = await getScores();
    expect(result.status).toBe(401);
    expect(result.body).toMatchObject({ success: false, data: null });
    expect(users.findById).not.toHaveBeenCalled();
    expectNoScoreReads();
  });

  it('rejects an invalid JWT before the locked handler', async () => {
    const result = await getScores(proposalId, 'invalid-token');
    expect(result.status).toBe(401);
    expect(result.body.data).toBeNull();
    expectNoScoreReads();
  });

  it.each(['STUDENT', 'LECTURER', 'COMMITTEE', 'FACULTY', 'ADMIN'])(
    'returns only the disabled response for authenticated %s, without reading scores',
    async (role) => {
      const result = await getScores(proposalId, await tokenFor(role));
      expect(result.status).toBe(403);
      expect(result.body).toMatchObject({
        success: false,
        data: null,
        error: {
          code: 'SCORE_READING_NOT_ENABLED',
          message: 'Chức năng đọc điểm chưa được mở.',
        },
      });
      expect(result.body).not.toHaveProperty('scoreDetails');
      expect(result.body).not.toHaveProperty('totalScore');
      expect(users.findById).toHaveBeenCalledWith('test-user');
      expect(users.session).toHaveBeenCalledWith('test-session');
      expectNoScoreReads();
    },
  );

  it('does not probe whether a proposal exists, even for ADMIN', async () => {
    const result = await getScores(
      '00000000-0000-4000-8000-000000000099',
      await tokenFor('ADMIN'),
    );
    expect(result.status).toBe(403);
    expect(result.body.error.code).toBe('SCORE_READING_NOT_ENABLED');
    expectNoScoreReads();
  });

  it('still rejects revoked sessions through the existing authentication', async () => {
    const token = await tokenFor('ADMIN');
    users.session.mockResolvedValueOnce(null);
    const result = await getScores(proposalId, token);
    expect(result.status).toBe(401);
    expect(result.body.data).toBeNull();
    expectNoScoreReads();
  });
});
