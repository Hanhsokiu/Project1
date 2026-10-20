import { describe, expect, it } from 'vitest';
import { getErrorMessage } from './error-message';

describe('getErrorMessage', () => {
  it('shows API validation errors instead of a generic HTTP error', () => {
    expect(getErrorMessage({
      isAxiosError: true,
      response: { data: { message: ['Required username', 'Required password'] } },
    }, 'Fallback')).toBe('Required username, Required password');
  });

  it('handles network errors and unknown thrown values', () => {
    expect(getErrorMessage(new Error('Network Error'), 'Fallback')).toBe('Network Error');
    expect(getErrorMessage(null, 'Fallback')).toBe('Fallback');
  });

  it('shows the business error returned by the backend', () => {
    expect(getErrorMessage({
      isAxiosError: true,
      response: { data: { success: false, error: { code: 'ACCOUNT_LOCKED', message: 'Account locked' } } },
    }, 'Fallback')).toBe('Account locked');
  });
});
