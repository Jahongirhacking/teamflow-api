/** Test fayllari (fixtures). Barchasi xotirada hosil qilinadi - diskda binary fayl saqlanmaydi. */

const PNG_1X1_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

export const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export const fixtures = {
  /** Haqiqiy 1x1 PNG */
  png: (): Buffer => Buffer.from(PNG_1X1_BASE64, 'base64'),

  /** JPEG signaturasi (SOI + JFIF APP0 + EOI) */
  jpeg: (): Buffer =>
    Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01,
      0x00, 0x00, 0xff, 0xd9,
    ]),

  pdf: (): Buffer =>
    Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n'),

  text: (content = 'Salom, TeamFlow!\n'): Buffer => Buffer.from(content, 'utf8'),

  /** Kengaytmasi .png, lekin ichida PHP kodi */
  phpDisguisedAsPng: (): Buffer => Buffer.from("<?php system($_GET['cmd']); ?>"),

  /** Windows bajariladigan fayl sarlavhasi (MZ) */
  exe: (): Buffer => Buffer.concat([Buffer.from('MZ'), Buffer.alloc(64, 0)]),

  /** Skript ichiga joylashtirilgan SVG (XSS vektori) */
  svgWithScript: (): Buffer =>
    Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script></svg>'),

  /** Matn kengaytmasi, lekin ichida binary (NUL baytlar) */
  binaryDisguisedAsText: (): Buffer => Buffer.from([0x00, 0x01, 0x02, 0x03, 0x00, 0xff, 0xfe, 0x00]),

  /** Haqiqiy PNG sarlavhasi bilan boshlanadigan, berilgan hajmdagi buffer */
  pngOfSize: (bytes: number): Buffer => {
    const buf = Buffer.alloc(bytes, 0);
    PNG_SIGNATURE.copy(buf);
    return buf;
  },
};

export const DEFAULT_MAX_UPLOAD = 5 * 1024 * 1024;
