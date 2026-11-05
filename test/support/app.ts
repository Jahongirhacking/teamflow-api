import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { Api } from './api';
import { closePool, truncateAll } from './db';
import { loadSrc } from './load-src';

export interface TestHarness {
  readonly app: INestApplication;
  readonly api: Api;
  /** Bu test fayli uchun ajratilgan vaqtinchalik upload papkasi */
  readonly uploadDir: string;
  /** Upload papkasidagi barcha (rekursiv) fayllar soni */
  countStoredFiles(): number;
  /** Upload papkasidagi barcha fayllarning mutlaq yo'llari */
  listStoredFiles(): string[];
  /** Saqlash papkasini oddiy faylga almashtiradi -> har qanday yozish urinishi ENOTDIR bilan yiqiladi. */
  breakStorage(): () => void;
}

function walkFiles(dir: string): string[] {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walkFiles(full) : [full];
  });
}

/**
 * Test faylida chaqiriladi (describe'dan tashqarida yoki ichida).
 * Hayot sikli: beforeAll -> ilovani ko'taradi, beforeEach -> bazani va upload papkasini tozalaydi,
 * afterAll -> ilovani yopadi va vaqtinchalik papkani o'chiradi.
 */
export function useTestApp(): TestHarness {
  let app: INestApplication;
  let api: Api;
  let uploadDir: string;

  beforeAll(async () => {
    uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teamflow-e2e-'));
    process.env.UPLOAD_DIR = uploadDir;
    process.env.BCRYPT_ROUNDS = process.env.BCRYPT_ROUNDS ?? '4';

    const { AppModule } = await loadSrc<{ AppModule: Type<unknown> }>('src/app.module');
    const { configureApp } = await loadSrc<{ configureApp: (app: INestApplication) => void | Promise<void> }>(
      'src/app.setup',
    );

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await configureApp(app);
    await app.init();
    api = new Api(app);
  });

  beforeEach(async () => {
    await truncateAll();
    fs.rmSync(uploadDir, { recursive: true, force: true });
    fs.mkdirSync(uploadDir, { recursive: true });
  });

  afterAll(async () => {
    await app?.close();
    await closePool();
    if (uploadDir) fs.rmSync(uploadDir, { recursive: true, force: true });
  });

  return {
    get app() {
      return app;
    },
    get api() {
      return api;
    },
    get uploadDir() {
      return uploadDir;
    },
    countStoredFiles: () => walkFiles(uploadDir).length,
    listStoredFiles: () => walkFiles(uploadDir),
    breakStorage() {
      fs.rmSync(uploadDir, { recursive: true, force: true });
      fs.writeFileSync(uploadDir, 'not-a-directory');
      return () => {
        fs.rmSync(uploadDir, { recursive: true, force: true });
        fs.mkdirSync(uploadDir, { recursive: true });
      };
    },
  };
}
