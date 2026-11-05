import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { Client } from 'pg';
import { assertSafeTestDatabase, dbConfig, loadTestEnv, ROOT_DIR } from './env';

/**
 * Bir marta, barcha E2E testlardan oldin ishlaydi:
 *  1. test env yuklanadi va bazaning xavfsizligi tekshiriladi;
 *  2. *_test bazasi yo'q bo'lsa yaratiladi;
 *  3. `public` schema butunlay tozalanadi (oldingi ishga tushirishdan qolgan narsalar yo'q);
 *  4. talaba yozgan MIGRATSIYALAR ishga tushiriladi (synchronize ishlatilmaydi).
 *
 * Migratsiya muvaffaqiyatsiz bo'lsa, bu yerda xato tashlanmaydi - har bir test o'z sababi
 * bilan alohida yiqiladi (kutilgan holat: talaba hali migratsiya yozmagan).
 */
export default async function globalSetup() {
  loadTestEnv();
  assertSafeTestDatabase();

  const dbName = process.env.DB_NAME as string;

  const admin = new Client(dbConfig('postgres'));
  try {
    await admin.connect();
  } catch (err) {
    throw new Error(
      `PostgreSQL ga ulanib bo'lmadi (${process.env.DB_HOST}:${process.env.DB_PORT}). ` +
        `"pnpm db:up" bilan bazani ishga tushiring.\n${(err as Error).message}`,
    );
  }
  const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (exists.rowCount === 0) {
    await admin.query(`CREATE DATABASE "${dbName}"`);
  }
  await admin.end();

  const db = new Client(dbConfig());
  await db.connect();
  await db.query('DROP SCHEMA IF EXISTS public CASCADE');
  await db.query('CREATE SCHEMA public');
  await db.end();

  const dataSource = path.join(ROOT_DIR, 'src/database/data-source.ts');
  if (!fs.existsSync(dataSource)) {
    console.warn(
      '\n[e2e setup] src/database/data-source.ts topilmadi - migratsiyalar ishga tushirilmadi.\n' +
        '            ASSIGNMENT.md "Test shartnomasi" bo\'limiga qarang.\n',
    );
    return;
  }

  const bin = path.join(ROOT_DIR, 'node_modules/.bin/typeorm-ts-node-commonjs');
  const result = spawnSync(bin, ['-d', 'src/database/data-source.ts', 'migration:run'], {
    cwd: ROOT_DIR,
    env: { ...process.env },
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    console.warn(
      `\n[e2e setup] Migratsiyalar bajarilmadi (exit ${result.status}).\n${result.stdout}\n${result.stderr}\n`,
    );
  }
}

export async function teardown() {
  // Vaqtinchalik upload papkalarini har bir test fayli o'zi tozalaydi.
}
