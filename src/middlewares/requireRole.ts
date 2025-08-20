// src/middlewares/requireRole.ts
import type { Request, Response, NextFunction } from 'express';

export type Role = 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'USER';

export function requireRole(...allowed: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = (req as any).user?.role as Role | undefined;
    if (!role) return res.status(401).json({ error: 'UNAUTHENTICATED' });

    if (!allowed.includes(role)) {
      return res.status(403).json({ error: 'FORBIDDEN', detail: `Role ${role} not allowed` });
    }
    next();
  };
}
