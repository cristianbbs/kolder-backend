// src/api/client.js
import axios from 'axios';
import { API_BASE_URL } from '../config';

let authToken = null;

// ---- util: log once ---------------------------------------------------------
let didLogBoot = false;
function logBootOnce() {
  if (didLogBoot) return;
  didLogBoot = true;
  console.log('[CAT][DEBUG] baseURL:', API_BASE_URL || '(undefined)', 'token?', !!authToken);
}

// -------------------- Axios instance --------------------
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 25000,
  headers: { Accept: 'application/json' },
});

// Request: adjunta JWT y loguea una vez.
api.interceptors.request.use((config) => {
  logBootOnce();

  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }

  // Si es FormData, NO forzar Content-Type
  const isFormData =
    typeof FormData !== 'undefined' && config.data instanceof FormData;
  if (
    !isFormData &&
    config.data &&
    typeof config.data === 'object' &&
    !config.headers['Content-Type']
  ) {
    config.headers['Content-Type'] = 'application/json';
  }

  return config;
});

// Response: logs compactos y propagación del error
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const method = (err?.config?.method || 'GET').toUpperCase();
    const url = err?.config?.url || '';
    const status = err?.response?.status;
    const code = err?.code || '';
    console.warn('[API ERR]', { baseURL: API_BASE_URL, code, method, status, url });
    return Promise.reject(err);
  }
);

// -------------------- Helpers internos --------------------
function normalizeEmergencyConfig(data) {
  if (!data || typeof data !== 'object') return null;

  if (
    Object.prototype.hasOwnProperty.call(data, 'extraCost') ||
    Object.prototype.hasOwnProperty.call(data, 'hours') ||
    Object.prototype.hasOwnProperty.call(data, 'days')
  ) {
    return {
      extraCost: data.extraCost ?? null,
      hours: data.hours ?? null,
      days: data.days ?? null,
    };
  }

  const fee = data.emergencyExtraCost ?? data.emergencyFeeCLP ?? null;
  let days = data.emergencyDays ?? null;
  let hours = data.emergencyHours ?? null;

  if (!days && !hours && typeof data.emergencySchedule === 'string') {
    const sched = data.emergencySchedule;
    const m = sched.match(/\d{2}:\d{2}\s*-\s*\d{2}:\d{2}/);
    hours = m ? m[0].replace(/\s+/g, '') : null;
    days = sched.replace(m ?? '', '').trim() || null;
  }

  return { extraCost: fee, hours, days };
}

// Limpia params (quita null/undefined/'')
const cleanParams = (obj = {}) => {
  const out = {};
  Object.keys(obj).forEach((k) => {
    const v = obj[k];
    if (v === null || v === undefined || v === '') return;
    out[k] = v;
  });
  return out;
};

// RN: helper para armar FormData con imagen
function toFormData(fields = {}) {
  const fd = new FormData();
  Object.entries(fields).forEach(([key, val]) => {
    if (val === undefined || val === null) return;

    // Soportar imageUri simple (RN)
    if (key === 'imageUri' && typeof val === 'string') {
      fd.append('image', {
        uri: val,
        name: `upload-${Date.now()}.jpg`,
        type: 'image/jpeg',
      });
      return;
    }

    // Soportar imageFile { uri, name, type }
    if (key === 'imageFile' && val && typeof val === 'object') {
      fd.append('image', {
        uri: val.uri,
        name: val.name || `upload-${Date.now()}`,
        type: val.type || 'application/octet-stream',
      });
      return;
    }

    // Campo binario estándar "file"
    if (key === 'file' && val && typeof val === 'object' && val.uri) {
      fd.append('file', {
        uri: val.uri,
        name: val.name || `upload-${Date.now()}`,
        type: val.type || 'application/octet-stream',
      });
      return;
    }

    // Cualquier otro campo (incluye imageUrl como texto)
    fd.append(key, String(val));
  });
  return fd;
}

// Extrae URL de distintas respuestas típicas de upload
function extractUploadUrl(data) {
  if (!data) return null;
  const candidates = [
    data.url,
    data.secure_url,
    data.Location,
    data.path,
    data?.file?.url,
    Array.isArray(data.files) ? data.files[0]?.url : null,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return null;
}

// -------------------- Auth --------------------
function setToken(token) {
  authToken = token || null;
}

async function login(email, password) {
  const res = await api.post('/auth/login', { email, password });
  const data = res?.data;
  if (!data?.token) throw new Error('Login: respuesta inválida (sin token)');
  setToken(data.token);
  return data; // { token, profile? }
}

async function getProfile() {
  const res = await api.get('/auth/me');
  return res?.data?.profile ?? null;
}

// -------------------- Catálogo (cliente) --------------------
async function getCatalog(options = {}) {
  const { onlyAllowed } = options || {};
  const qs = onlyAllowed ? '?onlyAllowed=1' : '';
  const res = await api.get('/products/catalog' + qs);
  const data = res?.data;
  if (!data || !Array.isArray(data.categories)) {
    console.warn('[API WARN] Formato inesperado de catálogo:', data);
    throw new Error('Catálogo: respuesta inválida del servidor');
  }
  return data.categories;
}

// -------------------- Pedidos (usuario) --------------------
async function createOrder(items, emergency = false, note = '') {
  const payload = { items, emergency: !!emergency, note: (note || '').trim() || undefined };
  const res = await api.post('/orders', payload);
  return res?.data;
}

async function listOrders(params = {}) {
  const { adminScope, status, companyId } = params || {};
  const q = new URLSearchParams();
  if (adminScope) q.set('admin', '1');
  if (status) q.set('status', status);
  if (companyId) q.set('companyId', String(companyId));
  const path = q.toString() ? `/orders?${q.toString()}` : '/orders';
  const res = await api.get(path);
  return res?.data;
}

async function repeatOrder(id) {
  const res = await api.post(`/orders/${id}/repeat`);
  return res?.data;
}

async function getOrder(orderId) {
  const res = await api.get(`/orders/${orderId}`);
  const data = res?.data;
  return data?.order ?? data ?? null;
}

async function updateOrderStatus(orderId, bodyOrStatus, note) {
  const body =
    typeof bodyOrStatus === 'string'
      ? bodyOrStatus === 'CANCELLED'
        ? { status: bodyOrStatus, reason: note || 'Cancelado por admin' }
        : { status: bodyOrStatus }
      : bodyOrStatus;

  const res = await api.put(`/orders/${orderId}/status`, body);
  const data = res?.data;
  return data?.order ?? data ?? null;
}

// -------------------- Config emergencia --------------------
async function getEmergencyConfig() {
  const res = await api.get('/company/emergency-config');
  return normalizeEmergencyConfig(res?.data?.config ?? res?.data);
}
async function putEmergencyConfig(body) {
  const payload = {
    extraCost: body?.extraCost ?? null,
    hours: body?.hours ?? null,
    days: body?.days ?? null,
  };
  const res = await api.put('/company/emergency-config', payload);
  return normalizeEmergencyConfig(res?.data?.config ?? res?.data);
}

// -------------------- Allowed products (LEGACY) --------------------
function getAllowedProducts(params) {
  return api.get('/company/allowed-products', { params });
}
function getEnabledProductsByCompany(companyId) {
  return api.get(`/company/${companyId}/products/enabled`);
}
function setEnabledProductsByCompany(companyId, productIds) {
  return api.put(`/company/${companyId}/products/enabled`, { productIds });
}
function toggleCompanyProduct(companyId, productId, enabled) {
  return api.patch(`/company/${companyId}/products/toggle`, { productId, enabled });
}

// -------------------- Admin usuarios empresa (legacy) --------------------
function listCompanyUsers(params) {
  return api.get('/company/users', { params });
}
function createCompanyUser(payload) {
  return api.post('/company/users', payload);
}
function deleteCompanyUser(userId, params) {
  return api.delete(`/company/users/${userId}`, { params });
}
function reissueProvisional(id, params) {
  return api.post(`/company/users/${id}/reissue-provisional`, null, { params });
}

/* ===================== ADMIN (NUEVO): usuarios & empresas ===================== */
async function adminListUsers(params = {}) {
  const res = await api.get('/admin/users', { params: cleanParams(params) });
  const d = res?.data || {};
  const items = Array.isArray(d.items)
    ? d.items
    : Array.isArray(d.users)
    ? d.users
    : Array.isArray(d.rows)
    ? d.rows
    : Array.isArray(d)
    ? d
    : [];
  return {
    items,
    total: d.total ?? d.count ?? items.length,
    page: d.page ?? params.page ?? 1,
    pageSize: d.pageSize ?? params.pageSize,
  };
}
async function adminCreateUser(payload) {
  const res = await api.post('/admin/users', payload);
  const data = res?.data;
  if (!data?.ok && !data?.user) throw new Error(data?.error || 'Error creando usuario');
  return data.user ?? data;
}
async function adminUpdateUser(id, patch) {
  const res = await api.patch(`/admin/users/${id}`, patch);
  const data = res?.data;
  if (!data?.ok && !data?.user) throw new Error(data?.error || 'Error actualizando usuario');
  return data.user ?? data;
}
async function adminDeleteUser(id) {
  const res = await api.delete(`/admin/users/${id}`);
  const data = res?.data;
  if (!data?.ok && data !== true) throw new Error(data?.error || 'Error eliminando usuario');
  return true;
}
async function adminPromoteToCompanyAdmin(id, companyId) {
  return adminUpdateUser(id, { companyAdmin: true, companyId });
}
async function adminDemoteFromCompanyAdmin(id) {
  return adminUpdateUser(id, { companyAdmin: false });
}
async function adminBlockUser(id, blocked = true) {
  return adminUpdateUser(id, { blocked: !!blocked });
}

// ---- Empresas (admin) ----
async function adminListCompanies(params = {}) {
  const res = await api.get('/admin/companies', { params: cleanParams(params) });
  const d = res?.data || {};
  const items = Array.isArray(d.items)
    ? d.items
    : Array.isArray(d.companies)
    ? d.companies
    : Array.isArray(d.rows)
    ? d.rows
    : Array.isArray(d)
    ? d
    : [];
  return {
    items,
    total: d.total ?? d.count ?? items.length,
    page: d.page ?? params.page ?? 1,
    pageSize: d.pageSize ?? params.pageSize,
  };
}
async function adminCreateCompany(body) {
  const res = await api.post('/admin/companies', body);
  const data = res?.data;
  if (!data?.ok && !data?.company) throw new Error(data?.error || 'Error creando empresa');
  return data.company ?? data;
}
async function adminUpdateCompany(id, patch) {
  const res = await api.put(`/admin/companies/${id}`, patch);
  const data = res?.data;
  if (!data?.ok && !data?.company) throw new Error(data?.error || 'Error actualizando empresa');
  return data.company ?? data;
}

/* ===================== ADMIN (NUEVO): Catálogo ===================== */
// ---- Categorías ----
async function adminListCategories(params = {}) {
  try {
    const res = await api.get('/admin/catalog/categories', { params: cleanParams(params) });
    const d = res?.data || {};
    const items = Array.isArray(d.items)
      ? d.items
      : Array.isArray(d.categories)
      ? d.categories
      : Array.isArray(d.rows)
      ? d.rows
      : Array.isArray(d)
      ? d
      : [];
    return {
      items,
      total: d.total ?? d.count ?? items.length,
      page: d.page ?? params.page ?? 1,
      pageSize: d.pageSize ?? params.pageSize,
      _readonly: false,
      fallback: false,
    };
  } catch (e) {
    if (e?.response?.status === 404) {
      const cats = await getCatalog({ onlyAllowed: false });
      const items = (Array.isArray(cats) ? cats : []).map((c, idx) => ({
        id: c.id ?? c._id ?? c.categoryId ?? idx + 1,
        name: c.name ?? c.title ?? 'Categoría',
        products: Array.isArray(c.products) ? c.products : [],
        productsCount: Array.isArray(c.products) ? c.products.length : (c.productsCount ?? 0),
      }));
      return { items, total: items.length, page: 1, pageSize: items.length, _readonly: true, fallback: true };
    }
    throw e;
  }
}
async function adminCreateCategory({ name }) {
  try {
    const res = await api.post('/admin/catalog/categories', { name });
    const d = res?.data || {};
    if (!d?.ok && !d?.category) throw new Error(d?.error || 'No se pudo crear la categoría');
    return d.category ?? d;
  } catch (e) {
    if (e?.response?.status === 404) throw new Error('Catálogo admin no disponible en el backend (/admin/catalog/*).');
    throw e;
  }
}
async function adminUpdateCategory(id, { name }) {
  try {
    const res = await api.put(`/admin/catalog/categories/${id}`, { name });
    const d = res?.data || {};
    if (!d?.ok && !d?.category) throw new Error(d?.error || 'No se pudo actualizar la categoría');
    return d.category ?? d;
  } catch (e) {
    if (e?.response?.status === 404) throw new Error('Catálogo admin no disponible en el backend (/admin/catalog/*).');
    throw e;
  }
}
async function adminDeleteCategory(id) {
  try {
    const res = await api.delete(`/admin/catalog/categories/${id}`);
    return res?.data?.ok ?? true;
  } catch (e) {
    const status = e?.response?.status;
    if (status === 404) throw new Error('Catálogo admin no disponible en el backend (/admin/catalog/*).');
    if (status === 409) throw new Error('No se puede eliminar la categoría: tiene productos asociados.');
    throw e;
  }
}

// ---- Productos ----
async function adminListProducts(params = {}) {
  try {
    const res = await api.get('/admin/catalog/products', { params: cleanParams(params) });
    const d = res?.data || {};
    const items = Array.isArray(d.items)
      ? d.items
      : Array.isArray(d.products)
      ? d.products
      : Array.isArray(d.rows)
      ? d.rows
      : Array.isArray(d)
      ? d
      : [];
    return {
      items,
      total: d.total ?? d.count ?? items.length,
      page: d.page ?? params.page ?? 1,
      pageSize: d.pageSize ?? params.pageSize,
      _readonly: false,
      fallback: false,
    };
  } catch (e) {
    if (e?.response?.status === 404) {
      const cats = await getCatalog({ onlyAllowed: false });
      let items = [];
      (Array.isArray(cats) ? cats : []).forEach((cat, cidx) => {
        const cid = cat.id ?? cat._id ?? cat.categoryId ?? (cidx + 1);
        (Array.isArray(cat.products) ? cat.products : []).forEach((p, pidx) => {
          const imgFromArray =
            (Array.isArray(p.images) && p.images[0]) ||
            (Array.isArray(p.iamges) && p.iamges[0]) || // typo común
            null;
          items.push({
            id: p.id ?? p._id ?? p.productId ?? `${cid}-${pidx + 1}`,
            title: p.title ?? p.name ?? 'Producto',
            categoryId: p.categoryId ?? cid,
            imageUrl: p.imageUrl ?? p.image_url ?? p.image ?? imgFromArray,
            ...p,
          });
        });
      });
      if (params?.categoryId != null) {
        items = items.filter((x) => String(x.categoryId ?? '') === String(params.categoryId));
      }
      return { items, total: items.length, page: 1, pageSize: items.length, _readonly: true, fallback: true };
    }
    throw e;
  }
}

/** SUBIDA de imagen (robusto con fallbacks).  Espera FormData con campo: file o image */
async function adminUploadImage(formData) {
  // Aseguramos que sea FormData válido
  const fd =
    typeof FormData !== 'undefined' && formData instanceof FormData
      ? formData
      : toFormData(formData && typeof formData === 'object' ? formData : {});

  const headers = { 'Content-Type': 'multipart/form-data' };

  // Intentamos varios endpoints comunes
  const candidates = [
    '/files/upload',
    '/admin/upload',
    '/upload',
    '/admin/catalog/upload',
    '/api/upload',
  ];

  for (const endpoint of candidates) {
    try {
      const res = await api.post(endpoint, fd, { headers, timeout: 20000 });
      const data = res?.data || {};
      const url = extractUploadUrl(data);
      if (url) {
        return { url, raw: data, endpoint }; // normalizado para el caller
      }
      // si no encontramos url, probamos siguiente
    } catch (e) {
      // si es auth error, mejor propagar
      if (e?.response?.status === 401) throw e;
      // seguimos con siguiente endpoint
    }
  }

  // Si nada funcionó, devolvemos un error consistente
  const err = new Error('UPLOAD_NOT_AVAILABLE');
  err.code = 'UPLOAD_NOT_AVAILABLE';
  throw err;
}

/**
 * Crea producto.
 * Acepta: { title/name, categoryId?, imageUrl?, imageUri? | imageFile? }
 * - Si ya subiste a /files/upload, pásame imageUrl (se guarda como texto).
 * - Alternativamente, puedes pasar imageUri/imageFile para multipart.
 */
async function adminCreateProduct(body = {}) {
  try {
    // Enviamos SIEMPRE imageUrl si viene
    const fd = toFormData({
      title: body.title ?? body.name,
      categoryId: body.categoryId ?? undefined,
      imageUrl: body.imageUrl ?? undefined,   // 👈 ahora se preserva
      imageUri: body.imageUri,
      imageFile: body.imageFile,
    });
    const res = await api.post('/admin/catalog/products', fd);
    const d = res?.data || {};
    if (!d?.ok && !d?.product) throw new Error(d?.error || 'No se pudo crear el producto');
    return d.product ?? d;
  } catch (e) {
    if (e?.response?.status === 404) throw new Error('Catálogo admin no disponible en el backend (/admin/catalog/*).');
    throw e;
  }
}

/**
 * Actualiza producto. Si pasas imageUri/imageFile se envía multipart; si no, JSON.
 * Siempre enviamos imageUrl si está definido (para actualizar/quitar).
 */
async function adminUpdateProduct(id, body = {}) {
  try {
    const hasBinary = !!body.imageUri || !!body.imageFile;
    let res;
    if (hasBinary) {
      const fd = toFormData({
        title: body.title ?? body.name,
        categoryId: body.categoryId ?? undefined,
        imageUrl: body.imageUrl ?? undefined,   // 👈 también aquí
        imageUri: body.imageUri,
        imageFile: body.imageFile,
      });
      res = await api.put(`/admin/catalog/products/${id}`, fd);
    } else {
      const payload = cleanParams({
        title: body.title ?? body.name,
        categoryId: body.categoryId,
        imageUrl:
          typeof body.imageUrl === 'string'
            ? body.imageUrl
            : body.imageUrl ?? undefined, // permite limpiar con ''
      });
      res = await api.put(`/admin/catalog/products/${id}`, payload);
    }
    const d = res?.data || {};
    if (!d?.ok && !d?.product) throw new Error(d?.error || 'No se pudo actualizar el producto');
    return d.product ?? d;
  } catch (e) {
    if (e?.response?.status === 404) throw new Error('Catálogo admin no disponible en el backend (/admin/catalog/*).');
    throw e;
  }
}

async function adminDeleteProduct(id) {
  try {
    const res = await api.delete(`/admin/catalog/products/${id}`);
    return res?.data?.ok ?? true;
  } catch (e) {
    if (e?.response?.status === 404) throw new Error('Catálogo admin no disponible en el backend (/admin/catalog/*).');
    throw e;
  }
}

// -------------------- Bootstrap auth --------------------
async function bootstrapAuth(getTokenFn) {
  try {
    const t = await getTokenFn();
    if (t) setToken(t);
  } catch {
    // silencio
  }
}

// -------------------- Exports --------------------
const API = {
  // Atajos genéricos
  get: (...args) => api.get(...args),
  post: (...args) => api.post(...args),
  put: (...args) => api.put(...args),
  delete: (...args) => api.delete(...args),
  patch: (...args) => api.patch(...args),

  // Auth
  setToken,
  login,
  getProfile,

  // Catálogo (cliente)
  getCatalog,

  // Pedidos (usuario)
  createOrder,
  listOrders,
  repeatOrder,
  getOrder,
  updateOrderStatus,

  // Config emergencia
  getEmergencyConfig,
  putEmergencyConfig,

  // Allowed products (legacy)
  getAllowedProducts,
  getEnabledProductsByCompany,
  setEnabledProductsByCompany,
  toggleCompanyProduct,

  // Admin (nuevo) usuarios
  adminListUsers,
  adminCreateUser,
  adminUpdateUser,
  adminDeleteUser,
  adminPromoteToCompanyAdmin,
  adminDemoteFromCompanyAdmin,
  adminBlockUser,

  // Admin (nuevo) empresas
  adminListCompanies,
  adminCreateCompany,
  adminUpdateCompany,

  // Admin (nuevo) catálogo
  adminListCategories,
  adminCreateCategory,
  adminUpdateCategory,
  adminDeleteCategory,
  adminListProducts,
  adminCreateProduct,
  adminUpdateProduct,
  adminDeleteProduct,

  // Subida de imágenes
  adminUploadImage,

  // Aliases para compat
  adminCatalogListCategories: (params) => adminListCategories(params),
  adminCatalogListProducts: (params) => adminListProducts(params),
};

export default API;
export { api, bootstrapAuth, setToken };
