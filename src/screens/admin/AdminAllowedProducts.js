// kolder-app/src/screens/admin/AdminAllowedProducts.js
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, Switch, Alert, RefreshControl } from 'react-native';
import { useRoute } from '@react-navigation/native';
import API from '../../api/client';

const PRIMARY = '#084999';

export default function AdminAllowedProductsScreen() {
  const route = useRoute();
  const forcedCompanyId = route?.params?.companyId ?? null; // si vienes desde el perfil

  const [data, setData] = useState({ companyId: null, categories: [] });
  const [enabled, setEnabled] = useState(new Set());
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = forcedCompanyId ? { companyId: forcedCompanyId } : undefined;
      const res = await API.getAllowedProducts(params);
      const safe = res || { companyId: forcedCompanyId ?? null, categories: [] };
      setData(safe);

      // construir el set de habilitados
      const on = new Set();
      for (const c of safe.categories || []) {
        for (const p of c.products || []) if (p.allowed) on.add(p.id);
      }
      setEnabled(on);
    } catch (e) {
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        'No se pudo cargar productos habilitados';
      Alert.alert('Error', msg);
      setData({ companyId: forcedCompanyId ?? null, categories: [] });
      setEnabled(new Set());
    } finally {
      setLoading(false);
    }
  }, [forcedCompanyId]);

  useEffect(() => { load(); }, [load]);

  const renderProduct = ({ item }) => {
    const on = enabled.has(item.id);
    return (
      <View
        style={{
          paddingVertical: 8,
          paddingHorizontal: 12,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={{ fontWeight: '600' }}>{item.title}</Text>
          {!!item.detail && (
            <Text style={{ color: '#555', marginTop: 2 }} numberOfLines={2}>
              {item.detail}
            </Text>
          )}
        </View>
        {/* Solo lectura: no editable aquí */}
        <Switch value={on} disabled />
      </View>
    );
  };

  const renderCategory = ({ item: cat }) => (
    <View
      style={{
        backgroundColor: '#fff',
        marginVertical: 8,
        borderRadius: 8,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#eee',
      }}
    >
      <View style={{ backgroundColor: PRIMARY, padding: 10 }}>
        <Text style={{ color: '#fff', fontWeight: '700' }}>{cat.name}</Text>
      </View>
      <FlatList
        data={cat.products}
        keyExtractor={(p) => String(p.id)}
        renderItem={renderProduct}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: '#eee' }} />}
      />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#f6f7f8' }}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 8,
          backgroundColor: '#fff',
          borderBottomWidth: 1,
          borderColor: '#eee',
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: '700', color: PRIMARY }}>
          Productos habilitados
        </Text>
        <Text style={{ color: '#666', marginTop: 2 }}>
          {forcedCompanyId
            ? `Vista de la empresa #${forcedCompanyId}`
            : 'Vista de productos habilitados'}
        </Text>
      </View>

      <FlatList
        style={{ flex: 1 }}
        data={data.categories || []}
        keyExtractor={(c) => String(c.id)}
        renderItem={renderCategory}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
        ListEmptyComponent={
          <View style={{ padding: 20 }}>
            <Text style={{ color: '#666' }}>{loading ? 'Cargando…' : 'No hay productos'}</Text>
          </View>
        }
      />
    </View>
  );
}
