import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadSrc } from '../support/load-src';

interface Storage {
  save(buffer: Buffer, originalName: string): Promise<string>;
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}
let LocalStorageProvider: new (baseDir: string) => Storage;
let StorageProvider: abstract new (...args: never[]) => unknown;

beforeAll(async () => {
  ({ StorageProvider } = await loadSrc<{ StorageProvider: typeof StorageProvider }>('src/storage/storage.provider'));
  ({ LocalStorageProvider } = await loadSrc<{ LocalStorageProvider: typeof LocalStorageProvider }>(
    'src/storage/local-storage.provider',
  ));
});

function listFiles(dir: string): string[] {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? listFiles(full) : [full];
  });
}

describe('LocalStorageProvider', () => {
  let sandbox: string; // testga xos ota papka
  let baseDir: string; // saqlash papkasi (sandbox ichida)
  let storage: Storage;

  beforeEach(() => {
    sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'teamflow-unit-'));
    baseDir = path.join(sandbox, 'uploads');
    fs.mkdirSync(baseDir);
    storage = new LocalStorageProvider(baseDir);
  });

  afterEach(() => {
    fs.rmSync(sandbox, { recursive: true, force: true });
  });

  it('abstrakt StorageProvider\'ni kengaytiradi (dependency inversion)', () => {
    expect(typeof StorageProvider).toBe('function');
    expect(LocalStorageProvider.prototype instanceof (StorageProvider as unknown as Function)).toBe(true);
  });

  describe('save / read / exists', () => {
    it('saqlangan baytlarni aynan o\'sha holda qaytaradi', async () => {
      const data = Buffer.from([1, 2, 3, 250, 0, 7]);
      const key = await storage.save(data, 'a.png');
      expect(await storage.read(key)).toEqual(data);
      expect(await storage.exists(key)).toBe(true);
    });

    it('mavjud bo\'lmagan kalit uchun exists() false', async () => {
      expect(await storage.exists('yoq-kalit')).toBe(false);
    });

    it('mavjud bo\'lmagan kalitni o\'qishda rad etadi', async () => {
      await expect(storage.read('yoq-kalit')).rejects.toBeDefined();
    });

    it('saqlash papkasi mavjud bo\'lmasa uni yaratadi', async () => {
      const nested = path.join(sandbox, 'a', 'b', 'c');
      const key = await new LocalStorageProvider(nested).save(Buffer.from('x'), 'x.txt');
      expect(listFiles(nested)).toHaveLength(1);
      expect(key).toBeTruthy();
    });
  });

  describe('xavfsiz va noyob kalit', () => {
    it('bir xil nomli ikki fayl uchun turli kalit beradi va ikkalasi alohida saqlanadi', async () => {
      const k1 = await storage.save(Buffer.from('one'), 'same.txt');
      const k2 = await storage.save(Buffer.from('two'), 'same.txt');
      expect(k1).not.toBe(k2);
      expect((await storage.read(k1)).toString()).toBe('one');
      expect((await storage.read(k2)).toString()).toBe('two');
    });

    it('kalit foydalanuvchi bergan nomni o\'z ichiga olmaydi', async () => {
      const key = await storage.save(Buffer.from('x'), 'maxfiy-hisobot.pdf');
      expect(key).not.toContain('maxfiy');
      expect(key).not.toContain('hisobot');
    });

    it('kalitda yo\'l ajratgichlari va ".." bo\'lmaydi', async () => {
      const key = await storage.save(Buffer.from('x'), '../../etc/passwd');
      expect(key).not.toMatch(/[\\/]/);
      expect(key).not.toContain('..');
    });

    it('zararli nom bilan saqlansa ham fayl faqat saqlash papkasi ichida yaratiladi', async () => {
      await storage.save(Buffer.from('x'), '../../outside.txt');
      await storage.save(Buffer.from('y'), '..\\..\\outside2.txt');
      await storage.save(Buffer.from('z'), '/etc/cron.d/evil');
      expect(listFiles(baseDir)).toHaveLength(3);
      expect(listFiles(sandbox)).toHaveLength(3); // sandbox'da boshqa fayl yo'q
      expect(fs.existsSync(path.join(os.tmpdir(), 'outside.txt'))).toBe(false);
    });

    it('bir vaqtda ko\'p saqlashda kalitlar to\'qnashmaydi', async () => {
      const keys = await Promise.all(Array.from({ length: 25 }, (_, i) => storage.save(Buffer.from(String(i)), 'a.txt')));
      expect(new Set(keys).size).toBe(25);
      expect(listFiles(baseDir)).toHaveLength(25);
    });
  });

  describe('delete', () => {
    it('faylni jismonan o\'chiradi', async () => {
      const key = await storage.save(Buffer.from('x'), 'a.txt');
      await storage.delete(key);
      expect(await storage.exists(key)).toBe(false);
      expect(listFiles(baseDir)).toHaveLength(0);
    });

    it('idempotent: mavjud bo\'lmagan faylni o\'chirish xato tashlamaydi', async () => {
      await expect(storage.delete('yoq-kalit')).resolves.toBeUndefined();
      const key = await storage.save(Buffer.from('x'), 'a.txt');
      await storage.delete(key);
      await expect(storage.delete(key)).resolves.toBeUndefined();
    });
  });

  describe('path traversal himoyasi', () => {
    let sentinel: string;
    beforeEach(() => {
      sentinel = path.join(sandbox, 'sentinel.txt');
      fs.writeFileSync(sentinel, 'do-not-touch');
    });

    it('read("../sentinel.txt") saqlash papkasidan tashqarini o\'qimaydi', async () => {
      await expect(storage.read('../sentinel.txt')).rejects.toBeDefined();
    });

    it('delete("../sentinel.txt") saqlash papkasidan tashqaridagi faylni o\'chirmaydi', async () => {
      await Promise.resolve(storage.delete('../sentinel.txt')).catch(() => undefined);
      expect(fs.readFileSync(sentinel, 'utf8')).toBe('do-not-touch');
    });

    it('mutlaq yo\'l kalit sifatida berilsa tashqi faylga tegmaydi', async () => {
      await expect(storage.read(sentinel)).rejects.toBeDefined();
      await Promise.resolve(storage.delete(sentinel)).catch(() => undefined);
      expect(fs.existsSync(sentinel)).toBe(true);
    });
  });

  describe('xatoliklar', () => {
    it('saqlash papkasi o\'rnida oddiy fayl bo\'lsa save() rad etiladi va yarim fayl qolmaydi', async () => {
      const blocked = path.join(sandbox, 'blocked');
      fs.writeFileSync(blocked, 'i am a file');
      await expect(new LocalStorageProvider(blocked).save(Buffer.from('x'), 'a.txt')).rejects.toBeDefined();
      expect(fs.readFileSync(blocked, 'utf8')).toBe('i am a file');
    });
  });
});
