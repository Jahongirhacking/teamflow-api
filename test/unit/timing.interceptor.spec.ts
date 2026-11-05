import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { defer, firstValueFrom, lastValueFrom, of, throwError } from 'rxjs';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { loadSrc } from '../support/load-src';

interface Interceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): import('rxjs').Observable<unknown>;
}
let TimingInterceptor: new () => Interceptor;

beforeAll(async () => {
  ({ TimingInterceptor } = await loadSrc<{ TimingInterceptor: new () => Interceptor }>(
    'src/common/interceptors/timing.interceptor',
  ));
});

/** Express'ga o'xshash minimal response: sarlavhalarni yig'adi. */
function fakeResponse() {
  const headers = new Map<string, string>();
  const set = (name: string, value: unknown) => {
    headers.set(name.toLowerCase(), String(value));
  };
  return {
    headers,
    res: {
      setHeader: set,
      header: set,
      set,
      append: set,
      getHeader: (n: string) => headers.get(n.toLowerCase()),
      headersSent: false,
    },
  };
}

function fakeContext(res: unknown): ExecutionContext {
  const http = { getRequest: () => ({ method: 'GET', url: '/x', headers: {} }), getResponse: () => res };
  return {
    getType: () => 'http',
    switchToHttp: () => http,
    getHandler: () => function handler() {},
    getClass: () => class Ctrl {},
    getArgs: () => [],
    getArgByIndex: () => undefined,
    switchToRpc: () => ({}) as never,
    switchToWs: () => ({}) as never,
  } as unknown as ExecutionContext;
}

describe('TimingInterceptor', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'performance', 'hrtime'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('handler natijasini o\'zgartirmay uzatadi', async () => {
    const { res } = fakeResponse();
    const out = await firstValueFrom(new TimingInterceptor().intercept(fakeContext(res), { handle: () => of({ ok: 1 }) }));
    expect(out).toEqual({ ok: 1 });
  });

  it('X-Response-Time sarlavhasini "<son>ms" formatida o\'rnatadi', async () => {
    const { res, headers } = fakeResponse();
    await lastValueFrom(new TimingInterceptor().intercept(fakeContext(res), { handle: () => of('x') }));
    expect(headers.get('x-response-time')).toMatch(/^\d+(\.\d+)?ms$/);
  });

  it('o\'lchangan vaqt handler sarflagan vaqtni aks ettiradi', async () => {
    const { res, headers } = fakeResponse();
    const handler: CallHandler = {
      handle: () =>
        defer(() => {
          vi.advanceTimersByTime(150);
          return of('slow');
        }),
    };
    await lastValueFrom(new TimingInterceptor().intercept(fakeContext(res), handler));
    const ms = parseFloat(headers.get('x-response-time')!);
    expect(ms).toBeGreaterThanOrEqual(150);
    expect(ms).toBeLessThan(1000);
  });

  it('handler xato tashlasa ham xatoni uzatadi va sarlavhani o\'rnatadi', async () => {
    const { res, headers } = fakeResponse();
    const boom = new Error('boom');
    const handler: CallHandler = {
      handle: () =>
        defer(() => {
          vi.advanceTimersByTime(40);
          return throwError(() => boom);
        }),
    };
    await expect(lastValueFrom(new TimingInterceptor().intercept(fakeContext(res), handler))).rejects.toBe(boom);
    expect(headers.get('x-response-time')).toMatch(/^\d+(\.\d+)?ms$/);
    expect(parseFloat(headers.get('x-response-time')!)).toBeGreaterThanOrEqual(40);
  });

  it('har bir so\'rov uchun alohida o\'lchaydi (holat saqlamaydi)', async () => {
    const interceptor = new TimingInterceptor();
    const a = fakeResponse();
    const b = fakeResponse();
    const slow: CallHandler = {
      handle: () => defer(() => { vi.advanceTimersByTime(200); return of(1); }),
    };
    await lastValueFrom(interceptor.intercept(fakeContext(a.res), slow));
    await lastValueFrom(interceptor.intercept(fakeContext(b.res), { handle: () => of(2) }));
    expect(parseFloat(a.headers.get('x-response-time')!)).toBeGreaterThanOrEqual(200);
    expect(parseFloat(b.headers.get('x-response-time')!)).toBeLessThan(50);
  });
});
