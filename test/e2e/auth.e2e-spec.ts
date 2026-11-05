import { describe, expect, it } from 'vitest';
import { ARGON_RE, BCRYPT_RE, PASSWORD, UUID_RE } from '../support/api';
import { expectError, expectPublicUser } from '../support/assertions';
import { useTestApp } from '../support/app';
import { dumpAllTables } from '../support/db';
import { signToken, unsignedToken } from '../support/jwt';

const h = useTestApp();
const validBody = (over: Record<string, unknown> = {}) => ({
  email: 'ali@example.test',
  password: PASSWORD,
  fullName: 'Ali Valiyev',
  ...over,
});

describe('POST /auth/register', () => {
  it('yangi foydalanuvchini yaratadi va 201 + ommaviy profilni qaytaradi', async () => {
    const res = await h.api.anon.post('/auth/register').send(validBody());
    expect(res.status).toBe(201);
    expectPublicUser(res.body);
    expect(res.body.id).toMatch(UUID_RE);
    expect(res.body.email).toBe('ali@example.test');
    expect(res.body.fullName).toBe('Ali Valiyev');
    expect(res.body.globalRole).toBe('USER');
    expect(res.body.isActive).toBe(true);
  });

  it('javobda parol ham, xesh ham yo\'q', async () => {
    const res = await h.api.anon.post('/auth/register').send(validBody());
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain(PASSWORD);
    expect(raw).not.toMatch(BCRYPT_RE);
    expect(raw).not.toMatch(ARGON_RE);
    expect(Object.keys(res.body).some((k) => /pass|hash/i.test(k))).toBe(false);
  });

  it('emailni kichik harfga keltirib saqlaydi', async () => {
    const res = await h.api.anon.post('/auth/register').send(validBody({ email: 'MiXeD.Case@Example.TEST' }));
    expect(res.status).toBe(201);
    expect(res.body.email).toBe('mixed.case@example.test');
  });

  it('ADMIN_EMAIL bilan ro\'yxatdan o\'tgan foydalanuvchi global ADMIN bo\'ladi', async () => {
    const res = await h.api.anon.post('/auth/register').send(validBody({ email: process.env.ADMIN_EMAIL }));
    expect(res.status).toBe(201);
    expect(res.body.globalRole).toBe('ADMIN');
  });

  it('ro\'yxatdan o\'tishda mijoz globalRole/isActive/id yubora olmaydi (forbidNonWhitelisted)', async () => {
    for (const extra of [{ globalRole: 'ADMIN' }, { isActive: false }, { id: 'x' }, { role: 'ADMIN' }]) {
      const res = await h.api.anon.post('/auth/register').send(validBody(extra));
      expectError(res, 400);
    }
  });

  it('parol bazada ochiq matnda emas, bcrypt/argon2 xesh ko\'rinishida saqlanadi', async () => {
    await h.api.anon.post('/auth/register').send(validBody()).expect(201);
    const dump = JSON.stringify(await dumpAllTables());
    expect(dump).not.toContain(PASSWORD);
    expect(BCRYPT_RE.test(dump) || ARGON_RE.test(dump)).toBe(true);
  });

  it('bir xil parol turli foydalanuvchilarda turli xesh beradi (salt)', async () => {
    await h.api.anon.post('/auth/register').send(validBody({ email: 'u1@example.test' })).expect(201);
    await h.api.anon.post('/auth/register').send(validBody({ email: 'u2@example.test' })).expect(201);
    const dump = JSON.stringify(await dumpAllTables());
    const hashes = dump.match(new RegExp(BCRYPT_RE.source, 'g')) ?? dump.match(/\$argon2[^"\\]+/g) ?? [];
    expect(hashes.length).toBeGreaterThanOrEqual(2);
    expect(new Set(hashes).size).toBe(hashes.length);
  });

  describe('takroriy email', () => {
    it('xuddi shu email bilan ikkinchi marta 409', async () => {
      await h.api.anon.post('/auth/register').send(validBody()).expect(201);
      expectError(await h.api.anon.post('/auth/register').send(validBody({ fullName: 'Boshqa' })), 409);
    });

    it('harf registri farq qilsa ham takroriy hisoblanadi', async () => {
      await h.api.anon.post('/auth/register').send(validBody({ email: 'dup@example.test' })).expect(201);
      expectError(await h.api.anon.post('/auth/register').send(validBody({ email: 'DUP@Example.test' })), 409);
    });

    it('bir vaqtdagi 6 ta bir xil so\'rovdan aynan bittasi 201, qolganlari 409 (500 emas)', async () => {
      const results = await Promise.all(
        Array.from({ length: 6 }, () => h.api.anon.post('/auth/register').send(validBody({ email: 'race@example.test' }))),
      );
      const codes = results.map((r) => r.status).sort();
      expect(codes.filter((c) => c === 201)).toHaveLength(1);
      expect(codes.filter((c) => c === 409)).toHaveLength(5);
    });
  });

  describe('validatsiya (400)', () => {
    const cases: [string, Record<string, unknown>][] = [
      ['email yo\'q', { email: undefined }],
      ['email noto\'g\'ri formatda', { email: 'not-an-email' }],
      ['parol yo\'q', { password: undefined }],
      ['parol 8 belgidan qisqa', { password: 'Ab1' }],
      ['parolda raqam yo\'q', { password: 'OnlyLetters' }],
      ['parolda harf yo\'q', { password: '123456789' }],
      ['parol 72 belgidan uzun', { password: 'a1'.repeat(37) }],
      ['fullName yo\'q', { fullName: undefined }],
      ['fullName bo\'sh', { fullName: '' }],
      ['fullName faqat bo\'shliq', { fullName: '   ' }],
      ['fullName 100 belgidan uzun', { fullName: 'x'.repeat(101) }],
      ['email satr emas', { email: 12345 }],
      ['parol massiv', { password: ['a'] }],
    ];
    it.each(cases)('%s', async (_name, over) => {
      const res = await h.api.anon.post('/auth/register').send(validBody(over));
      expectError(res, 400);
      expect(Array.isArray(res.body.message)).toBe(true);
    });

    it('xato javobida kiritilgan parol qaytarilmaydi', async () => {
      const res = await h.api.anon.post('/auth/register').send(validBody({ email: 'bad', password: 'LeakMe123' }));
      expect(JSON.stringify(res.body)).not.toContain('LeakMe123');
    });

    it('bo\'sh tana 400', async () => {
      expectError(await h.api.anon.post('/auth/register').send({}), 400);
    });
  });
});

describe('POST /auth/login', () => {
  it('to\'g\'ri ma\'lumotlar bilan 200, accessToken va foydalanuvchini qaytaradi', async () => {
    await h.api.anon.post('/auth/register').send(validBody()).expect(201);
    const res = await h.api.anon.post('/auth/login').send({ email: 'ali@example.test', password: PASSWORD });
    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe('string');
    expect(res.body.accessToken.split('.')).toHaveLength(3);
    expectPublicUser(res.body.user);
    expect(res.body.user.email).toBe('ali@example.test');
    expect(JSON.stringify(res.body)).not.toContain(PASSWORD);
  });

  it('JWT `sub` claim\'ida foydalanuvchi id\'si bor va muddati cheklangan', async () => {
    const user = await h.api.createUser();
    const payload = JSON.parse(Buffer.from(user.token.split('.')[1], 'base64url').toString());
    expect(payload.sub).toBe(user.id);
    expect(typeof payload.exp).toBe('number');
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(JSON.stringify(payload)).not.toMatch(/pass|hash/i);
  });

  it('email registrga sezgir emas', async () => {
    await h.api.anon.post('/auth/register').send(validBody()).expect(201);
    await h.api.anon.post('/auth/login').send({ email: 'ALI@Example.test', password: PASSWORD }).expect(200);
  });

  it('noto\'g\'ri parol va mavjud bo\'lmagan email bir xil 401 xabarini qaytaradi (user enumeration yo\'q)', async () => {
    await h.api.anon.post('/auth/register').send(validBody()).expect(201);
    const wrongPass = await h.api.anon.post('/auth/login').send({ email: 'ali@example.test', password: 'Wrong-pass-1' });
    const unknown = await h.api.anon.post('/auth/login').send({ email: 'nobody@example.test', password: 'Wrong-pass-1' });
    expectError(wrongPass, 401);
    expectError(unknown, 401);
    expect(wrongPass.body.message).toEqual(unknown.body.message);
    expect(wrongPass.body.accessToken).toBeUndefined();
  });

  it('noto\'g\'ri tana 400 (email/parol yo\'q)', async () => {
    expectError(await h.api.anon.post('/auth/login').send({ email: 'ali@example.test' }), 400);
    expectError(await h.api.anon.post('/auth/login').send({ password: PASSWORD }), 400);
    expectError(await h.api.anon.post('/auth/login').send({ email: 'ali@example.test', password: PASSWORD, extra: 1 }), 400);
  });

  it('faolsizlantirilgan foydalanuvchi tizimga kira olmaydi (401)', async () => {
    const admin = await h.api.createGlobalAdmin();
    const user = await h.api.createUser();
    await h.api.as(admin).patch(`/users/${user.id}/status`).send({ isActive: false }).expect(200);
    expectError(await h.api.anon.post('/auth/login').send({ email: user.email, password: user.password }), 401);
  });
});

describe('GET /auth/me va JWT himoyasi', () => {
  it('amaldagi token bilan joriy foydalanuvchini qaytaradi', async () => {
    const user = await h.api.createUser({ fullName: 'Me Myself' });
    const res = await h.api.as(user).get('/auth/me');
    expect(res.status).toBe(200);
    expectPublicUser(res.body);
    expect(res.body.id).toBe(user.id);
    expect(res.body.fullName).toBe('Me Myself');
  });

  it('JWT_SECRET bilan imzolangan, `sub`li token qabul qilinadi', async () => {
    const user = await h.api.createUser();
    const res = await h.api.asToken(signToken({ sub: user.id })).get('/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(user.id);
  });

  it('Authorization sarlavhasisiz so\'rov 401', async () => {
    expectError(await h.api.anon.get('/auth/me'), 401);
  });

  it.each([
    ['Bearer prefiksisiz token', (t: string) => t],
    ['Basic sxema', (t: string) => `Basic ${t}`],
    ['bo\'sh Bearer', () => 'Bearer '],
    ['axlat token', () => 'Bearer not.a.jwt'],
  ])('%s 401', async (_n, build) => {
    const user = await h.api.createUser();
    const res = await h.api.anon.get('/auth/me').set('Authorization', build(user.token));
    expectError(res, 401);
  });

  it('boshqa sir bilan imzolangan token 401', async () => {
    const user = await h.api.createUser();
    const forged = signToken({ sub: user.id }, { secret: 'attacker-secret-attacker-secret-1234' });
    expectError(await h.api.asToken(forged).get('/auth/me'), 401);
  });

  it('muddati o\'tgan token 401', async () => {
    const user = await h.api.createUser();
    const expired = signToken({ sub: user.id }, { expiresIn: -60 });
    expectError(await h.api.asToken(expired).get('/auth/me'), 401);
  });

  it('`alg: none` imzosiz token 401', async () => {
    const user = await h.api.createUser();
    expectError(await h.api.asToken(unsignedToken({ sub: user.id })).get('/auth/me'), 401);
  });

  it('mavjud bo\'lmagan foydalanuvchiga tegishli (to\'g\'ri imzolangan) token 401', async () => {
    const ghost = signToken({ sub: '3f9d3c64-6f34-4f0f-8c0b-0a8e9f1d2b3c' });
    expectError(await h.api.asToken(ghost).get('/auth/me'), 401);
  });

  it('token o\'zgartirilsa (payload almashtirilsa) 401', async () => {
    const [a, , c] = (await h.api.createUser()).token.split('.');
    const evil = Buffer.from(JSON.stringify({ sub: '3f9d3c64-6f34-4f0f-8c0b-0a8e9f1d2b3c', exp: 9999999999 })).toString('base64url');
    expectError(await h.api.asToken(`${a}.${evil}.${c}`).get('/auth/me'), 401);
  });

  it('faolsizlantirilgan foydalanuvchining eski tokeni ham ishlamaydi (401)', async () => {
    const admin = await h.api.createGlobalAdmin();
    const user = await h.api.createUser();
    await h.api.as(user).get('/auth/me').expect(200);
    await h.api.as(admin).patch(`/users/${user.id}/status`).send({ isActive: false }).expect(200);
    expectError(await h.api.as(user).get('/auth/me'), 401);
    expectError(await h.api.as(user).get('/projects'), 401);
  });

  it('himoyalangan marshrutlarning hammasi tokensiz 401 qaytaradi', async () => {
    const fakeId = '3f9d3c64-6f34-4f0f-8c0b-0a8e9f1d2b3c';
    const calls = [
      h.api.anon.get('/users'),
      h.api.anon.get(`/users/${fakeId}`),
      h.api.anon.patch(`/users/${fakeId}`).send({ fullName: 'x' }),
      h.api.anon.patch(`/users/${fakeId}/status`).send({ isActive: false }),
      h.api.anon.get('/projects'),
      h.api.anon.post('/projects').send({ name: 'x' }),
      h.api.anon.get(`/projects/${fakeId}`),
      h.api.anon.get(`/projects/${fakeId}/members`),
      h.api.anon.get(`/projects/${fakeId}/tasks`),
      h.api.anon.get(`/tasks/${fakeId}`),
      h.api.anon.get(`/attachments/${fakeId}`),
      h.api.anon.get(`/attachments/${fakeId}/download`),
      h.api.anon.delete(`/attachments/${fakeId}`),
    ];
    for (const res of await Promise.all(calls)) expectError(res, 401);
  });

  it('ommaviy marshrutlar faqat register va login', async () => {
    // 401 EMAS (ya'ni autentifikatsiyasiz ham javob beradi): 400 - validatsiya xatosi
    expect((await h.api.anon.post('/auth/register').send({})).status).toBe(400);
    expect((await h.api.anon.post('/auth/login').send({})).status).toBe(400);
  });
});
