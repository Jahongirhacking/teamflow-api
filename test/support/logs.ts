import { format } from 'node:util';

export interface LogCapture {
  /** Ushlangan barcha yozuvlar (qatorlarga bo'lingan) */
  lines(): string[];
  text(): string;
  stop(): void;
}

/**
 * Jarayon darajasida stdout/stderr va console.* ga yozilgan hamma narsani ushlaydi.
 * Ilova loglari shu kanallardan birortasi orqali chiqishi shart
 * (Nest Logger / ConsoleLogger / console.*). Faylga yoki to'g'ridan-to'g'ri fd ga
 * yozuvchi kutubxonalar (masalan, pino default) bu yerda ko'rinmaydi.
 */
export function captureLogs(): LogCapture {
  const chunks: string[] = [];
  const passthrough = process.env.TEST_VERBOSE === '1';

  const origStdout = process.stdout.write.bind(process.stdout);
  const origStderr = process.stderr.write.bind(process.stderr);
  const consoleMethods = ['log', 'info', 'warn', 'error', 'debug', 'trace'] as const;
  const origConsole = new Map<string, (...args: unknown[]) => void>();

  const sink = (chunk: unknown) => {
    chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk as Uint8Array).toString('utf8'));
  };

  process.stdout.write = ((chunk: unknown, ...rest: unknown[]) => {
    sink(chunk);
    return passthrough ? (origStdout as (...a: unknown[]) => boolean)(chunk, ...rest) : true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: unknown, ...rest: unknown[]) => {
    sink(chunk);
    return passthrough ? (origStderr as (...a: unknown[]) => boolean)(chunk, ...rest) : true;
  }) as typeof process.stderr.write;

  for (const m of consoleMethods) {
    origConsole.set(m, console[m] as (...args: unknown[]) => void);
    (console as unknown as Record<string, unknown>)[m] = (...args: unknown[]) => {
      sink(format(...args) + '\n');
      if (passthrough) origConsole.get(m)!(...args);
    };
  }

  let stopped = false;
  return {
    lines: () =>
      chunks
        .join('')
        .split('\n')
        .filter((l) => l.length > 0),
    text: () => chunks.join(''),
    stop() {
      if (stopped) return;
      stopped = true;
      process.stdout.write = origStdout as typeof process.stdout.write;
      process.stderr.write = origStderr as typeof process.stderr.write;
      for (const m of consoleMethods) {
        (console as unknown as Record<string, unknown>)[m] = origConsole.get(m);
      }
    },
  };
}
