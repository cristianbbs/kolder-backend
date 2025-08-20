// src/schemas/orders.ts
import { z } from 'zod';

export const OrderStatusEnum = z.enum([
  'SUBMITTED', 'PREPARING', 'EN_ROUTE', 'DELIVERED', 'CANCELLED',
]);

export const ChangeStatusSchema = z.object({
  status: OrderStatusEnum,
  note: z.string().trim().max(500).optional(),
});
export type ChangeStatusInput = z.infer<typeof ChangeStatusSchema>;
