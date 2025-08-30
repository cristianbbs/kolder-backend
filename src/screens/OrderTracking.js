// kolder-app/src/screens/OrderTracking.js
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, RefreshControl, ScrollView, Alert } from 'react-native';
import API from '../api/client';

const STEP_ORDER = ['SUBMITTED', 'PREPARING', 'EN_ROUTE', 'DELIVERED', 'CANCELLED'];
const LABELS = {
  SUBMITTED: 'Recibido',
  PREPARING: 'Preparando',
  EN_ROUTE: 'En ruta',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
};

export default function OrderTracking({ route, navigation }) {
  const { orderId } = route.params;
  const [order, setOrder] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      const o = await API.getOrder(orderId);
      if (!o) throw new Error('No se encontró el pedido');
      setOrder(o);
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Error al cargar pedido';
      Alert.alert('Error', msg);
    } finally {
      setRefreshing(false);
    }
  }, [orderId]);

  useEffect(() => {
    navigation.setOptions({ title: `Pedido #${orderId}` });
    load();
  }, [load, navigation, orderId]);

  if (!order) {
    return (
      <View style={{ flex: 1, padding: 16 }}>
        <Text>Cargando...</Text>
      </View>
    );
  }

  const achieved = new Set([...(order.statusLogs ?? []).map(l => l.to)]);
  const isDone = (s) => achieved.has(s) || order.status === s;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#fff' }}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
    >
      <View style={{ backgroundColor: '#F6F8FB', padding: 16, borderRadius: 12 }}>
        <Text style={{ fontWeight: '800', fontSize: 16, color: '#084999' }}>
          Seguimiento de tu pedido
        </Text>
        <Text style={{ color: '#333', marginTop: 4 }}>
          Estado actual: <Text style={{ fontWeight: '700' }}>{order.status}</Text>
        </Text>
        {order.emergency ? (
          <Text style={{ color: '#444', marginTop: 2 }}>
            Despacho de emergencia: Sí{order.extraCost ? ` (+$${order.extraCost})` : ''}
          </Text>
        ) : (
          <Text style={{ color: '#444', marginTop: 2 }}>
            Despacho de emergencia: No
          </Text>
        )}
      </View>

      <View style={{ marginTop: 20 }}>
        <Text style={{ fontWeight: '800', fontSize: 16, marginBottom: 8 }}>Línea de tiempo</Text>

        {STEP_ORDER.map((s, idx) => {
          const log = (order.statusLogs || []).find(l => l.to === s);
          const active = isDone(s);
          return (
            <View key={s} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <View style={{
                width: 16, height: 16, borderRadius: 8,
                backgroundColor: active ? '#084999' : '#CCD6E0',
                marginTop: 2,
              }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', color: active ? '#084999' : '#666' }}>
                  {LABELS[s]}
                </Text>
                {log?.createdAt && (
                  <Text style={{ color: '#666', fontSize: 12 }}>
                    {new Date(log.createdAt).toLocaleString()}
                  </Text>
                )}
                {idx < STEP_ORDER.length - 1 && (
                  <View style={{ height: 18, borderLeftWidth: 2, borderLeftColor: '#E5EAF0', marginLeft: 7 }} />
                )}
              </View>
            </View>
          );
        })}
      </View>

      <View style={{ marginTop: 20 }}>
        <Text style={{ fontWeight: '800', fontSize: 16, marginBottom: 8 }}>Ítems</Text>
        {(order.items || []).map(it => (
          <View key={it.id ?? `${it.productId}-${it.quantity}`} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#EEE' }}>
            <Text style={{ fontWeight: '600' }}>{it.productTitle || `Producto ${it.productId}`}</Text>
            <Text style={{ color: '#444' }}>Cantidad: {it.quantity}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
