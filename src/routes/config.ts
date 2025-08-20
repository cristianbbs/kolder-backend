// kolder-backend/src/routes/config.ts
import { Router } from 'express';
import { prisma } from '../prisma.ts';
import { requireAuth, requireRole } from '../auth/middleware.ts';
import { z } from 'zod';

export const configRouter = Router();

/** Normaliza la fila a forma canónica + campos legados opcionales (solo lectura) */
function normalizeEmergency(row: any) {
  const c: any = row || {};

  const rawExtra =
    c.emergencyExtraCost ??
    c.emergencyFeeCLP ??   // legado (si existiera)
    c.extraCost ??         // por si existiera
    null;

  const extraCost =
    typeof rawExtra === 'number'
      ? rawExtra
      : rawExtra != null
        ? Number(rawExtra)
        : null;

  const hours =
    c.emergencyHours ??
    c.emergencySchedule ?? // legado (si existiera)
    c.hours ??
    null;

  const days =
    c.emergencyDays ??
    c.days ??
    null;

  return {
    // canónico
    extraCost,
    hours,
    days,
    // compat salida (no persistimos estas columnas si no existen)
    emergencyFeeCLP: typeof extraCost === 'number' ? extraCost : undefined,
    emergencySchedule: hours ?? undefined,
  };
}

/* -------------------- GET /config/emergency --------------------
   Mantiene requireAuth (tu decisión original).
----------------------------------------------------------------- */
configRouter.get('/emergency', requireAuth, async (_req, res) => {
  const row = await prisma.globalConfig.findFirst().catch(() => null);
  return res.json(normalizeEmergency(row));
});

/* -------------------- PUT /config/emergency --------------------
   Requiere: SUPER_ADMIN o COMPANY_ADMIN
   Escribe SOLO columnas reales: emergencyExtraCost, emergencyHours, emergencyDays
----------------------------------------------------------------- */
const EmergencyConfigInput = z.object({
  extraCost: z.number().nonnegative().nullable().optional(),
  hours: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/, 'Formato HH:MM-HH:MM')
    .nullable()
    .optional(),
  days: z.string().trim().min(1).nullable().optional(),
}).refine(obj => Object.keys(obj).length > 0, { message: 'Debe enviar al menos un campo' });

configRouter.put(
  '/emergency',
  requireAuth,
  requireRole('SUPER_ADMIN', 'COMPANY_ADMIN'),
  async (req: any, res) => {
    const parsed = EmergencyConfigInput.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validación', issues: parsed.error.format() });
    }
    const { extraCost, hours, days } = parsed.data;

    // ⚠️ Escribimos SOLO columnas existentes en tu schema
    const updateData: any = {};
    if (extraCost !== undefined) updateData.emergencyExtraCost = extraCost;
    if (hours !== undefined)     updateData.emergencyHours    = hours;
    if (days !== undefined)      updateData.emergencyDays     = days;

    // Upsert manual: si hay fila, update; si no, create
    const current = await prisma.globalConfig.findFirst();
    const saved = current
      ? await prisma.globalConfig.update({ where: { id: current.id }, data: updateData })
      : await prisma.globalConfig.create({ data: updateData });

    console.log('[CONFIG][emergency][PUT]', {
      by: req.user?.id,
      role: req.user?.role,
      payload: { extraCost, hours, days },
    });

    return res.json(normalizeEmergency(saved));
  }
);
