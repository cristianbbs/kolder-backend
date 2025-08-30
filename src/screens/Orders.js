// kolder-app/src/screens/Orders.js
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import dayjs from 'dayjs';
import API from '../api/client';
import { Cart } from '../store/cart';

export default function OrdersScreen({ navigation }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await API.listOrders(); // debe devolver { orders: [...] }
      setOrders(data?.orders || []);
    } catch (e) {
      const msg = e?.response?.data?.error || 'No se pudo cargar historial';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ---- Repetir pedido → cargar carrito y navegar a Carrito ----
  const repeatToCart = (order) => {
    if (!order || !Array.isArray(order.items) || order.items.length === 0) {
      return Alert.alert('Pedido sin ítems');
    }

    const putItemsInCart = (mode = 'replace') => {
      if (mode === 'replace') Cart.clear();
      for (const it of order.items) {
        const pid = it.productId;
        const title = it.productTitle || it.product?.title || `Producto ${pid}`;
        const qty = Number(it.quantity) || 0;
        if (qty > 0) Cart.add(pid, title, qty);
      }
      navigation.navigate('Cart');
    };

    Alert.alert(
      'Repetir pedido',
      '¿Cómo quieres cargar los productos?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sumar al carrito', onPress: () => putItemsInCart('merge') },
        { text: 'Reemplazar', style: 'destructive', onPress: () => putItemsInCart('replace') },
      ],
      { cancelable: true }
    );
  };

  const goToTracking = (orderId) => {
    navigation.navigate('OrderTracking', { orderId });
  };

  return (
    <FlatList
      style={{ flex: 1 }}
      data={orders}
      keyExtractor={(o) => String(o.id)}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      contentContainerStyle={{ paddingBottom: 24, paddingTop: 8 }}
      renderItem={({ item: o }) => (
        <View style={{ padding: 16, borderBottomWidth: 1, borderColor: '#eee', gap: 6 }}>
          <Text style={{ fontWeight: '600' }}>#{o.id} • {o.status}</Text>
          <Text style={{ color: '#666' }}>{dayjs(o.createdAt).format('DD/MM/YYYY HH:mm')}</Text>
          <Text>
            {(o.items || [])
              .map(it => `${it.quantity}x ${it.productTitle || it.product?.title || `Producto ${it.productId}`}`)
              .join(', ')}
          </Text>

          <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
            <TouchableOpacity onPress={() => goToTracking(o.id)}>
              <Text style={{ color: '#084999', fontWeight: '700' }}>Seguimiento</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => repeatToCart(o)}>
              <Text style={{ color: '#0a7', fontWeight: '600' }}>Repetir (en carrito)</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      ListEmptyComponent={
        <View style={{ padding: 16 }}>
          <Text>No tienes pedidos aún.</Text>
        </View>
      }
    />
  );
}
