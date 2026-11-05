import { describe, expect, it } from 'vitest';
import { ISO_DATE_RE, UUID_RE } from '../support/api';
import { expectError, expectPage } from '../support/assertions';
import { useTestApp } from '../support/app';

const h = useTestApp();
const FAKE_ID = '3f9d3c64-6f34-4f0f-8c0b-0a8e9f1d2b3c';
const base = (p: { id: string }) => `/projects/${p.id}/members`;

describe('GET /projects/:projectId/members', () => {
  it('har qanday a\'zo a\'zolar ro\'yxatini ko\'radi', async () => {
    const t = await h.api.createTeam();
    for (const user of [t.owner, t.manager, t.member]) {
      const res = await h.api.as(user).get(base(t.project));
      expectPage(res, { page: 1, limit: 10, total: 4 });
      for (const m of res.body.data) {
        expect(m.userId).toMatch(UUID_RE);
        expect(['ADMIN', 'MANAGER', 'MEMBER']).toContain(m.role);
        expect(typeof m.email).toBe('string');
        expect(typeof m.fullName).toBe('string');
        expect(m.joinedAt).toMatch(ISO_DATE_RE);
        expect(Object.keys(m).sort()).toEqual(['email', 'fullName', 'joinedAt', 'role', 'userId']);
      }
    }
  });

  it('egasi birinchi, qolganlari qo\'shilish tartibida', async () => {
    const t = await h.api.createTeam();
    const res = await h.api.as(t.owner).get(base(t.project));
    expect(res.body.data.map((m: any) => m.userId)).toEqual([t.owner.id, t.manager.id, t.member.id, t.member2.id]);
  });

  it('sahifalash ishlaydi', async () => {
    const t = await h.api.createTeam();
    const res = await h.api.as(t.owner).get(`${base(t.project)}?page=2&limit=3`);
    expectPage(res, { page: 2, limit: 3, total: 4 });
    expect(res.body.data).toHaveLength(1);
  });

  it('a\'zo bo\'lmagan foydalanuvchi uchun 404; tokensiz 401; global ADMIN uchun 200', async () => {
    const t = await h.api.createTeam();
    expectError(await h.api.as(t.outsider).get(base(t.project)), 404);
    expectError(await h.api.anon.get(base(t.project)), 401);
    await h.api.as(t.globalAdmin).get(base(t.project)).expect(200);
  });

  it('loyiha roli loyihaga xos: bir foydalanuvchi turli loyihalarda turli rolda', async () => {
    const t = await h.api.createTeam();
    const other = await h.api.createProject(t.outsider, { name: 'Other' });
    await h.api.addMember(t.outsider, other.id, t.member, 'MANAGER');

    const inOther = await h.api.as(t.outsider).get(base(other));
    const memberRoleInOther = inOther.body.data.find((m: any) => m.userId === t.member.id).role;
    const inMain = await h.api.as(t.owner).get(base(t.project));
    const memberRoleInMain = inMain.body.data.find((m: any) => m.userId === t.member.id).role;
    expect(memberRoleInOther).toBe('MANAGER');
    expect(memberRoleInMain).toBe('MEMBER');
  });
});

describe('POST /projects/:projectId/members', () => {
  it('ADMIN istalgan rolda a\'zo qo\'shadi (201)', async () => {
    const t = await h.api.createTeam();
    for (const role of ['MEMBER', 'MANAGER', 'ADMIN'] as const) {
      const u = await h.api.createUser();
      const res = await h.api.as(t.owner).post(base(t.project)).send({ email: u.email, role });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ userId: u.id, role, email: u.email });
      expect(res.body.joinedAt).toMatch(ISO_DATE_RE);
    }
  });

  it('MANAGER faqat MEMBER qo\'sha oladi; MANAGER/ADMIN qo\'shishga urinsa 403', async () => {
    const t = await h.api.createTeam();
    const u1 = await h.api.createUser();
    const u2 = await h.api.createUser();
    const u3 = await h.api.createUser();
    await h.api.as(t.manager).post(base(t.project)).send({ email: u1.email, role: 'MEMBER' }).expect(201);
    expectError(await h.api.as(t.manager).post(base(t.project)).send({ email: u2.email, role: 'MANAGER' }), 403);
    expectError(await h.api.as(t.manager).post(base(t.project)).send({ email: u3.email, role: 'ADMIN' }), 403);
    const list = await h.api.as(t.owner).get(base(t.project));
    expect(list.body.data.map((m: any) => m.userId)).not.toContain(u2.id);
    expect(list.body.data.map((m: any) => m.userId)).not.toContain(u3.id);
  });

  it('MEMBER a\'zo qo\'sha olmaydi (403), a\'zo bo\'lmagan 404', async () => {
    const t = await h.api.createTeam();
    const u = await h.api.createUser();
    expectError(await h.api.as(t.member).post(base(t.project)).send({ email: u.email, role: 'MEMBER' }), 403);
    expectError(await h.api.as(t.outsider).post(base(t.project)).send({ email: u.email, role: 'MEMBER' }), 404);
  });

  it('global ADMIN a\'zo bo\'lmasa ham a\'zo qo\'sha oladi', async () => {
    const t = await h.api.createTeam();
    const res = await h.api.as(t.globalAdmin).post(base(t.project)).send({ email: t.outsider.email, role: 'MANAGER' });
    expect(res.status).toBe(201);
  });

  it('qo\'shilgan a\'zo loyihaga kira oladi', async () => {
    const t = await h.api.createTeam();
    expectError(await h.api.as(t.outsider).get(`/projects/${t.project.id}`), 404);
    await h.api.addMember(t.owner, t.project.id, t.outsider, 'MEMBER');
    await h.api.as(t.outsider).get(`/projects/${t.project.id}`).expect(200);
    expect((await h.api.as(t.outsider).get('/projects')).body.data.map((p: any) => p.id)).toContain(t.project.id);
  });

  it('email registrga sezgir emas', async () => {
    const t = await h.api.createTeam();
    const res = await h.api.as(t.owner).post(base(t.project)).send({ email: t.outsider.email.toUpperCase(), role: 'MEMBER' });
    expect(res.status).toBe(201);
    expect(res.body.userId).toBe(t.outsider.id);
  });

  it('allaqachon a\'zo bo\'lgan foydalanuvchini qo\'shish 409', async () => {
    const t = await h.api.createTeam();
    expectError(await h.api.as(t.owner).post(base(t.project)).send({ email: t.member.email, role: 'MANAGER' }), 409);
    const list = await h.api.as(t.owner).get(base(t.project));
    expect(list.body.data.filter((m: any) => m.userId === t.member.id)).toHaveLength(1);
    expect(list.body.data.find((m: any) => m.userId === t.member.id).role).toBe('MEMBER');
  });

  it('bir vaqtda bir xil foydalanuvchini qo\'shish: bittasi 201, qolgani 409 (unique constraint)', async () => {
    const t = await h.api.createTeam();
    const results = await Promise.all(
      Array.from({ length: 5 }, () => h.api.as(t.owner).post(base(t.project)).send({ email: t.outsider.email, role: 'MEMBER' })),
    );
    const codes = results.map((r) => r.status).sort();
    expect(codes).toEqual([201, 409, 409, 409, 409]);
  });

  it('mavjud bo\'lmagan email 404; faolsiz foydalanuvchi 404 emas - 409 emas, 422', async () => {
    const t = await h.api.createTeam();
    expectError(await h.api.as(t.owner).post(base(t.project)).send({ email: 'nobody@example.test', role: 'MEMBER' }), 404);
    await h.api.as(t.globalAdmin).patch(`/users/${t.outsider.id}/status`).send({ isActive: false }).expect(200);
    expectError(await h.api.as(t.owner).post(base(t.project)).send({ email: t.outsider.email, role: 'MEMBER' }), 422);
  });

  it.each([
    ['email yo\'q', { role: 'MEMBER' }],
    ['email noto\'g\'ri', { email: 'nope', role: 'MEMBER' }],
    ['role yo\'q', { email: 'a@example.test' }],
    ['role noma\'lum', { email: 'a@example.test', role: 'OWNER' }],
    ['role kichik harfda', { email: 'a@example.test', role: 'member' }],
    ['ortiqcha maydon', { email: 'a@example.test', role: 'MEMBER', userId: FAKE_ID }],
  ])('validatsiya: %s -> 400', async (_n, body) => {
    const t = await h.api.createTeam();
    expectError(await h.api.as(t.owner).post(base(t.project)).send(body), 400);
  });
});

describe('PATCH /projects/:projectId/members/:userId (rolni o\'zgartirish)', () => {
  it('ADMIN rolni o\'zgartiradi va yangi ruxsatlar darhol kuchga kiradi', async () => {
    const t = await h.api.createTeam();
    expectError(await h.api.as(t.member).patch(`/projects/${t.project.id}`).send({ name: 'x' }), 403);

    const res = await h.api.as(t.owner).patch(`${base(t.project)}/${t.member.id}`).send({ role: 'MANAGER' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ userId: t.member.id, role: 'MANAGER' });

    await h.api.as(t.member).patch(`/projects/${t.project.id}`).send({ name: 'Now allowed' }).expect(200);
  });

  it('pasaytirilgan rol ruxsatlarni darhol kamaytiradi', async () => {
    const t = await h.api.createTeam();
    await h.api.as(t.manager).patch(`/projects/${t.project.id}`).send({ name: 'ok' }).expect(200);
    await h.api.as(t.owner).patch(`${base(t.project)}/${t.manager.id}`).send({ role: 'MEMBER' }).expect(200);
    expectError(await h.api.as(t.manager).patch(`/projects/${t.project.id}`).send({ name: 'no' }), 403);
  });

  it('MANAGER va MEMBER rolni o\'zgartira olmaydi (403)', async () => {
    const t = await h.api.createTeam();
    expectError(await h.api.as(t.manager).patch(`${base(t.project)}/${t.member.id}`).send({ role: 'MANAGER' }), 403);
    expectError(await h.api.as(t.member).patch(`${base(t.project)}/${t.member.id}`).send({ role: 'ADMIN' }), 403);
    expectError(await h.api.as(t.member).patch(`${base(t.project)}/${t.member2.id}`).send({ role: 'MANAGER' }), 403);
    const list = await h.api.as(t.owner).get(base(t.project));
    expect(list.body.data.find((m: any) => m.userId === t.member.id).role).toBe('MEMBER');
  });

  it('loyiha egasining rolini pasaytirib bo\'lmaydi (409)', async () => {
    const t = await h.api.createTeam();
    await h.api.addMember(t.owner, t.project.id, t.outsider, 'ADMIN');
    expectError(await h.api.as(t.outsider).patch(`${base(t.project)}/${t.owner.id}`).send({ role: 'MEMBER' }), 409);
    expectError(await h.api.as(t.owner).patch(`${base(t.project)}/${t.owner.id}`).send({ role: 'MANAGER' }), 409);
  });

  it('a\'zo bo\'lmagan foydalanuvchi uchun 404; noto\'g\'ri rol 400', async () => {
    const t = await h.api.createTeam();
    expectError(await h.api.as(t.owner).patch(`${base(t.project)}/${t.outsider.id}`).send({ role: 'MEMBER' }), 404);
    expectError(await h.api.as(t.owner).patch(`${base(t.project)}/${t.member.id}`).send({ role: 'GOD' }), 400);
    expectError(await h.api.as(t.owner).patch(`${base(t.project)}/not-a-uuid`).send({ role: 'MEMBER' }), 400);
  });
});

describe('DELETE /projects/:projectId/members/:userId', () => {
  it('ADMIN istalgan a\'zoni (egasidan tashqari) chiqaradi (204) va u kirish huquqini yo\'qotadi', async () => {
    const t = await h.api.createTeam();
    await h.api.as(t.owner).delete(`${base(t.project)}/${t.manager.id}`).expect(204);
    expectError(await h.api.as(t.manager).get(`/projects/${t.project.id}`), 404);
    const list = await h.api.as(t.owner).get(base(t.project));
    expect(list.body.meta.total).toBe(3);
  });

  it('MANAGER faqat MEMBER\'ni chiqara oladi', async () => {
    const t = await h.api.createTeam();
    await h.api.as(t.manager).delete(`${base(t.project)}/${t.member.id}`).expect(204);
    expectError(await h.api.as(t.manager).delete(`${base(t.project)}/${t.owner.id}`), 403);
    const other = await h.api.createUser();
    await h.api.addMember(t.owner, t.project.id, other, 'MANAGER');
    expectError(await h.api.as(t.manager).delete(`${base(t.project)}/${other.id}`), 403);
  });

  it('MEMBER boshqani chiqara olmaydi (403), lekin o\'zi chiqib keta oladi', async () => {
    const t = await h.api.createTeam();
    expectError(await h.api.as(t.member).delete(`${base(t.project)}/${t.member2.id}`), 403);
    await h.api.as(t.member).delete(`${base(t.project)}/${t.member.id}`).expect(204);
    expectError(await h.api.as(t.member).get(`/projects/${t.project.id}`), 404);
  });

  it('loyiha egasini chiqarib bo\'lmaydi (409), hatto o\'zi ham', async () => {
    const t = await h.api.createTeam();
    expectError(await h.api.as(t.owner).delete(`${base(t.project)}/${t.owner.id}`), 409);
    await h.api.addMember(t.owner, t.project.id, t.outsider, 'ADMIN');
    expectError(await h.api.as(t.outsider).delete(`${base(t.project)}/${t.owner.id}`), 409);
    await h.api.as(t.owner).get(`/projects/${t.project.id}`).expect(200);
  });

  it('chiqarilgan a\'zoning vazifalari tayinlanmagan (assignee=null) holatga o\'tadi, vazifalar o\'chmaydi', async () => {
    const t = await h.api.createTeam();
    const task = await h.api.createTask(t.owner, t.project.id, { assigneeId: t.member.id });
    expect(task.assignee.id).toBe(t.member.id);

    await h.api.as(t.owner).delete(`${base(t.project)}/${t.member.id}`).expect(204);

    const res = await h.api.as(t.owner).get(`/tasks/${task.id}`);
    expect(res.status).toBe(200);
    expect(res.body.assignee).toBeNull();
  });

  it('a\'zo bo\'lmagan foydalanuvchini chiqarish 404; a\'zo bo\'lmagan chaqiruvchi 404', async () => {
    const t = await h.api.createTeam();
    expectError(await h.api.as(t.owner).delete(`${base(t.project)}/${t.outsider.id}`), 404);
    expectError(await h.api.as(t.outsider).delete(`${base(t.project)}/${t.member.id}`), 404);
  });

  it('chiqarilgan a\'zoni qayta qo\'shish mumkin', async () => {
    const t = await h.api.createTeam();
    await h.api.as(t.owner).delete(`${base(t.project)}/${t.member.id}`).expect(204);
    await h.api.addMember(t.owner, t.project.id, t.member, 'MANAGER');
  });
});
