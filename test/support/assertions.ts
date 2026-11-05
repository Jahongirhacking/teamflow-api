import type { Response } from 'supertest';
import { expect } from 'vitest';
import { UUID_RE } from './api';

const STATUS_TEXT: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  413: 'Payload Too Large',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Entity',
  500: 'Internal Server Error',
};

/**
 * Standart xato javob formati:
 * { statusCode, error, message (string | string[]), path, timestamp, requestId }
 */
export function expectError(res: Response, status: number): void {
  expect(res.status).toBe(status);
  expect(res.headers['content-type']).toMatch(/application\/json/);
  const body = res.body;
  expect(body.statusCode).toBe(status);
  expect(body.error).toBe(STATUS_TEXT[status]);
  expect(
    typeof body.message === 'string' || (Array.isArray(body.message) && body.message.every((m: unknown) => typeof m === 'string')),
  ).toBe(true);
  expect(typeof body.path).toBe('string');
  expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
  expect(body.requestId).toBe(res.headers['x-request-id']);
  // Ichki ma'lumotlar sizib chiqmasligi kerak
  const raw = JSON.stringify(body);
  expect(raw).not.toMatch(/node_modules|\.ts:\d+|\bat\s+\S+\s+\(|QueryFailedError|SELECT\s|INSERT\s|"stack"/i);
}

export function expectPage(res: Response, expected: { page: number; limit: number; total?: number }): void {
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body.data)).toBe(true);
  expect(res.body.meta.page).toBe(expected.page);
  expect(res.body.meta.limit).toBe(expected.limit);
  expect(typeof res.body.meta.total).toBe('number');
  if (expected.total !== undefined) expect(res.body.meta.total).toBe(expected.total);
  expect(res.body.meta.totalPages).toBe(Math.ceil(res.body.meta.total / expected.limit));
}

/** Foydalanuvchi javobi: parol/xesh yo'q, kerakli maydonlar bor. */
export function expectPublicUser(user: Record<string, unknown>): void {
  expect(user.id).toMatch(UUID_RE);
  expect(typeof user.email).toBe('string');
  expect(typeof user.fullName).toBe('string');
  expect(['USER', 'ADMIN']).toContain(user.globalRole);
  expect(typeof user.isActive).toBe('boolean');
  expect(Number.isNaN(Date.parse(user.createdAt as string))).toBe(false);
  expect(Number.isNaN(Date.parse(user.updatedAt as string))).toBe(false);
  expect(Object.keys(user).some((k) => /pass|hash|secret/i.test(k))).toBe(false);
}
