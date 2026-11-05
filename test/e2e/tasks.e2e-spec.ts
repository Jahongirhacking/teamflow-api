import { describe, expect, it } from 'vitest';
import { ISO_DATE_RE, UUID_RE } from '../support/api';
import { expectError, expectPage } from '../support/assertions';
import { useTestApp } from '../support/app';
import { fixtures } from '../support/files';

const h = useTestApp();
const FAKE_ID = '3f9d3c64-6f34-4f0f-8c0b-0a8e9f1d2b3c';

function expectTaskShape(task: any) {
  expect(task.id).toMatch(UUID_RE);
  expect(typeof task.title).toBe('string');
  expect(task.description === null || typeof task.description === 'string').toBe(true);
  expect(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED']).toContain(task.status);
  expect(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).toContain(task.priority);
  expect(task.dueDate === null || ISO_DATE_RE.test(task.dueDate)).toBe(true);
  expect(task.projectId).toMatch(UUID_RE);
  expect(task.assignee === null || (task.assignee.id && typeof task.assignee.fullName === 'string')).toBeTruthy();
  expect(task.createdBy.id).toMatch(UUID_RE);
  expect(typeof task.createdBy.fullName).toBe('string');
  expect(task.createdAt).toMatch(ISO_DATE_RE);
  expect(task.updatedAt).toMatch(ISO_DATE_RE);
  expect(Object.keys(task).sort()).toEqual([
    'assignee', 'createdAt', 'createdBy', 'description', 'dueDate', 'id', 'priority', 'projectId', 'status', 'title', 'updatedAt',
  ]);
  if (task.assignee) expect(Object.keys(task.assignee).sort()).toEqual(['fullName', 'id']);
  expect(Object.keys(task.createdBy).sort()).toEqual(['fullName', 'id']);
}

describe('POST /projects/:projectId/tasks', () => {
  it('standart qiymatlar bilan vazifa yaratadi: status=TODO, priority=MEDIUM, assignee=null', async () => {
    const t = await h.api.createTeam();
    const res = await h.api.as(t.manager).post(`/projects/${t.project.id}/tasks`).send({ title: 'Write docs' });
    expect(res.status).toBe(201);
    expectTaskShape(res.body);
    expect(res.body).toMatchObject({
      title: 'Write docs',
      description: null,
      status: 'TODO',
      priority: 'MEDIUM',
      dueDate: null,
      assignee: null,
      projectId: t.project.id,
    });
    expect(res.body.createdBy.id).toBe(t.manager.id);
  });

  it('barcha ixtiyoriy maydonlar bilan yaratadi', async () => {
    const t = await h.api.createTeam();
    const dueDate = '2030-05-20T10:00:00.000Z';
    const res = await h.api.as(t.owner).post(`/projects/${t.project.id}/tasks`).send({
      title: 'Full task',
      description: 'Batafsil',
      priority: 'URGENT',
      dueDate,
      assigneeId: t.member.id,
    });
    expect(res.status).toBe(201);
    expectTaskShape(res.body);
    expect(res.body).toMatchObject({ description: 'Batafsil', priority: 'URGENT', status: 'TODO' });
    expect(new Date(res.body.dueDate).toISOString()).toBe(dueDate);
    expect(res.body.assignee.id).toBe(t.member.id);
  });

  it('MEMBER vazifa yarata oladi, lekin tayinlay olmaydi (assigneeId bilan 403)', async () => {
    const t = await h.api.createTeam();
    await h.api.as(t.member).post(`/projects/${t.project.id}/tasks`).send({ title: 'mine' }).expect(201);
    expectError(await h.api.as(t.member).post(`/projects/${t.project.id}/tasks`).send({ title: 'assign', assigneeId: t.member2.id }), 403);
    const list = await h.api.as(t.owner).get(`/projects/${t.project.id}/tasks`);
    expect(list.body.meta.total).toBe(1);
  });

  it('loyiha a\'zosi bo\'lmagan foydalanuvchini tayinlash 422 va vazifa yaratilmaydi', async () => {
    const t = await h.api.createTeam();
    const res = await h.api.as(t.owner).post(`/projects/${t.project.id}/tasks`).send({ title: 'x', assigneeId: t.outsider.id });
    expectError(res, 422);
    expect((await h.api.as(t.owner).get(`/projects/${t.project.id}/tasks`)).body.meta.total).toBe(0);
  });

  it('mavjud bo\'lmagan foydalanuvchini tayinlash 422', async () => {
    const t = await h.api.createTeam();
    expectError(await h.api.as(t.owner).post(`/projects/${t.project.id}/tasks`).send({ title: 'x', assigneeId: FAKE_ID }), 422);
  });

  it('mijoz status/createdBy/projectId/id yubora olmaydi (400)', async () => {
    const t = await h.api.createTeam();
    for (const extra of [{ status: 'DONE' }, { createdById: t.member.id }, { projectId: FAKE_ID }, { id: FAKE_ID }]) {
      expectError(await h.api.as(t.owner).post(`/projects/${t.project.id}/tasks`).send({ title: 'x', ...extra }), 400);
    }
  });

  it.each([
    ['title yo\'q', {}],
    ['title bo\'sh', { title: '' }],
    ['title faqat bo\'shliq', { title: '  ' }],
    ['title 200 belgidan uzun', { title: 't'.repeat(201) }],
    ['description 5000 belgidan uzun', { title: 'ok', description: 'd'.repeat(5001) }],
    ['priority noma\'lum', { title: 'ok', priority: 'CRITICAL' }],
    ['priority kichik harf', { title: 'ok', priority: 'high' }],
    ['dueDate noto\'g\'ri', { title: 'ok', dueDate: 'tomorrow' }],
    ['dueDate son', { title: 'ok', dueDate: 12345 }],
    ['assigneeId UUID emas', { title: 'ok', assigneeId: 'abc' }],
  ])('validatsiya: %s -> 400', async (_n, body) => {
    const t = await h.api.createTeam();
    expectError(await h.api.as(t.owner).post(`/projects/${t.project.id}/tasks`).send(body), 400);
  });

  it('a\'zo bo\'lmagan foydalanuvchi uchun 404, mavjud bo\'lmagan loyiha 404', async () => {
    const t = await h.api.createTeam();
    expectError(await h.api.as(t.outsider).post(`/projects/${t.project.id}/tasks`).send({ title: 'x' }), 404);
    expectError(await h.api.as(t.owner).post(`/projects/${FAKE_ID}/tasks`).send({ title: 'x' }), 404);
  });
});

describe('GET /tasks/:id', () => {
  it('a\'zo vazifani oladi', async () => {
    const t = await h.api.createTeam();
    const task = await h.api.createTask(t.owner, t.project.id, { title: 'Read me' });
    const res = await h.api.as(t.member).get(`/tasks/${task.id}`);
    expect(res.status).toBe(200);
    expectTaskShape(res.body);
    expect(res.body.id).toBe(task.id);
  });

  it('a\'zo bo\'lmagan uchun 404, mavjud bo\'lmagan id 404, noto\'g\'ri UUID 400', async () => {
    const t = await h.api.createTeam();
    const task = await h.api.createTask(t.owner, t.project.id);
    expectError(await h.api.as(t.outsider).get(`/tasks/${task.id}`), 404);
    expectError(await h.api.as(t.owner).get(`/tasks/${FAKE_ID}`), 404);
    expectError(await h.api.as(t.owner).get('/tasks/xyz'), 400);
  });
});

describe('PATCH /tasks/:id', () => {
  it('ADMIN/MANAGER matn maydonlarini yangilaydi, boshqa maydonlar o\'zgarmaydi', async () => {
    const t = await h.api.createTeam();
    const task = await h.api.createTask(t.owner, t.project.id, { title: 'Old', priority: 'LOW', assigneeId: t.member.id });
    const res = await h.api
      .as(t.manager)
      .patch(`/tasks/${task.id}`)
      .send({ title: 'New', description: 'Desc', priority: 'HIGH', dueDate: '2031-01-01T00:00:00.000Z' });
    expect(res.status).toBe(200);
    expectTaskShape(res.body);
    expect(res.body).toMatchObject({ title: 'New', description: 'Desc', priority: 'HIGH', status: 'TODO' });
    expect(res.body.assignee.id).toBe(t.member.id);
    expect(res.body.createdAt).toBe(task.createdAt);
    expect(Date.parse(res.body.updatedAt)).toBeGreaterThanOrEqual(Date.parse(task.updatedAt));
  });

  it('dueDate va description null qilib tozalanishi mumkin', async () => {
    const t = await h.api.createTeam();
    const task = await h.api.createTask(t.owner, t.project.id, { description: 'x', dueDate: '2031-01-01T00:00:00.000Z' });
    const res = await h.api.as(t.owner).patch(`/tasks/${task.id}`).send({ description: null, dueDate: null });
    expect(res.status).toBe(200);
    expect(res.body.description).toBeNull();
    expect(res.body.dueDate).toBeNull();
  });

  it('MEMBER faqat o\'zi yaratgan yoki o\'ziga tayinlangan vazifani tahrirlay oladi', async () => {
    const t = await h.api.createTeam();
    const own = await h.api.createTask(t.member, t.project.id, { title: 'own' });
    const assigned = await h.api.createTask(t.owner, t.project.id, { title: 'assigned', assigneeId: t.member.id });
    const foreign = await h.api.createTask(t.owner, t.project.id, { title: 'foreign' });
    await h.api.as(t.member).patch(`/tasks/${own.id}`).send({ title: 'own2' }).expect(200);
    await h.api.as(t.member).patch(`/tasks/${assigned.id}`).send({ title: 'assigned2' }).expect(200);
    expectError(await h.api.as(t.member).patch(`/tasks/${foreign.id}`).send({ title: 'nope' }), 403);
    expect((await h.api.as(t.owner).get(`/tasks/${foreign.id}`)).body.title).toBe('foreign');
  });

  it('status, assigneeId, projectId, createdBy PATCH orqali o\'zgartirilmaydi (400)', async () => {
    const t = await h.api.createTeam();
    const task = await h.api.createTask(t.owner, t.project.id);
    for (const body of [{ status: 'DONE' }, { assigneeId: t.member.id }, { projectId: FAKE_ID }, { createdById: t.member.id }]) {
      expectError(await h.api.as(t.owner).patch(`/tasks/${task.id}`).send(body), 400);
    }
  });

  it('noto\'g\'ri qiymatlar 400; bo\'sh tana ham 400', async () => {
    const t = await h.api.createTeam();
    const task = await h.api.createTask(t.owner, t.project.id);
    expectError(await h.api.as(t.owner).patch(`/tasks/${task.id}`).send({ title: '' }), 400);
    expectError(await h.api.as(t.owner).patch(`/tasks/${task.id}`).send({ priority: 'NOW' }), 400);
    expectError(await h.api.as(t.owner).patch(`/tasks/${task.id}`).send({}), 400);
  });

  it('a\'zo bo\'lmagan 404', async () => {
    const t = await h.api.createTeam();
    const task = await h.api.createTask(t.owner, t.project.id);
    expectError(await h.api.as(t.outsider).patch(`/tasks/${task.id}`).send({ title: 'x' }), 404);
  });
});

describe('DELETE /tasks/:id', () => {
  it('ADMIN va MANAGER o\'chiradi (204), keyin 404', async () => {
    const t = await h.api.createTeam();
    const a = await h.api.createTask(t.owner, t.project.id);
    const b = await h.api.createTask(t.owner, t.project.id);
    const r1 = await h.api.as(t.owner).delete(`/tasks/${a.id}`);
    expect(r1.status).toBe(204);
    expect(r1.text).toBe('');
    await h.api.as(t.manager).delete(`/tasks/${b.id}`).expect(204);
    expectError(await h.api.as(t.owner).get(`/tasks/${a.id}`), 404);
    expect((await h.api.as(t.owner).get(`/projects/${t.project.id}/tasks`)).body.meta.total).toBe(0);
  });

  it('MEMBER o\'zi yaratgan vazifani ham o\'chira olmaydi (403)', async () => {
    const t = await h.api.createTeam();
    const own = await h.api.createTask(t.member, t.project.id);
    expectError(await h.api.as(t.member).delete(`/tasks/${own.id}`), 403);
    await h.api.as(t.owner).get(`/tasks/${own.id}`).expect(200);
  });

  it('vazifa o\'chganda uning biriktirmalari va jismoniy fayllari ham o\'chadi', async () => {
    const t = await h.api.createTeam();
    const task = await h.api.createTask(t.owner, t.project.id);
    const att = await h.api.uploadToTask(t.owner, task.id, { buffer: fixtures.png(), filename: 'a.png', contentType: 'image/png' });
    expect(h.countStoredFiles()).toBe(1);
    await h.api.as(t.owner).delete(`/tasks/${task.id}`).expect(204);
    expectError(await h.api.as(t.owner).get(`/attachments/${att.id}`), 404);
    expect(h.countStoredFiles()).toBe(0);
  });

  it('mavjud bo\'lmagan vazifa 404', async () => {
    const t = await h.api.createTeam();
    expectError(await h.api.as(t.owner).delete(`/tasks/${FAKE_ID}`), 404);
  });
});

describe('GET /projects/:projectId/tasks (ro\'yxat)', () => {
  async function seed() {
    const t = await h.api.createTeam();
    const mk = (body: Record<string, unknown>) => h.api.createTask(t.owner, t.project.id, body);
    const tasks = {
      a: await mk({ title: 'Alpha', priority: 'LOW', dueDate: '2030-01-03T00:00:00.000Z', assigneeId: t.member.id }),
      b: await mk({ title: 'Bravo', priority: 'URGENT', dueDate: '2030-01-01T00:00:00.000Z', assigneeId: t.member2.id }),
      c: await mk({ title: 'Charlie', priority: 'HIGH' }),
      d: await mk({ title: 'Delta', priority: 'MEDIUM', dueDate: '2030-01-02T00:00:00.000Z', assigneeId: t.member.id }),
      e: await mk({ title: 'Echo', priority: 'URGENT' }),
    };
    await h.api.setTaskStatus(t.owner, tasks.b.id, 'IN_PROGRESS');
    await h.api.setTaskStatus(t.owner, tasks.d.id, 'CANCELLED');
    return { t, tasks };
  }
  const ids = (res: any) => res.body.data.map((x: any) => x.id);
  const url = (t: any, qs = '') => `/projects/${t.project.id}/tasks${qs ? `?${qs}` : ''}`;

  it('standart: createdAt kamayish tartibi, page=1, limit=10', async () => {
    const { t, tasks } = await seed();
    const res = await h.api.as(t.member).get(url(t));
    expectPage(res, { page: 1, limit: 10, total: 5 });
    expect(ids(res)).toEqual([tasks.e.id, tasks.d.id, tasks.c.id, tasks.b.id, tasks.a.id]);
    res.body.data.forEach(expectTaskShape);
  });

  it('faqat shu loyihaning vazifalarini qaytaradi', async () => {
    const { t } = await seed();
    const other = await h.api.createProject(t.owner, { name: 'Other' });
    await h.api.createTask(t.owner, other.id);
    expect((await h.api.as(t.owner).get(url(t))).body.meta.total).toBe(5);
  });

  it('status bo\'yicha filtr', async () => {
    const { t, tasks } = await seed();
    expect(ids(await h.api.as(t.owner).get(url(t, 'status=IN_PROGRESS')))).toEqual([tasks.b.id]);
    expect(ids(await h.api.as(t.owner).get(url(t, 'status=CANCELLED')))).toEqual([tasks.d.id]);
    expect((await h.api.as(t.owner).get(url(t, 'status=TODO'))).body.meta.total).toBe(3);
    expect((await h.api.as(t.owner).get(url(t, 'status=DONE'))).body.meta.total).toBe(0);
  });

  it('priority bo\'yicha filtr', async () => {
    const { t, tasks } = await seed();
    const res = await h.api.as(t.owner).get(url(t, 'priority=URGENT&sortBy=title&order=ASC'));
    expect(ids(res)).toEqual([tasks.b.id, tasks.e.id]);
  });

  it('assigneeId bo\'yicha filtr', async () => {
    const { t, tasks } = await seed();
    const res = await h.api.as(t.owner).get(url(t, `assigneeId=${t.member.id}&sortBy=title&order=ASC`));
    expect(ids(res)).toEqual([tasks.a.id, tasks.d.id]);
  });

  it('filtrlar birgalikda (AND) ishlaydi va meta.total filtrlangan sonni ko\'rsatadi', async () => {
    const { t, tasks } = await seed();
    const res = await h.api.as(t.owner).get(url(t, `assigneeId=${t.member.id}&status=CANCELLED`));
    expect(ids(res)).toEqual([tasks.d.id]);
    expect(res.body.meta.total).toBe(1);
    const none = await h.api.as(t.owner).get(url(t, `assigneeId=${t.member2.id}&priority=LOW`));
    expect(none.body.data).toEqual([]);
    expect(none.body.meta.total).toBe(0);
  });

  it('sortBy=title', async () => {
    const { t, tasks } = await seed();
    expect(ids(await h.api.as(t.owner).get(url(t, 'sortBy=title&order=ASC')))).toEqual(
      [tasks.a, tasks.b, tasks.c, tasks.d, tasks.e].map((x) => x.id),
    );
    expect(ids(await h.api.as(t.owner).get(url(t, 'sortBy=title&order=DESC')))).toEqual(
      [tasks.e, tasks.d, tasks.c, tasks.b, tasks.a].map((x) => x.id),
    );
  });

  it('sortBy=priority ma\'no bo\'yicha saralaydi (alifbo bo\'yicha emas): URGENT > HIGH > MEDIUM > LOW', async () => {
    const { t, tasks } = await seed();
    const desc = await h.api.as(t.owner).get(url(t, 'sortBy=priority&order=DESC'));
    expect(desc.body.data.map((x: any) => x.priority)).toEqual(['URGENT', 'URGENT', 'HIGH', 'MEDIUM', 'LOW']);
    const asc = await h.api.as(t.owner).get(url(t, 'sortBy=priority&order=ASC'));
    expect(asc.body.data.map((x: any) => x.priority)).toEqual(['LOW', 'MEDIUM', 'HIGH', 'URGENT', 'URGENT']);
    expect(ids(asc)[0]).toBe(tasks.a.id);
  });

  it('sortBy=dueDate: dueDate\'i yo\'q vazifalar har ikki tartibda ham oxirida', async () => {
    const { t, tasks } = await seed();
    const asc = await h.api.as(t.owner).get(url(t, 'sortBy=dueDate&order=ASC'));
    expect(ids(asc).slice(0, 3)).toEqual([tasks.b.id, tasks.d.id, tasks.a.id]);
    expect(asc.body.data.slice(3).every((x: any) => x.dueDate === null)).toBe(true);
    const desc = await h.api.as(t.owner).get(url(t, 'sortBy=dueDate&order=DESC'));
    expect(ids(desc).slice(0, 3)).toEqual([tasks.a.id, tasks.d.id, tasks.b.id]);
    expect(desc.body.data.slice(3).every((x: any) => x.dueDate === null)).toBe(true);
  });

  it('sahifalash saralash va filtr bilan birga: sahifalar kesishmaydi', async () => {
    const { t } = await seed();
    const p1 = await h.api.as(t.owner).get(url(t, 'sortBy=title&order=ASC&limit=2&page=1'));
    const p2 = await h.api.as(t.owner).get(url(t, 'sortBy=title&order=ASC&limit=2&page=2'));
    const p3 = await h.api.as(t.owner).get(url(t, 'sortBy=title&order=ASC&limit=2&page=3'));
    expectPage(p1, { page: 1, limit: 2, total: 5 });
    expect(p1.body.meta.totalPages).toBe(3);
    expect(p1.body.data.map((x: any) => x.title)).toEqual(['Alpha', 'Bravo']);
    expect(p2.body.data.map((x: any) => x.title)).toEqual(['Charlie', 'Delta']);
    expect(p3.body.data.map((x: any) => x.title)).toEqual(['Echo']);
  });

  it.each([
    'status=WAITING',
    'priority=CRITICAL',
    'assigneeId=abc',
    'sortBy=description',
    'order=UP',
    'page=0',
    'limit=0',
    'limit=101',
    'limit=abc',
    'unknownParam=1',
  ])('noto\'g\'ri parametr (%s) 400', async (qs) => {
    const t = await h.api.createTeam();
    expectError(await h.api.as(t.owner).get(url(t, qs)), 400);
  });

  it('a\'zo bo\'lmagan 404', async () => {
    const t = await h.api.createTeam();
    expectError(await h.api.as(t.outsider).get(url(t)), 404);
  });
});
