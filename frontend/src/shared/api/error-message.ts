import { isAxiosError } from 'axios';

export function getErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError<{ message?: string | string[]; error?: { message?: string } }>(error)) {
    const message = error.response?.data?.error?.message ?? error.response?.data?.message;
    if (typeof message === 'string' && message) return message;
    if (Array.isArray(message) && message.length > 0) return message.join(', ');
  }
  return error instanceof Error && error.message ? error.message : fallback;
}
