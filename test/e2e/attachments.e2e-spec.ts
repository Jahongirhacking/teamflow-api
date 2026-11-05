import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ISO_DATE_RE, UUID_RE } from '../support/api';
import { expectError, expectPage } from '../support/assertions';
import { useTestApp } from '../support/app';
import { DEFAULT_MAX_UPLOAD, fixtures } from '../support/files';

const h = useTestApp();
const FAKE_ID = '3f9d3c64-6f34-4f0f-8c0b-0a8e9f1d2b3c';
const png = (filename = 'photo.png') => ({ buffer: fixtures.png(), filename, contentType: 'image/png' });

function expectAttachmentShape(a: any) {
  expect(a.id).toMatch(UUID_RE);
  expect(typeof a.originalName).toBe('string');
  expect(typeof a.mimeType).toBe('string');
  expect(Number.isInteger(a.size)).toBe(true);
  expect(a.projectId).toMatch(UUID_RE);
  expect(a.taskId === null || UUID_RE.test(a.taskId)).toBe(true);
  expect(a.uploadedBy.id).toMatch(UUID_RE);
  expect(typeof a.uploadedBy.fullName).toBe('string');
  expect(a.createdAt).toMatch(ISO_DATE_RE);
  // Fayl tizimi tafsilotlari sizib chiqmasligi kerak
  expect(Object.keys(a).sort()).toEqual(['createdAt', 'id', 'mimeType', 'originalName', 'projectId', 'size', 'taskId', 'uploadedBy']);
  const raw = JSON.stringify(a);
  expect(raw).not.toContain(os.tmpdir());
  expect(raw).not.toContain('teamflow-e2e');
}

describe('yuklash: POST /projects/:projectId/attachments va /tasks/:taskId/attachments', () => {
  it('loyihaga PNG yuklaydi (201) va metadata qaytaradi', async () => {
    const t = await h.api.createTeam();
    const res = await h.api.uploadTo(t.member, `/projects/${t.project.id}/attachments`, png('logo.png'));
    expect(res.status).toBe(201);
    expectAttachmentShape(res.body);
    expect(res.body).toMatchObject({
      originalName: 'logo.png',
      mimeType: 'image/png',
      size: fixtures.png().length,
      projectId: t.project.id,
      taskId: null,
    });
    expect(res.body.uploadedBy.id).toBe(t.member.id);
    expect(h.countStoredFiles()).toBe(1);
  });

  it('vazifaga yuklaydi: taskId va projectId to\'ldiriladi', async () => {
    const t = await h.api.createTeam();
    const task = await h.api.createTask(t.owner, t.project.id);
    const res = await h.api.uploadTo(t.member, `/tasks/${task.id}/attachments`, png());
    expect(res.status).toBe(201);
    expectAttachmentShape(res.body);
    expect(res.body.taskId).toBe(task.id);
    expect(res.body.projectId).toBe(t.project.id);
  });

  it.each([
    ['rasm.png', 'image/png', () => fixtures.png()],
    ['rasm.jpg', 'image/jpeg', () => fixtures.jpeg()],
    ['rasm.jpeg', 'image/jpeg', () => fixtures.jpeg()],
    ['hujjat.pdf', 'application/pdf', () => fixtures.pdf()],
    ['eslatma.txt', 'text/plain', () => fixtures.text()],
  ])('ruxsat etilgan tur: %s', async (filename, contentType, buf) => {
    const t = await h.api.createTeam();
    const res = await h.api.uploadTo(t.owner, `/projects/${t.project.id}/attachments`, { buffer: buf(), filename, contentType });
    expect(res.status).toBe(201);
    expect(res.body.mimeType).toBe(contentType);
    expect(res.body.size).toBe(buf().length);
  });

  it('aynan limit (5 MiB) hajmidagi fayl qabul qilinadi', async () => {
    const t = await h.api.createTeam();
    const res = await h.api.uploadTo(t.owner, `/projects/${t.project.id}/attachments`, {
      buffer: fixtures.pngOfSize(DEFAULT_MAX_UPLOAD),
      filename: 'edge.png',
      contentType: 'image/png',
    });
    expect(res.status).toBe(201);
    expect(res.body.size).toBe(DEFAULT_MAX_UPLOAD);
  });

  it('diskda fayl tasodifiy/noyob nom bilan saqlanadi, asl nom bilan emas', async () => {
    const t = await h.api.createTeam();
    await h.api.uploadToProject(t.owner, t.project.id, png('maxfiy-hisobot.png'));
    const [stored] = h.listStoredFiles();
    expect(path.basename(stored)).not.toContain('maxfiy');
    expect(path.basename(stored)).not.toContain('hisobot');
    expect(stored.startsWith(h.uploadDir)).toBe(true);
  });

  it('bir xil nomli ikki fayl to\'qnashmaydi: 2 yozuv, 2 jismoniy fayl', async () => {
    const t = await h.api.createTeam();
    const a = await h.api.uploadToProject(t.owner, t.project.id, png('same.png'));
    const b = await h.api.uploadToProject(t.owner, t.project.id, png('same.png'));
    expect(a.id).not.toBe(b.id);
    expect(h.countStoredFiles()).toBe(2);
    expect(new Set(h.listStoredFiles().map((f) => path.basename(f))).size).toBe(2);
  });

  it('bir vaqtda 5 ta yuklash: 5 yozuv va 5 fayl', async () => {
    const t = await h.api.createTeam();
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) => h.api.uploadTo(t.owner, `/projects/${t.project.id}/attachments`, png(`p${i}.png`))),
    );
    expect(results.map((r) => r.status)).toEqual([201, 201, 201, 201, 201]);
    expect(h.countStoredFiles()).toBe(5);
    expect((await h.api.as(t.owner).get(`/projects/${t.project.id}/attachments`)).body.meta.total).toBe(5);
  });

  describe('fayl nomi xavfsizligi', () => {
    it.each(['../../evil.png', '..\\..\\evil.png', '/etc/cron.d/evil.png', 'a/b/c/evil.png'])(
      'yo\'l ichiga o\'tuvchi nom (%s) saqlash papkasidan tashqariga fayl yaratmaydi',
      async (filename) => {
        const t = await h.api.createTeam();
        const res = await h.api.uploadTo(t.owner, `/projects/${t.project.id}/attachments`, png(filename));
        // Qabul qilinsa - nom tozalangan bo'lishi shart; rad etilsa - 400
        expect([201, 400]).toContain(res.status);
        if (res.status === 201) {
          expect(res.body.originalName).not.toMatch(/[\\/]/);
          expect(res.body.originalName).not.toContain('..');
          expect(h.countStoredFiles()).toBe(1);
          expect(h.listStoredFiles()[0].startsWith(h.uploadDir + path.sep)).toBe(true);
        }
        expect(fs.existsSync(path.join(os.tmpdir(), 'evil.png'))).toBe(false);
        expect(fs.existsSync(path.join(path.dirname(h.uploadDir), 'evil.png'))).toBe(false);
        expect(fs.existsSync('/etc/cron.d/evil.png')).toBe(false);
      },
    );

    it('unicode nom saqlanadi va qaytariladi', async () => {
      const t = await h.api.createTeam();
      const res = await h.api.uploadTo(t.owner, `/projects/${t.project.id}/attachments`, png('hisobot-тест-2024.png'));
      expect(res.status).toBe(201);
      expect(res.body.originalName).toContain('2024');
      expect(res.body.originalName.endsWith('.png')).toBe(true);
    });
  });

  describe('rad etiladigan fayllar (bazada yozuv ham, diskda fayl ham qolmasligi shart)', () => {
    async function expectRejectedClean(t: Awaited<ReturnType<typeof h.api.createTeam>>, status: number, res: any) {
      expectError(res, status);
      expect(h.countStoredFiles()).toBe(0);
      const list = await h.api.as(t.owner).get(`/projects/${t.project.id}/attachments`);
      expect(list.body.meta.total).toBe(0);
    }

    it('limitdan 1 bayt katta fayl -> 413', async () => {
      const t = await h.api.createTeam();
      const res = await h.api.uploadTo(t.owner, `/projects/${t.project.id}/attachments`, {
        buffer: fixtures.pngOfSize(DEFAULT_MAX_UPLOAD + 1),
        filename: 'big.png',
        contentType: 'image/png',
      });
      await expectRejectedClean(t, 413, res);
    });

    it.each([
      ['virus.exe', 'application/x-msdownload', () => fixtures.exe()],
      ['virus.exe (MIME rasm deb yolg\'on)', 'image/png', () => fixtures.png()],
      ['shell.php', 'application/x-php', () => fixtures.phpDisguisedAsPng()],
      ['index.html', 'text/html', () => fixtures.text('<script>alert(1)</script>')],
      ['logo.svg', 'image/svg+xml', () => fixtures.svgWithScript()],
      ['script.js', 'application/javascript', () => fixtures.text('alert(1)')],
      ['archive.zip', 'application/zip', () => Buffer.from('PK\u0003\u0004')],
      ['yashirin.png.exe', 'image/png', () => fixtures.png()],
      ['nokengaytma', 'image/png', () => fixtures.png()],
    ])('qo\'llab-quvvatlanmaydigan tur: %s -> 415', async (filename, contentType, buf) => {
      const t = await h.api.createTeam();
      const res = await h.api.uploadTo(t.owner, `/projects/${t.project.id}/attachments`, { buffer: buf(), filename, contentType });
      await expectRejectedClean(t, 415, res);
    });

    it('ruxsat etilgan kengaytma, lekin ruxsat etilmagan MIME (application/octet-stream) -> 415', async () => {
      const t = await h.api.createTeam();
      const res = await h.api.uploadTo(t.owner, `/projects/${t.project.id}/attachments`, {
        buffer: fixtures.png(),
        filename: 'a.png',
        contentType: 'application/octet-stream',
      });
      await expectRejectedClean(t, 415, res);
    });

    it.each([
      ['PHP kodi, .png va image/png deb', 'a.png', 'image/png', () => fixtures.phpDisguisedAsPng()],
      ['PNG baytlari, .pdf deb', 'a.pdf', 'application/pdf', () => fixtures.png()],
      ['PNG baytlari, .jpg deb', 'a.jpg', 'image/jpeg', () => fixtures.png()],
      ['exe baytlari, .png deb', 'a.png', 'image/png', () => fixtures.exe()],
      ['binary baytlar, .txt deb', 'a.txt', 'text/plain', () => fixtures.binaryDisguisedAsText()],
    ])('kontent kengaytmaga mos emas: %s -> 415', async (_n, filename, contentType, buf) => {
      const t = await h.api.createTeam();
      const res = await h.api.uploadTo(t.owner, `/projects/${t.project.id}/attachments`, { buffer: buf(), filename, contentType });
      await expectRejectedClean(t, 415, res);
    });

    it('bo\'sh fayl -> 400', async () => {
      const t = await h.api.createTeam();
      const res = await h.api.uploadTo(t.owner, `/projects/${t.project.id}/attachments`, {
        buffer: Buffer.alloc(0),
        filename: 'empty.txt',
        contentType: 'text/plain',
      });
      await expectRejectedClean(t, 400, res);
    });

    it('fayl yuborilmasa (multipart, lekin fayl maydoni yo\'q) -> 400', async () => {
      const t = await h.api.createTeam();
      const res = await h.api.as(t.owner).post(`/projects/${t.project.id}/attachments`).field('note', 'hello');
      await expectRejectedClean(t, 400, res);
    });

    it('JSON tana (multipart emas) -> 400', async () => {
      const t = await h.api.createTeam();
      const res = await h.api.as(t.owner).post(`/projects/${t.project.id}/attachments`).send({ file: 'x' });
      await expectRejectedClean(t, 400, res);
    });

    it('noto\'g\'ri maydon nomi ("file" emas) -> 400', async () => {
      const t = await h.api.createTeam();
      const res = await h.api
        .as(t.owner)
        .post(`/projects/${t.project.id}/attachments`)
        .attach('document', fixtures.png(), { filename: 'a.png', contentType: 'image/png' });
      await expectRejectedClean(t, 400, res);
    });

    it('bir so\'rovda bir nechta fayl -> 400 va hech narsa saqlanmaydi', async () => {
      const t = await h.api.createTeam();
      const res = await h.api
        .as(t.owner)
        .post(`/projects/${t.project.id}/attachments`)
        .attach('file', fixtures.png(), { filename: 'a.png', contentType: 'image/png' })
        .attach('file', fixtures.png(), { filename: 'b.png', contentType: 'image/png' });
      await expectRejectedClean(t, 400, res);
    });

    it('mavjud bo\'lmagan vazifaga yuklash 404 va fayl qolmaydi', async () => {
      const t = await h.api.createTeam();
      const res = await h.api.uploadTo(t.owner, `/tasks/${FAKE_ID}/attachments`, png());
      expectError(res, 404);
      expect(h.countStoredFiles()).toBe(0);
    });

    it('ruxsatsiz foydalanuvchining yuklashi (a\'zo emas) 404 va fayl diskka yozilmaydi', async () => {
      const t = await h.api.createTeam();
      const res = await h.api.uploadTo(t.outsider, `/projects/${t.project.id}/attachments`, png());
      expectError(res, 404);
      expect(h.countStoredFiles()).toBe(0);
    });

    it('arxivlangan loyihaga yuklash 409 va fayl qolmaydi', async () => {
      const t = await h.api.createTeam();
      await h.api.as(t.owner).post(`/projects/${t.project.id}/archive`).expect(200);
      const res = await h.api.uploadTo(t.owner, `/projects/${t.project.id}/attachments`, png());
      expectError(res, 409);
      expect(h.countStoredFiles()).toBe(0);
    });
  });
});

describe('metadata va ro\'yxatlar', () => {
  it('GET /attachments/:id metadata qaytaradi', async () => {
    const t = await h.api.createTeam();
    const att = await h.api.uploadToProject(t.member, t.project.id, png('x.png'));
    const res = await h.api.as(t.manager).get(`/attachments/${att.id}`);
    expect(res.status).toBe(200);
    expectAttachmentShape(res.body);
    expect(res.body).toEqual(att);
  });

  it('GET /projects/:id/attachments faqat loyihaning o\'ziga biriktirilganlarni, /tasks/:id/attachments vazifanikini qaytaradi', async () => {
    const t = await h.api.createTeam();
    const task1 = await h.api.createTask(t.owner, t.project.id);
    const task2 = await h.api.createTask(t.owner, t.project.id);
    const p = await h.api.uploadToProject(t.owner, t.project.id, png('p.png'));
    const a1 = await h.api.uploadToTask(t.owner, task1.id, png('t1.png'));
    const a2 = await h.api.uploadToTask(t.owner, task2.id, png('t2.png'));

    const proj = await h.api.as(t.member).get(`/projects/${t.project.id}/attachments`);
    expectPage(proj, { page: 1, limit: 10, total: 1 });
    expect(proj.body.data.map((x: any) => x.id)).toEqual([p.id]);

    const tk1 = await h.api.as(t.member).get(`/tasks/${task1.id}/attachments`);
    expect(tk1.body.data.map((x: any) => x.id)).toEqual([a1.id]);
    const tk2 = await h.api.as(t.member).get(`/tasks/${task2.id}/attachments`);
    expect(tk2.body.data.map((x: any) => x.id)).toEqual([a2.id]);
  });

  it('ro\'yxat yangisi birinchi tartibda va sahifalanadi', async () => {
    const t = await h.api.createTeam();
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) ids.push((await h.api.uploadToProject(t.owner, t.project.id, png(`n${i}.png`))).id);
    const p1 = await h.api.as(t.owner).get(`/projects/${t.project.id}/attachments?limit=2&page=1`);
    const p2 = await h.api.as(t.owner).get(`/projects/${t.project.id}/attachments?limit=2&page=2`);
    expectPage(p1, { page: 1, limit: 2, total: 3 });
    expect([...p1.body.data, ...p2.body.data].map((x: any) => x.id)).toEqual([...ids].reverse());
  });

  it('mavjud bo\'lmagan id 404, noto\'g\'ri UUID 400', async () => {
    const t = await h.api.createTeam();
    expectError(await h.api.as(t.owner).get(`/attachments/${FAKE_ID}`), 404);
    expectError(await h.api.as(t.owner).get('/attachments/xyz'), 400);
    expectError(await h.api.as(t.owner).get(`/attachments/${FAKE_ID}/download`), 404);
  });
});

describe('yuklab olish: GET /attachments/:id/download', () => {
  it('a\'zo asl baytlarni to\'g\'ri sarlavhalar bilan oladi', async () => {
    const t = await h.api.createTeam();
    const att = await h.api.uploadToProject(t.owner, t.project.id, { buffer: fixtures.pdf(), filename: 'shartnoma.pdf', contentType: 'application/pdf' });
    const res = await h.api.as(t.member).get(`/attachments/${att.id}/download`).buffer(true).parse(binaryParser);
    expect(res.status).toBe(200);
    expect(Buffer.compare(res.body, fixtures.pdf())).toBe(0);
    expect(res.headers['content-type']).toMatch(/^application\/pdf/);
    expect(res.headers['content-disposition']).toMatch(/^attachment/i);
    expect(res.headers['content-disposition']).toContain('shartnoma.pdf');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('maxsus belgili nom (qo\'shtirnoq, nuqta-vergul) sarlavhani buzmaydi', async () => {
    const t = await h.api.createTeam();
    const att = await h.api.uploadToProject(t.owner, t.project.id, png('we"ird;na me.png'));
    const res = await h.api.as(t.owner).get(`/attachments/${att.id}/download`);
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/^attachment/i);
    expect(res.headers['content-type']).toMatch(/^image\/png/);
  });

  it('a\'zo bo\'lmagan foydalanuvchi yuklab ola olmaydi (404), tokensiz 401', async () => {
    const t = await h.api.createTeam();
    const att = await h.api.uploadToProject(t.owner, t.project.id, png());
    const denied = await h.api.as(t.outsider).get(`/attachments/${att.id}/download`);
    expectError(denied, 404);
    expect(denied.body).not.toHaveProperty('data');
    expectError(await h.api.anon.get(`/attachments/${att.id}/download`), 401);
  });

  it('loyihadan chiqarilgan a\'zo yuklab olish huquqini yo\'qotadi', async () => {
    const t = await h.api.createTeam();
    const att = await h.api.uploadToProject(t.owner, t.project.id, png());
    await h.api.as(t.member).get(`/attachments/${att.id}/download`).expect(200);
    await h.api.as(t.owner).delete(`/projects/${t.project.id}/members/${t.member.id}`).expect(204);
    expectError(await h.api.as(t.member).get(`/attachments/${att.id}/download`), 404);
    expectError(await h.api.as(t.member).get(`/attachments/${att.id}`), 404);
  });
});

describe('o\'chirish: DELETE /attachments/:id', () => {
  it('yozuvni ham, jismoniy faylni ham o\'chiradi (204)', async () => {
    const t = await h.api.createTeam();
    const att = await h.api.uploadToProject(t.owner, t.project.id, png());
    expect(h.countStoredFiles()).toBe(1);
    const res = await h.api.as(t.owner).delete(`/attachments/${att.id}`);
    expect(res.status).toBe(204);
    expect(h.countStoredFiles()).toBe(0);
    expectError(await h.api.as(t.owner).get(`/attachments/${att.id}`), 404);
    expectError(await h.api.as(t.owner).get(`/attachments/${att.id}/download`), 404);
    expectError(await h.api.as(t.owner).delete(`/attachments/${att.id}`), 404);
  });

  it('MEMBER faqat o\'zi yuklaganini o\'chira oladi', async () => {
    const t = await h.api.createTeam();
    const mine = await h.api.uploadToProject(t.member, t.project.id, png('mine.png'));
    const theirs = await h.api.uploadToProject(t.member2, t.project.id, png('theirs.png'));
    await h.api.as(t.member).delete(`/attachments/${mine.id}`).expect(204);
    expectError(await h.api.as(t.member).delete(`/attachments/${theirs.id}`), 403);
    await h.api.as(t.owner).get(`/attachments/${theirs.id}`).expect(200);
    expect(h.countStoredFiles()).toBe(1);
  });

  it('MANAGER boshqalarning fayllarini o\'chira oladi', async () => {
    const t = await h.api.createTeam();
    const att = await h.api.uploadToProject(t.member, t.project.id, png());
    await h.api.as(t.manager).delete(`/attachments/${att.id}`).expect(204);
  });

  it('jismoniy fayl allaqachon yo\'qolgan bo\'lsa ham o\'chirish yozuvni olib tashlaydi (204)', async () => {
    const t = await h.api.createTeam();
    const att = await h.api.uploadToProject(t.owner, t.project.id, png());
    for (const f of h.listStoredFiles()) fs.rmSync(f);
    await h.api.as(t.owner).delete(`/attachments/${att.id}`).expect(204);
    expectError(await h.api.as(t.owner).get(`/attachments/${att.id}`), 404);
  });

  it('a\'zo bo\'lmagan 404 va hech narsa o\'chmaydi', async () => {
    const t = await h.api.createTeam();
    const att = await h.api.uploadToProject(t.owner, t.project.id, png());
    expectError(await h.api.as(t.outsider).delete(`/attachments/${att.id}`), 404);
    expect(h.countStoredFiles()).toBe(1);
  });
});

describe('xatoliklar va izchillik', () => {
  it('saqlash xatosi -> 500 (standart format, yo\'l sizmaydi), bazada yozuv qolmaydi, tiklangach ishlaydi', async () => {
    const t = await h.api.createTeam();
    const restore = h.breakStorage();
    try {
      const res = await h.api.uploadTo(t.owner, `/projects/${t.project.id}/attachments`, png());
      expectError(res, 500);
      const raw = JSON.stringify(res.body);
      expect(raw).not.toContain(h.uploadDir);
      expect(raw).not.toMatch(/ENOTDIR|ENOENT|EEXIST|EACCES|mkdir|writeFile|teamflow-e2e/);
      expect(res.body.message).toBe('Internal server error');
      const list = await h.api.as(t.owner).get(`/projects/${t.project.id}/attachments`);
      expect(list.body.meta.total).toBe(0);
    } finally {
      restore();
    }
    const ok = await h.api.uploadTo(t.owner, `/projects/${t.project.id}/attachments`, png());
    expect(ok.status).toBe(201);
    expect(h.countStoredFiles()).toBe(1);
  });

  it('vazifaga yuklashda saqlash xatosi ham izchil qoladi', async () => {
    const t = await h.api.createTeam();
    const task = await h.api.createTask(t.owner, t.project.id);
    const restore = h.breakStorage();
    try {
      expectError(await h.api.uploadTo(t.owner, `/tasks/${task.id}/attachments`, png()), 500);
      expect((await h.api.as(t.owner).get(`/tasks/${task.id}/attachments`)).body.meta.total).toBe(0);
    } finally {
      restore();
    }
  });

  it('saqlash xatosidan keyin ilova ishlashda davom etadi', async () => {
    const t = await h.api.createTeam();
    const restore = h.breakStorage();
    try {
      await h.api.uploadTo(t.owner, `/projects/${t.project.id}/attachments`, png());
    } finally {
      restore();
    }
    await h.api.as(t.owner).get('/auth/me').expect(200);
  });
});

function binaryParser(res: any, cb: (err: Error | null, body: Buffer) => void) {
  const chunks: Buffer[] = [];
  res.on('data', (c: Buffer) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
}
