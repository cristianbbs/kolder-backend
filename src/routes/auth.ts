import { Router } from 'express';
import { prisma } from '../prisma.ts';
import bcrypt from 'bcryptjs';
import dayjs from 'dayjs';
import { z } from 'zod';
import { signToken } from '../auth/jwt.ts';
import { requireAuth } from '../auth/middleware.ts';

export const authRouter = Router();

// POST /auth/login
authRouter.post('/login', async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
  });
  const { email, password } = schema.parse(req.body);

  // Normaliza email por si hay mayúsculas
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { company: true },
  });

  if (!user || user.isBlocked) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });

  // Enforcements de contraseña provisoria
  if (user.mustChangePassword) {
    if (!user.provisionalExpiresAt || dayjs().isAfter(user.provisionalExpiresAt)) {
      await prisma.user.update({ where: { id: user.id }, data: { isBlocked: true } });
      return res.status(403).json({ error: 'Contraseña provisoria expirada. Solicita una nueva.' });
    }
  }

  // 👇 NO pases `sub` aquí; signToken ya lo agrega internamente.
  const token = signToken({
    uid: user.id,
    role: user.role,
  });

  return res.json({
    token,
    mustChangePassword: user.mustChangePassword,
    profile: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      company: user.company
        ? {
            id: user.company.id,
            name: user.company.name,
            contactName: user.company.contactName ?? null,
          }
        : null,
    },
  });
});

// GET /auth/me  → perfil con company/contactName
authRouter.get('/me', requireAuth, async (req: any, res) => {
  const uid: number = req.user.id;

  const user = await prisma.user.findUnique({
    where: { id: uid },
    include: { company: true },
  });
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  return res.json({
    profile: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      company: user.company
        ? {
            id: user.company.id,
            name: user.company.name,
            contactName: user.company.contactName ?? null,
          }
        : null,
    },
  });
});

// POST /auth/change-password
authRouter.post('/change-password', requireAuth, async (req: any, res) => {
  const schema = z.object({
    oldPassword: z.string().min(6),
    newPassword: z.string().min(8),
  });
  const { oldPassword, newPassword } = schema.parse(req.body);
  const uid: number = req.user.id;

  const user = await prisma.user.findUnique({ where: { id: uid } });
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  const ok = await bcrypt.compare(oldPassword, user.passwordHash);
  if (!ok) return res.status(400).json({ error: 'Contraseña actual incorrecta' });

  const hash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: uid },
    data: {
      passwordHash: hash,
      mustChangePassword: false,
      provisionalExpiresAt: null,
      isBlocked: false,
    },
  });

  res.json({ ok: true });
});
