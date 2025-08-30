// kolder-app/src/screens/Catalog.js
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Button, FlatList, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import API, { api } from '../api/client';
import { useAuth } from '../auth/context';

function pickImageUrl(p) {
  // Aceptar distintas formas que puede traer el backend o algún wrapper viejo
  const fromImagesArr =
    Array.isArray(p?.images) && p.images.length
      ? (typeof p.images[0] === 'string' ? p.images[0] : p.images[0]?.url || p.images[0]?.src)
      : undefined;

  return (
    p?.imageUrl ||
    p?.imageURL ||
    p?.image_url ||
    p?.image ||
    fromImagesArr ||
    '' // vacío si no hay
  );
}

export default function Catalog({ navigation }) {
  const { token, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    console.log('[CAT][DEBUG] baseURL:', api?.defaults?.baseURL, 'token?', !!token);
  }, [token]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const cats = await API.getCatalog({ onlyAllowed: true });
      const safeCats = Array.isArray(cats) ? cats : [];

      safeCats.forEach((c) => {
        const n = Array.isArray(c?.products) ? c.products.length : 0;
        console.log(`[CAT] ${c?.name ?? 'sin nombre'} -> ${n} productos`);
      });

      setCategories(safeCats);
      console.log('[CAT] categorías recibidas:', safeCats.length);
    } catch (err) {
      const status = err?.response?.status;
      setErrorMsg(
        status === 401
          ? 'Sesión inválida. Inicia sesión nuevamente.'
          : 'No pudimos cargar el catálogo. Revisa la red/IP y vuelve a intentar.'
      );
      console.warn('[CAT] error cargando catálogo:', err?.message || err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) load();
  }, [token, load]);

  useFocusEffect(
    useCallback(() => {
      if (token) load();
    }, [token, load])
  );

  if (authLoading) {
    return (
      <View style={{ flex:1, justifyContent:'center', alignItems:'center', padding:16 }}>
        <ActivityIndicator size="large" />
        <Text>Preparando sesión…</Text>
      </View>
    );
  }

  if (!token) {
    return (
      <View style={{ flex:1, justifyContent:'center', alignItems:'center', padding:16 }}>
        <Text>Debes iniciar sesión.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={{ flex:1, justifyContent:'center', alignItems:'center', padding:16 }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop:12 }}>Cargando catálogo…</Text>
      </View>
    );
  }

  if (errorMsg) {
    return (
      <View style={{ flex:1, justifyContent:'center', alignItems:'center', padding:16 }}>
        <Text style={{ marginBottom:12, textAlign:'center' }}>{errorMsg}</Text>
        <Button title="Reintentar" onPress={load} />
      </View>
    );
  }

  if (!categories?.length) {
    return (
      <View style={{ flex:1, justifyContent:'center', alignItems:'center', padding:16 }}>
        <Text>No hay productos habilitados para tu empresa.</Text>
        <Button title="Actualizar" onPress={load} />
      </View>
    );
  }

  const goToCategory = (cat) => {
    const raw = Array.isArray(cat?.products) ? cat.products : [];
    const products = raw.map((p) => ({
      id: p?.id,
      title: p?.title ?? p?.name ?? 'Producto',
      detail: p?.detail ?? '',
      imageUrl: pickImageUrl(p),
    }));
    console.log(`[NAV] "${cat?.name}" -> paso ${products.length} productos a CategoryProducts`);
    navigation.navigate('CategoryProducts', {
      categoryId: cat?.id,
      categoryName: cat?.name,
      products,
    });
  };

  return (
    <FlatList
      data={categories}
      keyExtractor={(c, i) => String(c?.id ?? i)}
      onRefresh={load}
      refreshing={loading}
      contentContainerStyle={{ paddingBottom: 24 }}
      renderItem={({ item }) => {
        const count = Array.isArray(item?.products) ? item.products.length : 0;
        return (
          <TouchableOpacity
            onPress={() => goToCategory(item)}
            style={{
              padding:16, borderBottomWidth:1, borderColor:'#eee',
              flexDirection:'row', alignItems:'center', justifyContent:'space-between'
            }}
          >
            <View>
              <Text style={{ fontWeight:'bold', fontSize:16 }}>{item?.name ?? 'Sin nombre'}</Text>
              <Text style={{ fontSize:12, opacity:0.7 }}>{count} productos</Text>
            </View>
            <Text style={{ fontSize:18, opacity:0.5 }}>{'>'}</Text>
          </TouchableOpacity>
        );
      }}
    />
  );
}
