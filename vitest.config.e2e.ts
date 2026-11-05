import path from 'node:path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * E2E testlar uchun konfiguratsiya.
 * Ishga tushirish: pnpm test:e2e
 *
 * - Haqiqiy PostgreSQL (alohida *_test bazasi) ishlatiladi.
 * - Barcha fayllar bitta bazani baham ko'radi, shuning uchun fayllar ketma-ket ishlaydi.
 * - Bazani tayyorlash (xavfsizlik tekshiruvi, schema reset, migratsiyalar) global-setup.ts da.
 */
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  resolve: {
    alias: { src: path.resolve(__dirname, 'src') },
  },
  test: {
    environment: 'node',
    include: ['test/e2e/**/*.e2e-spec.ts'],
    globalSetup: ['test/support/global-setup.ts'],
    setupFiles: ['test/support/setup-e2e.ts'],
    pool: 'forks',
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    teardownTimeout: 15_000,
  },
});
