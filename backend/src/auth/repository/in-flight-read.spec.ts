import { describe, expect, it, vi } from 'vitest';
import { inFlightRead } from './in-flight-read';

describe('Concurrent auth reads without persistent authorization cache', () => {
  it('shares one database read for concurrent requests for the same identity', async () => {
    const pending = new Map<string, Promise<string>>();
    let finish!: (value: string) => void;
    const read = vi.fn(() => new Promise<string>(resolve => { finish = resolve; }));
    const first = inFlightRead(pending, 'user-1', read);
    const second = inFlightRead(pending, 'user-1', read);
    expect(second).toBe(first);
    await Promise.resolve();
    expect(read).toHaveBeenCalledTimes(1);
    finish('active');
    expect(await Promise.all([first, second])).toEqual(['active', 'active']);
    expect(pending.size).toBe(0);
  });

  it('reads changed account/session status after the preceding read has finished', async () => {
    const pending = new Map<string, Promise<string>>();
    const read = vi.fn().mockResolvedValueOnce('active').mockResolvedValueOnce('revoked');
    expect(await inFlightRead(pending, 'session-1', read)).toBe('active');
    expect(await inFlightRead(pending, 'session-1', read)).toBe('revoked');
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('never shares results between different users', async () => {
    const pending = new Map<string, Promise<string>>();
    const first = inFlightRead(pending, 'user-1', async () => 'student');
    const second = inFlightRead(pending, 'user-2', async () => 'faculty');
    expect(await Promise.all([first, second])).toEqual(['student', 'faculty']);
  });

  it('removes failed reads so a retry can recover', async () => {
    const pending = new Map<string, Promise<string>>();
    await expect(inFlightRead(pending, 'user-1', async () => { throw Error('pool full'); }))
      .rejects.toThrow('pool full');
    expect(pending.size).toBe(0);
    expect(await inFlightRead(pending, 'user-1', async () => 'recovered')).toBe('recovered');
  });
});
