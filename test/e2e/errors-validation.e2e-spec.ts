import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { PASSWORD } from '../support/api';
import { expectError } from '../support/assertions';
import { useTestApp } from '../support/app';

const h = useTestApp();
const FAKE_ID = '3f9d3c64-6f34-4f0f-8c0b-0a8e9f1d2b3c';

describe('standart xato formati', () => {
  it('mavjud bo\'lmagan marshrut: 404 va standart tana', async () => {
    const res = await h.api.anon.get('/no/such/route');
    expectError(res, 404);
  });

  it('turli sabablar bilan chiqqan xatolarning hammasi bir xil tuzilmada', async () => {
    const t = await h.api.createTeam();
    const task = await h.api.createTask(t.owner, t.project.id);
    const cases: [number, import('supertest').Test][] = [
      [400, h.api.anon.post('/auth/register').send({})],
      [400, h.api.as(t.owner).get('/projects?limit=1000')],
      [400, h.api.as(t.owner).get('/projects/not-a-uuid')],
      [401, h.api.anon.get('/projects')],
      [403, h.api.as(t.member).patch(`/projects/${t.project.id}`).send({ name: 'x' })],
      [404, h.api.as(t.outsider).get(`/projects/${t.project.id}`)],
      [404, h.api.as(t.owner).get(`/tasks/${FAKE_ID}`)],
      [409, h.api.as(t.owner).post(`/projects/${t.project.id}/members`).send({ email: t.member.email, role: 'MEMBER' })],
      [422, h.api.as(t.owner).patch(`/tasks/${task.id}/status`).send({ status: 'DONE' })],
    ];
    for (const [status, req] of cases) expectError(await req, status);
  });

  it('path maydoni so\'ralgan yo\'lni ko\'rsatadi', async () => {
    const res = await h.api.anon.get('/definitely-missing?x=1');
    expect(res.body.path).toContain('/definitely-missing');
  });

  it('validatsiya xatosida message - satrlar massivi va maydon nomlarini eslatadi', async () => {
    const res = await h.api.anon.post('/auth/register').send({ email: 'bad', password: 'x', fullName: '' });
    expectError(res, 400);
    expect(res.body.message.length).toBeGreaterThanOrEqual(3);
    const joined = res.body.message.join(' | ');
    expect(joined).toMatch(/email/i);
    expect(joined).toMatch(/password/i);
    expect(joined).toMatch(/fullName/i);
  });

  it('401 va noto\'g\'ri-parol xabarlarida ichki tafsilot yo\'q', async () => {
    const res = await h.api.anon.post('/auth/login').send({ email: 'x@example.test', password: PASSWORD });
    expectError(res, 401);
    expect(JSON.stringify(res.body)).not.toMatch(/bcrypt|jwt|passport|typeorm|postgres/i);
  });
});

describe('HTTP darajasidagi xatolar', () => {
  it('buzilgan JSON -> 400 va standart tana', async () => {
    const res = await request(h.app.getHttpServer())
      .post('/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": "a@example.test", "password": ');
    expectError(res, 400);
  });

  it('juda katta JSON tana -> 413 va standart tana', async () => {
    const huge = JSON.stringify({ email: 'a@example.test', password: 'x'.repeat(2 * 1024 * 1024), fullName: 'x' });
    const res = await request(h.app.getHttpServer()).post('/auth/register').set('Content-Type', 'application/json').send(huge);
    expectError(res, 413);
  });

  it('JSON bo\'lmagan Content-Type bilan yuborilgan tana validatsiyadan o\'tmaydi (400)', async () => {
    const res = await request(h.app.getHttpServer()).post('/auth/login').set('Content-Type', 'text/plain').send('email=a&password=b');
    expectError(res, 400);
  });

  it('X-Powered-By sarlavhasi yashirilgan', async () => {
    const res = await h.api.anon.get('/auth/me');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('global ValidationPipe sozlamalari', () => {
  it('whitelist + forbidNonWhitelisted: noma\'lum maydon rad etiladi va xabarda nomi bor', async () => {
    const user = await h.api.createUser();
    const res = await h.api.as(user).post('/projects').send({ name: 'ok', hackerField: 1 });
    expectError(res, 400);
    expect(res.body.message.join(' ')).toContain('hackerField');
  });

  it('transform: query parametrlari kerakli turga o\'tkaziladi', async () => {
    const user = await h.api.createUser();
    const res = await h.api.as(user).get('/projects?page=2&limit=3');
    expect(res.body.meta).toMatchObject({ page: 2, limit: 3 });
    expect(typeof res.body.meta.page).toBe('number');
  });

  it('ichma-ich ob\'ektlardagi xatolar ham tekshiriladi (tana massiv bo\'lsa rad etiladi)', async () => {
    const user = await h.api.createUser();
    expectError(await h.api.as(user).post('/projects').send([{ name: 'x' }]), 400);
  });

  it('prototype pollution urinishi ta\'sir qilmaydi', async () => {
    const user = await h.api.createUser();
    const res = await h.api
      .as(user)
      .post('/projects')
      .set('Content-Type', 'application/json')
      .send('{"name":"p","__proto__":{"isAdmin":true},"constructor":{"prototype":{"x":1}}}');
    expect([201, 400]).toContain(res.status);
    expect(({} as Record<string, unknown>).isAdmin).toBeUndefined();
  });
});
