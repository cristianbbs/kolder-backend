// src/services/orders.ts
import { prisma } from '../prisma.ts';

// NO importes el enum de Prisma; usamos un tipo local robusto
export type Status = 'SUBMITTED' | 'PREPARING' | 'EN_ROUTE' | 'DELIVERED' | 'CANCELLED';

const STATUSES: Status[] = ['SUBMITTED','PREPARING','EN_ROUTE','DELIVERED','CANCELLED'] as const;
const FINAL_STATES: Status[] = ['DELIVERED', 'CANCELLED'];

const TRANSITIONS: Record<Status, Status[]> = {
  SUBMITTED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['EN_ROUTE',  'CANCELLED'],
  EN_ROUTE:  ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

function isStatus(x: unknown): x is Status {
  return typeof x === 'string' && (STATUSES as readonly string[]).includes(x);
}

export function canTransition(from: Status, to: Status): boolean {
  if (from === to) return false;
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Si no eres SUPER_ADMIN, asegúrate de que el pedido pertenezca a tu empresa.
 */
export async function assertSameCompanyOrAdmin(
  orderId: number,
  user: { companyId: number; role: string }
) {
  if (user.role === 'SUPER_ADMIN') return;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { companyId: true },
  });
  if (!order) throw new Error('NOT_FOUND');
  if (order.companyId !== user.companyId) throw new Error('FORBIDDEN_COMPANY_SCOPE');
}

/**
 * Cambia el estado con validación de transición y log.
 * Diseñado para tolerar schema con `String` o con `enum` en Prisma.
 */
export async function changeOrderStatus(params: {
  orderId: number;
  next: Status;           // validado río arriba (Zod)
  note?: string;
  changedByUserId: number;
}) {
  const { orderId, next, note, changedByUserId } = params;

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true }, // status puede venir como string o enum
    });

    if (!order) {
      throw new Error('NOT_FOUND');
    }

    // Normaliza el tipo a nuestro Status local
    const current = order.status as unknown;
    if (!isStatus(current)) {
      // Si tu DB tiene valores extraños, lo paramos explícitamente
      throw new Error(`UNKNOWN_STATUS_${String(order.status)}`);
    }

    if (FINAL_STATES.includes(current)) {
      throw new Error(`ORDER_FINAL_STATE_${current}`);
    }

    if (!canTransition(current, next)) {
      throw new Error(`INVALID_TRANSITION_${current}_TO_${next}`);
    }

    // Update del pedido: casteo a any para tolerar schema Prisma (enum o string)
    const updated = await tx.order.update({
      where: { id: orderId },
      data: { status: next as any },
      select: { id: true, status: true, updatedAt: true },
    });

    // Log de estado: los campos podrían ser String o enum en tu schema
    await tx.orderStatusLog.create({
      data: {
        orderId,
        fromStatus: current as any, // <-- evita el error de tipos en tu entorno
        toStatus:   next as any,
        note: note ?? null,
        changedByUserId,
      } as any,
    });

    return updated;
  });
}
