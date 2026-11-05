import { describe, expect, it } from 'vitest';
import { expectError, expectPage, expectPublicUser } from '../support/assertions';
import { useTestApp } from '../support/app';

const h = useTestApp();
const FAKE_ID = '3f9d3c64-6f34-4f0f-8c0b-0a8e9f1d2b3c';

describe('GET /users (faqat global ADMIN)', () => {
  it('ADMIN barcha foydalanuvchilarni sahifalab oladi', async () => {
    const admin = await h.api.createGlobalAdmin();
    await Promise.all([h.api.createUser(), h.api.createUser(), h.api.createUser()]);
    const res = await h.api.as(admin).get('/users');
    expectPage(res, { page: 1, limit: 10, total: 4 });
    expect(res.body.data).toHaveLength(4);
    res.body.data.forEach(expectPublicUser);
  });

  it('page va limit ishlaydi', async () => {
    const admin = await h.api.createGlobalAdmin();
    for (let i = 0; i < 4; i++) await h.api.createUser();
    const p1 = await h.api.as(admin).get('/users?page=1&limit=2');
    const p3 = await h.api.as(admin).get('/users?page=3&limit=2');
    expectPage(p1, { page: 1, limit: 2, total: 5 });
    expect(p1.body.data).toHaveLength(2);
    expect(p1.body.meta.totalPages).toBe(3);
    expect(p3.body.data).toHaveLength(1);
  });

  it('isActive bo\'yicha filtrlaydi', async () => {
    const admin = await h.api.createGlobalAdmin();
    const u = await h.api.createUser();
    await h.api.createUser();
    await h.api.as(admin).patch(`/users/${u.id}/status`).send({ isActive: false }).expect(200);
    const inactive = await h.api.as(admin).get('/users?isActive=false');
    expect(inactive.body.data.map((x: any) => x.id)).toEqual([u.id]);
    const active = await h.api.as(admin).get('/users?isActive=true');
    expect(active.body.meta.total).toBe(2);
  });

  it('oddiy foydalanuvchi uchun 403', async () => {
    const user = await h.api.createUser();
    expectError(await h.api.as(user).get('/users'), 403);
  });

  it.each(['page=0', 'page=-1', 'page=abc', 'limit=0', 'limit=101', 'limit=x', 'isActive=maybe'])(
    'noto\'g\'ri so\'rov parametri (%s) 400',
    async (qs) => {
      const admin = await h.api.createGlobalAdmin();
      expectError(await h.api.as(admin).get(`/users?${qs}`), 400);
    },
  );
});

describe('GET /users/:id', () => {
  it('foydalanuvchi o\'z profilini oladi', async () => {
    const user = await h.api.createUser();
    const res = await h.api.as(user).get(`/users/${user.id}`);
    expect(res.status).toBe(200);
    expectPublicUser(res.body);
    expect(res.body.id).toBe(user.id);
  });

  it('boshqa foydalanuvchining profiliga kirish 403', async () => {
    const [a, b] = await Promise.all([h.api.createUser(), h.api.createUser()]);
    expectError(await h.api.as(a).get(`/users/${b.id}`), 403);
  });

  it('ADMIN istalgan foydalanuvchini oladi', async () => {
    const admin = await h.api.createGlobalAdmin();
    const user = await h.api.createUser();
    const res = await h.api.as(admin).get(`/users/${user.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(user.id);
  });

  it('ADMIN uchun mavjud bo\'lmagan id 404', async () => {
    const admin = await h.api.createGlobalAdmin();
    expectError(await h.api.as(admin).get(`/users/${FAKE_ID}`), 404);
  });

  it('noto\'g\'ri UUID formati 400', async () => {
    const user = await h.api.createUser();
    expectError(await h.api.as(user).get('/users/not-a-uuid'), 400);
  });
});

describe('PATCH /users/:id', () => {
  it('foydalanuvchi o\'z fullName\'ini yangilaydi', async () => {
    const user = await h.api.createUser();
    const res = await h.api.as(user).patch(`/users/${user.id}`).send({ fullName: 'Yangi Ism' });
    expect(res.status).toBe(200);
    expectPublicUser(res.body);
    expect(res.body.fullName).toBe('Yangi Ism');
    expect((await h.api.as(user).get('/auth/me')).body.fullName).toBe('Yangi Ism');
  });

  it('updatedAt yangilanadi, createdAt o\'zgarmaydi', async () => {
    const user = await h.api.createUser();
    const before = (await h.api.as(user).get('/auth/me')).body;
    const after = (await h.api.as(user).patch(`/users/${user.id}`).send({ fullName: 'Boshqa Ism' })).body;
    expect(after.createdAt).toBe(before.createdAt);
    expect(Date.parse(after.updatedAt)).toBeGreaterThanOrEqual(Date.parse(before.updatedAt));
  });

  it.each([
    ['email', { email: 'new@example.test' }],
    ['globalRole', { globalRole: 'ADMIN' }],
    ['isActive', { isActive: false }],
    ['password', { password: 'NewPassw0rd!' }],
    ['id', { id: FAKE_ID }],
    ['createdAt', { createdAt: '2000-01-01T00:00:00.000Z' }],
  ])('himoyalangan maydon (%s) o\'zgartirilmaydi - 400', async (_f, body) => {
    const user = await h.api.createUser();
    expectError(await h.api.as(user).patch(`/users/${user.id}`).send({ fullName: 'Ok Name', ...body }), 400);
    const me = (await h.api.as(user).get('/auth/me')).body;
    expect(me.email).toBe(user.email);
    expect(me.globalRole).toBe('USER');
    expect(me.isActive).toBe(true);
  });

  it('o\'zini ADMIN qilib qo\'ya olmaydi', async () => {
    const user = await h.api.createUser();
    await h.api.as(user).patch(`/users/${user.id}`).send({ globalRole: 'ADMIN' });
    expect((await h.api.as(user).get('/auth/me')).body.globalRole).toBe('USER');
    expectError(await h.api.as(user).get('/users'), 403);
  });

  it('boshqa foydalanuvchini tahrirlash 403 va ma\'lumot o\'zgarmaydi', async () => {
    const [a, b] = await Promise.all([h.api.createUser(), h.api.createUser({ fullName: 'Asl Ism' })]);
    expectError(await h.api.as(a).patch(`/users/${b.id}`).send({ fullName: 'Hacked' }), 403);
    expect((await h.api.as(b).get('/auth/me')).body.fullName).toBe('Asl Ism');
  });

  it('ADMIN boshqa foydalanuvchining fullName\'ini o\'zgartira oladi', async () => {
    const admin = await h.api.createGlobalAdmin();
    const user = await h.api.createUser();
    const res = await h.api.as(admin).patch(`/users/${user.id}`).send({ fullName: 'Admin Tahriri' });
    expect(res.status).toBe(200);
    expect(res.body.fullName).toBe('Admin Tahriri');
  });

  it.each([[''], ['   '], ['x'.repeat(101)]])('noto\'g\'ri fullName (%j) 400', async (fullName) => {
    const user = await h.api.createUser();
    expectError(await h.api.as(user).patch(`/users/${user.id}`).send({ fullName }), 400);
  });
});

describe('PATCH /users/:id/status (faqat ADMIN)', () => {
  it('ADMIN foydalanuvchini faolsizlantiradi va qayta faollashtiradi', async () => {
    const admin = await h.api.createGlobalAdmin();
    const user = await h.api.createUser();
    const off = await h.api.as(admin).patch(`/users/${user.id}/status`).send({ isActive: false });
    expect(off.status).toBe(200);
    expect(off.body.isActive).toBe(false);
    expectError(await h.api.as(user).get('/auth/me'), 401);

    const on = await h.api.as(admin).patch(`/users/${user.id}/status`).send({ isActive: true });
    expect(on.body.isActive).toBe(true);
    const login = await h.api.anon.post('/auth/login').send({ email: user.email, password: user.password });
    expect(login.status).toBe(200);
  });

  it('oddiy foydalanuvchi status o\'zgartira olmaydi (403), hatto o\'zinikini ham', async () => {
    const [a, b] = await Promise.all([h.api.createUser(), h.api.createUser()]);
    expectError(await h.api.as(a).patch(`/users/${b.id}/status`).send({ isActive: false }), 403);
    expectError(await h.api.as(a).patch(`/users/${a.id}/status`).send({ isActive: false }), 403);
    await h.api.as(b).get('/auth/me').expect(200);
  });

  it('ADMIN o\'zini faolsizlantira olmaydi (409)', async () => {
    const admin = await h.api.createGlobalAdmin();
    expectError(await h.api.as(admin).patch(`/users/${admin.id}/status`).send({ isActive: false }), 409);
    await h.api.as(admin).get('/auth/me').expect(200);
  });

  it('mavjud bo\'lmagan foydalanuvchi 404, noto\'g\'ri tana 400', async () => {
    const admin = await h.api.createGlobalAdmin();
    const user = await h.api.createUser();
    expectError(await h.api.as(admin).patch(`/users/${FAKE_ID}/status`).send({ isActive: false }), 404);
    expectError(await h.api.as(admin).patch(`/users/${user.id}/status`).send({ isActive: 'no' }), 400);
    expectError(await h.api.as(admin).patch(`/users/${user.id}/status`).send({}), 400);
  });

  it('faolsizlantirilgan foydalanuvchi loyiha a\'zoligini yo\'qotmaydi, lekin API\'dan foydalana olmaydi', async () => {
    const t = await h.api.createTeam();
    await h.api.as(t.globalAdmin).patch(`/users/${t.member.id}/status`).send({ isActive: false }).expect(200);
    expectError(await h.api.as(t.member).get(`/projects/${t.project.id}`), 401);
    const members = await h.api.as(t.owner).get(`/projects/${t.project.id}/members`);
    expect(members.body.data.map((m: any) => m.userId)).toContain(t.member.id);
  });
});
