// src/auth/jwt.ts
import jwt, { type SignOptions } from 'jsonwebtoken';

/**
 * Importante:
 * - Usamos el MISMO secreto que el middleware (sin fallback distinto) para evitar "Invalid token".
 * - Si falta, preferimos fallar en arranque (te obliga a configurar .env).
 */
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET no configurado. Define JWT_SECRET en tu .env');
}

/** Claims que nos interesan (aceptamos extra) */
export type AuthClaims = {
  uid: number;          // compat con clientes que esperan uid
  role: string;
  sub?: string;         // estándar JWT (string)
  [k: string]: any;     // permitir claims adicionales sin romper
};

/**
 * Firma un token con `sub` (string) + `uid` (number) + `role`.
 * Mantiene compatibilidad y alinea con el estándar.
 */
export function signToken(
  payload: { uid: number; role: string },
  options: SignOptions = { expiresIn: '7d' }
): string {
  const claims: AuthClaims = {
    sub: String(payload.uid),   // estándar
    uid: payload.uid,           // compat
    role: payload.role,
  };
  return jwt.sign(claims, JWT_SECRET, options);
}

/**
 * Verifica y devuelve los claims relevantes. Es tolerante a claims extra.
 * Útil si en algún punto quieres validar tokens fuera del middleware.
 */
export function verifyToken(token: string): AuthClaims {
  const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
  if (typeof decoded === 'string') throw new Error('Invalid token payload');

  // Normalizamos uid/role, y conservamos sub si viene
  const any = decoded as Record<string, any>;
  const uidRaw = any.uid ?? any.userId ?? any.id ?? (any.sub ? Number(any.sub) : undefined);

  const uid = typeof uidRaw === 'string' ? Number(uidRaw) : uidRaw;
  const role = any.role;

  if (!Number.isFinite(uid) || typeof role !== 'string') {
    throw new Error('Invalid token payload (uid/role)');
  }

  return {
    ...any,
    uid,
    role,
    sub: typeof any.sub === 'string' ? any.sub : String(uid),
  } as AuthClaims;
}
