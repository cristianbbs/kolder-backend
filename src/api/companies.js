// kolder-app/src/api/companies.js
import { api } from './client';

/* =================== Helpers de normalización =================== */
const buildAddress = (src = {}) => {
  const addressLine = src.addressLine ?? src.address?.addressLine ?? src.address ?? '';
  const region      = src.region      ?? src.address?.region      ?? '';
  const communeAny  = src.commune     ?? src.comuna               ?? src.address?.commune ?? src.address?.comuna ?? '';
  const department  = src.department  ?? src.address?.department  ?? '';
  const notes       = src.deliveryNotes ?? src.address?.notes     ?? '';
  const commune = String(communeAny || '');
  return { addressLine, region, commune, department, notes };
};

const toCompanyPayload = (form = {}) => {
  const name = form.name ?? form.legalName ?? form.razon_social ?? '';
  const rut  = form.rut ?? '';
  const email = form.email ?? '';
  const phone = form.phone ?? '';
  const { addressLine, region, commune, department, notes } = buildAddress(form);
  const contactName  = form.contactName ?? form.contact_name ?? '';
  const contactPhone = form.contactPhone ?? '';

  return {
    // Planos
    name,
    legalName: form.legalName ?? undefined,
    rut,
    email,
    phone,
    addressLine,
    region,
    commune,
    comuna: commune, // alias por compat
    department,
    deliveryNotes: notes,
    contactName,
    contactPhone,
    // Anidado (compat)
    address: {
      addressLine,
      region,
      commune,
      department,
      notes,
    },
  };
};

const normCompany = (row = {}) => {
  const addr = buildAddress(row);
  return {
    id: row.id,
    name: row.name ?? row.legalName ?? row.razon_social ?? '',
    legalName: row.legalName ?? null,
    rut: row.rut ?? '',
    email: row.email ?? null,
    phone: row.phone ?? null,

    contactName: row.contactName ?? row.contact_name ?? null,
    contactPhone: row.contactPhone ?? null,

    addressLine: addr.addressLine || null,
    region: addr.region || null,
    commune: addr.commune || null,
    department: addr.department || null,
    deliveryNotes: addr.notes || null,

    address: {
      addressLine: addr.addressLine || null,
      region: addr.region || null,
      commune: addr.commune || null,
      department: addr.department || null,
      notes: addr.notes || null,
    },

    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
  };
};

const extractCompaniesArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.companies)) return payload.companies;
  if (Array.isArray(payload?.data?.companies)) return payload.data.companies;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return [];
};

/* =================== EMPRESAS =================== */
// Acepta filtros: { q, commune|comuna, page, pageSize }
export async function list(params = {}) {
  const p = {
    q: params.q || undefined,
    commune: params.commune ?? params.comuna ?? undefined,
    page: params.page ?? undefined,
    pageSize: params.pageSize ?? undefined,
  };
  const r = await api.get('/admin/companies', { params: p });
  const payload = r?.data ?? r;
  const arr = extractCompaniesArray(payload);
  return arr.map(normCompany);
}

export async function get(id) {
  const r = await api.get(`/admin/companies/${id}`);
  const data = r?.data?.company ?? r?.data ?? r;
  return normCompany(data);
}

export async function create(data) {
  const body = toCompanyPayload(data);
  const r = await api.post('/admin/companies', body);
  const payload = r?.data?.company ?? r?.data ?? r;
  return normCompany(payload);
}

export async function update(id, data) {
  const body = toCompanyPayload(data);
  const r = await api.put(`/admin/companies/${id}`, body);
  const payload = r?.data?.company ?? r?.data ?? r;
  return normCompany(payload);
}

export function remove(id) {
  return api.delete(`/admin/companies/${id}`).then((r) => r.data);
}

/* =================== USUARIOS DE EMPRESA (sin cambios de endpoint) =================== */
export async function listUsers(params) {
  const { companyId, ...rest } = params || {};
  const p = {
    ...(rest || {}),
    ...(Number.isFinite(companyId) ? { companyId } : {}),
  };
  const r = await api.get('/company/users', { params: p });
  const data = r?.data ?? r;

  const arr =
    (Array.isArray(data?.users) && data.users) ||
    (Array.isArray(data?.data?.users) && data.data.users) ||
    (Array.isArray(data?.rows) && data.rows) ||
    [];

  return arr;
}

export async function createUser(payload) {
  const { data } = await api.post('/company/users', payload);
  return data;
}

export async function detachUserFromCompany(userId, params) {
  const { companyId, ...rest } = params || {};
  const p = {
    ...(rest || {}),
    ...(Number.isFinite(companyId) ? { companyId } : {}),
  };
  const { data } = await api.patch(`/company/users/${userId}/detach`, {}, { params: p });
  return data;
}

export async function deleteUser(userId, params) {
  const { companyId, hard, ...rest } = params || {};
  const p = {
    ...(rest || {}),
    ...(Number.isFinite(companyId) ? { companyId } : {}),
    ...(hard ? { hard: true } : {}),
  };
  const { data } = await api.delete(`/company/users/${userId}`, { params: p });
  return data;
}

export async function getAllowedProducts(params) {
  const { companyId, ...rest } = params || {};
  const p = {
    ...(rest || {}),
    ...(Number.isFinite(companyId) ? { companyId } : {}),
  };
  const { data } = await api.get('/company/allowed-products', { params: p });
  return {
    categories: Array.isArray(data?.categories) ? data.categories : [],
    companyId: data?.companyId ?? null,
    ok: !!data?.ok,
  };
}

export async function getEnabledProductsByCompany(companyId) {
  const { data } = await api.get(`/company/${companyId}/products/enabled`);
  return Array.isArray(data?.enabledProductIds) ? data.enabledProductIds : [];
}

export async function setEnabledProductsByCompany(companyId, productIds) {
  const { data } = await api.put(`/company/${companyId}/products/enabled`, { productIds });
  return data;
}

export async function toggleCompanyProduct(companyId, productId, enabled) {
  const { data } = await api.patch(`/company/${companyId}/products/toggle`, { productId, enabled });
  return data;
}

export function orders(companyId, params) {
  return api.get(`/company/${companyId}/orders`, { params }).then((r) => r.data);
}
export function orderStats(companyId, params) {
  return api.get(`/company/${companyId}/orders/stats`, { params }).then((r) => r.data);
}
export function ordersCSV(companyId, params) {
  return api.get(`/company/${companyId}/orders.csv`, { params, responseType: 'text' }).then((r) => r.data);
}
export function statsCSV(companyId, params) {
  return api.get(`/company/${companyId}/orders/stats.csv`, { params, responseType: 'text' }).then((r) => r.data);
}

export const CompaniesAPI = {
  list,
  get,
  create,
  update,
  remove,
  listUsers,
  createUser,
  detachUserFromCompany,
  deleteUser,
  getAllowedProducts,
  getEnabledProductsByCompany,
  setEnabledProductsByCompany,
  toggleCompanyProduct,
  orders,
  orderStats,
  ordersCSV,
  statsCSV,
};
export default CompaniesAPI;
