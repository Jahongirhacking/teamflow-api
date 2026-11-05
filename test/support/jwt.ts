import jwt from 'jsonwebtoken';

export function jwtSecret(): string {
  return process.env.JWT_SECRET as string;
}

/** Test uchun token yasaydi. Kontrakt: foydalanuvchi identifikatori `sub` claim'ida. */
export function signToken(
  payload: Record<string, unknown>,
  options: jwt.SignOptions & { secret?: string } = {},
): string {
  const { secret, ...signOptions } = options;
  return jwt.sign(payload, secret ?? jwtSecret(), { expiresIn: '5m', ...signOptions });
}

/** `alg: none` - imzosiz token (rad etilishi shart). */
export function unsignedToken(payload: Record<string, unknown>): string {
  const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${enc({ alg: 'none', typ: 'JWT' })}.${enc(payload)}.`;
}
