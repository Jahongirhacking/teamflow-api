import { describe, expect, it } from 'vitest';
import { expectError } from '../support/assertions';
import { useTestApp } from '../support/app';

const h = useTestApp();
const FAKE_ID = '3f9d3c64-6f34-4f0f-8c0b-0a8e9f1d2b3c';

describe('PUT /tasks/:id/assignee (tayinlash)', () => {
  it('MANAGER va ADMIN loyiha a\'zosini tayinlaydi', async () => {
    const t = await h.api.createTeam();
    const task = await h.api.createTask(t.owner, t.project.id);
    const a = await h.api.as(t.manager).put(`/tasks/${task.id}/assignee`).send({ assigneeId: t.member.id });
    expect(a.status).toBe(200);
    expect(a.body.assignee).toEqual({ id: t.member.id, fullName: t.member.fullName });
    const b = await h.api.as(t.owner).put(`/tasks/${task.id}/assignee`).send({ assigneeId: t.manager.id });
    expect(b.body.assignee.id).toBe(t.manager.id);
  });

  it('tayinlash faqat assigneeni o\'zgartiradi (boshqa maydonlar saqlanadi)', async () => {
    const t = await h.api.createTeam();
    const task = await h.api.createTask(t.owner, t.project.id, { title: 'Keep', priority: 'HIGH' });
    const res = await h.api.as(t.owner).put(`/tasks/${task.id}/assignee`).send({ assigneeId: t.member.id });
    expect(res.body).toMatchObject({ title: 'Keep', priority: 'HIGH', status: 'TODO' });
  });

  it('assigneeId: null tayinlashni bekor qiladi', async () => {
    const t = await h.api.createTeam();
    const task = await h.api.createTask(t.owner, t.project.id, { assigneeId: t.member.id });
    const res = await h.api.as(t.owner).put(`/tasks/${task.id}/assignee`).send({ assigneeId: null });
    expect(res.status).toBe(200);
    expect(res.body.assignee).toBeNull();
  });

  it('loyiha a\'zosi bo\'lmagan foydalanuvchini tayinlash 422 va tayinlash o\'zgarmaydi', async () => {
    const t = await h.api.createTeam();
    const task = await h.api.createTask(t.owner, t.project.id, { assigneeId: t.member.id });
    expectError(await h.api.as(t.owner).put(`/tasks/${task.id}/assignee`).send({ assigneeId: t.outsider.id }), 422);
    expectError(await h.api.as(t.owner).put(`/tasks/${task.id}/assignee`).send({ assigneeId: FAKE_ID }), 422);
    expect((await h.api.as(t.owner).get(`/tasks/${task.id}`)).body.assignee.id).toBe(t.member.id);
  });

  it('boshqa loyihada a\'zo (hatto ADMIN) bo\'lgan, lekin bu loyihada a\'zo bo\'lmagan foydalanuvchini tayinlab bo\'lmaydi', async () => {
    const t = await h.api.createTeam();
    await h.api.createProject(t.outsider, { name: 'Other' });
    const task = await h.api.createTask(t.owner, t.project.id);
    expectError(await h.api.as(t.owner).put(`/tasks/${task.id}/assignee`).send({ assigneeId: t.outsider.id }), 422);
  });

  it('MEMBER hech kimni (hatto o\'zini ham) tayinlay olmaydi (403)', async () => {
    const t = await h.api.createTeam();
    const task = await h.api.createTask(t.owner, t.project.id);
    expectError(await h.api.as(t.member).put(`/tasks/${task.id}/assignee`).send({ assigneeId: t.member.id }), 403);
    expectError(await h.api.as(t.member).put(`/tasks/${task.id}/assignee`).send({ assigneeId: t.member2.id }), 403);
    expect((await h.api.as(t.owner).get(`/tasks/${task.id}`)).body.assignee).toBeNull();
  });

  it('tayinlangan MEMBER ham boshqaga qayta tayinlay olmaydi (403)', async () => {
    const t = await h.api.createTeam();
    const task = await h.api.createTask(t.owner, t.project.id, { assigneeId: t.member.id });
    expectError(await h.api.as(t.member).put(`/tasks/${task.id}/assignee`).send({ assigneeId: t.member2.id }), 403);
    expectError(await h.api.as(t.member).put(`/tasks/${task.id}/assignee`).send({ assigneeId: null }), 403);
  });

  it('noto\'g\'ri tana 400: assigneeId yo\'q, UUID emas, ortiqcha maydon', async () => {
    const t = await h.api.createTeam();
    const task = await h.api.createTask(t.owner, t.project.id);
    expectError(await h.api.as(t.owner).put(`/tasks/${task.id}/assignee`).send({}), 400);
    expectError(await h.api.as(t.owner).put(`/tasks/${task.id}/assignee`).send({ assigneeId: 'abc' }), 400);
    expectError(await h.api.as(t.owner).put(`/tasks/${task.id}/assignee`).send({ assigneeId: t.member.id, status: 'DONE' }), 400);
  });

  it('tayinlash idempotent: xuddi shu foydalanuvchini qayta tayinlash 200', async () => {
    const t = await h.api.createTeam();
    const task = await h.api.createTask(t.owner, t.project.id, { assigneeId: t.member.id });
    await h.api.as(t.owner).put(`/tasks/${task.id}/assignee`).send({ assigneeId: t.member.id }).expect(200);
  });
});

describe('PATCH /tasks/:id/status (holat o\'tishlari)', () => {
  it('ruxsat etilgan zanjir: TODO -> IN_PROGRESS -> IN_REVIEW -> DONE', async () => {
    const t = await h.api.createTeam();
    const task = await h.api.createTask(t.owner, t.project.id);
    for (const status of ['IN_PROGRESS', 'IN_REVIEW', 'DONE']) {
      const res = await h.api.as(t.manager).patch(`/tasks/${task.id}/status`).send({ status });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe(status);
    }
    expect((await h.api.as(t.owner).get(`/tasks/${task.id}`)).body.status).toBe('DONE');
  });

  it('qayta ochish: DONE -> IN_PROGRESS va CANCELLED -> TODO', async () => {
    const t = await h.api.createTeam();
    const a = await h.api.createTask(t.owner, t.project.id);
    for (const s of ['IN_PROGRESS', 'IN_REVIEW', 'DONE', 'IN_PROGRESS']) await h.api.setTaskStatus(t.owner, a.id, s);
    const b = await h.api.createTask(t.owner, t.project.id);
    for (const s of ['CANCELLED', 'TODO']) await h.api.setTaskStatus(t.owner, b.id, s);
  });

  it.each([
    ['TODO', 'DONE'],
    ['TODO', 'IN_REVIEW'],
    ['TODO', 'TODO'],
    ['IN_PROGRESS', 'DONE'],
    ['IN_PROGRESS', 'IN_PROGRESS'],
  ])('ruxsat etilmagan o\'tish %s -> %s: 422 va holat o\'zgarmaydi', async (from, to) => {
    const t = await h.api.createTeam();
    const task = await h.api.createTask(t.owner, t.project.id);
    const path: Record<string, string[]> = { TODO: [], IN_PROGRESS: ['IN_PROGRESS'] };
    for (const s of path[from]) await h.api.setTaskStatus(t.owner, task.id, s);
    expectError(await h.api.as(t.owner).patch(`/tasks/${task.id}/status`).send({ status: to }), 422);
    expect((await h.api.as(t.owner).get(`/tasks/${task.id}`)).body.status).toBe(from);
  });

  it('DONE holatidan CANCELLED/TODO ga o\'tib bo\'lmaydi', async () => {
    const t = await h.api.createTeam();
    const task = await h.api.createTask(t.owner, t.project.id);
    for (const s of ['IN_PROGRESS', 'IN_REVIEW', 'DONE']) await h.api.setTaskStatus(t.owner, task.id, s);
    expectError(await h.api.as(t.owner).patch(`/tasks/${task.id}/status`).send({ status: 'CANCELLED' }), 422);
    expectError(await h.api.as(t.owner).patch(`/tasks/${task.id}/status`).send({ status: 'TODO' }), 422);
  });

  it('noma\'lum status yoki yo\'q status 400', async () => {
    const t = await h.api.createTeam();
    const task = await h.api.createTask(t.owner, t.project.id);
    expectError(await h.api.as(t.owner).patch(`/tasks/${task.id}/status`).send({ status: 'ARCHIVED' }), 400);
    expectError(await h.api.as(t.owner).patch(`/tasks/${task.id}/status`).send({ status: 'todo' }), 400);
    expectError(await h.api.as(t.owner).patch(`/tasks/${task.id}/status`).send({}), 400);
    expectError(await h.api.as(t.owner).patch(`/tasks/${task.id}/status`).send({ status: 'IN_PROGRESS', title: 'x' }), 400);
  });

  it('o\'ziga tayinlangan MEMBER holatni o\'zgartira oladi', async () => {
    const t = await h.api.createTeam();
    const task = await h.api.createTask(t.owner, t.project.id, { assigneeId: t.member.id });
    const res = await h.api.as(t.member).patch(`/tasks/${task.id}/status`).send({ status: 'IN_PROGRESS' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('IN_PROGRESS');
  });

  it('boshqaga tayinlangan yoki tayinlanmagan vazifada MEMBER holatni o\'zgartira olmaydi (403)', async () => {
    const t = await h.api.createTeam();
    const others = await h.api.createTask(t.owner, t.project.id, { assigneeId: t.member2.id });
    const unassigned = await h.api.createTask(t.owner, t.project.id);
    expectError(await h.api.as(t.member).patch(`/tasks/${others.id}/status`).send({ status: 'IN_PROGRESS' }), 403);
    expectError(await h.api.as(t.member).patch(`/tasks/${unassigned.id}/status`).send({ status: 'IN_PROGRESS' }), 403);
    expect((await h.api.as(t.owner).get(`/tasks/${others.id}`)).body.status).toBe('TODO');
  });

  it('o\'zi yaratgan, lekin tayinlanmagan vazifa holatini MEMBER o\'zgartira olmaydi (403)', async () => {
    const t = await h.api.createTeam();
    const own = await h.api.createTask(t.member, t.project.id);
    expectError(await h.api.as(t.member).patch(`/tasks/${own.id}/status`).send({ status: 'IN_PROGRESS' }), 403);
  });

  it('tayinlash bekor qilinsa MEMBER huquqini yo\'qotadi', async () => {
    const t = await h.api.createTeam();
    const task = await h.api.createTask(t.owner, t.project.id, { assigneeId: t.member.id });
    await h.api.assignTask(t.owner, task.id, null);
    expectError(await h.api.as(t.member).patch(`/tasks/${task.id}/status`).send({ status: 'IN_PROGRESS' }), 403);
  });

  it('a\'zo bo\'lmagan 404; mavjud bo\'lmagan vazifa 404', async () => {
    const t = await h.api.createTeam();
    const task = await h.api.createTask(t.owner, t.project.id);
    expectError(await h.api.as(t.outsider).patch(`/tasks/${task.id}/status`).send({ status: 'IN_PROGRESS' }), 404);
    expectError(await h.api.as(t.owner).patch(`/tasks/${FAKE_ID}/status`).send({ status: 'IN_PROGRESS' }), 404);
  });

  it('holat o\'zgargach updatedAt yangilanadi', async () => {
    const t = await h.api.createTeam();
    const task = await h.api.createTask(t.owner, t.project.id);
    const res = await h.api.as(t.owner).patch(`/tasks/${task.id}/status`).send({ status: 'IN_PROGRESS' });
    expect(Date.parse(res.body.updatedAt)).toBeGreaterThanOrEqual(Date.parse(task.updatedAt));
  });
});
