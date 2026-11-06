import { describe, expect, it, vi } from 'vitest';
import { AuthController } from './auth.controller';
import type { AuthService } from '../service/auth.service';

describe('Authenticated profile response', () => {
  it('uses the current guard identity without another database read or leaking session identifiers', async () => {
    const auth = { me: vi.fn() };
    const controller = new AuthController(auth as unknown as AuthService);
    const identity = {
      id: 'user-1', username: '221000001', name: 'Sinh viên',
      email: null, phone: '', roles: ['STUDENT'], permissions: ['proposal:read'],
      mustChangePassword: false, profileComplete: false, locked: false,
      studentId: undefined, lecturerId: undefined, student: undefined, lecturer: undefined,
      sub: 'user-1', userId: 'user-1', sid: 'private-session-id',
    };
    const response = await controller.me(identity);
    expect(response.data.id).toBe('user-1');
    expect(response.data.permissions).toEqual(['proposal:read']);
    expect(response.data).not.toHaveProperty('sid');
    expect(response.data).not.toHaveProperty('sub');
    expect(response.data).not.toHaveProperty('userId');
    expect(auth.me).not.toHaveBeenCalled();
  });
});
