// kolder-app/src/screens/admin/AdminOrderDetail.js
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Alert, RefreshControl, ActivityIndicator, Image,
} from 'react-native';
import API, { api } from '../../api/client';
import ErrorBanner from '../../components/ErrorBanner';
import StatusBadge from '../../components/StatusBadge';
import { getAdminOrder } from '../../api/admin';

const FLOW_BASE = ['SUBMITTED', 'PREPARING', 'EN_ROUTE', 'DELIVERED'];
const STATUS_ES = {
  SUBMITTED: 'Solicitud recibida',
  PREPARING: 'En preparación',
  EN_ROUTE: 'En camino',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
};
const validNext = {
  SUBMITTED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['EN_ROUTE', 'CANCELLED'],
  EN_ROUTE: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

// -------- utils --------
const STATUS_KEYS = ['status', 'state', 'to', 'new_status'];
const DATE_KEYS = ['createdAt', 'created_at', 'timestamp', 'changedAt', 'updatedAt', 'date', 'ts'];
const USER_NAME_KEYS = ['userName', 'username', 'by', 'actor', 'author'];

const getFirst = (obj, keys) => { for (const k of keys) if (obj && obj[k] != null) return obj[k]; };
const asISO = (v) => { if (!v) return null; const d = new Date(v); return isNaN(d.getTime()) ? null : d.toISOString(); };

/** Usuario “dado de baja” (bloqueado/inactivo/eliminado) */
const isUserDown = (u, order) => {
  if (!u && order) u = order.user || null;
  if (!u) return false;
  if (u.blocked === true || u.isBlocked === true) return true;
  if ('active' in u && u.active === false) return true;
  const statusStr = String(u.status || order?.userStatus || '').toUpperCase();
  if (['INACTIVE', 'DELETED', 'DISABLED', 'BLOCKED', 'BAJA'].includes(statusStr)) return true;
  if (u.disabled === true || u.deleted === true || u.baja === true) return true;
  return false;
};

function extractRawLogs(order) {
  if (!order || typeof order !== 'object') return [];
  const candidates = [
    order.statusLogs, order.status_logs, order.statusHistory, order.history,
    order.events, order.logs, order.transitions, order.statusChanges, order.status_changes,
  ].filter(Array.isArray)[0];
  let arr = Array.isArray(candidates) ? candidates : [];
  if (!arr.length) {
    for (const v of Object.values(order)) {
      if (Array.isArray(v) && v.length && typeof v[0] === 'object') {
        const hasStatusLike = v.some(o => o && STATUS_KEYS.some(k => k in o));
        const hasDateLike   = v.some(o => o && DATE_KEYS.some(k => k in o));
        if (hasStatusLike && hasDateLike) { arr = v; break; }
      }
    }
  }
  return arr.filter(Boolean);
}

function normalizeEvents(raw = []) {
  return raw.map((l) => {
    const to = getFirst(l, STATUS_KEYS)?.toString()?.toUpperCase() || null;
    const createdAt = asISO(getFirst(l, DATE_KEYS));
    const by =
      (l?.user && (l.user.name || l.user.email)) ||
      getFirst(l, USER_NAME_KEYS) ||
      null;
    return { to, createdAt, by };
  }).filter(e => e.to && e.createdAt);
}

function fillMissingStages(events, finalStatus) {
  if (!events.length) return events;
  if (finalStatus === 'CANCELLED') return events;
  const seen = new Set(events.map(e => e.to));
  const needed = [];
  for (const s of FLOW_BASE) {
    if (s === 'SUBMITTED') continue;
    if (!seen.has(s) && FLOW_BASE.indexOf(s) <= FLOW_BASE.indexOf(finalStatus)) needed.push(s);
  }
  if (!needed.length) return events;
  const out = [...events];
  for (const s of needed) {
    let idx = out.findIndex(ev => FLOW_BASE.indexOf(ev.to) > FLOW_BASE.indexOf(s));
    if (idx < 0) idx = out.length;
    const refTs = out[idx - 1]?.createdAt || out[idx]?.createdAt || out[out.length - 1]?.createdAt;
    out.splice(idx, 0, { to: s, createdAt: refTs, by: null });
  }
  out.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const uniq = []; const keyset = new Set();
  for (const e of out) { const k = `${e.to}|${e.createdAt}`; if (!keyset.has(k)) { keyset.add(k); uniq.push(e); } }
  return uniq;
}

function buildTransitions(events, createdAtOrderISO) {
  const tx = []; let prev = 'SUBMITTED';
  if (createdAtOrderISO) tx.push({ from: null, to: 'SUBMITTED', createdAt: createdAtOrderISO, by: null });
  for (const e of events) {
    if (e.to === 'SUBMITTED' && createdAtOrderISO && e.createdAt === createdAtOrderISO) continue;
    tx.push({ from: prev, to: e.to, createdAt: e.createdAt, by: e.by || null });
    prev = e.to;
  }
  const seen = new Set(); const out = [];
  for (const t of tx) { const k = `${t.to}|${t.createdAt}`; if (!seen.has(k)) { seen.add(k); out.push(t); } }
  return out;
}

function mergeOrderPreferA(a, b) {
  if (!a && b) return b; if (!a) return a; const out = { ...a };
  if (!out.user && b?.user) out.user = b.user;
  if (!out.userEmail && b?.userEmail) out.userEmail = b.userEmail;
  if (!out.userName && b?.userName) out.userName = b.userName;
  if (!out.company && b?.company) out.company = b.company;
  if (!out.companyName && b?.companyName) out.companyName = b.companyName;
  if (!out.companyRut && b?.companyRut) out.companyRut = b.companyRut;
  if ((!Array.isArray(out.items) || out.items.length === 0) && Array.isArray(b?.items)) out.items = b.items;
  if (!out.createdAt && b?.createdAt) out.createdAt = b.createdAt;
  if (!out.status && b?.status) out.status = b.status;
  const raw = extractRawLogs(b); const events = normalizeEvents(raw);
  if ((!Array.isArray(out._events) || out._events.length === 0) && events.length) out._events = events;
  return out;
}

/** ----- imágenes ----- */
const ensureAbsoluteUrl = (input) => {
  if (!input) return null;
  let url = typeof input === 'string' ? input : input.url || input.path || input.filename || null;
  if (!url) return null;
  url = String(url).trim().replace(/\\/g, '/');
  if (!/^https?:\/\//i.test(url)) {
    const base = (api?.defaults?.baseURL || '').replace(/\/+$/,'');
    const clean = url.replace(/^\.?\/*/, '');
    url = `${base}/${clean}`;
  }
  const qIndex = url.indexOf('?');
  url = qIndex >= 0 ? encodeURI(url.slice(0, qIndex)) + url.slice(qIndex) : encodeURI(url);
  return url;
};
const pickProductThumb = (p) =>
  ensureAbsoluteUrl(p?.imageUrl || p?.image || p?.photo || p?.featuredImage?.url || p?.media?.[0]?.url || p?.images?.[0]?.url || p?.images?.[0]);
const getItemImageRaw = (it) =>
  it?.imageUrl || it?.image || it?.img || it?.photo ||
  it?.product?.imageUrl || it?.product?.image || it?.product?.photo ||
  it?.product?.featuredImage?.url || it?.product?.media?.[0]?.url ||
  it?.product?.images?.[0]?.url || it?.product?.images?.[0];

// ⚠️ Versión pura: NO usa variables externas; recibe el mapa por parámetro.
const getItemImage = (it, thumbById = {}) => {
  const raw = getItemImageRaw(it);
  const pid = it?.productId ?? it?.product?.id;
  const byId = pid != null ? thumbById[pid] : undefined;
  return ensureAbsoluteUrl(raw || byId || null);
};

const formatWhen = (d) => {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  const dateStr = date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = date.toLocaleTimeString('es-CL', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
  return `${dateStr}, ${timeStr}`;
};

const pickCompanyAddress = (company) => {
  if (!company) return null;
  const parts = [
    company.address, company.direccion, company.address1, company.addressLine, company.address_line,
    company.street, company.street1, company.streetAddress,
    company.commune || company.comuna, company.city, company.region, company.state,
    company.zip || company.postalCode,
  ].filter(Boolean);
  const seen = new Set();
  const uniq = parts.map(x => String(x).trim()).filter(x => x && !seen.has(x) && seen.add(x));
  return uniq.length ? uniq.join(', ') : null;
};

// -------- component --------
export default function AdminOrderDetail({ route }) {
  const id = Number(route?.params?.orderId ?? route?.params?.id ?? NaN);

  const [order, setOrder] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [brokenThumbs, setBrokenThumbs] = useState(() => new Set());
  const [thumbByProductId, setThumbByProductId] = useState({});

  const buildThumbMap = useCallback(async (items = []) => {
    const needIds = Array.from(new Set(items
      .filter(it => !getItemImageRaw(it))
      .map(it => it?.productId || it?.product?.id)
      .filter(Boolean)));
    if (!needIds.length) return;
    let prods = [];
    try { const arr = await API.adminListProducts?.(); if (Array.isArray(arr)) prods = arr; if (!prods.length && arr?.items) prods = arr.items; } catch {}
    if (!prods.length) { try { const cats = await API.getCatalog?.(); if (Array.isArray(cats)) prods = cats.flatMap(c => Array.isArray(c?.products) ? c.products : []); } catch {} }
    if (!prods.length) return;
    const map = {}; for (const p of prods) { const pid = p?.id; if (!pid) continue; const thumb = pickProductThumb(p); if (thumb) map[pid] = thumb; }
    if (Object.keys(map).length) setThumbByProductId(prev => ({ ...prev, ...map }));
  }, []);

  const load = useCallback(async () => {
    setErr(null);
    if (!Number.isFinite(id)) { setErr('Falta id de pedido.'); setLoading(false); setRefreshing(false); return; }
    try {
      setLoading(true);
      const resAdmin = await getAdminOrder(id);
      let o = resAdmin?.order ?? resAdmin ?? null;

      const missingUser = !o?.user?.name && !o?.user?.email && !o?.userEmail && !o?.userName;
      const missingItems = !Array.isArray(o?.items) || o?.items?.length === 0;

      let raw = extractRawLogs(o); let events = normalizeEvents(raw);
      if (missingUser || missingItems || !events.length) {
        try {
          const resPublic = await API.getOrder(id);
          o = mergeOrderPreferA(o, resPublic);
          if (!events.length) { raw = extractRawLogs(resPublic); events = normalizeEvents(raw); }
        } catch {}
      }

      const finalStatus = (o?.status || '').toString().toUpperCase();
      const createdISO = asISO(o?.createdAt || o?.created_at);
      const eventsFilled = fillMissingStages(events, finalStatus);
      const transitions = buildTransitions(eventsFilled, createdISO);
      setOrder({ ...o, _events: eventsFilled, statusLogs: transitions });

      if (Array.isArray(o?.items) && o.items.length) buildThumbMap(o.items);
    } catch (e) {
      setErr(e?.message || 'Error cargando pedido');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, buildThumbMap]);

  useEffect(() => { load(); }, [load]);

  const changeStatus = async (status) => {
    try {
      setUpdating(true);
      const body = status === 'CANCELLED' ? { status, reason: cancelReason || 'Cancelado por admin' } : { status };
      await API.updateOrderStatus(id, body);
      await load();
    } catch (e) {
      Alert.alert('Error', e?.message || 'No se pudo cambiar el estado');
    } finally {
      setUpdating(false);
    }
  };

  const companyLabel = useMemo(() => {
    const name = order?.company?.name ?? order?.companyName ?? '—';
    const rut  = order?.company?.rut  ?? order?.companyRut  ?? null;
    return rut ? `${name} · ${rut}` : name;
  }, [order]);

  const userLabel = useMemo(() => {
    const n  = order?.user?.name || order?.userName || '';
    const e = order?.user?.email || order?.userEmail || '';
    const base = n && e ? `${n} <${e}>` : (n || e || '—');
    const down = isUserDown(order?.user, order);
    return down ? `${base} (dado de baja)` : base;
  }, [order]);

  const items = Array.isArray(order?.items) ? order.items : [];
  const next = validNext[order?.status] || [];

  // Timeline rows
  const timelineRows = useMemo(() => {
    const logs = Array.isArray(order?.statusLogs) ? order.statusLogs : [];
    return logs.map((l, i) => ({
      id: `${l.to}|${l.createdAt}|${i}`,
      to: String(l.to || '').toUpperCase(),
      when: l.createdAt ? new Date(l.createdAt) : null,
      by: l.by || null,
    }));
  }, [order]);

  const statusUp = String(order?.status || '').toUpperCase();
  const FLOW = statusUp === 'CANCELLED' ? ['SUBMITTED', 'PREPARING', 'EN_ROUTE', 'CANCELLED'] : FLOW_BASE;
  const currentIdx = Math.max(0, FLOW.indexOf(statusUp));
  const whenByStep = useMemo(() => { const m = {}; for (const r of timelineRows) if (!m[r.to]) m[r.to] = r.when; return m; }, [timelineRows]);

  const receivedBy = useMemo(() => {
    const lastDelivered = [...timelineRows].reverse().find(r => r.to === 'DELIVERED' && r.by);
    return lastDelivered?.by ||
      order?.deliveredBy || order?.receivedBy || order?.delivery?.receivedBy || order?.recipient || null;
  }, [timelineRows, order]);
  const addressLabel = useMemo(() => pickCompanyAddress(order?.company), [order]);

  if (loading && !order && !err) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /></View>;
  }
  if (err) {
    return <View style={{ flex: 1, padding: 12 }}><ErrorBanner message={err} onRetry={load} /></View>;
  }
  if (!order) {
    return <View style={{ flex: 1, padding: 12 }}><View style={{ padding: 16, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, backgroundColor: '#fff' }}><Text>No se encontró el pedido.</Text></View></View>;
  }

  const renderItemRow = ({ item, index }) => {
    const title =
      item?.product?.title ?? item?.productTitle ?? (item?.productId ? `Producto #${item.productId}` : 'Producto');
    const qty = Number(item?.quantity ?? item?.qty ?? 0) || 0;
    const qtyLabel = `${qty} ${qty === 1 ? 'producto' : 'productos'}`;
    const uri = getItemImage(item, thumbByProductId);
    const key = String(item?.id ?? item?.productId ?? index);
    const broken = brokenThumbs.has(key);

    const first = index === 0;
    const last = index === items.length - 1;

    return (
      <View style={[
        styles.itemRow, styles.itemRowBox,
        first && styles.itemRowTop,
        last ? styles.itemRowBottom : styles.itemRowDivider,
        { marginTop: first ? 12 : 0 }
      ]}>
        {uri && !broken ? (
          <Image
            source={{ uri }}
            style={styles.thumb}
            onError={() => setBrokenThumbs(prev => { const s = new Set(prev); s.add(key); return s; })}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.thumbPlaceholder}><Text style={styles.thumbInitial}>{(title || '?').slice(0,1).toUpperCase()}</Text></View>
        )}
        <View style={styles.itemMain}>
          <Text numberOfLines={2} style={styles.itemTitle}>{title}</Text>
          <Text style={styles.itemSubtitle}>{qtyLabel}</Text>
        </View>
      </View>
    );
  };

  const ListHeader = (
    <View>
      {/* Información de la entrega */}
      <View style={styles.card}>
        <View style={styles.cardHeader}><Text style={styles.cardHeaderTitle}>Información de la entrega</Text></View>
        <View style={styles.cardBody}>
          <View style={styles.rowBetween}>
            <Text style={styles.infoTitle}>Pedido #{order.id}</Text>
            <StatusBadge status={order.status} />
          </View>
          <Text style={styles.infoRow}>{companyLabel}</Text>
          {/* Muestra “(dado de baja)” si aplica */}
          <Text style={styles.infoRow}>
            Solicitado por: {userLabel}
          </Text>
          {!!addressLabel && <Text style={styles.infoRow}>Dirección: {addressLabel}</Text>}
          {!!receivedBy && <Text style={styles.infoRow}>Recibido por: {receivedBy}</Text>}
        </View>
      </View>

      {/* Seguimiento del pedido */}
      <View style={[styles.card, { marginTop: 12 }]}>
        <View style={styles.cardHeader}><Text style={styles.cardHeaderTitle}>Seguimiento del pedido</Text></View>
        <View style={styles.cardBody}>
          {FLOW.map((step, idx) => {
            const state = idx < currentIdx ? 'done' : idx === currentIdx ? 'current' : 'pending';
            const when = whenByStep[step];
            return (
              <View key={step} style={styles.stepRow}>
                <View style={styles.stepCol}>
                  {idx > 0 && (
                    <View
                      style={[
                        styles.stepLine,
                        state === 'pending' ? styles.linePending : styles.lineDone,
                        { top: 0, bottom: 20 },
                      ]}
                    />
                  )}
                  <View
                    style={[
                      styles.dotBase,
                      state === 'done' && styles.dotDone,
                      state === 'current' && styles.dotCurrent,
                      state === 'pending' && styles.dotPending,
                    ]}
                  />
                </View>
                <View style={styles.stepContent}>
                  <Text style={[
                    styles.stepLabel,
                    state === 'done' && styles.doneText,
                    state === 'pending' && styles.pendingText,
                  ]}>
                    {STATUS_ES[step] || step}
                    {when ? (<Text style={styles.stepWhen}>  {formatWhen(when)}</Text>) : null}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );

  const ListFooter = (
    <View>
      {/* Acciones */}
      <Text style={styles.sectionActions}>Acciones</Text>
      <View style={styles.actions}>
        {next.map((s) => (
          <TouchableOpacity key={s} style={styles.btn} onPress={() => changeStatus(s)} disabled={updating}>
            <Text style={styles.btnText}>Marcar {s}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Cancelación */}
      {next.includes('CANCELLED') && (
        <>
          <Text style={styles.section}>Motivo de cancelación</Text>
          <TextInput
            style={[styles.input, styles.mbSm]}
            placeholder="Motivo (requerido)"
            value={cancelReason}
            onChangeText={setCancelReason}
          />
          <TouchableOpacity
            style={[styles.btn, styles.btnDanger, styles.mtSm]}
            onPress={() => changeStatus('CANCELLED')}
            disabled={updating || !cancelReason.trim()}
          >
            <Text style={styles.btnText}>Cancelar pedido</Text>
          </TouchableOpacity>
        </>
      )}
      <View style={{ height: 24 }} />
    </View>
  );

  return (
    <FlatList
      contentContainerStyle={{ padding: 12 }}
      data={items}
      keyExtractor={(it, idx) => String(it?.id ?? it?.productId ?? idx)}
      renderItem={renderItemRow}
      ListHeaderComponent={ListHeader}
      ListFooterComponent={ListFooter}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(); }}
        />
      }
    />
  );
}

const R = 14;

const styles = StyleSheet.create({
  section: { marginTop: 16, marginBottom: 6, fontWeight: '700', color: '#084999' },
  sectionActions: { marginTop: 16, marginBottom: 8, fontWeight: '700', color: '#084999' },

  // Card genérica
  card: { backgroundColor: '#fff', borderRadius: R, borderWidth: 1, borderColor: '#e5e7eb', overflow: 'hidden' },
  cardHeader: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  cardHeaderTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  cardBody: { paddingHorizontal: 14, paddingVertical: 12 },

  // Info entrega
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  infoTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  infoRow: { marginTop: 4, color: '#374151' },

  // Ítems
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#fff' },
  itemRowBox: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#e5e7eb' },
  itemRowTop: { borderTopLeftRadius: R, borderTopRightRadius: R, borderTopWidth: 1 },
  itemRowBottom: { borderBottomLeftRadius: R, borderBottomRightRadius: R, borderBottomWidth: 1 },
  itemRowDivider: { borderBottomWidth: 1, borderBottomColor: '#eef2f7' },

  thumb: { width: 72, height: 72, borderRadius: 12, marginRight: 14, backgroundColor: '#f3f4f6' },
  thumbPlaceholder: { width: 72, height: 72, borderRadius: 12, marginRight: 14, backgroundColor: '#edf2ff', alignItems: 'center', justifyContent: 'center' },
  thumbInitial: { fontWeight: '800', color: '#3b82f6' },

  itemMain: { flex: 1 },
  itemTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  itemSubtitle: { marginTop: 4, fontSize: 14, color: '#6b7280' },

  // Stepper
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6 },
  stepCol: { width: 28, alignItems: 'center', position: 'relative' },
  stepLine: { position: 'absolute', width: 2, left: 13 },
  lineDone: { backgroundColor: '#9ca3af' },
  linePending: { backgroundColor: '#e5e7eb' },
  dotBase: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#e5e7eb' },
  dotDone: { backgroundColor: '#9ca3af' },
  dotPending: { backgroundColor: '#e5e7eb' },
  dotCurrent: { backgroundColor: '#fff', borderWidth: 3, borderColor: '#111827', width: 18, height: 18, borderRadius: 9 },
  stepContent: { flex: 1, paddingLeft: 8, paddingRight: 8 },
  stepLabel: { fontSize: 16, fontWeight: '700', color: '#111827' },
  stepWhen: { color: '#6b7280', fontSize: 12, fontWeight: '500' },
  doneText: { color: '#6b7280' },
  pendingText: { color: '#9ca3af' },

  // Acciones / botones / input
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btn: { backgroundColor: '#084999', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, marginRight: 8, marginBottom: 8 },
  btnDanger: { backgroundColor: '#991b1b' },
  btnText: { color: '#fff', fontWeight: '700' },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 10, backgroundColor: '#fff' },
  mtSm: { marginTop: 10 },
  mbSm: { marginBottom: 10 },
});
