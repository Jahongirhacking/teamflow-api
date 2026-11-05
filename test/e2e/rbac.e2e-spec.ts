import { describe, expect, it } from 'vitest';
import type { AuthedRequester, TestUser } from '../support/api';
import { expectError } from '../support/assertions';
import { useTestApp } from '../support/app';
import { fixtures } from '../support/files';

const h = useTestApp();

type Team = Awaited<ReturnType<typeof h.api.createTeam>>;
type Role = 'projectAdmin' | 'manager' | 'member' | 'nonMember' | 'globalAdmin' | 'anonymous';
const ROLES: Role[] = ['projectAdmin', 'manager', 'member', 'nonMember', 'globalAdmin', 'anonymous'];

interface Ctx {
  t: Team;
  /** owner yaratgan vazifa (tayinlanmagan) */
  taskId: string;
  /** owner yuklagan loyiha biriktirmasi */
  attachmentId: string;
  /** yangi foydalanuvchi (a'zo qo'shish ssenariylari uchun) */
  newcomer: TestUser;
}

interface Op {
  name: string;
  call: (r: AuthedRequester, c: Ctx) => import('supertest').Test;
  /** Rol -> kutilgan status: [projectAdmin, manager, member, nonMember, globalAdmin, anonymous] */
  expected: [number, number, number, number, number, number];
}

const OPS: Op[] = [
  { name: 'loyihani o\'qish', call: (r, c) => r.get(`/projects/${c.t.project.id}`), expected: [200, 200, 200, 404, 200, 401] },
  { name: 'loyihani yangilash', call: (r, c) => r.patch(`/projects/${c.t.project.id}`).send({ name: 'RBAC' }), expected: [200, 200, 403, 404, 200, 401] },
  { name: 'loyihani arxivlash', call: (r, c) => r.post(`/projects/${c.t.project.id}/archive`), expected: [200, 403, 403, 404, 200, 401] },
  { name: 'loyihani o\'chirish', call: (r, c) => r.delete(`/projects/${c.t.project.id}`), expected: [204, 403, 403, 404, 204, 401] },
  { name: 'a\'zolar ro\'yxati', call: (r, c) => r.get(`/projects/${c.t.project.id}/members`), expected: [200, 200, 200, 404, 200, 401] },
  {
    name: 'MEMBER rolida a\'zo qo\'shish',
    call: (r, c) => r.post(`/projects/${c.t.project.id}/members`).send({ email: c.newcomer.email, role: 'MEMBER' }),
    expected: [201, 201, 403, 404, 201, 401],
  },
  {
    name: 'MANAGER rolida a\'zo qo\'shish',
    call: (r, c) => r.post(`/projects/${c.t.project.id}/members`).send({ email: c.newcomer.email, role: 'MANAGER' }),
    expected: [201, 403, 403, 404, 201, 401],
  },
  {
    name: 'a\'zo rolini o\'zgartirish',
    call: (r, c) => r.patch(`/projects/${c.t.project.id}/members/${c.t.member2.id}`).send({ role: 'MANAGER' }),
    expected: [200, 403, 403, 404, 200, 401],
  },
  {
    name: 'MEMBER\'ni loyihadan chiqarish',
    call: (r, c) => r.delete(`/projects/${c.t.project.id}/members/${c.t.member2.id}`),
    expected: [204, 204, 403, 404, 204, 401],
  },
  { name: 'vazifalar ro\'yxati', call: (r, c) => r.get(`/projects/${c.t.project.id}/tasks`), expected: [200, 200, 200, 404, 200, 401] },
  { name: 'vazifani o\'qish', call: (r, c) => r.get(`/tasks/${c.taskId}`), expected: [200, 200, 200, 404, 200, 401] },
  { name: 'vazifa yaratish', call: (r, c) => r.post(`/projects/${c.t.project.id}/tasks`).send({ title: 'RBAC task' }), expected: [201, 201, 201, 404, 201, 401] },
  {
    name: 'o\'zi yaratmagan/unga tayinlanmagan vazifani tahrirlash',
    call: (r, c) => r.patch(`/tasks/${c.taskId}`).send({ title: 'Edited' }),
    expected: [200, 200, 403, 404, 200, 401],
  },
  {
    name: 'o\'ziga tayinlanmagan vazifa holatini o\'zgartirish',
    call: (r, c) => r.patch(`/tasks/${c.taskId}/status`).send({ status: 'IN_PROGRESS' }),
    expected: [200, 200, 403, 404, 200, 401],
  },
  {
    name: 'vazifani tayinlash',
    call: (r, c) => r.put(`/tasks/${c.taskId}/assignee`).send({ assigneeId: c.t.member.id }),
    expected: [200, 200, 403, 404, 200, 401],
  },
  { name: 'vazifani o\'chirish', call: (r, c) => r.delete(`/tasks/${c.taskId}`), expected: [204, 204, 403, 404, 204, 401] },
  {
    name: 'loyihaga fayl yuklash',
    call: (r, c) => r.post(`/projects/${c.t.project.id}/attachments`).attach('file', fixtures.png(), { filename: 'x.png', contentType: 'image/png' }),
    expected: [201, 201, 201, 404, 201, 401],
  },
  {
    name: 'vazifaga fayl yuklash',
    call: (r, c) => r.post(`/tasks/${c.taskId}/attachments`).attach('file', fixtures.png(), { filename: 'x.png', contentType: 'image/png' }),
    expected: [201, 201, 201, 404, 201, 401],
  },
  { name: 'loyiha biriktirmalari ro\'yxati', call: (r, c) => r.get(`/projects/${c.t.project.id}/attachments`), expected: [200, 200, 200, 404, 200, 401] },
  { name: 'biriktirma metadatasi', call: (r, c) => r.get(`/attachments/${c.attachmentId}`), expected: [200, 200, 200, 404, 200, 401] },
  { name: 'biriktirmani yuklab olish', call: (r, c) => r.get(`/attachments/${c.attachmentId}/download`), expected: [200, 200, 200, 404, 200, 401] },
  {
    name: 'boshqa birov yuklagan biriktirmani o\'chirish',
    call: (r, c) => r.delete(`/attachments/${c.attachmentId}`),
    expected: [204, 204, 403, 404, 204, 401],
  },
];

async function buildCtx(): Promise<Ctx> {
  const t = await h.api.createTeam();
  const task = await h.api.createTask(t.owner, t.project.id);
  const attachment = await h.api.uploadToProject(t.owner, t.project.id, {
    buffer: fixtures.png(),
    filename: 'seed.png',
    contentType: 'image/png',
  });
  const newcomer = await h.api.createUser();
  return { t, taskId: task.id, attachmentId: attachment.id, newcomer };
}

function requesterFor(role: Role, c: Ctx): AuthedRequester {
  const map: Record<Exclude<Role, 'anonymous'>, TestUser> = {
    projectAdmin: c.t.owner,
    manager: c.t.manager,
    member: c.t.member,
    nonMember: c.t.outsider,
    globalAdmin: c.t.globalAdmin,
  };
  return role === 'anonymous' ? h.api.anon : h.api.as(map[role]);
}

describe('RBAC matritsasi: har bir amal x har bir rol', () => {
  for (const op of OPS) {
    describe(op.name, () => {
      it.each(ROLES.map((role, i) => [role, op.expected[i]] as const))('%s -> %i', async (role, status) => {
        const c = await buildCtx();
        const res = await op.call(requesterFor(role, c), c);
        if (status >= 400) expectError(res, status);
        else expect(res.status).toBe(status);
      });
    });
  }
});

describe('global va loyiha darajalari aralashmasligi', () => {
  it('loyiha ADMIN\'i global ADMIN emas: /users ro\'yxati va status o\'zgartirish taqiqlanadi', async () => {
    const t = await h.api.createTeam();
    expectError(await h.api.as(t.owner).get('/users'), 403);
    expectError(await h.api.as(t.owner).patch(`/users/${t.member.id}/status`).send({ isActive: false }), 403);
  });

  it('A loyihadagi MANAGER roli B loyihada hech narsa bermaydi', async () => {
    const t = await h.api.createTeam();
    const projectB = await h.api.createProject(t.outsider, { name: 'B' });
    const taskB = await h.api.createTask(t.outsider, projectB.id);
    expectError(await h.api.as(t.manager).get(`/projects/${projectB.id}`), 404);
    expectError(await h.api.as(t.manager).patch(`/projects/${projectB.id}`).send({ name: 'x' }), 404);
    expectError(await h.api.as(t.manager).get(`/tasks/${taskB.id}`), 404);
    expectError(await h.api.as(t.manager).delete(`/tasks/${taskB.id}`), 404);
    expectError(await h.api.as(t.manager).post(`/projects/${projectB.id}/tasks`).send({ title: 'x' }), 404);
  });

  it('A loyihada MEMBER, B loyihada MANAGER bo\'lgan foydalanuvchi: ruxsatlar loyihaga qarab farqlanadi', async () => {
    const t = await h.api.createTeam();
    const projectB = await h.api.createProject(t.outsider, { name: 'B' });
    await h.api.addMember(t.outsider, projectB.id, t.member, 'MANAGER');
    await h.api.as(t.member).patch(`/projects/${projectB.id}`).send({ name: 'B2' }).expect(200);
    expectError(await h.api.as(t.member).patch(`/projects/${t.project.id}`).send({ name: 'A2' }), 403);
  });

  it('boshqa loyiha vazifasi/biriktirmasi id orqali ham ochilmaydi (IDOR)', async () => {
    const t = await h.api.createTeam();
    const projectB = await h.api.createProject(t.outsider, { name: 'B' });
    const taskB = await h.api.createTask(t.outsider, projectB.id);
    const attB = await h.api.uploadToTask(t.outsider, taskB.id, { buffer: fixtures.png(), filename: 'b.png', contentType: 'image/png' });
    for (const user of [t.owner, t.manager, t.member]) {
      expectError(await h.api.as(user).get(`/tasks/${taskB.id}`), 404);
      expectError(await h.api.as(user).get(`/attachments/${attB.id}`), 404);
      expectError(await h.api.as(user).get(`/attachments/${attB.id}/download`), 404);
      expectError(await h.api.as(user).delete(`/attachments/${attB.id}`), 404);
      expectError(await h.api.as(user).put(`/tasks/${taskB.id}/assignee`).send({ assigneeId: user.id }), 404);
    }
  });

  it('global ADMIN a\'zolar ro\'yxatida paydo bo\'lmaydi (u a\'zo emas, faqat imtiyozli)', async () => {
    const t = await h.api.createTeam();
    await h.api.as(t.globalAdmin).get(`/projects/${t.project.id}/tasks`).expect(200);
    const list = await h.api.as(t.owner).get(`/projects/${t.project.id}/members`);
    expect(list.body.data.map((m: any) => m.userId)).not.toContain(t.globalAdmin.id);
  });
});
