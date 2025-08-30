// kolder-app/src/screens/CategoryProducts.js
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, Text, FlatList, Image, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import API from '../api/client';
import { API_BASE_URL } from '../config';
import { useCart } from '../store/cart';

// ---- helpers ---------------------------------------------------------------
function toAbsUrl(u) {
  if (!u || typeof u !== 'string') return '';
  const s = u.trim();
  if (!s) return '';
  // urls absolutas o locales RN
  if (/^(https?:)?\/\//i.test(s) || s.startsWith('file:') || s.startsWith('content:')) return s;
  // relativas -> pegar base
  if (s.startsWith('/')) return (API_BASE_URL || '').replace(/\/+$/, '') + s;
  return s;
}

function normalizeProduct(p) {
  const imgFromArray =
    (Array.isArray(p?.images) && p.images[0]) ||
    (Array.isArray(p?.iamges) && p.iamges[0]) || // typo común
    null;

  const img =
    p?.imageUrl ||
    p?.image_url ||
    p?.image ||
    imgFromArray ||
    '';

  return {
    id: p?.id ?? p?._id ?? p?.productId,
    title: p?.title ?? p?.name ?? 'Producto',
    detail: p?.detail ?? p?.description ?? '',
    imageUrl: toAbsUrl(img),
  };
}
// ---------------------------------------------------------------------------

export default function CategoryProducts({ route }) {
  const params = route?.params || {};
  const { categoryId, categoryName } = params;

  // ⚠️ params.products puede ser una NUEVA referencia en cada render de la screen anterior.
  // Para no entrar en loops, lo "memorizamos" por contenido y normalizamos.
  const initialProducts = useMemo(() => {
    const raw = Array.isArray(params.products) ? params.products : [];
    return raw.map(normalizeProduct);
  }, [params.products]);

  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState(initialProducts);
  const [qtyMap, setQtyMap] = useState(new Map());

  const didFallbackFetch = useRef(false);

  const initQtyMap = useCallback((list) => {
    const m = new Map();
    for (const p of list || []) m.set(p.id, 0);
    setQtyMap(m);
  }, []);

  // 🔁 Si cambian los products "de verdad", sincronizamos estado.
  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  // 🧭 Fallback: si no llegaron products por params y hay categoryId, cargamos PERMITIDOS una sola vez
  useEffect(() => {
    (async () => {
      if (didFallbackFetch.current) return;
      if (products && products.length > 0) return;
      if (!categoryId) return;

      try {
        didFallbackFetch.current = true;
        setLoading(true);
        const cats = await API.getCatalog({ onlyAllowed: true });
        const cat = (cats || []).find((c) => String(c.id) === String(categoryId));
        const prods = Array.isArray(cat?.products) ? cat.products.map(normalizeProduct) : [];
        setProducts(prods);
      } catch (e) {
        console.warn('[CAT-PROD] fallback getCatalog error:', e?.message || e);
      } finally {
        setLoading(false);
      }
    })();
  }, [categoryId, products]);

  // 🔢 Cada vez que cambien los products efectivos, reinicia el qtyMap
  useEffect(() => {
    initQtyMap(products);
  }, [products, initQtyMap]);

  const setQty = (id, next) => {
    const num = Number.isFinite(next) ? next : 0;
    const val = Math.max(0, Math.min(999, Math.trunc(num)));
    setQtyMap((prev) => {
      const copy = new Map(prev);
      copy.set(id, val);
      return copy;
    });
  };

  const onChangeQtyText = (id, t) => {
    const parsed = parseInt(String(t).replace(/[^\d]/g, ''), 10);
    setQty(id, Number.isNaN(parsed) ? 0 : parsed);
  };

  // ✅ Usamos el provider (reactivo)
  const { add } = useCart();

  const addToCart = (p) => {
    const q = qtyMap.get(p.id) || 0;
    if (q <= 0) return;
    add(p.id, p.title, q);      // actualiza store + badge
    setQty(p.id, 0);            // feedback en UI
  };

  const renderItem = ({ item: p }) => {
    const qty = qtyMap.get(p.id) || 0;
    return (
      <View
        style={{
          backgroundColor: '#fff',
          borderWidth: 1,
          borderColor: '#e6eef7',
          borderRadius: 12,
          padding: 12,
          marginHorizontal: 12,
          marginVertical: 8,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          shadowColor: '#000',
          shadowOpacity: 0.03,
          shadowRadius: 4,
        }}
      >
        {/* FOTO */}
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 8,
            overflow: 'hidden',
            backgroundColor: '#f1f5f9',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {p.imageUrl ? (
            <Image source={{ uri: p.imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : (
            <Text style={{ color: '#8091a0' }}>IMG</Text>
          )}
        </View>

        {/* Título + detalle */}
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '700', color: '#0b1f3a' }}>{p.title}</Text>
          {!!p.detail && <Text style={{ color: '#5b7083', marginTop: 2 }}>{p.detail}</Text>}
        </View>

        {/* Qty */}
        <View style={{ width: 84, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <TouchableOpacity
              onPress={() => setQty(p.id, (qty - 1))}
              style={{ paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: '#ccd7e5', borderRadius: 8 }}
              accessibilityLabel="Disminuir cantidad"
            >
              <Text style={{ fontSize: 18, fontWeight: '700' }}>−</Text>
            </TouchableOpacity>

            <TextInput
              keyboardType="number-pad"
              value={String(qty)}
              onChangeText={(t) => onChangeQtyText(p.id, t)}
              style={{ width: 40, borderWidth: 1, borderColor: '#ccd7e5', borderRadius: 8, textAlign: 'center', paddingVertical: 4 }}
              accessibilityLabel="Cantidad"
            />

            <TouchableOpacity
              onPress={() => setQty(p.id, (qty + 1))}
              style={{ paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: '#ccd7e5', borderRadius: 8 }}
              accessibilityLabel="Aumentar cantidad"
            >
              <Text style={{ fontSize: 18, fontWeight: '700' }}>＋</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Agregar */}
        <TouchableOpacity
          onPress={() => addToCart(p)}
          style={{ backgroundColor: '#084999', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, marginLeft: 8 }}
          accessibilityLabel="Agregar al carrito"
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>Agregar</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }} edges={['top', 'right', 'left']}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 8 }}>Cargando productos…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top', 'right', 'left']}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#0b1f3a' }}>
          {categoryName || 'Productos'}
        </Text>
        <Text style={{ color: '#5b7083' }}>
          {Array.isArray(products) ? products.length : 0} productos
        </Text>
      </View>

      <FlatList
        data={Array.isArray(products) ? products : []}
        keyExtractor={(p, i) => String(p?.id ?? i)}
        renderItem={renderItem}
        contentContainerStyle={{ paddingVertical: 8, paddingBottom: 24 }}
        ListEmptyComponent={
          <View style={{ padding: 16 }}>
            <Text>No hay productos en esta categoría.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
