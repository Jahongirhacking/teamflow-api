import { beforeAll, describe, expect, it } from 'vitest';
import { loadSrc } from '../support/load-src';

type Redact = (value: unknown) => any;
let redactSensitive: Redact;

beforeAll(async () => {
  ({ redactSensitive } = await loadSrc<{ redactSensitive: Redact }>('src/common/utils/redact'));
});

const SECRET_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

describe('redactSensitive()', () => {
  describe('kalit nomlari bo\'yicha yashirish', () => {
    it.each([
      'password',
      'Password',
      'passwordHash',
      'password_hash',
      'authorization',
      'Authorization',
      'cookie',
      'set-cookie',
      'token',
      'accessToken',
      'refreshToken',
      'secret',
      'jwtSecret',
      'apiKey',
      'x-api-key',
    ])('"%s" kaliti qiymatini yashiradi', (key) => {
      const result = redactSensitive({ [key]: 'super-qiymat-123' });
      expect(JSON.stringify(result)).not.toContain('super-qiymat-123');
      expect(result).toHaveProperty([key]);
    });

    it('sezgir bo\'lmagan maydonlarni o\'zgartirmaydi', () => {
      const input = { email: 'a@b.test', fullName: 'Ali Valiyev', method: 'GET', url: '/projects', status: 200 };
      expect(redactSensitive(input)).toEqual(input);
    });
  });

  describe('tuzilma', () => {
    it('ichma-ich obyektlar va massivlarni rekursiv tozalaydi', () => {
      const result = redactSensitive({
        req: { headers: { authorization: 'Bearer abc', 'x-request-id': 'r1' }, body: { users: [{ password: 'p1' }, { password: 'p2' }] } },
      });
      const raw = JSON.stringify(result);
      expect(raw).not.toContain('Bearer abc');
      expect(raw).not.toContain('"p1"');
      expect(raw).not.toContain('"p2"');
      expect(result.req.headers['x-request-id']).toBe('r1');
    });

    it('kirish obyektini mutatsiya qilmaydi', () => {
      const input = { password: 'keep-me', nested: { token: 'keep-too' } };
      const snapshot = JSON.parse(JSON.stringify(input));
      redactSensitive(input);
      expect(input).toEqual(snapshot);
    });

    it('aylanma (circular) havolalarda xato tashlamaydi', () => {
      const a: any = { name: 'a', password: 'x' };
      a.self = a;
      expect(() => redactSensitive(a)).not.toThrow();
    });

    it.each([null, undefined, 0, 42, true, '', 'oddiy matn'])('primitiv %j ni buzmaydi', (value) => {
      expect(redactSensitive(value)).toEqual(value);
    });
  });

  describe('satr qiymatlari ichidagi sirlar', () => {
    it('"Bearer <token>" ni qiymat sezgir bo\'lmagan kalit ostida bo\'lsa ham yashiradi', () => {
      const result = redactSensitive({ message: `incoming Bearer ${SECRET_JWT} header` });
      expect(JSON.stringify(result)).not.toContain(SECRET_JWT);
    });

    it('JWT shaklidagi satrni yashiradi', () => {
      expect(JSON.stringify(redactSensitive({ note: `jwt=${SECRET_JWT}` }))).not.toContain(SECRET_JWT);
    });

    it('yuqori darajadagi satr argumentini ham tozalaydi', () => {
      expect(String(redactSensitive(`Bearer ${SECRET_JWT}`))).not.toContain(SECRET_JWT);
    });
  });
});
