// kolder-app/src/screens/admin/AdminCompanies.js
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as CompaniesAPI from '../../api/companies';
import ErrorBanner from '../../components/ErrorBanner';
import EmptyState from '../../components/EmptyState';

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

// helpers de normalización + verificador RM
const norm = (s) =>
  String(s || '')
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
const isRM = (r) => norm(r) === 'region metropolitana de santiago';
const normCommune = (s) => norm(String(s||'').split(',')[0].replace(/^comuna\s+de\s+/, '').replace(/\s+/g,' '));

export default function AdminCompanies({ navigation }) {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [querying, setQuerying] = useState(false);
  const [err, setErr] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Filtros del listado
  const [q, setQ] = useState('');
  const [commune, setCommune] = useState('TODAS'); // filtro
  const [communePickerOpen, setCommunePickerOpen] = useState(false);
  const [communeSearch, setCommuneSearch] = useState('');

  // -------- Crear empresa --------
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    rut: '',
    email: '',
    phone: '',
    addressLine: '',
    region: 'Región Metropolitana de Santiago',
    commune: '',
    department: '',
    deliveryNotes: '',
    contactName: '',
  });

  // pickers del formulario (crear)
  const [regionPickerOpen, setRegionPickerOpen] = useState(false);
  const [regionSearch, setRegionSearch] = useState('');
  const [createCommunePickerOpen, setCreateCommunePickerOpen] = useState(false);
  const [createCommuneSearch, setCreateCommuneSearch] = useState('');

  // regiones filtradas
  const regionsFiltered = useMemo(() => {
    const t = norm(regionSearch);
    if (!t) return CHILE_REGIONS;
    return CHILE_REGIONS.filter(r => norm(r).includes(t));
  }, [regionSearch]);

  // comunas filtradas (para filtro superior)
  const communesFiltered = useMemo(() => {
    const t = norm(communeSearch);
    if (!t) return COMMUNES_RM;
    return COMMUNES_RM.filter(c => norm(c).includes(t));
  }, [communeSearch]);

  // comunas filtradas (para crear)
  const createCommunesFiltered = useMemo(() => {
    const t = norm(createCommuneSearch);
    if (!t) return COMMUNES_RM;
    return COMMUNES_RM.filter(c => norm(c).includes(t));
  }, [createCommuneSearch]);

  const getCommuneOf = (c) => {
    const k = String(
      c?.commune ?? c?.comuna ?? c?.comunaNombre ?? c?.comuna_name ??
      c?.district ?? c?.borough ??
      c?.address?.commune ?? c?.address?.comuna ?? ''
    ).trim();
    return k;
  };

  const load = useCallback(async ({ soft = false } = {}) => {
    setErr(null);
    try {
      if (soft) setQuerying(true); else setLoading(true);
      const params = { q: q.trim() || undefined, commune: commune !== 'TODAS' ? commune : undefined };
      const rows = await CompaniesAPI.list(params);
      const arr = Array.isArray(rows) ? rows : [];
      const map = new Map();
      arr.forEach((c) => map.set(String(c.id), c));
      setCompanies(Array.from(map.values()));
    } catch (e) {
      setErr(e?.message || 'Error cargando empresas');
      setCompanies([]);
    } finally {
      if (soft) setQuerying(false); else setLoading(false);
      setRefreshing(false);
    }
  }, [q, commune]);

  useEffect(() => { load({ soft: false }); }, []); // carga inicial

  // recarga “suave” al cambiar búsqueda o comuna
  useEffect(() => {
    const t = setTimeout(() => { load({ soft: true }); }, 250);
    return () => clearTimeout(t);
  }, [q, commune]); // eslint-disable-line react-hooks/exhaustive-deps

  const onRefresh = () => { setRefreshing(true); load({ soft: false }); };

  // Fallback en cliente (por si el backend aún no filtra)
  const companiesView = useMemo(() => {
    const term = norm(q);
    const sel = normCommune(commune);
    return companies.filter((c) => {
      const cComm = normCommune(getCommuneOf(c));
      const cmOk = commune === 'TODAS'
        ? true
        : (cComm === sel || cComm.startsWith(sel) || cComm.includes(sel));
      if (!term) return cmOk;

      const haystack = [
        c?.name, c?.fantasyName, c?.legalName,
        c?.rut, c?.email, c?.phone,
        getCommuneOf(c),
        c?.address?.street, c?.address?.address, c?.addressLine,
      ].map(x => norm(x));
      const match = haystack.some(x => x.includes(term));
      return cmOk && match;
    }).sort((a,b)=>String(a?.name||'').localeCompare(String(b?.name||''),'es'));
  }, [companies, q, commune]);

  const displayCommune = commune === 'TODAS' ? 'Todas las comunas' : commune;

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.item}
      onPress={() => navigation?.navigate?.('AdminCompanyDetail', { companyId: item.id })}
      activeOpacity={0.8}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{item.name}</Text>
        <Text style={styles.sub}>
          {(item.rut || '—')}
          {getCommuneOf(item) ? ` • ${getCommuneOf(item)}` : ''}
          {item.createdAt ? ` • Creada: ${new Date(item.createdAt).toLocaleDateString('es-CL')}` : ''}
        </Text>
      </View>
      <Text style={styles.chev}>{'›'}</Text>
    </TouchableOpacity>
  );

  // -------- Crear empresa --------
  const resetForm = () => setForm({
    name: '', rut: '', email: '', phone: '',
    addressLine: '', region: 'Región Metropolitana de Santiago', commune: '',
    department: '', deliveryNotes: '', contactName: '',
  });

  // si cambia región en el form, limpiar comuna si no es RM
  useEffect(() => {
    if (createOpen && !isRM(form.region) && form.commune) {
      setForm(s => ({ ...s, commune: '' }));
    }
  }, [form.region, createOpen]);

  const validate = () => {
    const req = [
      ['Razón Social', form.name],
      ['RUT', form.rut],
      ['Correo', form.email],
      ['Teléfono', form.phone],
      ['Calle y número', form.addressLine],
      ['Región', form.region],
      ['Comuna', isRM(form.region) ? form.commune : 'ok'],
      ['Nombre y apellido (contacto)', form.contactName],
    ];
    const missing = req.find(([label, val]) => !String(val || '').trim());
    if (missing) { Alert.alert('Faltan datos', `Completa: ${missing[0]}.`); return false; }
    return true;
  };

  const submitCreate = async () => {
    try {
      if (!validate()) return;
      setSaving(true);
      const payload = {
        name: form.name, legalName: form.name, razon_social: form.name,
        rut: form.rut,
        email: String(form.email).trim().toLowerCase(),
        phone: form.phone,
        addressLine: form.addressLine,
        address: {
          addressLine: form.addressLine, region: form.region, commune: form.commune || undefined,
          department: form.department || undefined, notes: form.deliveryNotes || undefined,
        },
        region: form.region, commune: form.commune || undefined, comuna: form.commune || undefined,
        department: form.department || undefined, deliveryNotes: form.deliveryNotes || undefined,
        contactName: form.contactName, contact_name: form.contactName,
      };
      await CompaniesAPI.create(payload);
      setCreateOpen(false); resetForm(); await load({ soft: false });
      Alert.alert('OK', 'Empresa creada correctamente.');
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'No fue posible crear la empresa';
      Alert.alert('Error', msg);
    } finally { setSaving(false); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator /></View>;

  return (
    <View style={{ flex: 1 }}>
      {err && <ErrorBanner message={err} onRetry={() => load({ soft: false })} />}

      {/* Acciones superiores */}
      <View style={{ paddingHorizontal: 12, paddingTop: 12, marginBottom: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <TouchableOpacity style={styles.newBtn} onPress={() => { resetForm(); setCreateOpen(true); }}>
          <Text style={styles.newBtnText}>+ Nueva Empresa</Text>
        </TouchableOpacity>
      </View>

      {/* Buscador + filtro de comuna (listado) */}
      <View style={{ paddingHorizontal: 12, gap: 10 }}>
        <View style={styles.searchWrap}>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Buscar empresa por nombre, RUT, dirección…"
            style={styles.search}
            autoCapitalize="none"
            returnKeyType="search"
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

        <TouchableOpacity
          style={styles.selectBtn}
          activeOpacity={0.85}
          onPress={() => { setCommuneSearch(''); setCommunePickerOpen(true); }}
        >
          <Text style={styles.selectBtnTxt}>{displayCommune}</Text>
          <Text style={styles.chevSmall}>›</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={companiesView}
        keyExtractor={(c) => String(c.id)}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 12, flexGrow: 1, paddingTop: 10 }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <EmptyState
            title="Sin resultados"
            subtitle={commune === 'TODAS' && !q ? 'No hay empresas registradas.' : 'Prueba quitando filtros o cambiando la búsqueda.'}
          />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Modal selector de comuna (listado) */}
      <Modal
        visible={communePickerOpen}
        transparent
        animationType="slide"
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
                <TextInput
                  value={communeSearch}
                  onChangeText={setCommuneSearch}
                  placeholder="Buscar comuna…"
                  style={styles.search}
                  autoCapitalize="words"
                />
                <Feather name="search" size={18} color="#64748b" style={styles.searchIconL} pointerEvents="none" />
                {communeSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setCommuneSearch('')} style={styles.clearBtn} hitSlop={{ top: 8, left: 8, bottom: 8, right: 8 }}>
                    <Feather name="x-circle" size={18} color="#94a3b8" />
                  </TouchableOpacity>
                )}
              </View>

              <FlatList
                data={['Todas las comunas', ...communesFiltered]}
                keyExtractor={(c, i) => `${c}-${i}`}
                contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const isAll = item === 'Todas las comunas';
                  return (
                    <View>
                      <TouchableOpacity
                        style={styles.pickerItem}
                        onPress={() => {
                          setCommune(isAll ? 'TODAS' : item);
                          setCommunePickerOpen(false);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.pickerItemText, isAll && styles.pickerItemTextBold]}>
                          {item}
                        </Text>
                      </TouchableOpacity>
                      {isAll && <View style={styles.pickerDivider} />}
                    </View>
                  );
                }}
                ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#64748b', marginTop: 16 }}>Sin coincidencias</Text>}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ================= Modal NUEVA EMPRESA ================= */}
      <Modal
        visible={createOpen}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setCreateOpen(false)}
      >
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={64}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { maxHeight: '90%' }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Nueva Empresa</Text>
                <TouchableOpacity onPress={() => setCreateOpen(false)} hitSlop={{ top: 10, left: 10, bottom: 10, right: 10 }}>
                  <Text style={styles.modalClose}>Cerrar</Text>
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={{ paddingBottom: 12 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={styles.label}>Razón social</Text>
                <TextInput value={form.name} onChangeText={(t)=>setForm(s=>({...s, name:t}))} placeholder="Ej: Inversiones Ejemplo SpA" style={styles.input} />

                <Text style={styles.label}>RUT</Text>
                <TextInput value={form.rut} onChangeText={(t)=>setForm(s=>({...s, rut:t}))} placeholder="12.345.678-9" style={styles.input} autoCapitalize="characters" />

                <Text style={styles.label}>Correo</Text>
                <TextInput value={form.email} onChangeText={(t)=>setForm(s=>({...s, email:t}))} placeholder="correo@empresa.cl" style={styles.input} autoCapitalize="none" keyboardType="email-address" />

                <Text style={styles.label}>Teléfono</Text>
                <TextInput value={form.phone} onChangeText={(t)=>setForm(s=>({...s, phone:t}))} placeholder="+56 9 1234 5678" style={styles.input} keyboardType="phone-pad" />

                <Text style={styles.label}>Calle y número</Text>
                <TextInput value={form.addressLine} onChangeText={(t)=>setForm(s=>({...s, addressLine:t}))} placeholder="Av. Siempre Viva 742" style={styles.input} />

                <Text style={styles.label}>Región</Text>
                <TouchableOpacity
                  style={styles.selectBtn}
                  activeOpacity={0.85}
                  onPress={() => { setRegionSearch(''); setCreateOpen(false); setTimeout(()=>setRegionPickerOpen(true), 60); }}
                >
                  <Text style={styles.selectBtnTxt}>{form.region || 'Seleccionar región'}</Text>
                  <Text style={styles.chevSmall}>›</Text>
                </TouchableOpacity>

                <Text style={styles.label}>Comuna</Text>
                <TouchableOpacity
                  style={[styles.selectBtn, (!isRM(form.region)) && styles.selectBtnDisabled]}
                  activeOpacity={0.85}
                  disabled={!isRM(form.region)}
                  onPress={() => {
                    if (!isRM(form.region)) return; // guard extra
                    setCreateCommuneSearch('');
                    setCreateOpen(false);
                    setTimeout(()=>setCreateCommunePickerOpen(true), 60);
                  }}
                >
                  <Text style={[styles.selectBtnTxt, (!isRM(form.region)) && styles.selectBtnTxtDisabled]}>
                    {form.commune || 'Seleccionar comuna'}
                  </Text>
                  <Text style={[styles.chevSmall, (!isRM(form.region)) && styles.selectBtnTxtDisabled]}>›</Text>
                </TouchableOpacity>

                <Text style={styles.label}>Departamento (opcional)</Text>
                <TextInput value={form.department} onChangeText={(t)=>setForm(s=>({...s, department:t}))} placeholder="Depto., oficina, piso…" style={styles.input} />

                <Text style={styles.label}>Indicaciones para la entrega (opcional)</Text>
                <TextInput value={form.deliveryNotes} onChangeText={(t)=>setForm(s=>({...s, deliveryNotes:t}))} placeholder="Portón negro, dejar en conserjería…" style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]} multiline />

                <Text style={styles.label}>Datos de contacto (Nombre y apellido)</Text>
                <TextInput value={form.contactName} onChangeText={(t)=>setForm(s=>({...s, contactName:t}))} placeholder="Nombre Apellido" style={styles.input} autoCapitalize="words" />

                <View style={{ height: 12 }} />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity style={[styles.bigBtn, styles.secondary]} onPress={() => setCreateOpen(false)} disabled={saving}>
                    <Text style={styles.bigBtnTxtSecondary}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.bigBtn, styles.primaryBtn]} onPress={submitCreate} disabled={saving}>
                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.bigBtnTxt}>Guardar</Text>}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Picker REGIÓN (crear) */}
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
                data={regionsFiltered}
                keyExtractor={(r, i) => `${r}-${i}`}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.pickerItem}
                    onPress={() => {
                      setForm(s => ({ ...s, region: item, commune: isRM(item) ? s.commune : '' }));
                      setRegionPickerOpen(false);
                      setTimeout(() => setCreateOpen(true), 60);
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

      {/* Picker COMUNA (crear) */}
      <Modal
        visible={createCommunePickerOpen}
        transparent
        animationType="slide"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={() => setCreateCommunePickerOpen(false)}
      >
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={64}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Seleccionar comuna</Text>
                <TouchableOpacity onPress={() => setCreateCommunePickerOpen(false)} hitSlop={{ top: 10, left: 10, bottom: 10, right: 10 }}>
                  <Text style={styles.modalClose}>Cerrar</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.searchWrap}>
                <TextInput value={createCommuneSearch} onChangeText={setCreateCommuneSearch} placeholder="Buscar comuna…" style={styles.search} autoCapitalize="words" />
                <Feather name="search" size={18} color="#64748b" style={styles.searchIconL} pointerEvents="none" />
                {createCommuneSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setCreateCommuneSearch('')} style={styles.clearBtn} hitSlop={{ top: 8, left: 8, bottom: 8, right: 8 }}>
                    <Feather name="x-circle" size={18} color="#94a3b8" />
                  </TouchableOpacity>
                )}
              </View>

              <FlatList
                data={createCommunesFiltered}
                keyExtractor={(c, i) => `${c}-${i}`}
                contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.pickerItem}
                    onPress={() => {
                      setForm(s => ({ ...s, commune: item }));
                      setCreateCommunePickerOpen(false);
                      setTimeout(() => setCreateOpen(true), 60);
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

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // botón nuevo
  newBtn: { alignSelf: 'flex-start', backgroundColor: PRIMARY, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  newBtnText: { color: '#fff', fontWeight: '700' },

  // buscador con iconos
  searchWrap: { position: 'relative' },
  search: {
    borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10,
    paddingHorizontal: 36, paddingVertical: 10, backgroundColor: '#fff',
  },
  searchIconL: { position: 'absolute', left: 12, top: 9, zIndex: 2 },
  clearBtn: { position: 'absolute', right: 12, top: 8, zIndex: 2 },

  // selector (pill)
  selectBtn: {
    borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 10, backgroundColor: '#fff',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  selectBtnDisabled: { backgroundColor: '#f1f5f9', opacity: 0.6 },
  selectBtnTxt: { fontWeight: '700', color: '#0b1f3a' },
  selectBtnTxtDisabled: { color: '#94a3b8' },
  chevSmall: { fontSize: 20, color: '#94a3b8', paddingLeft: 6 },

  // ítem empresa
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb',
    padding: 12, marginBottom: 10,
  },
  title: { fontSize: 16, fontWeight: '700' },
  sub: { fontSize: 12, color: '#6b7280' },
  chev: { fontSize: 24, color: '#9ca3af', paddingHorizontal: 6 },

  // modal base / pickers
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'flex-end' },
  modalCard: {
    maxHeight: '80%', backgroundColor: '#fff',
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    padding: 12, borderWidth: 1, borderColor: '#e5e7eb',
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 2 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0b1f3a' },
  modalClose: { fontSize: 16, fontWeight: '800', color: PRIMARY },

  pickerItem: { paddingVertical: 10, paddingHorizontal: 6 },
  pickerItemText: { color: '#0b1f3a', fontSize: 16, fontWeight: '500' },
  pickerItemTextBold: { fontWeight: '800' },
  pickerDivider: { height: 1, backgroundColor: '#e5e7eb', marginTop: 8, marginBottom: 4 },

  // labels e inputs del form
  label: { fontWeight: '700', color: '#334155', marginBottom: 6, marginTop: 10 },
  input: {
    borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 10, backgroundColor: '#fff',
  },

  // botones del form
  bigBtn: { flex: 1, borderRadius: 10, paddingVertical: 16, alignItems: 'center' },
  primaryBtn: { backgroundColor: PRIMARY },
  secondary: { backgroundColor: '#eef2ff' },
  bigBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
  bigBtnTxtSecondary: { color: '#111827', fontWeight: '700', fontSize: 16 },
});
