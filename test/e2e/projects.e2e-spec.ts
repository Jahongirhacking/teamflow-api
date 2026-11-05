import { describe, expect, it } from 'vitest';
import { ISO_DATE_RE, UUID_RE } from '../support/api';
import { expectError, expectPage } from '../support/assertions';
import { useTestApp } from '../support/app';
import { fixtures } from '../support/files';

const h = useTestApp();
const FAKE_ID = '3f9d3c64-6f34-4f0f-8c0b-0a8e9f1d2b3c';

function expectProjectShape(p: any) {
  expect(p.id).toMatch(UUID_RE);
  expect(typeof p.name).toBe('string');
  expect(p.description === null || typeof p.description === 'string').toBe(true);
  expect(['ACTIVE', 'ARCHIVED']).toContain(p.status);
  expect(p.owner.id).toMatch(UUID_RE);
  expect(typeof p.owner.fullName).toBe('string');
  expect(p.createdAt).toMatch(ISO_DATE_RE);
  expect(p.updatedAt).toMatch(ISO_DATE_RE);
  // entity to'g'ridan-to'g'ri sizib chiqmasin
  expect(Object.keys(p).sort()).toEqual(['createdAt', 'description', 'id', 'name', 'owner', 'status', 'updatedAt']);
  expect(Object.keys(p.owner).sort()).toEqual(['fullName', 'id']);
}

describe('POST /projects', () => {
  it('autentifikatsiyalangan foydalanuvchi loyiha yaratadi (201)', async () => {
    const user = await h.api.createUser();
    const res = await h.api.as(user).post('/projects').send({ name: 'Website', description: 'Yangi sayt' });
    expect(res.status).toBe(201);
    expectProjectShape(res.body);
    expect(res.body).toMatchObject({ name: 'Website', description: 'Yangi sayt', status: 'ACTIVE' });
    expect(res.body.owner.id).toBe(user.id);
  });

  it('tavsif ixtiyoriy: yuborilmasa null', async () => {
    const user = await h.api.createUser();
    const res = await h.api.as(user).post('/projects').send({ name: 'No description' });
    expect(res.status).toBe(201);
    expect(res.body.description).toBeNull();
  });

  it('yaratuvchi avtomatik tarzda loyiha ADMIN a\'zosi bo\'ladi', async () => {
    const user = await h.api.createUser();
    const p = await h.api.createProject(user);
    const members = await h.api.as(user).get(`/projects/${p.id}/members`);
    expect(members.body.data).toHaveLength(1);
    expect(members.body.data[0]).toMatchObject({ userId: user.id, role: 'ADMIN' });
  });

  it('tokensiz 401', async () => {
    expectError(await h.api.anon.post('/projects').send({ name: 'x' }), 401);
  });

  it('mijoz owner/status/id yubora olmaydi (400)', async () => {
    const [user, other] = await Promise.all([h.api.createUser(), h.api.createUser()]);
    for (const extra of [{ ownerId: other.id }, { status: 'ARCHIVED' }, { id: FAKE_ID }, { owner: { id: other.id } }]) {
      expectError(await h.api.as(user).post('/projects').send({ name: 'P', ...extra }), 400);
    }
  });

  it.each([
    ['name yo\'q', {}],
    ['name bo\'sh', { name: '' }],
    ['name faqat bo\'shliq', { name: '   ' }],
    ['name 100 belgidan uzun', { name: 'n'.repeat(101) }],
    ['name satr emas', { name: 123 }],
    ['description 1000 belgidan uzun', { name: 'ok', description: 'd'.repeat(1001) }],
    ['description satr emas', { name: 'ok', description: 5 }],
  ])('validatsiya: %s -> 400', async (_n, body) => {
    const user = await h.api.createUser();
    expectError(await h.api.as(user).post('/projects').send(body), 400);
  });

  it('name chetidagi bo\'shliqlar kesiladi', async () => {
    const user = await h.api.createUser();
    const res = await h.api.as(user).post('/projects').send({ name: '  Padded  ' });
    expect(res.body.name).toBe('Padded');
  });
});

describe('GET /projects (ro\'yxat, sahifalash, filtr, saralash)', () => {
  it('faqat foydalanuvchi a\'zo bo\'lgan loyihalarni qaytaradi', async () => {
    const t = await h.api.createTeam();
    const foreign = await h.api.createProject(t.outsider, { name: 'Foreign' });
    const mine = await h.api.createProject(t.member, { name: 'Mine' });

    const res = await h.api.as(t.member).get('/projects');
    expectPage(res, { page: 1, limit: 10, total: 2 });
    const ids = res.body.data.map((p: any) => p.id);
    expect(ids).toContain(t.project.id);
    expect(ids).toContain(mine.id);
    expect(ids).not.toContain(foreign.id);
    res.body.data.forEach(expectProjectShape);
  });

  it('hech qaysi loyihaga a\'zo bo\'lmagan foydalanuvchi uchun bo\'sh ro\'yxat', async () => {
    const user = await h.api.createUser();
    const res = await h.api.as(user).get('/projects');
    expectPage(res, { page: 1, limit: 10, total: 0 });
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.totalPages).toBe(0);
  });

  it('global ADMIN barcha loyihalarni ko\'radi', async () => {
    const t = await h.api.createTeam();
    await h.api.createProject(t.outsider);
    const res = await h.api.as(t.globalAdmin).get('/projects');
    expect(res.body.meta.total).toBe(2);
  });

  it('sahifalash: page/limit, jami va totalPages', async () => {
    const user = await h.api.createUser();
    for (let i = 1; i <= 7; i++) await h.api.createProject(user, { name: `P${i}` });
    const p1 = await h.api.as(user).get('/projects?page=1&limit=3&sortBy=name&order=ASC');
    const p3 = await h.api.as(user).get('/projects?page=3&limit=3&sortBy=name&order=ASC');
    const p4 = await h.api.as(user).get('/projects?page=4&limit=3&sortBy=name&order=ASC');
    expectPage(p1, { page: 1, limit: 3, total: 7 });
    expect(p1.body.meta.totalPages).toBe(3);
    expect(p1.body.data.map((p: any) => p.name)).toEqual(['P1', 'P2', 'P3']);
    expect(p3.body.data.map((p: any) => p.name)).toEqual(['P7']);
    expect(p4.body.data).toEqual([]);
  });

  it('sahifalar kesishmaydi va hammasini qamrab oladi', async () => {
    const user = await h.api.createUser();
    for (let i = 0; i < 5; i++) await h.api.createProject(user);
    const seen: string[] = [];
    for (const page of [1, 2, 3]) {
      const res = await h.api.as(user).get(`/projects?page=${page}&limit=2`);
      seen.push(...res.body.data.map((p: any) => p.id));
    }
    expect(seen).toHaveLength(5);
    expect(new Set(seen).size).toBe(5);
  });

  it('standart saralash: createdAt kamayish tartibida (yangisi birinchi)', async () => {
    const user = await h.api.createUser();
    const a = await h.api.createProject(user, { name: 'first' });
    const b = await h.api.createProject(user, { name: 'second' });
    const c = await h.api.createProject(user, { name: 'third' });
    const res = await h.api.as(user).get('/projects');
    expect(res.body.data.map((p: any) => p.id)).toEqual([c.id, b.id, a.id]);
  });

  it('sortBy=name & order=DESC', async () => {
    const user = await h.api.createUser();
    for (const name of ['beta', 'alpha', 'gamma']) await h.api.createProject(user, { name });
    const res = await h.api.as(user).get('/projects?sortBy=name&order=DESC');
    expect(res.body.data.map((p: any) => p.name)).toEqual(['gamma', 'beta', 'alpha']);
  });

  it('status bo\'yicha filtrlaydi', async () => {
    const user = await h.api.createUser();
    const active = await h.api.createProject(user, { name: 'active' });
    const archived = await h.api.createProject(user, { name: 'old' });
    await h.api.as(user).post(`/projects/${archived.id}/archive`).expect(200);

    const a = await h.api.as(user).get('/projects?status=ACTIVE');
    const r = await h.api.as(user).get('/projects?status=ARCHIVED');
    expect(a.body.data.map((p: any) => p.id)).toEqual([active.id]);
    expect(r.body.data.map((p: any) => p.id)).toEqual([archived.id]);
    expect(a.body.meta.total).toBe(1);
  });

  it.each(['page=0', 'page=1.5', 'page=abc', 'limit=0', 'limit=101', 'status=DELETED', 'sortBy=password', 'order=SIDEWAYS'])(
    'noto\'g\'ri parametr (%s) 400',
    async (qs) => {
      const user = await h.api.createUser();
      expectError(await h.api.as(user).get(`/projects?${qs}`), 400);
    },
  );

  it('parametrlar son sifatida (transform) qaytadi', async () => {
    const user = await h.api.createUser();
    const res = await h.api.as(user).get('/projects?page=2&limit=5');
    expect(res.body.meta.page).toBe(2);
    expect(res.body.meta.limit).toBe(5);
  });
});

describe('GET /projects/:id', () => {
  it('a\'zo loyihani oladi', async () => {
    const t = await h.api.createTeam();
    for (const user of [t.owner, t.manager, t.member]) {
      const res = await h.api.as(user).get(`/projects/${t.project.id}`);
      expect(res.status).toBe(200);
      expectProjectShape(res.body);
      expect(res.body.id).toBe(t.project.id);
    }
  });

  it('a\'zo bo\'lmagan foydalanuvchi uchun 404 (loyiha mavjudligi sir saqlanadi)', async () => {
    const t = await h.api.createTeam();
    expectError(await h.api.as(t.outsider).get(`/projects/${t.project.id}`), 404);
  });

  it('global ADMIN a\'zo bo\'lmasa ham ko\'ra oladi', async () => {
    const t = await h.api.createTeam();
    await h.api.as(t.globalAdmin).get(`/projects/${t.project.id}`).expect(200);
  });

  it('mavjud bo\'lmagan id 404, noto\'g\'ri UUID 400', async () => {
    const user = await h.api.createUser();
    expectError(await h.api.as(user).get(`/projects/${FAKE_ID}`), 404);
    expectError(await h.api.as(user).get('/projects/123'), 400);
  });
});

describe('PATCH /projects/:id', () => {
  it('ADMIN va MANAGER nom/tavsifni yangilaydi', async () => {
    const t = await h.api.createTeam();
    const a = await h.api.as(t.owner).patch(`/projects/${t.project.id}`).send({ name: 'Renamed' });
    expect(a.status).toBe(200);
    expect(a.body.name).toBe('Renamed');
    const b = await h.api.as(t.manager).patch(`/projects/${t.project.id}`).send({ description: 'Yangi tavsif' });
    expect(b.status).toBe(200);
    expect(b.body).toMatchObject({ name: 'Renamed', description: 'Yangi tavsif' });
    expect(Date.parse(b.body.updatedAt)).toBeGreaterThanOrEqual(Date.parse(a.body.updatedAt));
  });

  it('description: null yuborilsa tavsif tozalanadi', async () => {
    const t = await h.api.createTeam();
    const res = await h.api.as(t.owner).patch(`/projects/${t.project.id}`).send({ description: null });
    expect(res.status).toBe(200);
    expect(res.body.description).toBeNull();
  });

  it('MEMBER 403, a\'zo bo\'lmagan 404 va ma\'lumot o\'zgarmaydi', async () => {
    const t = await h.api.createTeam();
    expectError(await h.api.as(t.member).patch(`/projects/${t.project.id}`).send({ name: 'Hack' }), 403);
    expectError(await h.api.as(t.outsider).patch(`/projects/${t.project.id}`).send({ name: 'Hack' }), 404);
    expect((await h.api.as(t.owner).get(`/projects/${t.project.id}`)).body.name).toBe(t.project.name);
  });

  it('global ADMIN a\'zo bo\'lmasa ham tahrirlay oladi', async () => {
    const t = await h.api.createTeam();
    const res = await h.api.as(t.globalAdmin).patch(`/projects/${t.project.id}`).send({ name: 'By Admin' });
    expect(res.status).toBe(200);
  });

  it('status/owner PATCH orqali o\'zgartirilmaydi (400)', async () => {
    const t = await h.api.createTeam();
    expectError(await h.api.as(t.owner).patch(`/projects/${t.project.id}`).send({ status: 'ARCHIVED' }), 400);
    expectError(await h.api.as(t.owner).patch(`/projects/${t.project.id}`).send({ ownerId: t.member.id }), 400);
  });

  it('noto\'g\'ri qiymatlar 400', async () => {
    const t = await h.api.createTeam();
    expectError(await h.api.as(t.owner).patch(`/projects/${t.project.id}`).send({ name: '' }), 400);
    expectError(await h.api.as(t.owner).patch(`/projects/${t.project.id}`).send({ name: 'x'.repeat(101) }), 400);
  });

  it('arxivlangan loyihani tahrirlash 409', async () => {
    const t = await h.api.createTeam();
    await h.api.as(t.owner).post(`/projects/${t.project.id}/archive`).expect(200);
    expectError(await h.api.as(t.owner).patch(`/projects/${t.project.id}`).send({ name: 'Late' }), 409);
  });
});

describe('arxivlash: POST /projects/:id/archive va /restore', () => {
  it('ADMIN arxivlaydi va qayta tiklaydi', async () => {
    const t = await h.api.createTeam();
    const a = await h.api.as(t.owner).post(`/projects/${t.project.id}/archive`);
    expect(a.status).toBe(200);
    expect(a.body.status).toBe('ARCHIVED');
    const r = await h.api.as(t.owner).post(`/projects/${t.project.id}/restore`);
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('ACTIVE');
  });

  it('MANAGER va MEMBER arxivlay olmaydi (403)', async () => {
    const t = await h.api.createTeam();
    expectError(await h.api.as(t.manager).post(`/projects/${t.project.id}/archive`), 403);
    expectError(await h.api.as(t.member).post(`/projects/${t.project.id}/archive`), 403);
    expectError(await h.api.as(t.outsider).post(`/projects/${t.project.id}/archive`), 404);
    expect((await h.api.as(t.owner).get(`/projects/${t.project.id}`)).body.status).toBe('ACTIVE');
  });

  it('allaqachon arxivlangan loyihani yana arxivlash 409; faol loyihani tiklash 409', async () => {
    const t = await h.api.createTeam();
    expectError(await h.api.as(t.owner).post(`/projects/${t.project.id}/restore`), 409);
    await h.api.as(t.owner).post(`/projects/${t.project.id}/archive`).expect(200);
    expectError(await h.api.as(t.owner).post(`/projects/${t.project.id}/archive`), 409);
  });

  it('arxivlangan loyihada yozish amallari 409, o\'qish esa mumkin', async () => {
    const t = await h.api.createTeam();
    const task = await h.api.createTask(t.owner, t.project.id);
    await h.api.as(t.owner).post(`/projects/${t.project.id}/archive`).expect(200);

    expectError(await h.api.as(t.owner).post(`/projects/${t.project.id}/tasks`).send({ title: 'New' }), 409);
    expectError(await h.api.as(t.owner).patch(`/tasks/${task.id}`).send({ title: 'Edit' }), 409);
    expectError(await h.api.as(t.owner).post(`/projects/${t.project.id}/members`).send({ email: t.outsider.email, role: 'MEMBER' }), 409);
    await h.api.as(t.member).get(`/projects/${t.project.id}`).expect(200);
    await h.api.as(t.member).get(`/tasks/${task.id}`).expect(200);
  });
});

describe('DELETE /projects/:id', () => {
  it('ADMIN loyihani o\'chiradi (204), keyin 404', async () => {
    const t = await h.api.createTeam();
    const res = await h.api.as(t.owner).delete(`/projects/${t.project.id}`);
    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expectError(await h.api.as(t.owner).get(`/projects/${t.project.id}`), 404);
    expect((await h.api.as(t.owner).get('/projects')).body.meta.total).toBe(0);
  });

  it('MANAGER/MEMBER o\'chira olmaydi (403), a\'zo bo\'lmagan 404', async () => {
    const t = await h.api.createTeam();
    expectError(await h.api.as(t.manager).delete(`/projects/${t.project.id}`), 403);
    expectError(await h.api.as(t.member).delete(`/projects/${t.project.id}`), 403);
    expectError(await h.api.as(t.outsider).delete(`/projects/${t.project.id}`), 404);
    await h.api.as(t.owner).get(`/projects/${t.project.id}`).expect(200);
  });

  it('o\'chirilganda vazifalar, a\'zolar va biriktirmalar ham (jismoniy fayllar bilan) o\'chadi', async () => {
    const t = await h.api.createTeam();
    const task = await h.api.createTask(t.owner, t.project.id);
    const projAtt = await h.api.uploadToProject(t.owner, t.project.id, { buffer: fixtures.png(), filename: 'a.png', contentType: 'image/png' });
    const taskAtt = await h.api.uploadToTask(t.member, task.id, { buffer: fixtures.pdf(), filename: 'b.pdf', contentType: 'application/pdf' });
    expect(h.countStoredFiles()).toBe(2);

    await h.api.as(t.owner).delete(`/projects/${t.project.id}`).expect(204);

    expectError(await h.api.as(t.owner).get(`/tasks/${task.id}`), 404);
    expectError(await h.api.as(t.owner).get(`/attachments/${projAtt.id}`), 404);
    expectError(await h.api.as(t.globalAdmin).get(`/attachments/${taskAtt.id}`), 404);
    expect(h.countStoredFiles()).toBe(0);
    // foydalanuvchilarning o'zi saqlanib qoladi
    await h.api.as(t.member).get('/auth/me').expect(200);
  });

  it('global ADMIN istalgan loyihani o\'chira oladi', async () => {
    const t = await h.api.createTeam();
    await h.api.as(t.globalAdmin).delete(`/projects/${t.project.id}`).expect(204);
  });

  it('arxivlangan loyihani ham o\'chirish mumkin', async () => {
    const t = await h.api.createTeam();
    await h.api.as(t.owner).post(`/projects/${t.project.id}/archive`).expect(200);
    await h.api.as(t.owner).delete(`/projects/${t.project.id}`).expect(204);
  });
});
