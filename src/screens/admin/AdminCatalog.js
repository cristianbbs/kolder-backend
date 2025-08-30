// kolder-app/src/screens/admin/AdminCatalog.js
import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, Modal, TextInput, Image, SectionList,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import API, { api } from '../../api/client';
import ErrorBanner from '../../components/ErrorBanner';
import { useAuth } from '../../auth/context';

const PRIMARY = '#084999';
const PAGE_SIZE = 50;
const OTROS_ID = '__otros__';

// --------- helpers ----------
const firstNonEmpty = (...vals) => {
  for (const v of vals) {
    if (Array.isArray(v) && v.length) return v[0];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
};
const getImgFromProduct = (p) =>
  firstNonEmpty(p?.imageUrl, p?.image_url, p?.image, p?.images, p?.iamges); // <- incluye el typo "iamges"

export default function AdminCatalog({ navigation }) {
  const { profile } = useAuth();
  const isSuper = String(profile?.role || '').toUpperCase() === 'SUPER_ADMIN';

  // ====== Estado ======
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);

  // Solo lectura (cuando el backend no tiene /admin/catalog/*)
  const [readonly, setReadonly] = useState(false);
  const [readonlyReason, setReadonlyReason] = useState(
    'El backend no expone /admin/catalog/*; el catálogo se muestra en modo solo lectura.'
  );

  // Filtro de productos por categoría
  const [productCatFilter, setProductCatFilter] = useState(null);

  // Modales
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [prodModalOpen, setProdModalOpen] = useState(false);
  const [catPickerOpen, setCatPickerOpen] = useState(false);
  const [reopenProductAfterPicker, setReopenProductAfterPicker] = useState(false);

  // Form categoría
  const [editingCatId, setEditingCatId] = useState(null);
  const [catName, setCatName] = useState('');

  // Form producto
  const [editingProdId, setEditingProdId] = useState(null);
  const [prodTitle, setProdTitle] = useState('');
  const [prodImageUrl, setProdImageUrl] = useState('');
  const [prodCategoryId, setProdCategoryId] = useState(null);
  const [manualUrlMode, setManualUrlMode] = useState(false); // <- URL manual de imagen

  // ref lista para scrollear a “Productos”
  const listRef = useRef(null);

  // ====== Carga ======
  const loadCategories = useCallback(async () => {
    const res =
      (await API.adminListCategories?.({ page: 1, pageSize: PAGE_SIZE })) ??
      (await API.adminListCategories?.());
    const items =
      Array.isArray(res?.items) ? res.items :
      Array.isArray(res?.rows) ? res.rows :
      Array.isArray(res?.categories) ? res.categories :
      Array.isArray(res) ? res : [];
    setCategories(items);
    if (res && typeof res === 'object' && (res._readonly || res.fallback)) {
      setReadonly(true);
      if (res.readonlyReason) setReadonlyReason(res.readonlyReason);
    }
  }, []);

  const loadProducts = useCallback(async () => {
    const res =
      (await API.adminListProducts?.({ page: 1, pageSize: PAGE_SIZE })) ??
      (await API.adminListProducts?.());
    const items =
      Array.isArray(res?.items) ? res.items :
      Array.isArray(res?.rows) ? res.rows :
      Array.isArray(res?.products) ? res.products :
      Array.isArray(res) ? res : [];
    setProducts(items);
    if (res && typeof res === 'object' && (res._readonly || res.fallback)) {
      setReadonly(true);
      if (res.readonlyReason) setReadonlyReason(res.readonlyReason);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setErr(null);
    try {
      setLoading(true);
      await Promise.all([loadCategories(), loadProducts()]);
    } catch (e) {
      setErr(e?.message || 'Error cargando catálogo');
    } finally {
      setLoading(false);
    }
  }, [loadCategories, loadProducts]);

  const refresh = useCallback(async () => {
    setErr(null);
    setRefreshing(true);
    try {
      await Promise.all([loadCategories(), loadProducts()]);
    } catch (e) {
      setErr(e?.message || 'Error recargando catálogo');
    } finally {
      setRefreshing(false);
    }
  }, [loadCategories, loadProducts]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', loadAll);
    return unsub;
  }, [navigation, loadAll]);

  // Cerrar cualquier modal si pasamos a solo-lectura
  useEffect(() => {
    if (readonly) {
      setCatModalOpen(false);
      setProdModalOpen(false);
      setCatPickerOpen(false);
    }
  }, [readonly]);

  // ====== Helpers ======
  const othersCategory = useMemo(() => {
    const c = categories.find(x => String(x.name || '').trim().toLowerCase() === 'otros');
    return c || null;
  }, [categories]);

  // Conteos por categoría y no categorizados
  const { productsCountByCategory, uncategorizedCount } = useMemo(() => {
    const map = {};
    let noCat = 0;
    for (const p of products) {
      const cid = p.categoryId ?? p.category_id ?? p.category?.id ?? null;
      if (!cid) { noCat += 1; continue; }
      map[cid] = (map[cid] || 0) + 1;
    }
    return { productsCountByCategory: map, uncategorizedCount: noCat };
  }, [products]);

  // Si hay productos sin categoría y no existe “Otros”, intentamos crearla una vez (solo si NO es solo-lectura)
  useEffect(() => {
    (async () => {
      if (readonly || loading) return;
      if (uncategorizedCount > 0 && !othersCategory && API.adminCreateCategory) {
        try {
          await API.adminCreateCategory({ name: 'Otros' });
          await loadCategories();
        } catch {
          // si falla, seguimos mostrando pseudo “Otros” en la UI
        }
      }
    })();
  }, [readonly, loading, uncategorizedCount, othersCategory, loadCategories]);

  // Lista de categorías a renderizar: + pseudo “Otros” si hace falta
  const categoriesForList = useMemo(() => {
    const arr = [...categories];
    if (!othersCategory) {
      arr.push({ id: OTROS_ID, name: 'Otros', productsCount: uncategorizedCount, _pseudoOtros: true });
    }
    return arr;
  }, [categories, othersCategory, uncategorizedCount]);

  const catNameOf = (id) => {
    if (id === OTROS_ID) return 'Otros';
    const c = categories.find(x => String(x.id) === String(id));
    return c?.name || 'Otros';
  };

  const isHighlightedCategory = (cat) => {
    if (!productCatFilter) return false;
    const id = cat._pseudoOtros ? OTROS_ID : cat.id;
    return String(productCatFilter) === String(id);
  };

  // ====== Acciones Categorías ======
  const openCreateCategory = () => {
    if (readonly) return Alert.alert('Solo lectura', readonlyReason);
    setEditingCatId(null);
    setCatName('');
    setCatModalOpen(true);
  };

  const openEditCategory = (cat) => {
    if (readonly) return Alert.alert('Solo lectura', readonlyReason);
    if (cat._pseudoOtros) return; // no editable
    setEditingCatId(cat.id);
    setCatName(cat.name || '');
    setCatModalOpen(true);
  };

  const saveCategory = async () => {
    if (readonly) return Alert.alert('Solo lectura', readonlyReason);
    const name = catName.trim();
    if (!name) return Alert.alert('Validación', 'El nombre es obligatorio.');
    try {
      if (editingCatId) {
        await API.adminUpdateCategory?.(editingCatId, { name });
      } else {
        await API.adminCreateCategory?.({ name });
      }
      setCatModalOpen(false);
      await loadCategories();
    } catch (e) {
      Alert.alert('Error', e?.message || 'No se pudo guardar la categoría');
    }
  };

  const deleteCategory = async (cat) => {
    if (readonly) return Alert.alert('Solo lectura', readonlyReason);
    if (cat._pseudoOtros) return; // no eliminable
    const cid = cat.id;
    const hasProducts = (cat.productsCount ?? productsCountByCategory[cid] ?? 0) > 0;
    if (hasProducts) {
      Alert.alert('No permitido', 'No puedes eliminar esta categoría porque tiene productos asociados.');
      return;
    }
    Alert.alert('Confirmar', `¿Eliminar la categoría "${cat.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          try {
            await API.adminDeleteCategory?.(cid);
            await loadCategories();
          } catch (e) {
            Alert.alert('Error', e?.message || 'No se pudo eliminar la categoría');
          }
        }
      }
    ]);
  };

  const viewCategoryProducts = (cat) => {
    const id = cat._pseudoOtros ? OTROS_ID : cat.id;
    setProductCatFilter(id);
    setTimeout(() => {
      listRef.current?.scrollToLocation?.({
        sectionIndex: 1,
        itemIndex: 0,
        viewPosition: 0,
        animated: true,
      });
    }, 50);
  };

  // ====== Acciones Productos ======
  const openCreateProduct = () => {
    if (readonly) return Alert.alert('Solo lectura', readonlyReason);
    setEditingProdId(null);
    setProdTitle('');
    setProdImageUrl('');
    setManualUrlMode(false);
    setProdCategoryId(null);
    setProdModalOpen(true);
  };

  const openEditProduct = (p) => {
    if (readonly) return Alert.alert('Solo lectura', readonlyReason);
    setEditingProdId(p.id);
    setProdTitle(p.title || p.name || '');
    setProdImageUrl(getImgFromProduct(p) || '');
    const cid = p.categoryId ?? p.category_id ?? p.category?.id ?? null;
    setProdCategoryId(cid);
    setManualUrlMode(false);
    setProdModalOpen(true);
  };

  // Abrir picker cerrando el modal de producto para evitar modales anidados
  const openCatPickerFromProduct = () => {
    if (readonly) return Alert.alert('Solo lectura', readonlyReason);
    setReopenProductAfterPicker(true);
    setProdModalOpen(false);
    setTimeout(() => setCatPickerOpen(true), 40);
  };
  const closeCatPicker = (reopen = false) => {
    setCatPickerOpen(false);
    if (reopen || reopenProductAfterPicker) {
      setTimeout(() => setProdModalOpen(true), 40);
    }
    setReopenProductAfterPicker(false);
  };

  // --- Subida de imagen con fallbacks y modo URL manual ---
  const uploadImageAsync = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Permisos', 'Se requiere acceso a tu galería para subir imágenes.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images, // <- CORREGIDO
        quality: 0.9,
        allowsEditing: true,
      });
      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.uri) return;

      const uri = asset.uri;
      const filename = uri.split('/').pop() || `photo.jpg`;
      const extMatch = /\.(\w+)$/.exec(filename);
      const type = extMatch ? `image/${extMatch[1]}` : 'image/jpeg';

      const form = new FormData();
      form.append('file', { uri, name: filename, type });

      // 1) Si el wrapper lo tiene
      if (API.adminUploadImage) {
        try {
          const res = await API.adminUploadImage(form);
          const url = res?.url || res?.secure_url || res?.path || res?.Location;
          if (url) { setProdImageUrl(url); return; }
        } catch (e) {
          // cae al fallback
        }
      }

      // 2) Fallback: probamos endpoints comunes con axios base (api)
      const candidates = [
        '/upload',
        '/admin/upload',
        '/files/upload',
        '/admin/catalog/upload',
        '/api/upload',
      ];

      for (const endpoint of candidates) {
        try {
          const res = await api.post(endpoint, form, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 15000,
          });
          const data = res?.data || {};
          const url =
            data.url ||
            data.secure_url ||
            data.Location ||
            data.path ||
            data?.file?.url ||
            (Array.isArray(data.files) ? data.files[0]?.url : null);
          if (url) {
            setProdImageUrl(url);
            return;
          }
        } catch {
          // probar siguiente
        }
      }

      // 3) Nada funcionó → ofrecer URL manual
      setManualUrlMode(true);
      Alert.alert(
        'Subida no disponible',
        'No se encontró endpoint de subida. Pega una URL de imagen manualmente.'
      );
    } catch (e) {
      setManualUrlMode(true);
      Alert.alert('Error', e?.message || 'No se pudo subir la imagen. Pega una URL manualmente.');
    }
  };

  const saveProduct = async () => {
    if (readonly) return Alert.alert('Solo lectura', readonlyReason);
    const title = prodTitle.trim();
    if (!title) return Alert.alert('Validación', 'El título es obligatorio.');
    try {
      let categoryId = prodCategoryId;
      if (!categoryId) {
        try {
          if (!othersCategory && API.adminCreateCategory) {
            await API.adminCreateCategory({ name: 'Otros' });
            await loadCategories();
          }
        } catch {}
        const other = othersCategory ||
          categories.find(c => String(c.name || '').toLowerCase() === 'otros');
        categoryId = other?.id ?? null;
      }
      const payload = {
        title,
        imageUrl: prodImageUrl || undefined,
        categoryId,
      };

      if (editingProdId) {
        await API.adminUpdateProduct?.(editingProdId, payload);
      } else {
        await API.adminCreateProduct?.(payload);
      }
      setProdModalOpen(false);
      await loadProducts();
      await loadCategories();
    } catch (e) {
      Alert.alert('Error', e?.message || 'No se pudo guardar el producto');
    }
  };

  const deleteProduct = (p) => {
    if (readonly) return Alert.alert('Solo lectura', readonlyReason);
    Alert.alert('Confirmar', `¿Eliminar el producto "${p.title || p.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          try {
            await API.adminDeleteProduct?.(p.id);
            await loadProducts();
            await loadCategories();
          } catch (e) {
            Alert.alert('Error', e?.message || 'No se pudo eliminar el producto');
          }
        }
      }
    ]);
  };

  // ====== Filtrado de productos por categoría ======
  const filteredProducts = useMemo(() => {
    if (!productCatFilter) return products;
    return products.filter((p) => {
      const cid = p.categoryId ?? p.category_id ?? p.category?.id ?? null;
      if (productCatFilter === OTROS_ID) return cid == null;
      return String(cid) === String(productCatFilter);
    });
  }, [products, productCatFilter]);

  // ====== Secciones para SectionList ======
  const sections = useMemo(() => ([
    {
      key: 'cats',
      title: 'Categorías',
      data: (categoriesForList || []).map(c => ({ _type: 'cat', value: c })),
    },
    {
      key: 'prods',
      title: 'Productos',
      data: (filteredProducts || []).map(p => ({ _type: 'prod', value: p })),
    },
  ]), [categoriesForList, filteredProducts]);

  // ====== UI ======
  return (
    <View style={{ flex: 1, padding: 12 }}>
      {err && <ErrorBanner message={err} onRetry={loadAll} />}

      {readonly && (
        <View style={styles.infoBanner}>
          <Text style={styles.infoTitle}>Modo solo lectura</Text>
          <Text style={styles.infoText}>{readonlyReason}</Text>
        </View>
      )}

      {!readonly && (
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
          <TouchableOpacity style={styles.primaryBtn} onPress={openCreateCategory}>
            <Text style={styles.primaryBtnText}>+ Agregar categoría</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryBtn} onPress={openCreateProduct}>
            <Text style={styles.primaryBtnText}>+ Agregar producto</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" />
      ) : (
        <SectionList
          ref={listRef}
          sections={sections}
          stickySectionHeadersEnabled={false}
          keyExtractor={(item, index) => {
            const v = item?.value;
            const id = v?.id ?? index;
            return (item._type === 'cat' ? `c:` : `p:`) + String(id);
          }}
          contentContainerStyle={{ paddingBottom: 24 }}
          refreshing={refreshing}
          onRefresh={refresh}
          renderSectionHeader={({ section }) => {
            if (section.key === 'prods') {
              return (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={styles.sectionTitle}>Productos</Text>
                  {productCatFilter && (
                    <TouchableOpacity
                      onPress={() => setProductCatFilter(null)}
                      style={styles.clearFilterChip}
                    >
                      <Text style={styles.clearFilterChipTxt}>
                        Quitar filtro ({catNameOf(productCatFilter)})
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            }
            return <Text style={styles.sectionTitle}>{section.title}</Text>;
          }}
          SectionSeparatorComponent={() => <View style={{ height: 12 }} />}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={
            <Text style={{ color: '#64748b', textAlign: 'center', marginTop: 16 }}>
              No hay categorías ni productos.
            </Text>
          }
          renderItem={({ item }) => {
            if (item._type === 'cat') {
              const c = item.value;
              const isPseudo = !!c._pseudoOtros;
              const cid = c.id;
              const count = c.productsCount ?? productsCountByCategory[cid] ?? (isPseudo ? uncategorizedCount : 0) ?? 0;
              const highlighted = isHighlightedCategory(c);
              return (
                <View style={[styles.row, highlighted && styles.rowActive]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{c.name}</Text>
                    <Text style={styles.sub}>{count} producto(s)</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity style={styles.link} onPress={() => viewCategoryProducts(c)}>
                      <Text style={styles.linkText}>Ver productos</Text>
                    </TouchableOpacity>
                    {!readonly && !isPseudo && (
                      <>
                        <TouchableOpacity style={styles.link} onPress={() => openEditCategory(c)}>
                          <Text style={styles.linkText}>Editar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.link, { backgroundColor: '#fee2e2' }]}
                          onPress={() => deleteCategory(c)}
                        >
                          <Text style={[styles.linkText, { color: '#991b1b' }]}>Eliminar</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>
              );
            }

            const p = item.value;
            const img = getImgFromProduct(p);
            const cid = p.categoryId ?? p.category_id ?? p.category?.id ?? null;
            return (
              <View style={styles.row}>
                {img
                  ? <Image source={{ uri: img }} style={styles.thumb} />
                  : <View style={styles.thumbPlaceholder}><Text style={{ color: '#64748b' }}>Sin imagen</Text></View>
                }
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{p.title || p.name}</Text>
                  <Text style={styles.sub}>{cid ? catNameOf(cid) : 'Otros'}</Text>
                </View>
                {!readonly && (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity style={styles.link} onPress={() => openEditProduct(p)}>
                      <Text style={styles.linkText}>Editar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.link, { backgroundColor: '#fee2e2' }]}
                      onPress={() => deleteProduct(p)}
                    >
                      <Text style={[styles.linkText, { color: '#991b1b' }]}>Eliminar</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}

      {/* Modal Categoría */}
      <Modal visible={catModalOpen} transparent animationType="slide" onRequestClose={() => setCatModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingCatId ? 'Editar categoría' : 'Nueva categoría'}</Text>
            <Text style={styles.label}>Nombre</Text>
            <TextInput value={catName} onChangeText={setCatName} style={styles.input} placeholder="Ej: Bebidas" />
            <View style={{ height: 12 }} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={[styles.bigBtn, styles.secondary]} onPress={() => setCatModalOpen(false)}>
                <Text style={styles.bigBtnTxtSecondary}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.bigBtn, styles.primary]} onPress={saveCategory}>
                <Text style={styles.bigBtnTxt}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Producto */}
      <Modal visible={prodModalOpen} transparent animationType="slide" onRequestClose={() => setProdModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={{ paddingBottom: 12 }}>
              <Text style={styles.modalTitle}>{editingProdId ? 'Editar producto' : 'Nuevo producto'}</Text>

              <Text style={styles.label}>Título</Text>
              <TextInput value={prodTitle} onChangeText={setProdTitle} style={styles.input} placeholder="Ej: Coca-Cola 350 ml" />

              <Text style={styles.label}>Imagen</Text>
              {prodImageUrl ? (
                <View style={{ alignItems: 'center', marginBottom: 8 }}>
                  <Image source={{ uri: prodImageUrl }} style={{ width: 120, height: 120, borderRadius: 10 }} />
                  <TouchableOpacity onPress={() => setProdImageUrl('')} style={{ marginTop: 6 }}>
                    <Text style={{ color: '#991b1b', fontWeight: '700' }}>Quitar</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  {!manualUrlMode && (
                    <TouchableOpacity style={[styles.selectBtn]} onPress={uploadImageAsync}>
                      <Text style={styles.selectBtnTxt}>Subir imagen</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.selectBtn, { marginTop: 8, backgroundColor: '#f8fafc' }]}
                    onPress={() => setManualUrlMode((v) => !v)}
                  >
                    <Text style={[styles.selectBtnTxt, { color: '#0b1f3a' }]}>
                      {manualUrlMode ? 'Ocultar URL manual' : 'Pegar URL manual'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              {manualUrlMode && !prodImageUrl && (
                <TextInput
                  placeholder="https://ejemplo.com/imagen.jpg"
                  style={[styles.input, { marginTop: 8 }]}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={setProdImageUrl}
                />
              )}

              <Text style={styles.label}>Categoría</Text>
              <TouchableOpacity style={[styles.selectBtn]} onPress={openCatPickerFromProduct}>
                <Text style={styles.selectBtnTxt}>
                  {prodCategoryId ? (catNameOf(prodCategoryId) || `#${prodCategoryId}`) : 'Seleccionar categoría (si no, va a "Otros")'}
                </Text>
              </TouchableOpacity>

              <View style={{ height: 12 }} />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity style={[styles.bigBtn, styles.secondary]} onPress={() => setProdModalOpen(false)}>
                  <Text style={styles.bigBtnTxtSecondary}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.bigBtn, styles.primary]} onPress={saveProduct}>
                  <Text style={styles.bigBtnTxt}>Guardar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Picker de categorías para el producto */}
      <Modal
        visible={catPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => closeCatPicker(true)}
      >
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={styles.modalTitle}>Seleccionar categoría</Text>
              <TouchableOpacity onPress={() => closeCatPicker(true)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={categoriesForList}
              keyExtractor={(c) => String(c.id)}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerRow}
                  onPress={() => {
                    setProdCategoryId(item.id === OTROS_ID ? null : item.id);
                    closeCatPicker(true);
                  }}
                >
                  <Text style={{ fontWeight: '700' }}>{item.name}</Text>
                  {(item.productsCount ?? productsCountByCategory[item.id]) != null && (
                    <Text style={{ color: '#64748b' }}>
                      {(item.productsCount ?? productsCountByCategory[item.id] ?? (item.id === OTROS_ID ? uncategorizedCount : 0))} producto(s)
                    </Text>
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#64748b', marginTop: 10 }}>Sin categorías</Text>}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  primaryBtn: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700' },

  infoBanner: {
    borderWidth: 1,
    borderColor: '#c7e0ff',
    backgroundColor: '#eef6ff',
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  infoTitle: { fontWeight: '800', color: '#09335f', marginBottom: 4 },
  infoText: { color: '#09335f' },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0b1f3a',
    marginBottom: 8,
    marginTop: 4,
  },

  clearFilterChip: {
    backgroundColor: '#e5eefc',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  clearFilterChipTxt: { color: PRIMARY, fontWeight: '700' },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1, borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  rowActive: {
    borderColor: PRIMARY,
    backgroundColor: '#eef6ff',
  },
  title: { fontWeight: '700' },
  sub: { color: '#6b7280' },

  link: { paddingVertical: 6, paddingHorizontal: 8, borderRadius: 8, backgroundColor: '#eef2ff' },
  linkText: { color: PRIMARY, fontWeight: '700' },

  thumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: '#f1f5f9' },
  thumbPlaceholder: { width: 56, height: 56, borderRadius: 8, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },

  // Modal base
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
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0b1f3a', marginBottom: 8 },
  modalClose: { fontSize: 22, fontWeight: '800', color: '#64748b', paddingHorizontal: 4 },

  label: { fontWeight: '700', color: '#334155', marginBottom: 6, marginTop: 10 },
  input: {
    borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 10, backgroundColor: '#fff',
  },

  selectBtn: {
    borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 10, backgroundColor: '#fff',
  },
  selectBtnTxt: { fontWeight: '700', color: '#0b1f3a' },

  bigBtn: { flex: 1, borderRadius: 10, paddingVertical: 16, alignItems: 'center' },
  primary: { backgroundColor: PRIMARY },
  secondary: { backgroundColor: '#eef2ff' },
  bigBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
  bigBtnTxtSecondary: { color: '#111827', fontWeight: '700', fontSize: 16 },

  // Picker categorías
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
});
