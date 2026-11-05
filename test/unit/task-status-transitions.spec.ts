import { beforeAll, describe, expect, it } from 'vitest';
import { loadSrc } from '../support/load-src';

interface Module {
  canTransition(from: string, to: string): boolean;
  getAllowedTransitions(from: string): string[];
}
let m: Module;

beforeAll(async () => {
  m = await loadSrc<Module>('src/tasks/task-status-transitions');
});

const STATUSES = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED'];

const ALLOWED: Record<string, string[]> = {
  TODO: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['TODO', 'IN_REVIEW', 'CANCELLED'],
  IN_REVIEW: ['IN_PROGRESS', 'DONE', 'CANCELLED'],
  DONE: ['IN_PROGRESS'],
  CANCELLED: ['TODO'],
};

describe('canTransition()', () => {
  const pairs = STATUSES.flatMap((from) => STATUSES.map((to) => [from, to] as const));

  it.each(pairs)('%s -> %s', (from, to) => {
    expect(m.canTransition(from, to)).toBe(ALLOWED[from].includes(to));
  });

  it('bir xil holatga o\'tish (no-op) ruxsat etilmaydi', () => {
    for (const s of STATUSES) expect(m.canTransition(s, s)).toBe(false);
  });

  it('noma\'lum holatlar uchun false qaytaradi (xato tashlamaydi)', () => {
    expect(m.canTransition('TODO', 'ARCHIVED')).toBe(false);
    expect(m.canTransition('UNKNOWN', 'TODO')).toBe(false);
    expect(m.canTransition('todo', 'in_progress')).toBe(false);
  });
});

describe('getAllowedTransitions()', () => {
  it.each(STATUSES)('%s uchun to\'g\'ri to\'plamni qaytaradi', (from) => {
    expect([...m.getAllowedTransitions(from)].sort()).toEqual([...ALLOWED[from]].sort());
  });

  it('canTransition() bilan mos keladi', () => {
    for (const from of STATUSES) {
      for (const to of STATUSES) {
        expect(m.getAllowedTransitions(from).includes(to)).toBe(m.canTransition(from, to));
      }
    }
  });

  it('qaytarilgan massivni o\'zgartirish ichki holatni buzmaydi', () => {
    const first = m.getAllowedTransitions('TODO');
    first.push('DONE');
    first.length = 0;
    expect([...m.getAllowedTransitions('TODO')].sort()).toEqual(['CANCELLED', 'IN_PROGRESS']);
  });

  it('noma\'lum holat uchun bo\'sh massiv', () => {
    expect(m.getAllowedTransitions('NOPE')).toEqual([]);
  });
});
