import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_MAX_UPLOAD, fixtures } from '../support/files';
import { loadSrc } from '../support/load-src';

interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}
type Result = { valid: true } | { valid: false; code: string };
interface Module {
  validateUploadedFile(file: UploadedFile, options?: { maxSizeBytes?: number }): Result;
  sanitizeOriginalName(name: string): string;
}
let m: Module;

beforeAll(async () => {
  m = await loadSrc<Module>('src/uploads/file-validation');
});

const file = (originalname: string, mimetype: string, buffer: Buffer): UploadedFile => ({
  originalname,
  mimetype,
  buffer,
  size: buffer.length,
});

describe('validateUploadedFile()', () => {
  describe('ruxsat etilgan fayllar', () => {
    it.each([
      ['rasm.png', 'image/png', () => fixtures.png()],
      ['rasm.jpg', 'image/jpeg', () => fixtures.jpeg()],
      ['rasm.jpeg', 'image/jpeg', () => fixtures.jpeg()],
      ['hujjat.pdf', 'application/pdf', () => fixtures.pdf()],
      ['eslatma.txt', 'text/plain', () => fixtures.text()],
      ['KATTA.PNG', 'image/png', () => fixtures.png()],
    ])('%s (%s)', (name, mime, buf) => {
      expect(m.validateUploadedFile(file(name, mime, buf()))).toEqual({ valid: true });
    });

    it('UTF-8 (kirill/lotin/emoji) matnli .txt ni qabul qiladi', () => {
      const f = file('xabar.txt', 'text/plain', fixtures.text('Привет, Oʻzbekiston! 🚀\n'));
      expect(m.validateUploadedFile(f)).toEqual({ valid: true });
    });
  });

  describe('hajm', () => {
    it('aynan limit hajmidagi fayl qabul qilinadi', () => {
      const f = file('a.png', 'image/png', fixtures.pngOfSize(DEFAULT_MAX_UPLOAD));
      expect(m.validateUploadedFile(f)).toEqual({ valid: true });
    });

    it('limitdan 1 bayt katta fayl FILE_TOO_LARGE', () => {
      const f = file('a.png', 'image/png', fixtures.pngOfSize(DEFAULT_MAX_UPLOAD + 1));
      expect(m.validateUploadedFile(f)).toEqual({ valid: false, code: 'FILE_TOO_LARGE' });
    });

    it('maxSizeBytes opsiyasi hisobga olinadi', () => {
      const f = file('a.png', 'image/png', fixtures.pngOfSize(2048));
      expect(m.validateUploadedFile(f, { maxSizeBytes: 1024 })).toEqual({ valid: false, code: 'FILE_TOO_LARGE' });
      expect(m.validateUploadedFile(f, { maxSizeBytes: 4096 })).toEqual({ valid: true });
    });

    it('bo\'sh fayl EMPTY_FILE', () => {
      expect(m.validateUploadedFile(file('a.txt', 'text/plain', Buffer.alloc(0)))).toEqual({
        valid: false,
        code: 'EMPTY_FILE',
      });
    });
  });

  describe('kengaytma', () => {
    it.each(['virus.exe', 'shell.php', 'index.html', 'app.js', 'run.sh', 'logo.svg', 'archive.zip', 'README', '.env'])(
      '%s UNSUPPORTED_EXTENSION',
      (name) => {
        const result = m.validateUploadedFile(file(name, 'image/png', fixtures.png()));
        expect(result).toEqual({ valid: false, code: 'UNSUPPORTED_EXTENSION' });
      },
    );

    it('oxirgi kengaytma hisobga olinadi: "invoice.png.exe" rad etiladi', () => {
      expect(m.validateUploadedFile(file('invoice.png.exe', 'image/png', fixtures.png()))).toEqual({
        valid: false,
        code: 'UNSUPPORTED_EXTENSION',
      });
    });

    it('mijoz yuborgan MIME rasm bo\'lsa ham .exe qabul qilinmaydi (MIME spoofing)', () => {
      const result = m.validateUploadedFile(file('payload.exe', 'image/png', fixtures.png()));
      expect(result.valid).toBe(false);
    });
  });

  describe('MIME turi', () => {
    it.each(['application/x-msdownload', 'text/html', 'application/octet-stream', 'image/svg+xml', ''])(
      'mimetype "%s" UNSUPPORTED_MIME_TYPE',
      (mime) => {
        expect(m.validateUploadedFile(file('rasm.png', mime, fixtures.png()))).toEqual({
          valid: false,
          code: 'UNSUPPORTED_MIME_TYPE',
        });
      },
    );
  });

  describe('haqiqiy kontent (magic bytes)', () => {
    it('PHP kodi .png + image/png deb yuborilsa CONTENT_MISMATCH', () => {
      expect(m.validateUploadedFile(file('rasm.png', 'image/png', fixtures.phpDisguisedAsPng()))).toEqual({
        valid: false,
        code: 'CONTENT_MISMATCH',
      });
    });

    it('PNG baytlari .pdf deb yuborilsa CONTENT_MISMATCH', () => {
      expect(m.validateUploadedFile(file('hujjat.pdf', 'application/pdf', fixtures.png()))).toEqual({
        valid: false,
        code: 'CONTENT_MISMATCH',
      });
    });

    it('PNG baytlari .jpg deb yuborilsa CONTENT_MISMATCH', () => {
      expect(m.validateUploadedFile(file('rasm.jpg', 'image/jpeg', fixtures.png()))).toEqual({
        valid: false,
        code: 'CONTENT_MISMATCH',
      });
    });

    it('exe baytlari .pdf deb yuborilsa CONTENT_MISMATCH', () => {
      expect(m.validateUploadedFile(file('x.pdf', 'application/pdf', fixtures.exe()))).toEqual({
        valid: false,
        code: 'CONTENT_MISMATCH',
      });
    });

    it('NUL baytli binary .txt deb yuborilsa CONTENT_MISMATCH', () => {
      expect(m.validateUploadedFile(file('x.txt', 'text/plain', fixtures.binaryDisguisedAsText()))).toEqual({
        valid: false,
        code: 'CONTENT_MISMATCH',
      });
    });
  });
});

describe('sanitizeOriginalName()', () => {
  it('oddiy nomni o\'zgartirmaydi', () => {
    expect(m.sanitizeOriginalName('report-2024.pdf')).toBe('report-2024.pdf');
  });

  it.each([
    ['../../etc/passwd.png', 'passwd.png'],
    ['/var/www/uploads/a.png', 'a.png'],
    ['C:\\Users\\Ali\\rasm.png', 'rasm.png'],
    ['..\\..\\boot.txt', 'boot.txt'],
  ])('yo\'l qismini olib tashlaydi: %s', (input, expected) => {
    expect(m.sanitizeOriginalName(input)).toBe(expected);
  });

  it('boshqaruv belgilari va NUL baytni olib tashlaydi', () => {
    const out = m.sanitizeOriginalName('a\u0000b\r\nc\u0007.png');
    expect(out).not.toMatch(/[\u0000-\u001f\u007f]/);
    expect(out.endsWith('.png')).toBe(true);
  });

  it('natijada "/" va "\\" bo\'lmaydi va ".." segmenti qolmaydi', () => {
    for (const input of ['a/b/c.png', '....//x.png', '..', '.', 'a\\..\\b.png']) {
      const out = m.sanitizeOriginalName(input);
      expect(out).not.toMatch(/[\\/]/);
      expect(out).not.toBe('..');
      expect(out).not.toBe('.');
      expect(out.length).toBeGreaterThan(0);
    }
  });

  it('juda uzun nomni 255 belgigacha qisqartiradi va kengaytmani saqlaydi', () => {
    const out = m.sanitizeOriginalName(`${'x'.repeat(500)}.pdf`);
    expect(out.length).toBeLessThanOrEqual(255);
    expect(out.endsWith('.pdf')).toBe(true);
  });

  it('bo\'sh yoki faqat yo\'l bo\'lgan nom uchun bo\'sh bo\'lmagan zaxira nom beradi', () => {
    for (const input of ['', '   ', '../', '/']) {
      expect(m.sanitizeOriginalName(input).length).toBeGreaterThan(0);
    }
  });
});
