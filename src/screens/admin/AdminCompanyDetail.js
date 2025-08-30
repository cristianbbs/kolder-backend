// kolder-app/src/screens/admin/AdminCompanyDetail.js
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Switch,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as CompaniesAPI from '../../api/companies';

/* -------------------------- Datos auxiliares -------------------------- */
const COMMUNES_RM = [
  'Cerrillos','Cerro Navia','Conchalí','El Bosque','Estación Central','Huechuraba','Independencia',
  'La Cisterna','La Florida','La Granja','La Pintana','La Reina','Las Condes','Lo Barnechea','Lo Espejo',
  'Lo Prado','Macul','Maipú','Ñuñoa','Pedro Aguirre Cerda','Peñalolén','Providencia','Pudahuel','Quilicura',
  'Quinta Normal','Recoleta','Renca','Santiago','San Joaquín','San Miguel','San Ramón','Vitacura',
  'Puente Alto','Pirque','San José de Maipo','Colina','Lampa','Tiltil',
  'San Bernardo','Buin','Calera de Tango','Paine',
  'Melipilla','Alhué','Curacaví','María Pinto','San Pedro',
  'Talagante','El Monte','Isla de Maipo','Padre Hurtado','Peñaflor',
].sort((a,b)=>a.localeCompare(b,'es'));

const CHILE_REGIONS = [
  'Arica y Parinacota','Tarapacá','Antofagasta','Atacama','Coquimbo','Valparaíso',
  "Libertador Gral. Bernardo O'Higgins",'Maule','Ñuble','Biobío','La Araucanía','Los Ríos',
  'Los Lagos','Aysén del Gral. Carlos Ibáñez del Campo','Magallanes y de la Antártica Chilena',
  'Región Metropolitana de Santiago',
];

const PRIMARY = '#084999';

const norm = (s) => String(s||'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().trim();
const isRM = (r) => norm(r) === 'region metropolitana de santiago';

/* ===================================================================== */
export default function AdminCompanyDetail({ route, navigation }) {
  // ID robusto
  const companyFromRoute = route?.params?.company || null;
  const companyIdParam = Number(route?.params?.companyId ?? route?.params?.id ?? NaN);
  const derivedId = Number(Number.isFinite(companyIdParam) ? companyIdParam : (companyFromRoute?.id ?? NaN));
  const companyId = Number.isFinite(derivedId) ? derivedId : NaN;

  const [company, setCompany] = useState(companyFromRoute);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);

  const [allowed, setAllowed] = useState({ categories: [] });
  const [allowedLoading, setAllowedLoading] = useState(true);

  // --------- EDITAR empresa (modal + pickers) ---------
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '', rut: '', email: '', phone: '',
    addressLine: '',
    region: 'Región Metropolitana de Santiago',
    commune: '',
    department: '',
    deliveryNotes: '',
    contactName: '',
  });

  const [regionPickerOpen, setRegionPickerOpen] = useState(false);
  const [regionSearch, setRegionSearch] = useState('');
  const [communePickerOpen, setCommunePickerOpen] = useState(false);
  const [communeSearch, setCommuneSearch] = useState('');

  // Cuando cambia región en edición, limpia comuna si no es RM
  useEffect(() => {
    if (editOpen && !isRM(editForm.region) && editForm.commune) {
      setEditForm(s => ({ ...s, commune: '' }));
    }
  }, [editForm.region, editOpen]);

  // ---- LOADERS ---------------------------------------------------------------
  const getCommuneOf = (c) => String(
    c?.commune ?? c?.comuna ?? c?.comunaNombre ?? c?.comuna_name ??
    c?.district ?? c?.borough ??
    c?.address?.commune ?? c?.address?.comuna ?? ''
  ).trim();

  const loadCompany = useCallback(async () => {
    if (companyFromRoute?.id) {
      setCompany(companyFromRoute);
      return;
    }
    try {
      const all = await CompaniesAPI.list();
      const found = (Array.isArray(all) ? all : []).find((c) => c.id === companyId) || null;
      setCompany(found);
    } catch {/* noop */}
  }, [companyFromRoute, companyId]);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const rows = await CompaniesAPI.listUsers(
        Number.isFinite(companyId) ? { companyId } : undefined
      );
      setUsers(Array.isArray(rows) ? rows : []);
    } catch (e) {
      console.warn('[AdminCompanyDetail][users]', e?.message);
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }, [companyId]);

  const loadAllowed = useCallback(async () => {
    setAllowedLoading(true);
    try {
      const data = await CompaniesAPI.getAllowedProducts(
        Number.isFinite(companyId) ? { companyId } : undefined
      );
      setAllowed({ categories: Array.isArray(data?.categories) ? data.categories : [] });
    } catch (e) {
      console.warn('[AdminCompanyDetail][allowed]', e?.message);
      setAllowed({ categories: [] });
    } finally {
      setAllowedLoading(false);
    }
  }, [companyId]);

  const loadAll = useCallback(async () => {
    setErr(null);
    if (!Number.isFinite(companyId)) {
      setErr('Falta companyId');
      setLoading(false);
      return;
    }
    setLoading(true);
    await Promise.all([loadCompany(), loadUsers(), loadAllowed()]);
    setLoading(false);
  }, [companyId, loadCompany, loadUsers, loadAllowed]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ---- ACTIONS ---------------------------------------------------------------
  const removeUser = async (userId) => {
    try {
      await CompaniesAPI.deleteUser(userId, Number.isFinite(companyId) ? { companyId } : undefined);
      await loadUsers();
    } catch (e) {
      Alert.alert('Error', e?.message || 'No se pudo eliminar');
    }
  };

  const toggleProduct = async (productId, nextEnabled) => {
    try {
      await CompaniesAPI.toggleCompanyProduct(companyId, productId, nextEnabled);
    } catch (e) {
      Alert.alert('Error', e?.message || 'No se pudo actualizar el producto');
      return;
    }
    // optimistic update
    setAllowed((prev) => ({
      categories: prev.categories.map((c) => ({
        ...c,
        products: (c.products || []).map((p) =>
          p.id === productId ? { ...p, allowed: nextEnabled } : p
        ),
      })),
    }));
  };

  // ---- EDIT helpers ----------------------------------------------------------
  const openEdit = () => {
    const c = company || {};
    setEditForm({
      name: c?.name || '',
      rut: c?.rut || '',
      email: c?.email || '',
      phone: c?.phone || '',
      addressLine: c?.addressLine ?? c?.address?.addressLine ?? c?.address?.street ?? '',
      region: c?.region ?? c?.address?.region ?? 'Región Metropolitana de Santiago',
      commune: getCommuneOf(c) || '',
      department: c?.department ?? c?.address?.department ?? '',
      deliveryNotes: c?.deliveryNotes ?? c?.address?.notes ?? '',
      contactName: c?.contactName ?? '',
    });
    setEditOpen(true);
  };

  const validate = () => {
    const req = [
      ['Razón Social', editForm.name],
      ['RUT', editForm.rut],
      ['Correo', editForm.email],
      ['Teléfono', editForm.phone],
      ['Calle y número', editForm.addressLine],
      ['Región', editForm.region],
      ['Comuna', isRM(editForm.region) ? editForm.commune : 'ok'],
      ['Nombre y apellido (contacto)', editForm.contactName],
    ];
    const missing = req.find(([label, val]) => !String(val || '').trim());
    if (missing) { Alert.alert('Faltan datos', `Completa: ${missing[0]}.`); return false; }
    return true;
  };

  const submitEdit = async () => {
    try {
      if (!validate()) return;
      setSaving(true);
      const payload = {
        name: editForm.name, legalName: editForm.name, razon_social: editForm.name,
        rut: editForm.rut,
        email: String(editForm.email).trim().toLowerCase(),
        phone: editForm.phone,
        addressLine: editForm.addressLine,
        address: {
          addressLine: editForm.addressLine,
          region: editForm.region,
          commune: editForm.commune || undefined,
          department: editForm.department || undefined,
          notes: editForm.deliveryNotes || undefined,
        },
        region: editForm.region,
        commune: editForm.commune || undefined,
        comuna: editForm.commune || undefined,
        department: editForm.department || undefined,
        deliveryNotes: editForm.deliveryNotes || undefined,
        contactName: editForm.contactName,
      };

      const updated = await CompaniesAPI.update(companyId, payload);
      setCompany(updated?.company || { ...(company || {}), ...payload });
      setEditOpen(false);
      Alert.alert('OK', 'Empresa actualizada.');
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'No fue posible guardar';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteCompany = () => {
    const name = company?.name || `Empresa #${companyId}`;
    Alert.alert(
      'Eliminar empresa',
      `¿Seguro quiere eliminar la empresa "${name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await CompaniesAPI.remove(companyId);
              Alert.alert('OK', 'Empresa eliminada.');
              navigation.goBack();
            } catch (e) {
              Alert.alert('Error', e?.response?.data?.message || e?.message || 'No fue posible eliminar');
            }
          },
        },
      ]
    );
  };

  // ---- UI helpers ------------------------------------------------------------
  const title = useMemo(() => {
    if (!company) return `Empresa #${Number.isFinite(companyId) ? companyId : '—'}`;
    return company?.name || `Empresa #${company.id}`;
  }, [companyId, company]);

  const subtitle = useMemo(() => {
    if (!company) return null;
    const rut = company?.rut ? `RUT: ${company.rut}` : null;
    return rut;
  }, [company]);

  const headerRight = (
    <TouchableOpacity onPress={openEdit} style={styles.editLink}>
      <Feather name="edit-2" size={14} color={PRIMARY} />
      <Text style={styles.editLinkTxt}>Editar</Text>
    </TouchableOpacity>
  );

  // ---- RENDER ----------------------------------------------------------------
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Cargando…</Text>
      </View>
    );
  }
  if (err) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>{String(err)}</Text>
        <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={loadAll}>
          <Text style={styles.btnText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderUser = ({ item }) => (
    <View style={styles.userRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.userName}>{item.name || item.email}</Text>
        {!!item.email && <Text style={styles.subtle}>{item.email}</Text>}
      </View>
      <TouchableOpacity style={[styles.chip, styles.chipDanger]} onPress={() => removeUser(item.id)}>
        <Text style={styles.chipDangerText}>Eliminar</Text>
      </TouchableOpacity>
    </View>
  );

  const renderProduct = ({ item }) => {
    const on = !!item.allowed;
    return (
      <View style={styles.productRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.productTitle}>{item.title}</Text>
          {!!item.detail && (
            <Text style={styles.productDetail} numberOfLines={2}>
              {item.detail}
            </Text>
          )}
        </View>
        <Switch value={on} onValueChange={(v) => toggleProduct(item.id, v)} />
      </View>
    );
  };

  const renderCategory = ({ item: cat }) => (
    <View style={styles.categoryCard}>
      <View style={styles.categoryHeader}>
        <Text style={styles.categoryHeaderText}>{cat.name}</Text>
      </View>
      <FlatList
        data={cat.products || []}
        keyExtractor={(p) => String(p.id)}
        renderItem={renderProduct}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        scrollEnabled={false}
      />
    </View>
  );

  // Navegación a pedidos
  const goToCompanyOrders = () => {
    // 👇 Agregamos originCompanyId para que AdminOrderDetail pueda marcar “dado de baja”
    const params = { companyId, company_id: companyId, originCompanyId: companyId, range: 'all', _ts: Date.now() };
    try { navigation.push('AdminOrders', params); return; } catch {}
    try { navigation.navigate('AdminTab', { screen: 'AdminOrders', params }); return; } catch {}
    const parent = navigation.getParent?.(); parent?.navigate?.('AdminTab', { screen: 'AdminOrders', params });
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f6f7f8' }}>
      {/* Encabezado */}
      <View style={styles.headerCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{title}</Text>
            {!!subtitle && <Text style={styles.subtle}>{subtitle}</Text>}
          </View>
          {headerRight}
        </View>
      </View>

      <FlatList
        data={allowed.categories}
        keyExtractor={(c) => String(c.id)}
        renderItem={renderCategory}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: 12 }}>
            {/* Usuarios */}
            <Text style={styles.section}>Usuarios</Text>
            <View style={styles.card}>
              {usersLoading ? (
                <ActivityIndicator />
              ) : (
                <FlatList
                  data={users}
                  keyExtractor={(u) => String(u.id)}
                  renderItem={renderUser}
                  ItemSeparatorComponent={() => <View style={styles.sep} />}
                  ListEmptyComponent={<Text style={styles.subtle}>No hay usuarios.</Text>}
                  scrollEnabled={false}
                />
              )}
            </View>

            {/* Productos habilitados */}
            <Text style={styles.section}>Productos habilitados</Text>
            {allowedLoading && (
              <View style={{ padding: 12 }}>
                <ActivityIndicator />
              </View>
            )}
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={loading || usersLoading || allowedLoading}
            onRefresh={loadAll}
          />
        }
        contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
        ListEmptyComponent={
          !allowedLoading && (
            <View style={{ padding: 12 }}>
              <Text style={styles.subtle}>No hay categorías.</Text>
            </View>
          )
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Acciones rápidas */}
      <View style={styles.footer}>
        <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={goToCompanyOrders}>
          <Text style={styles.btnTextSecondary}>Ver pedidos de esta empresa</Text>
        </TouchableOpacity>
      </View>

      {/* ================== MODAL EDITAR ================== */}
      <Modal
        visible={editOpen}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setEditOpen(false)}
      >
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={64}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { maxHeight: '90%' }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Editar empresa</Text>
                <TouchableOpacity onPress={() => setEditOpen(false)} hitSlop={{ top: 10, left: 10, bottom: 10, right: 10 }}>
                  <Text style={styles.modalClose}>Cerrar</Text>
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={{ paddingBottom: 12 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={styles.label}>Razón social</Text>
                <TextInput value={editForm.name} onChangeText={(t)=>setEditForm(s=>({...s, name:t}))} placeholder="Ej: Inversiones Ejemplo SpA" style={styles.input} />

                <Text style={styles.label}>RUT</Text>
                <TextInput value={editForm.rut} onChangeText={(t)=>setEditForm(s=>({...s, rut:t}))} placeholder="12.345.678-9" style={styles.input} autoCapitalize="characters" />

                <Text style={styles.label}>Correo</Text>
                <TextInput value={editForm.email} onChangeText={(t)=>setEditForm(s=>({...s, email:t}))} placeholder="correo@empresa.cl" style={styles.input} autoCapitalize="none" keyboardType="email-address" />

                <Text style={styles.label}>Teléfono</Text>
                <TextInput value={editForm.phone} onChangeText={(t)=>setEditForm(s=>({...s, phone:t}))} placeholder="+56 9 1234 5678" style={styles.input} keyboardType="phone-pad" />

                <Text style={styles.label}>Calle y número</Text>
                <TextInput value={editForm.addressLine} onChangeText={(t)=>setEditForm(s=>({...s, addressLine:t}))} placeholder="Av. Siempre Viva 742" style={styles.input} />

                <Text style={styles.label}>Región</Text>
                <TouchableOpacity
                  style={styles.selectBtn}
                  activeOpacity={0.85}
                  onPress={() => { setRegionSearch(''); setEditOpen(false); setTimeout(()=>setRegionPickerOpen(true), 60); }}
                >
                  <Text style={styles.selectBtnTxt}>{editForm.region || 'Seleccionar región'}</Text>
                  <Text style={styles.chevSmall}>›</Text>
                </TouchableOpacity>

                <Text style={styles.label}>Comuna</Text>
                <TouchableOpacity
                  style={[styles.selectBtn, (!isRM(editForm.region)) && styles.selectBtnDisabled]}
                  activeOpacity={0.85}
                  disabled={!isRM(editForm.region)}
                  onPress={() => {
                    if (!isRM(editForm.region)) return; // guard extra
                    setCommuneSearch('');
                    setEditOpen(false);
                    setTimeout(()=>setCommunePickerOpen(true), 60);
                  }}
                >
                  <Text style={[styles.selectBtnTxt, (!isRM(editForm.region)) && styles.selectBtnTxtDisabled]}>
                    {editForm.commune || 'Seleccionar comuna'}
                  </Text>
                  <Text style={[styles.chevSmall, (!isRM(editForm.region)) && styles.selectBtnTxtDisabled]}>›</Text>
                </TouchableOpacity>

                <Text style={styles.label}>Departamento (opcional)</Text>
                <TextInput value={editForm.department} onChangeText={(t)=>setEditForm(s=>({...s, department:t}))} placeholder="Depto., oficina, piso…" style={styles.input} />

                <Text style={styles.label}>Indicaciones para la entrega (opcional)</Text>
                <TextInput value={editForm.deliveryNotes} onChangeText={(t)=>setEditForm(s=>({...s, deliveryNotes:t}))} placeholder="Portón negro, dejar en conserjería…" style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]} multiline />

                <Text style={styles.label}>Datos de contacto (Nombre y apellido)</Text>
                <TextInput value={editForm.contactName} onChangeText={(t)=>setEditForm(s=>({...s, contactName:t}))} placeholder="Nombre Apellido" style={styles.input} autoCapitalize="words" />

                <View style={{ height: 12 }} />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity style={[styles.bigBtn, styles.secondaryBtn]} onPress={() => setEditOpen(false)} disabled={saving}>
                    <Text style={styles.bigBtnTxtSecondary}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.bigBtn, styles.primaryBtn]} onPress={submitEdit} disabled={saving}>
                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.bigBtnTxt}>Guardar</Text>}
                  </TouchableOpacity>
                </View>

                <TouchableOpacity onPress={confirmDeleteCompany} style={[styles.bigBtn, styles.dangerBtn, { marginTop: 12 }]}>
                  <Text style={styles.dangerTxt}>Eliminar empresa</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Picker REGIÓN (editar) */}
      <Modal
        visible={regionPickerOpen}
        transparent
        animationType="slide"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={() => setRegionPickerOpen(false)}
      >
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={64}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Seleccionar región</Text>
                <TouchableOpacity onPress={() => setRegionPickerOpen(false)} hitSlop={{ top: 10, left: 10, bottom: 10, right: 10 }}>
                  <Text style={styles.modalClose}>Cerrar</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.searchWrap}>
                <TextInput value={regionSearch} onChangeText={setRegionSearch} placeholder="Buscar región…" style={styles.search} autoCapitalize="words" />
                <Feather name="search" size={18} color="#64748b" style={styles.searchIconL} pointerEvents="none" />
                {regionSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setRegionSearch('')} style={styles.clearBtn} hitSlop={{ top: 8, left: 8, bottom: 8, right: 8 }}>
                    <Feather name="x-circle" size={18} color="#94a3b8" />
                  </TouchableOpacity>
                )}
              </View>

              <FlatList
                data={CHILE_REGIONS.filter(r => norm(r).includes(norm(regionSearch)))}
                keyExtractor={(r, i) => `${r}-${i}`}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.pickerItem}
                    onPress={() => {
                      setEditForm(s => ({ ...s, region: item, commune: isRM(item) ? s.commune : '' }));
                      setRegionPickerOpen(false);
                      setTimeout(() => setEditOpen(true), 60);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.pickerItemText}>{item}</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#64748b', marginTop: 16 }}>Sin coincidencias</Text>}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Picker COMUNA (editar) */}
      <Modal
        visible={communePickerOpen}
        transparent
        animationType="slide"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={() => setCommunePickerOpen(false)}
      >
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={64}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Seleccionar comuna</Text>
                <TouchableOpacity onPress={() => setCommunePickerOpen(false)} hitSlop={{ top: 10, left: 10, bottom: 10, right: 10 }}>
                  <Text style={styles.modalClose}>Cerrar</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.searchWrap}>
                <TextInput value={communeSearch} onChangeText={setCommuneSearch} placeholder="Buscar comuna…" style={styles.search} autoCapitalize="words" />
                <Feather name="search" size={18} color="#64748b" style={styles.searchIconL} pointerEvents="none" />
                {communeSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setCommuneSearch('')} style={styles.clearBtn} hitSlop={{ top: 8, left: 8, bottom: 8, right: 8 }}>
                    <Feather name="x-circle" size={18} color="#94a3b8" />
                  </TouchableOpacity>
                )}
              </View>

              <FlatList
                data={COMMUNES_RM.filter(c => norm(c).includes(norm(communeSearch)))}
                keyExtractor={(c, i) => `${c}-${i}`}
                contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.pickerItem}
                    onPress={() => {
                      setEditForm(s => ({ ...s, commune: item }));
                      setCommunePickerOpen(false);
                      setTimeout(() => setEditOpen(true), 60);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.pickerItemText}>{item}</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#64748b', marginTop: 16 }}>Sin coincidencias</Text>}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

/* -------------------------------- STYLES ----------------------------------- */
const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },

  headerCard: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },

  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  subtle: { color: '#6b7280' },
  error: { color: '#991b1b', fontWeight: '600' },

  section: { marginTop: 16, marginBottom: 8, fontWeight: '700', color: PRIMARY },

  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eee',
    padding: 10,
    marginBottom: 12,
  },

  // Users
  userRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  userName: { fontWeight: '600', color: '#111827' },
  chip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, marginLeft: 8 },
  chipDanger: { backgroundColor: '#fee2e2' },
  chipDangerText: { color: '#991b1b', fontWeight: '700' },

  // Categories & products
  categoryCard: {
    backgroundColor: '#fff',
    marginVertical: 8,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#eee',
  },
  categoryHeader: { backgroundColor: PRIMARY, padding: 10 },
  categoryHeaderText: { color: '#fff', fontWeight: '700' },
  productRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 10 },
  productTitle: { fontWeight: '600', color: '#111827' },
  productDetail: { color: '#555', marginTop: 2 },
  sep: { height: 1, backgroundColor: '#eee' },

  // Footer
  footer: { padding: 12 },
  btn: { borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center' },
  btnPrimary: { backgroundColor: PRIMARY },
  btnSecondary: { backgroundColor: '#eef2ff' },
  btnText: { color: '#fff', fontWeight: '700', textAlign: 'center' },
  btnTextSecondary: { color: '#111827', fontWeight: '700', textAlign: 'center' },

  // Edit header action
  editLink: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: '#eef2ff', borderRadius: 8 },
  editLinkTxt: { color: PRIMARY, fontWeight: '700' },

  // ----- Modales / form -----
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'flex-end' },
  modalCard: {
    maxHeight: '80%', backgroundColor: '#fff',
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    padding: 12, borderWidth: 1, borderColor: '#e5e7eb',
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 2 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0b1f3a' },
  modalClose: { fontSize: 16, fontWeight: '800', color: PRIMARY },

  label: { fontWeight: '700', color: '#334155', marginBottom: 6, marginTop: 10 },
  input: {
    borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 10, backgroundColor: '#fff',
  },

  // select estilo pill
  selectBtn: {
    borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 10, backgroundColor: '#fff',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  selectBtnDisabled: { backgroundColor: '#f1f5f9', opacity: 0.6 },
  selectBtnTxt: { fontWeight: '700', color: '#0b1f3a' },
  selectBtnTxtDisabled: { color: '#94a3b8' },
  chevSmall: { fontSize: 20, color: '#94a3b8', paddingLeft: 6 },

  // buscador en pickers
  searchWrap: { position: 'relative' },
  search: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 36, paddingVertical: 10, backgroundColor: '#fff' },
  searchIconL: { position: 'absolute', left: 12, top: 9, zIndex: 2 },
  clearBtn: { position: 'absolute', right: 12, top: 8, zIndex: 2 },

  pickerItem: { paddingVertical: 10, paddingHorizontal: 6 },
  pickerItemText: { color: '#0b1f3a', fontSize: 16, fontWeight: '500' },

  // botones grandes
  bigBtn: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  primaryBtn: { backgroundColor: PRIMARY },
  secondaryBtn: { backgroundColor: '#eef2ff' },
  bigBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
  bigBtnTxtSecondary: { color: '#111827', fontWeight: '700', fontSize: 16 },
  dangerBtn: { backgroundColor: '#fee2e2' },
  dangerTxt: { color: '#991b1b', fontWeight: '700', fontSize: 16 },
});
