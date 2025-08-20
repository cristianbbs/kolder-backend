// kolder-backend/src/auth/middleware.ts
import type { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma.ts';
import { Role } from '@prisma/client';

// Flags (ON salvo que pongas 0)
const ENFORCE_PASSWORD_CHANGE = process.env.ENFORCE_PASSWORD_CHANGE !== '0';
const ENFORCE_PROVISIONAL_EXPIRY = process.env.ENFORCE_PROVISIONAL_EXPIRY !== '0';

// Payload flexible (id | userId | uid | sub | email)
type JwtPayload = {
  id?: number;
  userId?: number;
  uid?: number;
  sub?: string | number;
  role?: Role;
  email?: string;
};

function nowMs() {
  return Date.now();
}

export async function requireAuth(req: any, res: Response, next: NextFunction) {
  try {
    const auth = req.headers?.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ error: 'JWT secret no configurado' });

    const payload = jwt.verify(token, secret) as JwtPayload;

    // Resolver userId del token (acepta userId, id, uid, sub numérico)
    const claimed =
      payload?.userId ??
      payload?.id ??
      payload?.uid ??
      (typeof payload?.sub === 'string' ? Number(payload.sub) : payload?.sub);

    let user:
      | {
          id: number;
          email: string;
          role: Role;
          companyId: number | null;
          isBlocked: boolean;
          mustChangePassword: boolean;
          provisionalExpiresAt: Date | null;
        }
      | null = null;

    if (claimed && Number.isFinite(Number(claimed))) {
      user = await prisma.user.findUnique({
        where: { id: Number(claimed) },
        select: {
          id: true,
          email: true,
          role: true,
          companyId: true,
          isBlocked: true,
          mustChangePassword: true,
          provisionalExpiresAt: true,
        },
      });
    } else if (payload?.email) {
      user = await prisma.user.findUnique({
        where: { email: String(payload.email).toLowerCase() },
        select: {
          id: true,
          email: true,
          role: true,
          companyId: true,
          isBlocked: true,
          mustChangePassword: true,
          provisionalExpiresAt: true,
        },
      });
    }

    if (!user) return res.status(401).json({ error: 'Token inválido (sin user id)' });
    if (user.isBlocked) return res.status(403).json({ error: 'Usuario bloqueado' });

    // --- Permitir SIEMPRE /auth/change-password aún con mustChangePassword=true ---
    // Como montas el router con app.use('/auth', ...):
    //   req.baseUrl = '/auth'
    //   req.path    = '/change-password'
    //   req.originalUrl = '/auth/change-password'
    const method = String(req.method || '').toUpperCase();
    const path = String(req.path || '');
    const baseUrl = String(req.baseUrl || '');
    const originalUrl = String(req.originalUrl || '');
    const isChangePassword =
      method === 'POST' &&
      (
        path === '/change-password' ||
        (baseUrl === '/auth' && path === '/change-password') ||
        originalUrl.endsWith('/auth/change-password')
      );

    if (ENFORCE_PASSWORD_CHANGE && user.mustChangePassword && !isChangePassword) {
      if (ENFORCE_PROVISIONAL_EXPIRY && user.provisionalExpiresAt) {
        const expired = nowMs() > new Date(user.provisionalExpiresAt).getTime();
        if (expired) {
          return res.status(403).json({
            error: 'Contraseña provisoria expirada. Solicita reemisión.',
            code: 'PROVISIONAL_EXPIRED',
          });
        }
      }
      return res.status(403).json({
        error: 'Debes cambiar tu contraseña antes de continuar.',
        code: 'PASSWORD_CHANGE_REQUIRED',
      });
    }

    // req.user para el resto de rutas
    req.user = {
      id: user.id,
      companyId: user.companyId ?? null,
      role: user.role,
      email: user.email,
    };

    return next();
  } catch (e: any) {
    if (e?.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado' });
    }
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

export function requireRole(...allowed: Role[]) {
  return (req: any, res: Response, next: NextFunction) => {
    const r: Role | undefined = req?.user?.role;
    if (!r) return res.status(401).json({ error: 'Unauthorized' });
    if (!allowed.includes(r)) return res.status(403).json({ error: 'Forbidden' });
    return next();
  };
}

export function requireCompany(req: any, res: Response, next: NextFunction) {
  const cid = req?.user?.companyId;
  if (!Number.isFinite(Number(cid))) {
    return res.status(400).json({ error: 'Tu usuario no tiene empresa asignada' });
  }
  return next();
}
