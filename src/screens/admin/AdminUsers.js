// src/screens/admin/AdminUsers.js
import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, RefreshControl, Modal, TextInput, Switch, ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import API from '../../api/client';
import ErrorBanner from '../../components/ErrorBanner';
import EmptyState from '../../components/EmptyState';
import { useAuth } from '../../auth/context';

// ====== Config paginación ======
const PAGE_SIZE_USERS = 30;
const PAGE_SIZE_COMPANIES = 30;

// Roles existentes (para etiquetas/filtros)
const ROLES_ALL = ['USER', 'COMPANY_ADMIN', 'ADMIN_GENERAL', 'SUPER_ADMIN'];
// Roles asignables desde la UI (EXCLUYE SUPER_ADMIN)
const ROLES_SELECTABLE = ['USER', 'COMPANY_ADMIN', 'ADMIN_GENERAL'];
const ROLE_FILTERS = ['TODOS', ...ROLES_ALL];

// ---------- helpers ----------
const normUser = (u) => {
  const roleUp = String(u.role ?? '').toUpperCase();
  const companyId = (u.companyId ?? u.company_id ?? u.company?.id ?? null);
  return {
    ...u,
    role: roleUp || 'USER',
    companyId,
    companyAdmin: !!(u.companyAdmin ?? u.isCompanyAdmin) || roleUp === 'COMPANY_ADMIN',
    isBlocked: !!(u.isBlocked ?? u.blocked),
  };
};

const stableUserKey = (u, i) =>
  String(u?.id ?? u?._id ?? u?.email ?? `${u?.name || 'user'}-${u?.createdAt || ''}-${i}`);

const stableCompanyKey = (c, i) =>
  String(c?.id ?? c?._id ?? c?.rut ?? `${c?.name || 'company'}-${i}`);

const dedupeByKey = (arr, keyFn) => {
  const map = new Map();
  arr.forEach((item, i) => {
    const k = keyFn(item, i);
    if (!map.has(k)) map.set(k, item);
  });
  return Array.from(map.values());
};

function RolePill({ value, selected, onPress, mr = 8, small = false }) {
  const isSel = !!selected;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[
        small ? styles.pillSm : styles.pill,
        isSel ? styles.pillSel : styles.pillOff,
        { marginRight: mr },
      ]}
    >
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        style={
          isSel
            ? (small ? styles.pillSelTxtSm : styles.pillSelTxt)
            : (small ? styles.pillOffTxtSm : styles.pillOffTxt)
        }
      >
        {value}
      </Text>
    </TouchableOpacity>
  );
}

export default function AdminUsers({ navigation }) {
  const { profile } = useAuth();
  const isSuper = String(profile?.role || '').toUpperCase() === 'SUPER_ADMIN';

  // ====== Estado usuarios (paginado) ======
  const [users, setUsers] = useState([]);
  const usersRef = useRef(users);
  useEffect(() => { usersRef.current = users; }, [users]);

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ====== Estado empresas (paginado para picker) ======
  const [companies, setCompanies] = useState([]);
  const companiesRef = useRef(companies);
  useEffect(() => { companiesRef.current = companies; }, [companies]);

  const [compPage, setCompPage] = useState(1);
  const [compHasMore, setCompHasMore] = useState(true);
  const [compLoadingMore, setCompLoadingMore] = useState(false);

  const [err, setErr] = useState(null);

  // búsqueda y filtro por rol
  const [q, setQ] = useState('');
  const [querying, setQuerying] = useState(false); // 👈 igual que en AdminCompanies
  const [roleFilter, setRoleFilter] = useState('TODOS');

  // modal usuario
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    id: null,
    name: '',
    email: '',
    password: '',
    role: 'USER',
    companyAdmin: false,
    companyId: null,
    blocked: false,
  });

  // modal selector de empresa
  const [companyPickerOpen, setCompanyPickerOpen] = useState(false);
  const [companySearch, setCompanySearch] = useState('');

  const resetForm = useCallback(() => {
    setIsEditing(false);
    setForm({
      id: null,
      name: '',
      email: '',
      password: '',
      role: 'USER',
      companyAdmin: false,
      companyId: null,
      blocked: false,
    });
  }, []);

  const openCreateModal = () => { resetForm(); setModalVisible(true); };

  const openEditModal = (u) => {
    const nu = normUser(u);
    setIsEditing(true);
    setForm({
      id: nu.id,
      name: nu.name || '',
      email: nu.email || '',
      password: '',
      role: nu.role || 'USER',
      companyAdmin: !!nu.companyAdmin,
      companyId: nu.companyId ?? null,
      blocked: !!nu.isBlocked,
    });
    setModalVisible(true);
  };

  const openCompanyPicker = () => {
    setCompanySearch('');
    setModalVisible(false);
    setTimeout(() => setCompanyPickerOpen(true), 60);
  };

  const closeCompanyPicker = (reopenUserModal = true) => {
    setCompanyPickerOpen(false);
    if (reopenUserModal) setTimeout(() => setModalVisible(true), 60);
  };

  // ====== Cargar USUARIOS (paginado) ======
  const loadUsers = useCallback(async ({ reset = false, pageArg } = {}) => {
    try {
      const nextPage = reset ? 1 : (Number.isFinite(pageArg) ? pageArg : 1);

      const params = {
        page: nextPage,
        pageSize: PAGE_SIZE_USERS,
        q: q.trim() || undefined,
        role: roleFilter !== 'TODOS' ? roleFilter : undefined,
      };

      const res = await API.adminListUsers(params);

      const items = Array.isArray(res?.items)
        ? res.items
        : Array.isArray(res?.rows)
        ? res.rows
        : Array.isArray(res)
        ? res
        : [];

      const normalized = items.map(normUser);

      let dedupedOut = [];
      setUsers(prev => {
        const base = reset ? [] : (usersRef.current || prev || []);
        const merged = [...base, ...normalized];
        const d = dedupeByKey(merged, stableUserKey);
        dedupedOut = d;
        return d;
      });

      const total = res?.total ?? res?.count;
      const more = total != null
        ? (dedupedOut.length < Number(total))
        : (normalized.length === PAGE_SIZE_USERS);

      setHasMore(more);
      setPage(p => (reset ? 2 : p + 1));
    } catch (e) {
      setErr(e?.message || 'Error cargando usuarios');
    }
  }, [q, roleFilter]);

  // ====== Cargar EMPRESAS (paginado para picker) ======
  const loadCompanies = useCallback(async ({ reset = false, pageArg } = {}) => {
    try {
      if (!isSuper) { setCompanies([]); setCompHasMore(false); setCompPage(1); return; }
      const nextPage = reset ? 1 : (Number.isFinite(pageArg) ? pageArg : 1);

      const params = {
        page: nextPage,
        pageSize: PAGE_SIZE_COMPANIES,
        q: companySearch.trim() || undefined,
      };

      const res = await API.adminListCompanies(params);

      const items = Array.isArray(res?.items)
        ? res.items
        : Array.isArray(res?.rows)
        ? res.rows
        : Array.isArray(res?.companies)
        ? res.companies
        : Array.isArray(res)
        ? res
        : [];

      let dedupedOut = [];
      setCompanies(prev => {
        const base = reset ? [] : (companiesRef.current || prev || []);
        const merged = [...base, ...items];
        const d = dedupeByKey(merged, stableCompanyKey);
        dedupedOut = d;
        return d;
      });

      const total = res?.total ?? res?.count;
      const more = total != null
        ? (dedupedOut.length < Number(total))
        : (items.length === PAGE_SIZE_COMPANIES);

      setCompHasMore(more);
      setCompPage(p => (reset ? 2 : p + 1));
    } catch (e) {
      setErr(e?.message || 'Error cargando empresas');
    }
  }, [isSuper, companySearch]);

  // ====== Carga inicial ======
  const load = useCallback(async () => {
    setErr(null);
    try {
      setLoading(true);
      await Promise.all([
        loadUsers({ reset: true, pageArg: 1 }),
        loadCompanies({ reset: true, pageArg: 1 }),
      ]);
    } catch (e) {
      setErr(e?.message || 'Error cargando datos');
    } finally {
      setLoading(false);
    }
  }, [loadUsers, loadCompanies]);

  // refresh (pull to refresh)
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadUsers({ reset: true, pageArg: 1 }),
        isSuper ? loadCompanies({ reset: true, pageArg: 1 }) : Promise.resolve(),
      ]);
    } catch (e) {
      setErr(e?.message || 'Error recargando');
    } finally {
      setRefreshing(false);
    }
  }, [loadUsers, loadCompanies, isSuper]);

  // al enfocar la pantalla
  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation, load]);

  // cerrar picker si se cierra el modal principal
  useEffect(() => {
    if (!modalVisible) setCompanyPickerOpen(false);
  }, [modalVisible]);

  // cuando cambian búsqueda/rol -> resetear usuarios (debounce) + querying como en Companies
  useEffect(() => {
    let mounted = true;
    const t = setTimeout(async () => {
      if (!mounted) return;
      setQuerying(true);
      try {
        await loadUsers({ reset: true, pageArg: 1 });
      } finally {
        if (mounted) setQuerying(false);
      }
    }, 200);
    return () => { mounted = false; clearTimeout(t); };
  }, [q, roleFilter, loadUsers]);

  // cuando se abre el picker o cambia el término de búsqueda -> resetear empresas (debounce)
  useEffect(() => {
    if (companyPickerOpen) {
      const t = setTimeout(() => {
        loadCompanies({ reset: true, pageArg: 1 });
      }, 200);
      return () => clearTimeout(t);
    }
  }, [companyPickerOpen, companySearch, loadCompanies]);

  const confirmDelete = (id) => {
    Alert.alert(
      'Confirmar',
      '¿Eliminar este usuario?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await API.adminDeleteUser(id);
              setModalVisible(false);
              await refresh();
            } catch (e) {
              const status = e?.response?.status;
              const msg = status === 403
                ? 'No tienes permisos para eliminar usuarios.'
                : (e?.message || 'No se pudo eliminar');
              Alert.alert('Error', msg);
            }
          },
        },
      ],
    );
  };

  const roleColor = (r) => {
    switch (String(r || '').toUpperCase()) {
      case 'SUPER_ADMIN': return '#0b3b80';
      case 'ADMIN_GENERAL': return '#084999';
      case 'COMPANY_ADMIN': return '#155e75';
      default: return '#334155';
    }
  };

  const companyNameOf = useCallback((companyId) => {
    if (companyId == null) return null;
    const c = companies.find((x) => String(x.id) === String(companyId));
    return c?.name || `Empresa #${companyId}`;
  }, [companies]);

  // ====== Filtro local (backup si el backend ignora filtros) ======
  const usersView = useMemo(() => {
    const term = q.trim().toLowerCase();
    const rf = String(roleFilter).toUpperCase();
    return users.filter(u => {
      const roleOk = rf === 'TODOS' || String(u.role).toUpperCase() === rf;
      if (!term) return roleOk;
      const hay = [
        u.name, u.username, u.fullName, u.email,
        u.company?.name, u.companyName, u.rut, u.phone,
      ].map(x => String(x || '').toLowerCase());
      const match = hay.some(x => x.includes(term));
      return roleOk && match;
    });
  }, [users, q, roleFilter]);

  const roleUp = String(form.role).toUpperCase();

  // ====== Guardar ======
  const handleSave = async () => {
    try {
      if (!isSuper) {
        Alert.alert('Permisos', 'Solo SUPER_ADMIN puede crear/editar usuarios.');
        return;
      }
      if (!form.email || !form.name) {
        Alert.alert('Validación', 'Nombre y Email son obligatorios.');
        return;
      }
      if (isEditing && !form.id) {
        Alert.alert('Error', 'Falta ID de usuario.');
        return;
      }
      const roleUpLocal = String(form.role).toUpperCase();
      if (roleUpLocal === 'SUPER_ADMIN') {
        Alert.alert('Rol no permitido', 'No se puede asignar el rol SUPER_ADMIN desde esta interfaz.');
        return;
      }

      const companyIdRaw = form.companyId ?? null;

      if ((roleUpLocal === 'USER' || roleUpLocal === 'COMPANY_ADMIN') && (companyIdRaw == null || companyIdRaw === '')) {
        Alert.alert('Empresa requerida', 'Debes seleccionar una empresa para este usuario.');
        return;
      }

      const base = {
        email: form.email.trim().toLowerCase(),
        name: form.name.trim(),
        role: roleUpLocal,
        blocked: !!form.blocked,
      };
      if (form.password && form.password.trim()) {
        base.password = form.password.trim();
      }

      if (isEditing) {
        if (roleUpLocal === 'USER') {
          await API.adminUpdateUser(form.id, {
            ...base,
            companyAdmin: false,
            isCompanyAdmin: false,
          });
          await API.adminUpdateUser(form.id, {
            company_id: companyIdRaw,
            companyId: companyIdRaw,
          });
        } else if (roleUpLocal === 'COMPANY_ADMIN') {
          await API.adminUpdateUser(form.id, {
            ...base,
            companyAdmin: true,
            isCompanyAdmin: true,
            company_id: companyIdRaw,
            companyId: companyIdRaw,
          });
        } else { // ADMIN_GENERAL
          await API.adminUpdateUser(form.id, {
            ...base,
            companyAdmin: false,
            isCompanyAdmin: false,
            company_id: null,
            companyId: null,
          });
        }
      } else {
        if (roleUpLocal === 'COMPANY_ADMIN') {
          await API.adminCreateUser({
            ...base,
            companyAdmin: true,
            isCompanyAdmin: true,
            company_id: companyIdRaw,
            companyId: companyIdRaw,
          });
        } else if (roleUpLocal === 'USER') {
          await API.adminCreateUser({
            ...base,
            company_id: companyIdRaw,
            companyId: companyIdRaw,
          });
        } else { // ADMIN_GENERAL
          await API.adminCreateUser({
            ...base,
            company_id: null,
            companyId: null,
            companyAdmin: false,
            isCompanyAdmin: false,
          });
        }
      }

      setModalVisible(false);
      resetForm();
      await refresh();
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'No fue posible guardar';
      Alert.alert('Error', msg);
    }
  };

  return (
    <View style={{ flex: 1, padding: 12 }}>
      {err && <ErrorBanner message={err} onRetry={load} />}

      {/* Acciones superiores */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        {isSuper && (
          <TouchableOpacity style={styles.newBtn} onPress={openCreateModal}>
            <Text style={styles.newBtnText}>+ Nuevo Usuario</Text>
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }} />
      </View>

      {/* Buscador (mismo patrón que AdminCompanies: ícono izquierda + clear/spinner derecha) */}
      <View style={{ marginBottom: 10 }}>
        <View style={styles.searchWrap}>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Buscar por nombre o email..."
            style={styles.search}
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={() => loadUsers({ reset: true, pageArg: 1 })}
          />
          <Feather name="search" size={18} color="#64748b" style={styles.searchIconL} pointerEvents="none" />
          {q.length > 0 ? (
            <TouchableOpacity onPress={() => setQ('')} style={styles.clearBtn} hitSlop={{ top: 8, left: 8, bottom: 8, right: 8 }}>
              <Feather name="x-circle" size={18} color="#94a3b8" />
            </TouchableOpacity>
          ) : querying ? (
            <ActivityIndicator size="small" style={styles.clearBtn} />
          ) : null}
        </View>
      </View>

      {/* Filtros por rol — compacto */}
      <View style={styles.pillsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsContent}>
          {ROLE_FILTERS.map((rf, idx) => (
            <RolePill
              key={`filter:${rf}`}
              value={rf}
              selected={roleFilter === rf}
              onPress={() => {
                setRoleFilter(rf);
                setPage(1); setHasMore(true);
              }}
              mr={idx === ROLE_FILTERS.length - 1 ? 0 : 8}
            />
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator size="large" />
      ) : (
        <FlatList
          data={usersView}
          keyExtractor={(u, i) => stableUserKey(u, i)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          onEndReachedThreshold={0.4}
          onEndReached={async () => {
            if (!loading && !loadingMore && hasMore) {
              try {
                setLoadingMore(true);
                await loadUsers({ pageArg: page });
              } finally {
                setLoadingMore(false);
              }
            }
          }}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator style={{ marginVertical: 12 }} /> :
            !hasMore ? <View style={{ height: 8 }} /> : null
          }
          renderItem={({ item: u }) => (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{u.name || '(Sin nombre)'}</Text>
                <Text style={styles.sub}>{u.email}</Text>
                <View style={styles.badges}>
                  <Text style={[styles.badge, { backgroundColor: '#eef2ff', color: roleColor(u.role) }]}>
                    {String(u.role || 'USER').toUpperCase()}
                  </Text>

                  {String(u.role).toUpperCase() !== 'COMPANY_ADMIN' && u.companyAdmin && (
                    <Text style={[styles.badge, { backgroundColor: '#e0f2fe', color: '#0369a1' }]}>
                      COMPANY_ADMIN
                    </Text>
                  )}

                  {u.companyId != null ? (
                    <Text style={[styles.badge, { backgroundColor: '#f1f5f9', color: '#334155' }]}>
                      {companyNameOf(u.companyId)}
                    </Text>
                  ) : null}

                  {u.isBlocked && (
                    <Text style={[styles.badge, { backgroundColor: '#fee2e2', color: '#991b1b' }]}>
                      BLOQUEADO
                    </Text>
                  )}
                </View>
              </View>

              {isSuper && (
                <View style={{ gap: 6 }}>
                  <TouchableOpacity style={styles.link} onPress={() => openEditModal(u)}>
                    <Text style={styles.linkText}>Editar</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={
            !loading && <EmptyState title="Sin usuarios" subtitle="Crea el primero con el botón superior." />
          }
        />
      )}

      {/* Modal create/edit */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView contentContainerStyle={{ paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{isEditing ? 'Editar Usuario' : 'Nuevo Usuario'}</Text>
                <TouchableOpacity
                  onPress={() => { setModalVisible(false); resetForm(); }}
                  hitSlop={{ top: 10, left: 10, bottom: 10, right: 10 }}
                >
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Nombre</Text>
              <TextInput value={form.name} onChangeText={(t) => setForm((s) => ({ ...s, name: t }))} placeholder="Nombre" style={styles.input} />

              <Text style={styles.label}>Email</Text>
              <TextInput value={form.email} onChangeText={(t) => setForm((s) => ({ ...s, email: t }))} autoCapitalize="none" keyboardType="email-address" placeholder="correo@dominio.cl" style={styles.input} />

              <Text style={styles.label}>{isEditing ? 'Cambiar Password (opcional)' : 'Password (opcional)'}</Text>
              <TextInput value={form.password} onChangeText={(t) => setForm((s) => ({ ...s, password: t }))} placeholder={isEditing ? 'Dejar vacío para no cambiar' : 'Si se omite, se genera provisoria'} secureTextEntry style={styles.input} />

              {/* Selector de rol (sin SUPER_ADMIN) */}
              <Text style={styles.label}>Rol</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {ROLES_SELECTABLE.map((r, i) => (
                  <RolePill key={`sel:${r}`} value={r} selected={form.role === r} onPress={() => setForm((s) => ({ ...s, role: r }))} mr={i === ROLES_SELECTABLE.length - 1 ? 0 : 8} small />
                ))}
              </View>

              {/* Empresa obligatoria para USER o COMPANY_ADMIN */}
              {(roleUp === 'USER' || roleUp === 'COMPANY_ADMIN') && (
                <>
                  <Text style={[styles.label, { marginTop: 12 }]}>Empresa (obligatoria)</Text>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <TouchableOpacity style={[styles.selectBtn, { flex: 1 }]} onPress={openCompanyPicker}>
                      <Text style={styles.selectBtnTxt}>
                        {form.companyId != null
                          ? (companyNameOf(form.companyId) || `Empresa #${form.companyId}`)
                          : 'Seleccionar empresa'}
                      </Text>
                    </TouchableOpacity>
                    {form.companyId != null && (
                      <TouchableOpacity
                        onPress={() => setForm(s => ({ ...s, companyId: null }))}
                        style={[styles.selectBtn, { backgroundColor: '#f8fafc' }]}
                      >
                        <Text style={{ fontWeight: '700', color: '#991b1b' }}>Quitar</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              )}

              <View style={styles.switchRow}>
                <Text style={styles.label}>Bloqueado</Text>
                <Switch value={!!form.blocked} onValueChange={(v) => setForm((s) => ({ ...s, blocked: v }))} />
              </View>

              <View style={{ height: 12 }} />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity style={[styles.bigBtn, styles.secondary]} onPress={() => { setModalVisible(false); resetForm(); }}>
                  <Text style={styles.bigBtnTxtSecondary}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.bigBtn, styles.primary]} onPress={handleSave}>
                  <Text style={styles.bigBtnTxt}>Guardar</Text>
                </TouchableOpacity>
              </View>

              {isEditing && isSuper && (
                <TouchableOpacity onPress={() => confirmDelete(form.id)} style={[styles.bigBtn, { marginTop: 12, backgroundColor: '#fee2e2' }]}>
                  <Text style={{ color: '#991b1b', fontWeight: '700', fontSize: 16 }}>Eliminar Usuario</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal buscador de empresas */}
      <Modal
        visible={companyPickerOpen}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={() => closeCompanyPicker(true)}
      >
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar empresa</Text>
              <TouchableOpacity onPress={() => closeCompanyPicker(true)} hitSlop={{ top: 10, left: 10, bottom: 10, right: 10 }}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              value={companySearch}
              onChangeText={setCompanySearch}
              placeholder="Buscar empresa..."
              style={[styles.input, { marginBottom: 10 }]}
            />
            <FlatList
              data={companies.filter(c => {
                const t = companySearch.trim().toLowerCase();
                if (!t) return true;
                return String(c.name || '').toLowerCase().includes(t) || String(c.rut || '').toLowerCase().includes(t);
              })}
              keyExtractor={(c, i) => stableCompanyKey(c, i)}
              keyboardShouldPersistTaps="handled"
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              contentContainerStyle={{ paddingTop: 4, paddingBottom: 8 }}
              onEndReachedThreshold={0.4}
              onEndReached={async () => {
                if (companyPickerOpen && compHasMore && !compLoadingMore) {
                  try {
                    setCompLoadingMore(true);
                    await loadCompanies({ pageArg: compPage });
                  } finally {
                    setCompLoadingMore(false);
                  }
                }
              }}
              ListFooterComponent={
                compLoadingMore ? <ActivityIndicator style={{ marginVertical: 8 }} /> :
                !compHasMore ? <View style={{ height: 4 }} /> : null
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerRow}
                  onPress={() => {
                    setForm((s) => ({ ...s, companyId: item.id }));
                    closeCompanyPicker(true);
                  }}
                >
                  <Text style={{ fontWeight: '700' }}>{item.name}</Text>
                  {item.rut ? <Text style={{ color: '#64748b' }}>{item.rut}</Text> : null}
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#64748b', marginTop: 16 }}>Sin resultados</Text>}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const PRIMARY = '#084999';

const styles = StyleSheet.create({
  newBtn: {
    alignSelf: 'flex-start',
    backgroundColor: PRIMARY,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 8,
  },
  newBtnText: { color: '#fff', fontWeight: '700' },

  // 🔎 Buscador con iconos (idéntico a AdminCompanies)
  searchWrap: { position: 'relative' },
  search: {
    borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10,
    paddingHorizontal: 36, paddingVertical: 10, backgroundColor: '#fff',
  },
  searchIconL: { position: 'absolute', left: 12, top: 9, zIndex: 2 },
  clearBtn: { position: 'absolute', right: 12, top: 8, zIndex: 2 },

  pillsWrap: {
    height: 40,
    justifyContent: 'center',
    marginTop: 6,
    marginBottom: 8,
  },
  pillsContent: {
    paddingVertical: 0,
    alignItems: 'center',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 10,
    gap: 10,
  },
  title: { fontWeight: '700' },
  sub: { color: '#6b7280' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  badge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 999,
    fontWeight: '700',
    fontSize: 12,
    overflow: 'hidden',
  },

  link: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#eef2ff',
  },
  linkText: { color: PRIMARY, fontWeight: '700' },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center', justifyContent: 'center', padding: 16,
  },
  modalCard: {
    width: '100%',
    maxHeight: '90%',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0b1f3a' },
  modalClose: { fontSize: 22, fontWeight: '800', color: '#64748b', paddingHorizontal: 4 },

  label: { fontWeight: '700', color: '#334155', marginBottom: 6, marginTop: 10 },
  input: {
    borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 10, backgroundColor: '#fff',
  },

  pill: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  pillSm: {
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  pillSel: { backgroundColor: '#08499915', borderColor: '#084999' },
  pillOff: { backgroundColor: '#f8fafc', borderColor: '#cbd5e1' },
  pillSelTxt: { color: '#084999', fontWeight: '700' },
  pillOffTxt: { color: '#334155', fontWeight: '700' },
  pillSelTxtSm: { color: '#084999', fontWeight: '700', fontSize: 12 },
  pillOffTxtSm: { color: '#334155', fontWeight: '700', fontSize: 12 },

  selectBtn: {
    borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 10, backgroundColor: '#fff',
  },
  selectBtnTxt: { fontWeight: '700', color: '#0b1f3a' },

  pickerOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center', padding: 16,
  },
  pickerCard: {
    width: '100%',
    maxHeight: '85%',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
  },
  pickerRow: {
    paddingVertical: 10, paddingHorizontal: 10,
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10,
    backgroundColor: '#f8fafc',
  },

  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },

  bigBtn: { flex: 1, borderRadius: 10, paddingVertical: 16, alignItems: 'center' },
  primary: { backgroundColor: PRIMARY },
  secondary: { backgroundColor: '#eef2ff' },
  bigBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
  bigBtnTxtSecondary: { color: '#111827', fontWeight: '700', fontSize: 16 },
});
