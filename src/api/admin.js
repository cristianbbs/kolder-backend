// kolder-app/src/api/admin.js
import { api } from './client';

export const ADMIN_LIST_TIMEOUT_MS = 30000; // 30s para listados grandes
export const ADMIN_MUTATION_TIMEOUT_MS = 20000; // 20s para cambios de estado

// Lista con filtros (range por defecto: 'today')
export async function getAdminOrders({
  page = 1,
  pageSize = 20,
  range = 'today',
  status,
  companyId,
  dateFrom,
  dateTo,
} = {}) {
  const params = { page, pageSize, range };

  if (status) params.status = status;           // acepta 'CONFIRMED' (el backend lo normaliza)
  if (companyId) params.companyId = companyId;
  if (dateFrom) params.dateFrom = dateFrom;     // ISO string (opcional para custom)
  if (dateTo) params.dateTo = dateTo;

  const { data } = await api.get('/admin/orders', {
    params,
    timeout: ADMIN_LIST_TIMEOUT_MS,
  });
  return data;
}

export async function getAdminOrder(id) {
  const { data } = await api.get(`/admin/orders/${id}`);
  return data;
}

// Ruta principal: /status; fallback a alias /admin/orders/:id si el server viejo responde 404
export async function updateAdminOrderStatus(id, body) {
  try {
    const { data } = await api.patch(`/admin/orders/${id}/status`, body, {
      timeout: ADMIN_MUTATION_TIMEOUT_MS,
    });
    return data;
  } catch (e) {
    if (e?.response?.status === 404) {
      const { data } = await api.patch(`/admin/orders/${id}`, body, {
        timeout: ADMIN_MUTATION_TIMEOUT_MS,
      });
      return data;
    }
    throw e;
  }
}
