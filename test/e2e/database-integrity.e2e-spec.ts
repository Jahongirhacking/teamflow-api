import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { expectError } from '../support/assertions';
import { useTestApp } from '../support/app';
import { columnFacts, countRows, dumpAllTables, schemaFacts } from '../support/db';
import { ROOT_DIR } from '../support/env';
import { fixtures } from '../support/files';

const h = useTestApp();

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : [full];
  });
}

describe('migratsiyalar va sxema (sxema nomlariga bog\'liq bo\'lmagan tekshiruvlar)', () => {
  it('sxema migratsiyalar orqali yaratilgan: migratsiya jadvalida yozuvlar bor', async () => {
    const facts = await schemaFacts();
    expect(facts.migrationTables.length).toBeGreaterThanOrEqual(1);
    expect(await countRows(facts.migrationTables[0])).toBeGreaterThanOrEqual(1);
  });

  it('src/database/migrations ichida kamida bitta migratsiya fayli bor', () => {
    const files = walk(path.join(ROOT_DIR, 'src/database/migrations')).filter((f) => /\.(ts|js)$/.test(f));
    expect(files.length).toBeGreaterThanOrEqual(1);
  });

  it('kodda `synchronize: true` ishlatilmagan', () => {
    const offenders = walk(path.join(ROOT_DIR, 'src'))
      .filter((f) => /\.(ts|js)$/.test(f))
      .filter((f) => /synchronize\s*:\s*true/.test(fs.readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('kamida 5 ta ilova jadvali (foydalanuvchi, loyiha, a\'zolik, vazifa, biriktirma) mavjud', async () => {
    expect((await schemaFacts()).tables.length).toBeGreaterThanOrEqual(5);
  });

  it('referential integrity: kamida 8 ta foreign key bor va kamida bittasi ON DELETE CASCADE', async () => {
    const { foreignKeys } = await schemaFacts();
    expect(foreignKeys.length).toBeGreaterThanOrEqual(8);
    expect(foreignKeys.some((fk) => fk.delete_rule === 'CASCADE')).toBe(true);
  });

  it('email ustida UNIQUE indeks bor; a\'zolik jadvalida ham UNIQUE cheklov bor', async () => {
    const { uniqueIndexes } = await schemaFacts();
    expect(uniqueIndexes.some((u) => /email/i.test(u.def))).toBe(true);
    expect(uniqueIndexes.some((u) => /member/i.test(u.table_name))).toBe(true);
  });

  it('barcha bitta ustunli primary key\'lar UUID turida', async () => {
    const { primaryKeys } = await columnFacts();
    const byTable = new Map<string, { data_type: string }[]>();
    for (const pk of primaryKeys) byTable.set(pk.table_name, [...(byTable.get(pk.table_name) ?? []), pk]);
    expect(byTable.size).toBeGreaterThanOrEqual(5);
    for (const [table, cols] of byTable) {
      if (cols.length === 1) expect(cols[0].data_type, `${table} PK`).toBe('uuid');
    }
  });

  it('createdAt/updatedAt ustunlari vaqt zonasi bilan (timestamptz)', async () => {
    const { columns } = await columnFacts();
    const stamps = columns.filter((c) => /^(created_?at|updated_?at)$/i.test(c.column_name));
    expect(stamps.length).toBeGreaterThanOrEqual(6);
    for (const c of stamps) expect(c.data_type, `${c.table_name}.${c.column_name}`).toBe('timestamp with time zone');
  });
});

describe('ma\'lumotlar izchilligi (HTTP orqali)', () => {
  it('loyiha o\'chirilganda foydalanuvchi jadvalidan boshqa hamma jadvallar bo\'shaydi (yetim yozuv yo\'q)', async () => {
    const t = await h.api.createTeam();
    const task = await h.api.createTask(t.owner, t.project.id, { assigneeId: t.member.id });
    await h.api.uploadToProject(t.owner, t.project.id, { buffer: fixtures.png(), filename: 'a.png', contentType: 'image/png' });
    await h.api.uploadToTask(t.member, task.id, { buffer: fixtures.pdf(), filename: 'b.pdf', contentType: 'application/pdf' });

    await h.api.as(t.owner).delete(`/projects/${t.project.id}`).expect(204);

    const dump = await dumpAllTables();
    const userTables = Object.entries(dump)
      .filter(([, rows]) => rows.length > 0 && rows.every((r) => Object.keys(r).some((k) => /email/i.test(k))))
      .map(([name]) => name);
    expect(userTables.length).toBe(1);
    for (const [name, rows] of Object.entries(dump)) {
      if (userTables.includes(name)) continue;
      expect(rows.length, `"${name}" jadvalida yetim yozuvlar qoldi`).toBe(0);
    }
    expect(h.countStoredFiles()).toBe(0);
  });

  it('rad etilgan amallar (422/403/400) hech qanday yarim-yozuv qoldirmaydi', async () => {
    const t = await h.api.createTeam();
    const before = JSON.stringify(Object.fromEntries(Object.entries(await dumpAllTables()).map(([k, v]) => [k, v.length])));

    expectError(await h.api.as(t.owner).post(`/projects/${t.project.id}/tasks`).send({ title: 'x', assigneeId: t.outsider.id }), 422);
    expectError(await h.api.as(t.member).post(`/projects/${t.project.id}/tasks`).send({ title: 'x', assigneeId: t.member.id }), 403);
    expectError(await h.api.as(t.owner).post(`/projects/${t.project.id}/tasks`).send({ title: '' }), 400);
    expectError(await h.api.as(t.manager).post(`/projects/${t.project.id}/members`).send({ email: t.outsider.email, role: 'ADMIN' }), 403);

    const after = JSON.stringify(Object.fromEntries(Object.entries(await dumpAllTables()).map(([k, v]) => [k, v.length])));
    expect(after).toBe(before);
  });

  it('bir vaqtda ko\'p loyiha yaratish: har bir loyihada aynan bitta ADMIN a\'zo (atomiklik)', async () => {
    const user = await h.api.createUser();
    const created = await Promise.all(Array.from({ length: 6 }, (_, i) => h.api.as(user).post('/projects').send({ name: `Race ${i}` })));
    expect(created.map((r) => r.status)).toEqual([201, 201, 201, 201, 201, 201]);
    for (const res of created) {
      const members = await h.api.as(user).get(`/projects/${res.body.id}/members`);
      expect(members.body.data).toHaveLength(1);
      expect(members.body.data[0].role).toBe('ADMIN');
    }
  });

  it('foydalanuvchi o\'z loyihalaridan chiqib ketganda ham foydalanuvchi yozuvi o\'chmaydi', async () => {
    const t = await h.api.createTeam();
    await h.api.as(t.owner).delete(`/projects/${t.project.id}/members/${t.member.id}`).expect(204);
    await h.api.as(t.member).get('/auth/me').expect(200);
  });

  it('bir vaqtda bir xil vazifani turli foydalanuvchilarga tayinlash: oxirgisi g\'olib, natija izchil', async () => {
    const t = await h.api.createTeam();
    const task = await h.api.createTask(t.owner, t.project.id);
    const results = await Promise.all([
      h.api.as(t.owner).put(`/tasks/${task.id}/assignee`).send({ assigneeId: t.member.id }),
      h.api.as(t.owner).put(`/tasks/${task.id}/assignee`).send({ assigneeId: t.member2.id }),
    ]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    const final = (await h.api.as(t.owner).get(`/tasks/${task.id}`)).body;
    expect([t.member.id, t.member2.id]).toContain(final.assignee.id);
  });

  it('bir vaqtda bir xil vazifa holatini o\'zgartirish: bittasi 200, ikkinchisi 422 (yoki ikkalasi izchil)', async () => {
    const t = await h.api.createTeam();
    const task = await h.api.createTask(t.owner, t.project.id);
    const results = await Promise.all([
      h.api.as(t.owner).patch(`/tasks/${task.id}/status`).send({ status: 'IN_PROGRESS' }),
      h.api.as(t.owner).patch(`/tasks/${task.id}/status`).send({ status: 'CANCELLED' }),
    ]);
    for (const r of results) expect([200, 422]).toContain(r.status);
    expect(results.some((r) => r.status === 200)).toBe(true);
    const final = (await h.api.as(t.owner).get(`/tasks/${task.id}`)).body.status;
    expect(['IN_PROGRESS', 'CANCELLED']).toContain(final);
  });
});
