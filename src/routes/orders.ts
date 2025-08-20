import { Router } from 'express';
import { prisma } from '../prisma.ts';
import { requireAuth } from '../auth/middleware.ts';
import { OrderStatus } from '@prisma/client';
import { z } from 'zod';

export const ordersRouter = Router();

/* ========================== Helpers: errores y transiciones ========================== */
function err(res: any, status: number, code: string, message: string, issues?: unknown) {
  const body: any = { ok: false, code, message };
  if (issues !== undefined) body.issues = issues;
  return res.status(status).json(body);
}

const FINAL_STATES: OrderStatus[] = [OrderStatus.DELIVERED, OrderStatus.CANCELLED];

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

/* ========================== Zod schemas ========================== */
const OrderItemInput = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(999),
});
const CreateOrderInput = z.object({
  items: z.array(OrderItemInput).min(1),
  note: z.string().trim().max(500).optional().nullable(),
  emergency: z.boolean().optional(),
});

const ChangeStatusInput = z.object({
  status: z.nativeEnum(OrderStatus),
});

ordersRouter.use(requireAuth);

/* ========================== GET /orders (alcance por rol) ========================== */
ordersRouter.get('/', async (req: any, res) => {
  const role: string = String(req.user.role || '');
  const userId: number = req.user.id;
  const companyId = Number.isFinite(Number(req.user.companyId)) ? Number(req.user.companyId) : null;

  const where: any = {};
  if (role === 'SUPER_ADMIN') {
    // sin filtros
  } else if (role === 'COMPANY_ADMIN') {
    if (companyId == null) return err(res, 400, 'NO_COMPANY', 'Tu usuario no tiene empresa asignada');
    where.companyId = companyId;
  } else {
    if (companyId == null) return err(res, 400, 'NO_COMPANY', 'Tu usuario no tiene empresa asignada');
    where.companyId = companyId;
    where.userId = userId; // USER solo ve sus pedidos
  }

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { items: { include: { product: { select: { id: true, title: true } } } } },
  });

  res.json({
    ok: true,
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

/* ========================== POST /orders (crear pedido) ========================== */
ordersRouter.post('/', async (req: any, res) => {
  const parsed = CreateOrderInput.safeParse(req.body);
  if (!parsed.success) return err(res, 400, 'BAD_BODY', 'Payload inválido', parsed.error.format());

  const { items, emergency = false, note } = parsed.data;
  const userId: number = req.user.id;
  const companyIdRaw = req.user.companyId ?? null;
  if (!Number.isFinite(Number(companyIdRaw))) return err(res, 400, 'NO_COMPANY', 'Tu usuario no tiene empresa asignada');
  const companyId = Number(companyIdRaw);

  const ids = Array.from(new Set(items.map(i => i.productId)));
  const found = await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, title: true } });
  if (found.length !== ids.length) return err(res, 400, 'PRODUCT_NOT_FOUND', 'Hay productos inexistentes en el pedido');

  const titleById = new Map(found.map(p => [p.id, p.title]));

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
      data: { orderId: order.id, from: null, to: OrderStatus.SUBMITTED, changedBy: userId },
    });

    return order;
  });

  res.status(201).json({
    ok: true,
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

/* ========================== POST /orders/:id/repeat ========================== */
ordersRouter.post('/:id/repeat', async (req: any, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return err(res, 400, 'BAD_ID', 'id inválido');

  const userId: number = req.user.id;
  const companyIdRaw = req.user.companyId ?? null;
  if (!Number.isFinite(Number(companyIdRaw))) return err(res, 400, 'NO_COMPANY', 'Tu usuario no tiene empresa asignada');
  const companyId = Number(companyIdRaw);

  const base = await prisma.order.findFirst({ where: { id, userId }, include: { items: true } });
  if (!base) return err(res, 404, 'NOT_FOUND', 'Pedido no encontrado');
  if (!base.items.length) return err(res, 400, 'BASE_EMPTY', 'Pedido base sin ítems');

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
      data: { orderId: order.id, from: null, to: OrderStatus.SUBMITTED, changedBy: userId },
    });

    return order;
  });

  res.status(201).json({
    ok: true,
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

/* ========================== PUT /orders/:id/status (ADMIN) ========================== */
ordersRouter.put('/:id/status', async (req: any, res) => {
  const role = String(req.user.role || '');
  if (!['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(role)) {
    return err(res, 403, 'FORBIDDEN', 'Solo COMPANY_ADMIN/SUPER_ADMIN');
  }

  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return err(res, 400, 'BAD_ID', 'id inválido');

  const parsed = ChangeStatusInput.safeParse(req.body);
  if (!parsed.success) return err(res, 400, 'BAD_BODY', 'Payload inválido', parsed.error.format());

  const { status } = parsed.data;
  const userId: number = req.user.id;
  const companyId: number | null = Number.isFinite(Number(req.user.companyId)) ? Number(req.user.companyId) : null;

  try {
    const order = await prisma.order.findUnique({ where: { id }, select: { id: true, status: true, companyId: true } });
    if (!order) return err(res, 404, 'NOT_FOUND', 'Pedido no encontrado');

    // COMPANY_ADMIN fuera de su empresa => 404 (no revelar existencia)
    if (role === 'COMPANY_ADMIN') {
      if (companyId == null || order.companyId !== companyId) {
        return err(res, 404, 'NOT_FOUND', 'Pedido no encontrado');
      }
    }

    if (FINAL_STATES.includes(order.status)) {
      return err(res, 409, 'ORDER_FINAL_STATE', `Ya finalizado: ${order.status}`);
    }
    if (!canTransition(order.status, status)) {
      return err(res, 409, 'INVALID_TRANSITION', `${order.status} -> ${status}`);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.order.update({
        where: { id },
        data: { status },
        select: { id: true, status: true, updatedAt: true, companyId: true, userId: true },
      });
      await tx.orderStatusLog.create({ data: { orderId: id, from: order.status, to: status, changedBy: userId } });
      return u;
    });

    const timeline = await prisma.orderStatusLog.findMany({
      where: { orderId: id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, from: true, to: true, changedBy: true, createdAt: true },
    });

    return res.json({ ok: true, order: { ...updated, statusLogs: timeline } });
  } catch (e: any) {
    console.error('[ORDERS][:id/status] error', e);
    return err(res, 500, 'INTERNAL', 'Error interno');
  }
});

/* ========================== GET /orders/:id (detalle + timeline) ========================== */
ordersRouter.get('/:id', async (req: any, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return err(res, 400, 'BAD_ID', 'id inválido');

  const auth = req.user as { id: number; companyId?: number; role?: string };

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: { select: { id: true, productId: true, quantity: true, productTitle: true } } },
  });
  if (!order) return err(res, 404, 'NOT_FOUND', 'Pedido no encontrado');

  // Dueño (OK) | Admin misma empresa (OK) | Super admin (OK) | resto => 404 (no revelar)
  const isOwner = order.userId === auth.id;
  const isAdmin = auth?.role === 'COMPANY_ADMIN' || auth?.role === 'SUPER_ADMIN';
  const sameCompany = Number.isFinite(Number(auth.companyId)) && order.companyId === Number(auth.companyId);
  if (!(isOwner || (isAdmin && sameCompany) || auth?.role === 'SUPER_ADMIN')) {
    return err(res, 404, 'NOT_FOUND', 'Pedido no encontrado');
  }

  const timeline = await prisma.orderStatusLog.findMany({
    where: { orderId: id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, from: true, to: true, changedBy: true, createdAt: true },
  });

  return res.json({
    ok: true,
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
