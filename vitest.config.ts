import path from 'node:path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * Unit testlar uchun konfiguratsiya.
 * Ishga tushirish: pnpm test:unit
 *
 * unplugin-swc: NestJS dekoratorlari va `emitDecoratorMetadata` ni qo'llab-quvvatlash uchun
 * (esbuild bu metadata'ni chiqarmaydi, shuning uchun DI buziladi).
 */
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  resolve: {
    alias: { src: path.resolve(__dirname, 'src') },
  },
  test: {
    environment: 'node',
    include: ['test/unit/**/*.spec.ts'],
    setupFiles: ['test/support/setup-unit.ts'],
    clearMocks: true,
    restoreMocks: true,
  },
});
