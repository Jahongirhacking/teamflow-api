import { beforeAll, describe, expect, it } from 'vitest';
import { loadSrc } from '../support/load-src';

interface Module {
  hasProjectPermission(role: string | null | undefined, permission: string): boolean;
  isAllowed(subject: { globalRole: string; projectRole: string | null }, permission: string): boolean;
}
let m: Module;

beforeAll(async () => {
  m = await loadSrc<Module>('src/authorization/permissions');
});

const PERMISSIONS = [
  'project:read',
  'project:update',
  'project:archive',
  'project:delete',
  'member:list',
  'member:add',
  'member:remove',
  'member:change-role',
  'task:read',
  'task:create',
  'task:update',
  'task:update-own',
  'task:change-status',
  'task:change-status-own',
  'task:assign',
  'task:delete',
  'attachment:read',
  'attachment:upload',
  'attachment:delete',
  'attachment:delete-own',
] as const;

const MEMBER_ALLOWED = new Set([
  'project:read',
  'member:list',
  'task:read',
  'task:create',
  'task:update-own',
  'task:change-status-own',
  'attachment:read',
  'attachment:upload',
  'attachment:delete-own',
]);
const MANAGER_DENIED = new Set(['project:archive', 'project:delete', 'member:change-role']);

describe('hasProjectPermission() - loyiha darajasidagi ruxsatlar matritsasi', () => {
  describe('ADMIN', () => {
    it.each(PERMISSIONS)('%s ruxsat etiladi', (p) => {
      expect(m.hasProjectPermission('ADMIN', p)).toBe(true);
    });
  });

  describe('MANAGER', () => {
    it.each(PERMISSIONS)('%s', (p) => {
      expect(m.hasProjectPermission('MANAGER', p)).toBe(!MANAGER_DENIED.has(p));
    });
  });

  describe('MEMBER', () => {
    it.each(PERMISSIONS)('%s', (p) => {
      expect(m.hasProjectPermission('MEMBER', p)).toBe(MEMBER_ALLOWED.has(p));
    });
  });

  describe('a\'zo bo\'lmagan / noma\'lum holatlar', () => {
    it.each([null, undefined])('rol %s bo\'lsa hamma narsa taqiqlanadi', (role) => {
      for (const p of PERMISSIONS) expect(m.hasProjectPermission(role, p)).toBe(false);
    });

    it('noma\'lum rol nomi hech narsaga ruxsat bermaydi', () => {
      expect(m.hasProjectPermission('SUPERUSER', 'project:read')).toBe(false);
      expect(m.hasProjectPermission('admin', 'project:read')).toBe(false);
    });

    it('noma\'lum ruxsat nomi ADMIN uchun ham taqiqlanadi (deny by default)', () => {
      expect(m.hasProjectPermission('ADMIN', 'project:explode')).toBe(false);
      expect(m.hasProjectPermission('ADMIN', '')).toBe(false);
    });
  });
});

describe('isAllowed() - global va loyiha rollarini birlashtirish', () => {
  it('global ADMIN loyihaga a\'zo bo\'lmasa ham hamma ruxsatga ega', () => {
    for (const p of PERMISSIONS) {
      expect(m.isAllowed({ globalRole: 'ADMIN', projectRole: null }, p)).toBe(true);
    }
  });

  it('oddiy USER a\'zo bo\'lmasa hech narsaga ruxsati yo\'q', () => {
    for (const p of PERMISSIONS) {
      expect(m.isAllowed({ globalRole: 'USER', projectRole: null }, p)).toBe(false);
    }
  });

  it('oddiy USER uchun natija faqat loyiha roliga bog\'liq', () => {
    for (const role of ['ADMIN', 'MANAGER', 'MEMBER']) {
      for (const p of PERMISSIONS) {
        expect(m.isAllowed({ globalRole: 'USER', projectRole: role }, p)).toBe(m.hasProjectPermission(role, p));
      }
    }
  });

  it('global rol loyiha roli ruxsatini kamaytirmaydi', () => {
    expect(m.isAllowed({ globalRole: 'ADMIN', projectRole: 'MEMBER' }, 'project:delete')).toBe(true);
  });

  it('noma\'lum ruxsat nomi global ADMIN uchun ham taqiqlanadi', () => {
    expect(m.isAllowed({ globalRole: 'ADMIN', projectRole: null }, 'project:explode')).toBe(false);
  });
});
