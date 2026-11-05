import { describe, expect, it, vi } from 'vitest';
import { ARGON_RE, BCRYPT_RE, PASSWORD, UUID_RE } from '../support/api';
import { expectError } from '../support/assertions';
import { useTestApp } from '../support/app';
import { dumpAllTables } from '../support/db';
import { fixtures } from '../support/files';
import { captureLogs } from '../support/logs';

const h = useTestApp();
const FAKE_ID = '3f9d3c64-6f34-4f0f-8c0b-0a8e9f1d2b3c';

describe('Request ID middleware', () => {
  it('har bir javobda UUID formatidagi X-Request-Id bor', async () => {
    const res = await h.api.anon.post('/auth/login').send({});
    expect(res.headers['x-request-id']).toMatch(UUID_RE);
  });

  it('muvaffaqiyatli, 400, 401, 403, 404 va 409 javoblarida ham mavjud', async () => {
    const t = await h.api.createTeam();
    const responses = [
      await h.api.as(t.owner).get('/projects'), // 200
      await h.api.anon.get('/projects'), // 401
      await h.api.as(t.member).patch(`/projects/${t.project.id}`).send({ name: 'x' }), // 403
      await h.api.as(t.outsider).get(`/projects/${t.project.id}`), // 404
      await h.api.as(t.owner).get('/projects?page=0'), // 400
      await h.api.as(t.owner).post(`/projects/${t.project.id}/members`).send({ email: t.member.email, role: 'MEMBER' }), // 409
      await h.api.anon.get('/this/route/does/not/exist'), // 404 (marshrut yo'q)
    ];
    expect(responses.map((r) => r.status)).toEqual([200, 401, 403, 404, 400, 409, 404]);
    for (const r of responses) expect(r.headers['x-request-id']).toMatch(UUID_RE);
  });

  it('har bir so\'rov uchun noyob ID generatsiya qilinadi', async () => {
    const ids = await Promise.all(Array.from({ length: 10 }, () => h.api.anon.get('/auth/me')));
    expect(new Set(ids.map((r) => r.headers['x-request-id'])).size).toBe(10);
  });

  it('mijoz yuborgan to\'g\'ri X-Request-Id aynan o\'sha holda qaytariladi', async () => {
    for (const id of ['trace-abc_123.xyz', '3f9d3c64-6f34-4f0f-8c0b-0a8e9f1d2b3c', 'A'.repeat(64)]) {
      const res = await h.api.anon.get('/auth/me').set('X-Request-Id', id);
      expect(res.headers['x-request-id']).toBe(id);
      expect(res.body.requestId).toBe(id);
    }
  });

  it.each([
    ['juda uzun (>128)', 'x'.repeat(300)],
    ['HTML/skript belgilari', '<script>alert(1)</script>'],
    ['bo\'shliq va maxsus belgilar', 'bad id; drop table'],
    ['log injection urinishi', 'abc|{"level":"error"}'],
  ])('yaroqsiz mijoz ID (%s) o\'rniga yangi UUID beriladi', async (_n, bad) => {
    const res = await h.api.anon.get('/auth/me').set('X-Request-Id', bad);
    expect(res.headers['x-request-id']).toMatch(UUID_RE);
    expect(res.headers['x-request-id']).not.toBe(bad);
  });

  it('xato javobi tanasidagi requestId sarlavhadagi bilan bir xil', async () => {
    const res = await h.api.anon.get('/projects').set('X-Request-Id', 'corr-42');
    expectError(res, 401);
    expect(res.body.requestId).toBe('corr-42');
  });
});

describe('Request logging', () => {
  async function withLogs<T>(fn: () => Promise<T>) {
    const logs = captureLogs();
    try {
      const result = await fn();
      return { result, logs };
    } catch (e) {
      logs.stop();
      throw e;
    }
  }

  it('har bir so\'rov uchun requestId, method, path, status va davomiylik (ms) bor log qatori yoziladi', async () => {
    const user = await h.api.createUser();
    const { result: res, logs } = await withLogs(() => h.api.as(user).get('/projects?page=1&limit=5'));
    try {
      const id = res.headers['x-request-id'];
      await vi.waitFor(() => {
        const line = logs.lines().find((l) => l.includes(id) && l.includes('GET') && l.includes('/projects') && l.includes('200'));
        expect(line, `log topilmadi. Ushlangan loglar:\n${logs.text()}`).toBeDefined();
        expect(line).toMatch(/\d+(\.\d+)?\s?ms/);
      });
    } finally {
      logs.stop();
    }
  });

  it('xato javoblari (401, 404, 400) ham status kodi va requestId bilan loglanadi', async () => {
    const user = await h.api.createUser();
    const { result, logs } = await withLogs(async () => ({
      unauth: await h.api.anon.get('/projects'),
      missing: await h.api.as(user).get(`/projects/${FAKE_ID}`),
      invalid: await h.api.as(user).post('/projects').send({}),
    }));
    try {
      const expectations: [string, string][] = [
        [result.unauth.headers['x-request-id'], '401'],
        [result.missing.headers['x-request-id'], '404'],
        [result.invalid.headers['x-request-id'], '400'],
      ];
      for (const [id, status] of expectations) {
        await vi.waitFor(() => {
          expect(logs.lines().some((l) => l.includes(id) && l.includes(status))).toBe(true);
        });
      }
    } finally {
      logs.stop();
    }
  });

  it('turli so\'rovlarning loglari requestId orqali ajratib olinadi (korrelyatsiya)', async () => {
    const user = await h.api.createUser();
    const { result, logs } = await withLogs(() =>
      Promise.all([h.api.as(user).get('/auth/me'), h.api.as(user).get('/projects'), h.api.as(user).get('/projects?status=ACTIVE')]),
    );
    try {
      const ids = result.map((r) => r.headers['x-request-id']);
      expect(new Set(ids).size).toBe(3);
      for (const id of ids) {
        await vi.waitFor(() => expect(logs.lines().some((l) => l.includes(id))).toBe(true));
      }
      // bitta qator ikki xil so'rovga tegishli bo'lmasligi kerak
      for (const line of logs.lines()) {
        expect(ids.filter((id) => line.includes(id)).length).toBeLessThanOrEqual(1);
      }
    } finally {
      logs.stop();
    }
  });

  it('maxfiy ma\'lumotlar (parol, token, Authorization, Cookie, sir, xesh) hech qachon loglarga tushmaydi', async () => {
    const wrongPassword = 'Wr0ng-Pass-word-XYZ';
    const cookieValue = 'sess-COOKIE-VALUE-98765';
    const email = 'logger@example.test';

    const { result, logs } = await withLogs(async () => {
      const register = await h.api.anon.post('/auth/register').send({ email, password: PASSWORD, fullName: 'Log Tester' });
      const badRegister = await h.api.anon.post('/auth/register').send({ email: 'nope', password: 'LeakyPass123', fullName: 'x' });
      const badLogin = await h.api.anon.post('/auth/login').send({ email, password: wrongPassword });
      const login = await h.api.anon.post('/auth/login').send({ email, password: PASSWORD });
      const token = login.body.accessToken as string;
      const me = await h.api.asToken(token).get('/auth/me').set('Cookie', `session=${cookieValue}`);
      const forged = await h.api.asToken('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.forgedSignature123').get('/auth/me');
      const secretFile = await h.api
        .asToken(token)
        .post(`/projects`)
        .send({ name: 'secret-project' });
      return { register, badRegister, badLogin, login, me, forged, secretFile, token };
    });

    try {
      expect(result.register.status).toBe(201);
      expect(result.me.status).toBe(200);
      // Loglar haqiqatan yozilganini kutamiz (aks holda test ma'nosiz bo'lib qoladi)
      for (const r of [result.register, result.badLogin, result.login, result.me, result.forged]) {
        const id = r.headers['x-request-id'];
        await vi.waitFor(() => expect(logs.lines().some((l) => l.includes(id))).toBe(true));
      }

      const hashes = JSON.stringify(await dumpAllTables()).match(new RegExp(`${BCRYPT_RE.source}|\\$argon2[^"\\\\]+`, 'g')) ?? [];
      expect(hashes.length).toBeGreaterThan(0);

      const text = logs.text();
      const forbidden = [
        PASSWORD,
        wrongPassword,
        'LeakyPass123',
        result.token,
        `Bearer ${result.token}`,
        'forgedSignature123',
        cookieValue,
        process.env.JWT_SECRET as string,
        ...hashes,
      ];
      for (const secret of forbidden) {
        expect(text, `loglarda maxfiy qiymat topildi: ${secret.slice(0, 12)}...`).not.toContain(secret);
      }
      expect(text).not.toMatch(/Bearer\s+[A-Za-z0-9._-]{10,}/);
      expect(text).not.toMatch(/eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\./); // JWT shaklidagi satr
    } finally {
      logs.stop();
    }
  });

  it('yuklangan fayl mazmuni va sarlavhalari loglarga tushmaydi', async () => {
    const t = await h.api.createTeam();
    const marker = 'TOP-SECRET-FILE-CONTENT-4711';
    const { result, logs } = await withLogs(() =>
      h.api.uploadTo(t.owner, `/projects/${t.project.id}/attachments`, {
        buffer: fixtures.text(marker),
        filename: 'note.txt',
        contentType: 'text/plain',
      }),
    );
    try {
      expect(result.status).toBe(201);
      await vi.waitFor(() => expect(logs.lines().some((l) => l.includes(result.headers['x-request-id']))).toBe(true));
      expect(logs.text()).not.toContain(marker);
      expect(logs.text()).not.toContain(t.owner.token);
    } finally {
      logs.stop();
    }
  });

  it('500 xatosi loglanganda ham maxfiy ma\'lumotlar chiqmaydi, javobda esa stack yo\'q', async () => {
    const t = await h.api.createTeam();
    const restore = h.breakStorage();
    const logs = captureLogs();
    try {
      const res = await h.api.uploadTo(t.owner, `/projects/${t.project.id}/attachments`, {
        buffer: fixtures.png(),
        filename: 'a.png',
        contentType: 'image/png',
      });
      expectError(res, 500);
      await vi.waitFor(() => expect(logs.lines().some((l) => l.includes(res.headers['x-request-id']))).toBe(true));
      expect(logs.text()).not.toContain(t.owner.token);
      expect(logs.text()).not.toContain(process.env.JWT_SECRET as string);
    } finally {
      logs.stop();
      restore();
    }
  });
});

describe('Request timing interceptor', () => {
  const MS_RE = /^\d+(\.\d+)?ms$/;

  it('muvaffaqiyatli javoblarda X-Response-Time "<son>ms" formatida', async () => {
    const t = await h.api.createTeam();
    const responses = [
      await h.api.as(t.owner).get('/auth/me'),
      await h.api.as(t.owner).get('/projects'),
      await h.api.as(t.owner).post('/projects').send({ name: 'Timed' }),
      await h.api.as(t.owner).get(`/projects/${t.project.id}/tasks`),
    ];
    expect(responses.map((r) => r.status)).toEqual([200, 200, 201, 200]);
    for (const r of responses) expect(r.headers['x-response-time']).toMatch(MS_RE);
  });

  it('o\'lchangan vaqt mantiqiy oraliqda (0 <= t < 10 s)', async () => {
    const user = await h.api.createUser();
    const res = await h.api.as(user).get('/projects');
    const ms = parseFloat(res.headers['x-response-time']);
    expect(ms).toBeGreaterThanOrEqual(0);
    expect(ms).toBeLessThan(10_000);
  });

  it('fayl yuklab olish javobida ham mavjud', async () => {
    const t = await h.api.createTeam();
    const att = await h.api.uploadToProject(t.owner, t.project.id, { buffer: fixtures.png(), filename: 'a.png', contentType: 'image/png' });
    const res = await h.api.as(t.owner).get(`/attachments/${att.id}/download`);
    expect(res.headers['x-response-time']).toMatch(MS_RE);
  });
});
