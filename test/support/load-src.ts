/**
 * Talaba yozishi kerak bo'lgan modullarni dinamik yuklaydi.
 *
 * Nima uchun statik `import` emas? Modul hali mavjud bo'lmaganda test fayli
 * kompilyatsiya bosqichida butunlay qulab tushmasligi va `tsc` toza o'tishi uchun.
 * Modul yo'q bo'lsa - tushunarli xabar bilan test yiqiladi.
 */
export async function loadSrc<T>(relativeModule: string): Promise<T> {
  const absolute = `${process.cwd()}/${relativeModule}`;
  try {
    return (await import(/* @vite-ignore */ absolute)) as T;
  } catch (err) {
    const message = (err as Error).message ?? '';
    const missing =
      /Cannot find module|Failed to load url|Failed to resolve import|ENOENT/i.test(message) &&
      message.includes(relativeModule);
    if (missing) {
      throw new Error(
        `"${relativeModule}.ts" topilmadi. Bu modulni yozish kerak - ASSIGNMENT.md dagi ` +
          `"Test shartnomasi" bo'limiga qarang.`,
      );
    }
    throw err;
  }
}
