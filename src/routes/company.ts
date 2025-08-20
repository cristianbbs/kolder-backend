// kolder-backend/src/routes/company.ts
import { Router } from 'express';
import { prisma } from '../prisma.ts';
import { requireAuth, requireRole } from '../auth/middleware.ts';
import { Role } from '@prisma/client';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { sendProvisionalPassword } from '../utils/email.ts';
import { generateProvisionalPassword } from '../utils/password.ts';

export const companyRouter = Router();

/* --------------------------------- Helpers -------------------------------- */
function parseId(s: any) {
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function err(res: any, status: number, code: string, message: string, issues?: unknown) {
  const body: any = { ok: false, code, message };
  if (issues !== undefined) body.issues = issues;
  return res.status(status).json(body);
}

/** Retorna true si el actor puede operar sobre companyId; si no, responde 403. */
function assertScopeOr403(req: any, res: any, companyId: number) {
  const role: Role | undefined = req.user?.role;
  const userCompanyId = req.user?.companyId ?? null;
  if (role === Role.SUPER_ADMIN) return true;
  if (role === Role.COMPANY_ADMIN && Number(userCompanyId) === companyId) return true;
  err(res, 403, 'FORBIDDEN', 'Fuera del alcance de tu empresa');
  return false;
}

/* ------------------------------- Perfil propio ---------------------------- */
companyRouter.get('/me', requireAuth, async (req: any, res) => {
  const userId: number = req.user.id;
  const me = await prisma.user.findUnique({ where: { id: userId }, include: { company: true } });
  if (!me) return err(res, 404, 'NOT_FOUND', 'Usuario no encontrado');
  const company = me.company ? { id: me.company.id, name: me.company.name } : null;
  res.json({ ok: true, profile: { id: me.id, email: me.email, name: me.name, role: me.role, company } });
});

/* ------------------------------- Listar usuarios -------------------------- */
companyRouter.get(
  '/users',
  requireAuth,
  requireRole(Role.COMPANY_ADMIN, Role.SUPER_ADMIN),
  async (req: any, res) => {
    const role: Role = req.user.role;
    let companyId = Number(req.user.companyId ?? NaN);

    if (role === Role.SUPER_ADMIN) {
      const q = parseId(req.query.companyId);
      if (!q) return err(res, 400, 'COMPANY_ID_REQUIRED', 'companyId requerido para SUPER_ADMIN');
      companyId = q;
    } else {
      if (!Number.isFinite(companyId)) return err(res, 400, 'NO_COMPANY', 'Sin empresa');
    }

    const users = await prisma.user.findMany({
      where: { companyId },
      select: {
        id: true, name: true, email: true, phone: true, role: true,
        isBlocked: true, mustChangePassword: true,
      },
    });
    res.json({ ok: true, companyId, users });
  }
);

/* ------------------------------- Alta de usuario -------------------------- */
const CreateUserInput = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  companyId: z.number().int().positive().optional(),
});

companyRouter.post(
  '/users',
  requireAuth,
  requireRole(Role.COMPANY_ADMIN, Role.SUPER_ADMIN),
  async (req: any, res) => {
    const parsed = CreateUserInput.safeParse(req.body);
    if (!parsed.success) {
      return err(res, 400, 'BAD_BODY', 'Validación', parsed.error.format());
    }

    const role: Role = req.user.role;
    let companyId = Number(req.user.companyId ?? NaN);

    if (role === Role.SUPER_ADMIN) {
      const cid = parsed.data.companyId;
      if (!cid) return err(res, 400, 'COMPANY_ID_REQUIRED', 'companyId es requerido (SUPER_ADMIN)');
      companyId = cid;
    } else {
      if (!Number.isFinite(companyId)) return err(res, 400, 'NO_COMPANY', 'Sin empresa');
    }

    const count = await prisma.user.count({ where: { companyId, role: 'USER' } });
    if (count >= 10) return err(res, 400, 'LIMIT_REACHED', 'Límite de 10 usuarios alcanzado');

    const provisional = generateProvisionalPassword();
    const hash = await bcrypt.hash(provisional, 10);

    let created;
    try {
      created = await prisma.user.create({
        data: {
          name: parsed.data.name,
          email: parsed.data.email.toLowerCase(),
          phone: parsed.data.phone ?? null,
          role: 'USER',
          companyId,
          passwordHash: hash,
          mustChangePassword: true,
          provisionalExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        },
      });
    } catch (e: any) {
      if (String(e?.code) === 'P2002') return err(res, 409, 'EMAIL_TAKEN', 'Email ya existente');
      throw e;
    }

    try { await sendProvisionalPassword(created.email, provisional); } catch {}

    const devLeak = process.env.RETURN_PROVISIONAL_IN_RESPONSE === '1' ? { provisional } : {};
    res.json({ ok: true, id: created.id, companyId, ...devLeak });
  }
);

/* -------- Reemitir contraseña provisoria (dev-friendly leakage opcional) -- */
companyRouter.post(
  '/users/:id/reissue-provisional',
  requireAuth,
  requireRole(Role.COMPANY_ADMIN, Role.SUPER_ADMIN),
  async (req: any, res) => {
    const role: Role = req.user.role;
    let scopeCompanyId = Number(req.user.companyId ?? NaN);

    if (role === Role.SUPER_ADMIN) {
      const q = parseId(req.query.companyId);
      if (q) scopeCompanyId = q;
    } else if (!Number.isFinite(scopeCompanyId)) {
      return err(res, 400, 'NO_COMPANY', 'Sin empresa');
    }

    const uid = parseId(req.params.id);
    if (!uid) return err(res, 400, 'BAD_ID', 'id inválido');

    const target = await prisma.user.findUnique({ where: { id: uid } });
    if (!target) return err(res, 404, 'NOT_FOUND', 'Usuario no encontrado');

    if (role !== Role.SUPER_ADMIN && target.companyId !== scopeCompanyId) {
      return err(res, 403, 'FORBIDDEN', 'Fuera del alcance de tu empresa');
    }
    if (target.role !== 'USER') {
      return err(res, 400, 'ONLY_USER', 'Solo usuarios de rol USER');
    }

    const provisional = generateProvisionalPassword();
    const hash = await bcrypt.hash(provisional, 10);
    const until = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: uid },
      data: {
        passwordHash: hash,
        mustChangePassword: true,
        provisionalExpiresAt: until,
        isBlocked: false,
      },
    });

    try { await sendProvisionalPassword(target.email, provisional); } catch {}

    const devLeak = process.env.RETURN_PROVISIONAL_IN_RESPONSE === '1' ? { provisional } : {};
    return res.json({ ok: true, id: uid, until, ...devLeak });
  }
);

/* -------------------------------- Baja usuario ---------------------------- */
companyRouter.delete(
  '/users/:id',
  requireAuth,
  requireRole(Role.COMPANY_ADMIN, Role.SUPER_ADMIN),
  async (req: any, res) => {
    const role: Role = req.user.role;
    let scopeCompanyId = Number(req.user.companyId ?? NaN);

    if (role === Role.SUPER_ADMIN) {
      const q = parseId(req.query.companyId);
      if (q) scopeCompanyId = q;
    } else {
      if (!Number.isFinite(scopeCompanyId)) return err(res, 400, 'NO_COMPANY', 'Sin empresa');
    }

    const id = parseId(req.params.id);
    if (!id) return err(res, 400, 'BAD_ID', 'id inválido');

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return err(res, 404, 'NOT_FOUND', 'Usuario no encontrado');

    if (role !== Role.SUPER_ADMIN && user.companyId !== scopeCompanyId) {
      return err(res, 403, 'FORBIDDEN', 'Fuera del alcance de tu empresa');
    }
    if (user.role === 'COMPANY_ADMIN' && role !== Role.SUPER_ADMIN) {
      return err(res, 400, 'NOT_ALLOWED', 'No permitido eliminar COMPANY_ADMIN sin SUPER_ADMIN');
    }

    await prisma.user.delete({ where: { id } });
    res.json({ ok: true });
  }
);

/* ------------------- Allowed-products (presencia = habilitado) ------------- */
companyRouter.get(
  '/allowed-products',
  requireAuth,
  requireRole(Role.COMPANY_ADMIN, Role.SUPER_ADMIN),
  async (req: any, res) => {
    const role: Role = req.user.role;
    let companyId = Number(req.user.companyId ?? NaN);
    if (role === Role.SUPER_ADMIN) {
      const q = parseId(req.query.companyId);
      if (!q) return err(res, 400, 'COMPANY_ID_REQUIRED', 'companyId requerido para SUPER_ADMIN');
      companyId = q;
    } else if (!Number.isFinite(companyId)) {
      return err(res, 400, 'NO_COMPANY', 'Sin empresa');
    }

    const cats = await prisma.category.findMany({ include: { products: true } });
    const allowed = await prisma.companyProduct.findMany({
      where: { companyId },
      select: { productId: true },
    });
    const allowedSet = new Set(allowed.map(a => a.productId));

    res.json({
      ok: true,
      companyId,
      categories: cats.map(c => ({
        id: c.id,
        name: c.name,
        products: c.products.map(p => ({
          id: p.id,
          title: p.title,
          detail: p.detail,
          imageUrl: p.imageUrl,
          allowed: allowedSet.has(p.id),
        })),
      })),
    });
  }
);

companyRouter.post(
  '/allowed-products',
  requireAuth,
  requireRole(Role.COMPANY_ADMIN, Role.SUPER_ADMIN),
  async (req: any, res) => {
    const schema = z.object({ productIds: z.array(z.number().int().positive()) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return err(res, 400, 'BAD_BODY', 'Validación', parsed.error.format());

    const role: Role = req.user.role;
    let companyId = Number(req.user.companyId ?? NaN);
    if (role === Role.SUPER_ADMIN) {
      const q = parseId(req.query.companyId);
      if (!q) return err(res, 400, 'COMPANY_ID_REQUIRED', 'companyId requerido para SUPER_ADMIN');
      companyId = q;
    } else if (!Number.isFinite(companyId)) {
      return err(res, 400, 'NO_COMPANY', 'Sin empresa');
    }

    await prisma.companyProduct.deleteMany({ where: { companyId } });
    const uniqueIds = Array.from(new Set(parsed.data.productIds));
    if (uniqueIds.length) {
      await prisma.companyProduct.createMany({
        data: uniqueIds.map(pid => ({ companyId, productId: pid })),
      });
    }

    res.json({ ok: true, companyId, enabledCount: uniqueIds.length });
  }
);

/* ---------------------- Endpoints REST por empresa (opcional) ------------- */
companyRouter.get(
  '/:id/products/enabled',
  requireAuth,
  requireRole(Role.SUPER_ADMIN, Role.COMPANY_ADMIN),
  async (req: any, res) => {
    const companyId = parseId(req.params.id);
    if (!companyId) return err(res, 400, 'BAD_ID', 'companyId inválido');
    if (!assertScopeOr403(req, res, companyId)) return;

    const rows = await prisma.companyProduct.findMany({
      where: { companyId },
      select: { productId: true },
    });
    return res.json({ ok: true, companyId, enabledProductIds: rows.map(r => r.productId) });
  }
);

const PutEnabledInput = z.object({
  productIds: z.array(z.number().int().positive()).max(10000),
});

companyRouter.put(
  '/:id/products/enabled',
  requireAuth,
  requireRole(Role.SUPER_ADMIN, Role.COMPANY_ADMIN),
  async (req: any, res) => {
    const companyId = parseId(req.params.id);
    if (!companyId) return err(res, 400, 'BAD_ID', 'companyId inválido');
    if (!assertScopeOr403(req, res, companyId)) return;

    const parsed = PutEnabledInput.safeParse(req.body);
    if (!parsed.success) return err(res, 400, 'BAD_BODY', 'Validación', parsed.error.format());

    const distinct = Array.from(new Set(parsed.data.productIds));

    const found = await prisma.product.findMany({
      where: { id: { in: distinct.length ? distinct : [-1] } },
      select: { id: true },
    });
    const foundSet = new Set(found.map(p => p.id));
    const invalid = distinct.filter(id => !foundSet.has(id));
    if (invalid.length) return err(res, 400, 'PRODUCT_NOT_FOUND', 'IDs inválidos', { invalid });

    const current = await prisma.companyProduct.findMany({
      where: { companyId },
      select: { productId: true },
    });
    const cur = new Set(current.map(r => r.productId));
    const target = new Set(distinct);

    const toCreate = [...target].filter(id => !cur.has(id));
    const toDelete = [...cur].filter(id => !target.has(id));

    await prisma.$transaction([
      ...(toDelete.length
        ? [prisma.companyProduct.deleteMany({ where: { companyId, productId: { in: toDelete } } })]
        : []),
      ...(toCreate.length
        ? [prisma.companyProduct.createMany({ data: toCreate.map(pid => ({ companyId, productId: pid })) })]
        : []),
    ]);

    const rows = await prisma.companyProduct.findMany({
      where: { companyId },
      select: { productId: true },
    });

    console.log('[COMPANY][products][PUT]', {
      by: req.user?.id, role: req.user?.role, companyId,
      added: toCreate, removed: toDelete,
    });

    return res.json({
      ok: true,
      companyId,
      enabledProductIds: rows.map(r => r.productId),
      changed: { enabled: toCreate, disabled: toDelete },
    });
  }
);

const ToggleInput = z.object({
  productId: z.number().int().positive(),
  enabled: z.boolean(),
});

companyRouter.patch(
  '/:id/products/toggle',
  requireAuth,
  requireRole(Role.SUPER_ADMIN, Role.COMPANY_ADMIN),
  async (req: any, res) => {
    const companyId = parseId(req.params.id);
    if (!companyId) return err(res, 400, 'BAD_ID', 'companyId inválido');
    if (!assertScopeOr403(req, res, companyId)) return;

    const parsed = ToggleInput.safeParse(req.body);
    if (!parsed.success) {
      return err(res, 400, 'BAD_BODY', 'Validación', parsed.error.format());
    }
    const { productId, enabled } = parsed.data;

    const exists = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!exists) return err(res, 400, 'PRODUCT_NOT_FOUND', 'Producto inexistente', { productId });

    if (enabled) {
      await prisma.companyProduct.upsert({
        where: { companyId_productId: { companyId, productId } },
        update: {},
        create: { companyId, productId },
      });
    } else {
      await prisma.companyProduct.deleteMany({ where: { companyId, productId } });
    }

    console.log('[COMPANY][products][PATCH]', {
      by: req.user?.id, role: req.user?.role, companyId, productId, enabled,
    });

    return res.json({ ok: true, companyId, productId, enabled });
  }
);

export default companyRouter;
