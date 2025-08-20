import { Router } from 'express';
import { prisma } from '../prisma.ts';
import { requireAuth } from '../auth/middleware.ts';
import { OrderStatus } from '@prisma/client';
import { z } from 'zod';

export const ordersRouter = Router();

/* ============================================================
   Helpers: validación y transiciones de estado
   ============================================================ */
const FINAL_STATES: OrderStatus[] = [OrderStatus.DELIVERED, OrderStatus.CANCELLED];

// Usamos claves string para evitar fricciones de typing con enums de Prisma
const TRANSITIONS: Record<string, OrderStatus[]> = {
  [OrderStatus.SUBMITTED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.EN_ROUTE,  OrderStatus.CANCELLED],
  [OrderStatus.EN_ROUTE]:  [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return false;
  return (TRANSITIONS[from] ?? []).includes(to);
}

// zod: entrada para crear pedido
const OrderItemInput = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(999),
});
const CreateOrderInput = z.object({
  items: z.array(OrderItemInput).min(1),
  note: z.string().trim().max(500).optional().nullable(),
  emergency: z.boolean().optional(),
});

// zod: entrada para cambio de estado
const ChangeStatusInput = z.object({
  status: z.nativeEnum(OrderStatus),
  // note: z.string().trim().max(500).optional(), // <- descomenta si tu schema de log tiene `note`
});

ordersRouter.use(requireAuth);

/* ============================================================
   GET /orders - historial según rol/alcance
   ============================================================ */
ordersRouter.get('/', async (req: any, res) => {
  const role: string = String(req.user.role || '');
  const userId: number = req.user.id;
  const companyId = Number.isFinite(Number(req.user.companyId)) ? Number(req.user.companyId) : null;

  const where: any = {};
  if (role === 'SUPER_ADMIN') {
    // sin filtros
  } else if (role === 'COMPANY_ADMIN') {
    if (companyId == null) return res.status(400).json({ error: 'Tu usuario no tiene empresa asignada' });
    where.companyId = companyId;
  } else {
    if (companyId == null) return res.status(400).json({ error: 'Tu usuario no tiene empresa asignada' });
    where.companyId = companyId;
    where.userId = userId; // USER solo ve sus pedidos
  }

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      items: { include: { product: { select: { id: true, title: true } } } },
    },
  });

  res.json({
    orders: orders.map(o => ({
      id: o.id,
      status: o.status,
      createdAt: o.createdAt,
      emergency: o.emergency,
      extraCost: o.extraCost,
      items: o.items.map(it => ({
        productId: it.productId,
        quantity: it.quantity,
        productTitle: it.productTitle,
        product: it.product ? { id: it.product.id, title: it.product.title } : null,
      })),
    })),
  });
});

/* ============================================================
   POST /orders - crear pedido
   ============================================================ */
ordersRouter.post('/', async (req: any, res) => {
  const parsed = CreateOrderInput.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload inválido', issues: parsed.error.format() });
  }
  const { items, emergency = false, note } = parsed.data;

  const userId: number = req.user.id;
  const companyIdRaw = req.user.companyId ?? null;
  if (!Number.isFinite(Number(companyIdRaw))) {
    return res.status(400).json({ error: 'Tu usuario no tiene empresa asignada' });
  }
  const companyId = Number(companyIdRaw);

  // Validar productos existentes
  const ids = Array.from(new Set(items.map(i => i.productId)));
  const found = await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, title: true } });
  if (found.length !== ids.length) return res.status(400).json({ error: 'Hay productos inexistentes en el pedido' });

  const titleById = new Map(found.map(p => [p.id, p.title]));

  // Costo emergencia (snapshot)
  let extraCost: number | null = null;
  if (emergency) {
    const cfg = await prisma.globalConfig.findFirst({ where: { id: 1 } }).catch(() => null);
    const c: any = cfg || {};
    extraCost = (c.emergencyExtraCost ?? c.emergencyFeeCLP ?? 0) as number;
  }

  const created = await prisma.$transaction(async tx => {
    const order = await tx.order.create({
      data: {
        companyId,
        userId,
        note: note?.trim() || null,
        emergency,
        extraCost,
        status: OrderStatus.SUBMITTED,
        items: {
          create: items.map(it => ({
            productId: it.productId,
            quantity: it.quantity,
            productTitle: titleById.get(it.productId) || 'Producto',
          })),
        },
      },
      include: { items: true },
    });

    await tx.orderStatusLog.create({
      data: {
        orderId: order.id,
        from: null,
        to: OrderStatus.SUBMITTED,
        changedBy: userId,
        // note: note?.trim() || null, // <- descomenta si tu log tiene campo `note`
      },
    });

    return order;
  });

  res.status(201).json({
    id: created.id,
    status: created.status,
    createdAt: created.createdAt,
    emergency: created.emergency,
    extraCost: created.extraCost,
    items: created.items.map(it => ({
      productId: it.productId,
      quantity: it.quantity,
      productTitle: it.productTitle,
    })),
  });
});

/* ============================================================
   POST /orders/:id/repeat - clonar items
   ============================================================ */
ordersRouter.post('/:id/repeat', async (req: any, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'id inválido' });

  const userId: number = req.user.id;
  const companyIdRaw = req.user.companyId ?? null;
  if (!Number.isFinite(Number(companyIdRaw))) {
    return res.status(400).json({ error: 'Tu usuario no tiene empresa asignada' });
  }
  const companyId = Number(companyIdRaw);

  const base = await prisma.order.findFirst({ where: { id, userId }, include: { items: true } });
  if (!base) return res.status(404).json({ error: 'Pedido no encontrado' });
  if (!base.items.length) return res.status(400).json({ error: 'Pedido base sin ítems' });

  const created = await prisma.$transaction(async tx => {
    const order = await tx.order.create({
      data: {
        companyId,
        userId,
        note: base.note,
        emergency: false,
        extraCost: null,
        status: OrderStatus.SUBMITTED,
        items: {
          create: base.items.map(it => ({
            productId: it.productId,
            quantity: it.quantity,
            productTitle: it.productTitle,
          })),
        },
      },
      include: { items: true },
    });

    await tx.orderStatusLog.create({
      data: {
        orderId: order.id,
        from: null,
        to: OrderStatus.SUBMITTED,
        changedBy: userId,
        // note: null, // <- descomenta si tu log tiene campo `note`
      },
    });

    return order;
  });

  res.status(201).json({
    id: created.id,
    status: created.status,
    createdAt: created.createdAt,
    items: created.items.map(it => ({
      productId: it.productId,
      quantity: it.quantity,
      productTitle: it.productTitle,
    })),
  });
});

/* ============================================================
   PUT /orders/:id/status - cambiar estado (ADMIN)
   Roles permitidos: SUPER_ADMIN, COMPANY_ADMIN
   ============================================================ */
ordersRouter.put('/:id/status', async (req: any, res) => {
  const role = String(req.user.role || '');
  if (!['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(role)) {
    return res.status(403).json({ error: 'FORBIDDEN', detail: 'Rol no autorizado' });
  }

  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'id inválido' });

  const parsed = ChangeStatusInput.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', issues: parsed.error.format() });
  }
  const { status /*, note*/ } = parsed.data;
  const userId: number = req.user.id;
  const companyId: number | null = Number.isFinite(Number(req.user.companyId)) ? Number(req.user.companyId) : null;

  try {
    // Cargar pedido
    const order = await prisma.order.findUnique({
      where: { id },
      select: { id: true, status: true, companyId: true },
    });
    if (!order) return res.status(404).json({ error: 'NOT_FOUND' });

    // Alcance empresa para COMPANY_ADMIN
    if (role === 'COMPANY_ADMIN') {
      if (companyId == null || order.companyId !== companyId) {
        return res.status(403).json({ error: 'FORBIDDEN', detail: 'Fuera del ámbito de tu empresa' });
      }
    }

    if (FINAL_STATES.includes(order.status)) {
      return res.status(409).json({ error: 'ORDER_FINAL_STATE', detail: `Ya finalizado: ${order.status}` });
    }
    if (!canTransition(order.status, status)) {
      return res.status(409).json({ error: 'INVALID_TRANSITION', detail: `${order.status} -> ${status}` });
    }

    // Transacción: update + log
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.order.update({
        where: { id },
        data: { status },
        select: { id: true, status: true, updatedAt: true, companyId: true, userId: true },
      });

      await tx.orderStatusLog.create({
        data: {
          orderId: id,
          from: order.status,
          to: status,
          changedBy: userId,
          // note: note ?? null, // <- descomenta si tu log tiene `note`
        },
      });

      return u;
    });

    // Línea de tiempo
    const timeline = await prisma.orderStatusLog.findMany({
      where: { orderId: id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, from: true, to: true, changedBy: true, createdAt: true /*, note: true*/ },
    });

    return res.json({ ok: true, order: { ...updated, statusLogs: timeline } });
  } catch (e: any) {
    console.error('[ORDERS][:id/status] error', e);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

/* ============================================================
   GET /orders/:id - detalle del pedido + timeline
   ============================================================ */
ordersRouter.get('/:id', async (req: any, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'id inválido' });

  const auth = req.user as { id: number; companyId?: number; role?: string };

  // Cargar pedido con ítems
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: { select: { id: true, productId: true, quantity: true, productTitle: true } },
    },
  });
  if (!order) return res.status(404).json({ error: 'NOT_FOUND' });

  // Autorización: dueño, o ADMIN de misma empresa, o SUPER_ADMIN
  const isOwner = order.userId === auth.id;
  const isAdmin = auth?.role === 'COMPANY_ADMIN' || auth?.role === 'SUPER_ADMIN';
  const sameCompany = Number.isFinite(Number(auth.companyId)) && order.companyId === Number(auth.companyId);

  if (!(isOwner || (isAdmin && sameCompany))) {
    // puedes cambiar a 404 si prefieres ocultar existencia
    return res.status(403).json({ error: 'FORBIDDEN' });
  }

  const timeline = await prisma.orderStatusLog.findMany({
    where: { orderId: id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, from: true, to: true, changedBy: true, createdAt: true /*, note: true*/ },
  });

  return res.json({
    order: {
      id: order.id,
      status: order.status,
      createdAt: order.createdAt,
      emergency: order.emergency,
      extraCost: order.extraCost,
      items: order.items,
      statusLogs: timeline,
    },
  });
});
