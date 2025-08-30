// kolder-app/src/screens/admin/AdminOrders.js
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, RefreshControl, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, ScrollView, TextInput, KeyboardAvoidingView,
  Platform, TouchableWithoutFeedback, Keyboard,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import ErrorBanner from '../../components/ErrorBanner';
import EmptyState from '../../components/EmptyState';
import StatusBadge from '../../components/StatusBadge';
import { useAuth } from '../../auth/context';

import { getAdminOrders } from '../../api/admin';
import * as CompaniesAPI from '../../api/companies';

const STATUS = ['SUBMITTED', 'CONFIRMED', 'PREPARING', 'EN_ROUTE', 'DELIVERED', 'CANCELLED'];
const STATUS_ES = { SUBMITTED:'Creado', CONFIRMED:'Confirmado', PREPARING:'Preparando', EN_ROUTE:'En ruta', DELIVERED:'Entregado', CANCELLED:'Cancelado' };
const PAGE_SIZE = 20;
const PRIMARY = '#084999';

function Pill({ active, label, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}
const normalizeRut = (s='') => String(s).replace(/[^0-9kK]/g,'').toLowerCase();
const normalizeText = (s='') =>
  String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();

const rangeLabel = (r) =>
  r === 'all' ? 'Todos' : r === 'today' ? 'Hoy' : r === 'week' ? 'Última semana' : 'Último mes';

export default function AdminOrders({ navigation, route }) {
  const { profile } = useAuth();

  // params entrantes (p.ej. desde AdminCompanyDetail)
  const paramCompanyId = Number(route?.params?.companyId ?? NaN);
  const paramRange = route?.params?.range || null;

  // datos
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);

  // filtros
  const [statusFilter, setStatusFilter] = useState(null);
  const [range, setRange] = useState('all');
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState(undefined);
  const [companyPickerOpen, setCompanyPickerOpen] = useState(false);
  const [companySearch, setCompanySearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  // usuarios actuales de la empresa seleccionada (para marcar “dado de baja”)
  const [companyUserIds, setCompanyUserIds] = useState(() => new Set());

  // ui
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [err, setErr] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // inicializa desde params
  useEffect(() => {
    const cameWithCompany = Number.isFinite(paramCompanyId);
    if (cameWithCompany) setCompanyId(paramCompanyId);
    if (paramRange) setRange(paramRange);
    if (cameWithCompany || paramRange) setPage(1);
  }, [paramCompanyId, paramRange]);

  const activeFiltersCount = useMemo(() => {
    let n = 0; if (range && range !== 'all') n++; if (statusFilter) n++; return n;
  }, [range, statusFilter]);

  const filtersSummary = useMemo(() => {
    const parts = [];
    if (range && range !== 'all') parts.push(rangeLabel(range));
    if (statusFilter) parts.push(STATUS_ES[statusFilter] || statusFilter);
    return parts.length ? `Filtros: ${parts.join(' · ')}` : 'Filtros';
  }, [range, statusFilter]);

  const loadCompanies = useCallback(async () => {
    try {
      const list = await CompaniesAPI.list();
      const arr = Array.isArray(list) ? list : [];
      if (!arr.length && profile?.company?.id) {
        setCompanies([{ id: profile.company.id, name: profile.company.name, rut: profile.company.rut }]);
      } else {
        setCompanies(arr);
      }
    } catch {
      if (profile?.company?.id) {
        setCompanies([{ id: profile.company.id, name: profile.company.name, rut: profile.company.rut }]);
      } else {
        setCompanies([]);
      }
    }
  }, [profile?.company]);

  // carga set de usuarios actuales de la empresa seleccionada
  const loadCompanyUsers = useCallback(async () => {
    if (!Number.isFinite(companyId)) {
      setCompanyUserIds(new Set());
      return;
    }
    try {
      const rows = await CompaniesAPI.listUsers({ companyId });
      const ids = new Set((Array.isArray(rows) ? rows : []).map(u => Number(u.id)));
      setCompanyUserIds(ids);
    } catch {
      setCompanyUserIds(new Set());
    }
  }, [companyId]);

  // carga pedidos
  const load = useCallback(async () => {
    setErr(null);
    const isFirstPage = page === 1;
    if (isFirstPage) setLoading(true); else setLoadingMore(true);
    try {
      const params = { adminScope: 1, page, pageSize: PAGE_SIZE, range: range || 'all' };
      if (Number.isFinite(companyId)) { params.companyId = companyId; params.company_id = companyId; }
      if (statusFilter) params.status = statusFilter;

      const res = await getAdminOrders(params);
      const list =
        (Array.isArray(res?.orders) && res.orders) ||
        (Array.isArray(res?.data?.orders) && res.data.orders) ||
        (Array.isArray(res) && res) || [];
      const tot =
        Number.isFinite(res?.total) ? Number(res.total) :
        Number.isFinite(res?.data?.total) ? Number(res.data.total) :
        list.length;

      setTotal(tot);
      setHasMore(page * PAGE_SIZE < tot);
      if (isFirstPage) setOrders(list);
      else setOrders(prev => {
        const seen = new Set(prev.map(o => o.id));
        const merged = prev.slice();
        for (const o of list) if (!seen.has(o.id)) merged.push(o);
        return merged;
      });
    } catch (e) {
      setErr(e?.message || 'Error cargando pedidos');
      if (isFirstPage) { setOrders([]); setTotal(0); setHasMore(false); }
    } finally {
      if (isFirstPage) setLoading(false); else setLoadingMore(false);
      setRefreshing(false);
    }
  }, [companyId, range, page, statusFilter]);

  useEffect(() => { loadCompanies(); }, [loadCompanies]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadCompanyUsers(); }, [loadCompanyUsers]);

  const resetAndReload = useCallback(() => { setPage(1); }, []);
  const onRefresh = () => { setRefreshing(true); setPage(1); };
  const onEndReached = () => { if (!loading && !loadingMore && hasMore) setPage(p=>p+1); };

  const selectedCompanyLabel = useMemo(() => {
    if (!Number.isFinite(companyId)) return 'Todas las empresas';
    const c = companies.find(x=>x.id===companyId);
    return c ? (c.rut ? `${c.name} · ${c.rut}` : c.name) : 'Todas las empresas';
  }, [companyId, companies]);

  const totalLabel = useMemo(() => {
    const n = Number(total || 0);
    return `Total: ${n} pedido${n === 1 ? '' : 's'}`;
  }, [total]);

  const filteredCompanies = useMemo(() => {
    const raw = companySearch;
    const qLower = raw.trim().toLowerCase();
    const qNorm  = normalizeText(raw);
    const qRut   = normalizeRut(raw);
    if (!qLower && !qNorm && !qRut) return companies;
    return companies.filter(c => {
      const name = String(c.name||''); const nameLower = name.toLowerCase(); const nameNorm = normalizeText(name);
      const rutNorm = normalizeRut(c.rut||'');
      return (qLower && nameLower.includes(qLower)) || (qNorm && nameNorm.includes(qNorm)) || (qRut && rutNorm.includes(qRut));
    });
  }, [companies, companySearch]);

  // -------- Navegación al DETALLE --------
  const openDetail = (id) => {
    const params = { id, orderId: id };
    navigation.push('AdminOrderDetail', params);
  };

  // Detecta si el usuario del pedido ya no pertenece a la empresa seleccionada
  const isUserDroppedForSelectedCompany = (order) => {
    if (!Number.isFinite(companyId)) return false; // solo marcamos cuando hay empresa seleccionada
    const uid = Number(order?.user?.id ?? NaN);
    if (!Number.isFinite(uid)) return false;
    return !companyUserIds.has(uid);
  };

  const renderItem = ({ item }) => {
    const dropped = isUserDroppedForSelectedCompany(item);
    const userLabelBase = item.user?.name || item.user?.email || '—';
    const userLabelExtra = item.user?.name && item.user?.email ? ` · ${item.user.email}` : '';
    const userFull = `${userLabelBase}${userLabelExtra}`;

    return (
      <TouchableOpacity style={styles.item} onPress={() => openDetail(item.id)}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Pedido #{item.id}</Text>
          <Text style={styles.sub}>
            {(item.company?.name ?? '—')}{item.company?.rut ? ` · ${item.company.rut}` : ''} • {new Date(item.createdAt).toLocaleString('es-CL')}
          </Text>
          <Text style={styles.sub}>
            Ítems: {Array.isArray(item.items) ? item.items.length : 0} • Usuario:{' '}
            <Text style={dropped ? styles.userDropped : undefined}>
              {userFull}{dropped ? ' (dado de baja)' : ''}
            </Text>
          </Text>
        </View>
        <StatusBadge status={item.status} />
      </TouchableOpacity>
    );
  };

  const listFooter = () => !loadingMore ? null : (
    <View style={{ paddingVertical: 12, alignItems: 'center' }}>
      <ActivityIndicator />
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      {err && <ErrorBanner message={err} onRetry={() => { setPage(1); }} />}

      <View style={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 15 }}>Pedidos (Admin)</Text>

        {/* Selector de empresa (pill estándar) */}
        <TouchableOpacity
          onPress={() => setCompanyPickerOpen(true)}
          style={styles.selectBtn}
          activeOpacity={0.85}
        >
          <Text style={styles.selectBtnTxt}>{selectedCompanyLabel}</Text>
          <Text style={styles.chevSmall}>›</Text>
        </TouchableOpacity>

        {/* Selector de filtros (misma UI que el de empresa) */}
        <View style={{ marginTop: 10 }}>
          <TouchableOpacity
            onPress={() => setFiltersOpen(true)}
            style={styles.selectBtn}
            activeOpacity={0.85}
          >
            <Text style={styles.selectBtnTxt}>
              {filtersSummary}{activeFiltersCount ? ` (${activeFiltersCount})` : ''}
            </Text>
            <Text style={styles.chevSmall}>›</Text>
          </TouchableOpacity>
        </View>

        <Text style={{ color: '#6b7280', marginTop: 10 }}>{totalLabel}</Text>
      </View>

      {loading ? (
        <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}><ActivityIndicator /></View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o)=>String(o.id)}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ padding: 12, flexGrow: 1 }}
          ListEmptyComponent={<EmptyState title="Sin pedidos" subtitle="Ajusta filtros o intenta más tarde." />}
          onEndReachedThreshold={0.4}
          onEndReached={onEndReached}
          ListFooterComponent={listFooter}
        />
      )}

      {/* Modal selector empresa */}
      <Modal visible={companyPickerOpen} animationType="slide" transparent onRequestClose={()=>setCompanyPickerOpen(false)}>
        <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalBackdrop}>
              <View style={styles.modalSheet}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Seleccionar empresa</Text>
                  <TouchableOpacity onPress={()=>setCompanyPickerOpen(false)}><Text style={styles.modalCloseText}>Cerrar</Text></TouchableOpacity>
                </View>

                <View style={{ paddingHorizontal: 12, paddingTop: 8 }}>
                  <View style={styles.searchWrap}>
                    <TextInput
                      placeholder="Buscar por nombre o RUT…"
                      value={companySearch}
                      onChangeText={setCompanySearch}
                      autoFocus
                      style={styles.search}
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="search"
                    />
                    <Feather name="search" size={18} color="#64748b" style={styles.searchIconL} pointerEvents="none" />
                    {companySearch ? (
                      <TouchableOpacity onPress={()=>setCompanySearch('')} style={styles.clearBtn} hitSlop={{ top:8, left:8, bottom:8, right:8 }}>
                        <Feather name="x-circle" size={18} color="#94a3b8" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>

                <ScrollView
                  style={{ paddingHorizontal:12, paddingTop:8 }}
                  contentContainerStyle={{ paddingBottom:24 }}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                >
                  <TouchableOpacity
                    onPress={() => { setCompanyId(undefined); resetAndReload(); setCompanyPickerOpen(false); }}
                    style={styles.pickerItem}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.pickerItemText, !Number.isFinite(companyId) && styles.pickerItemTextBold]}>
                      Todas las empresas
                    </Text>
                  </TouchableOpacity>

                  {filteredCompanies.map(c => (
                    <TouchableOpacity
                      key={c.id}
                      onPress={() => { setCompanyId(c.id); resetAndReload(); setCompanyPickerOpen(false); }}
                      style={styles.pickerItem}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.pickerItemText, companyId === c.id && styles.pickerItemTextBold]}>
                        {c.name}{c.rut ? ` · ${c.rut}` : ''}
                      </Text>
                    </TouchableOpacity>
                  ))}

                  {companies.length === 0 && (
                    <View style={{ paddingVertical:16 }}>
                      <Text style={{ color:'#6b7280' }}>No se encontraron empresas.</Text>
                    </View>
                  )}
                </ScrollView>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal de filtros (pill estándar) */}
      <Modal visible={filtersOpen} animationType="slide" transparent onRequestClose={()=>setFiltersOpen(false)}>
        <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Filtros</Text>
                <TouchableOpacity onPress={()=>setFiltersOpen(false)}><Text style={styles.modalCloseText}>Cerrar</Text></TouchableOpacity>
              </View>

              <ScrollView style={{ paddingHorizontal:12, paddingTop:8 }} contentContainerStyle={{ paddingBottom:24 }}>
                <Text style={{ fontWeight:'600', marginBottom: 8 }}>Rango</Text>
                <FlatList
                  data={['today', 'week', 'month', 'all']}
                  horizontal keyExtractor={(v)=>v}
                  renderItem={({ item }) => (
                    <Pill
                      label={rangeLabel(item)}
                      active={range === item}
                      onPress={() => { setRange(item); resetAndReload(); }}
                    />
                  )}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 2 }}
                />

                <Text style={{ fontWeight:'600', marginTop: 14, marginBottom: 8 }}>Estado</Text>
                <FlatList
                  data={[null, ...STATUS]} horizontal
                  keyExtractor={(s,i)=>String(s ?? 'ALL')+i}
                  renderItem={({ item }) => {
                    const active = (item ?? null) === statusFilter;
                    const label = item ? (STATUS_ES[item] || item) : 'Todos';
                    return (
                      <TouchableOpacity style={[styles.chip, active && styles.chipActive]}
                        onPress={() => { setStatusFilter(item ?? null); resetAndReload(); }}>
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
                      </TouchableOpacity>
                    );
                  }}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 2 }}
                />
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  // chips (filtros)
  chip:{ paddingHorizontal:12, paddingVertical:8, borderRadius:20, borderWidth:1, borderColor:'#d1d5db', marginRight:8, backgroundColor:'#fff' },
  chipActive:{ backgroundColor:PRIMARY, borderColor:PRIMARY },
  chipText:{ color:'#374151' },
  chipTextActive:{ color:'#fff', fontWeight:'700' },

  // select pill (mismo diseño que AdminCompanies)
  selectBtn: {
    borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 10, backgroundColor: '#fff',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  selectBtnTxt: { fontWeight: '700', color: '#0b1f3a' },
  chevSmall: { fontSize: 20, color: '#94a3b8', paddingLeft: 6 },

  // ítem pedido
  item:{ flexDirection:'row', gap:8, backgroundColor:'#fff', borderRadius:12, borderWidth:1, borderColor:'#e5e7eb', padding:12, marginBottom:10 },
  title:{ fontSize:16, fontWeight:'700' },
  sub:{ fontSize:12, color:'#6b7280' },
  userDropped:{ color:'#b91c1c', fontWeight:'700' },

  // modal base
  modalBackdrop:{ flex:1, backgroundColor:'rgba(0,0,0,0.25)', justifyContent:'flex-end' },
  modalSheet:{ backgroundColor:'#fff', borderTopLeftRadius:16, borderTopRightRadius:16, maxHeight:'80%', paddingBottom:0, overflow:'hidden' },
  modalHeader:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:16, borderBottomWidth:1, borderBottomColor:'#eee' },
  modalTitle:{ fontSize:16, fontWeight:'700' },
  modalCloseText:{ fontSize:14, color:PRIMARY, fontWeight:'600' },

  // buscador del picker de empresas (idéntico a AdminCompanies)
  searchWrap: { position: 'relative' },
  search: {
    borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10,
    paddingHorizontal: 36, paddingVertical: 10, backgroundColor: '#fff',
  },
  searchIconL: { position: 'absolute', left: 12, top: 9, zIndex: 2 },
  clearBtn: { position: 'absolute', right: 12, top: 8, zIndex: 2 },

  // items del picker
  pickerItem: { paddingVertical: 12 },
  pickerItemText: { color: '#0b1f3a', fontSize: 16, fontWeight: '500' },
  pickerItemTextBold: { fontWeight: '800' },
});
