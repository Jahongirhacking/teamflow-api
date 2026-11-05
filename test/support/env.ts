import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

const ROOT = path.resolve(__dirname, '../..');

/**
 * `.env.test` mavjud bo'lsa shuni, aks holda `.env.test.example` ni yuklaydi.
 * Fayldagi qiymatlar shell'dagi o'zgaruvchilardan USTUN turadi: tasodifan dev bazaga
 * ulanib qolishning oldini olish uchun.
 */
export function loadTestEnv(): Record<string, string> {
  const candidates = ['.env.test', '.env.test.example'].map((f) => path.join(ROOT, f));
  const file = candidates.find((f) => fs.existsSync(f));
  if (!file) {
    throw new Error('.env.test ham, .env.test.example ham topilmadi.');
  }
  const parsed = dotenv.parse(fs.readFileSync(file));
  for (const [key, value] of Object.entries(parsed)) {
    process.env[key] = value;
  }
  process.env.NODE_ENV = 'test';
  return parsed;
}

/** Test bazasi emasligiga ishonch hosil qilmaguncha hech narsa o'chirilmaydi. */
export function assertSafeTestDatabase(): void {
  const name = process.env.DB_NAME ?? '';
  if (process.env.NODE_ENV !== 'test') {
    throw new Error(`Xavfsizlik: NODE_ENV=test bo'lishi shart (hozir: ${process.env.NODE_ENV}).`);
  }
  if (!/_test$/.test(name)) {
    throw new Error(
      `Xavfsizlik: DB_NAME "_test" bilan tugashi shart (hozir: "${name}"). ` +
        `E2E testlar bazani tozalaydi - dev/prod bazaga ulanmang.`,
    );
  }
}

export function dbConfig(database = process.env.DB_NAME) {
  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database,
  };
}

export const ROOT_DIR = ROOT;
