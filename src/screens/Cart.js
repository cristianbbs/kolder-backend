// src/screens/Cart.js
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useCart } from '../store/cart';
import API from '../api/client';

const PRIMARY = '#084999';

export default function CartScreen() {
  const navigation = useNavigation();
  const { items, count, set, remove, clear } = useCart();
  const [submitting, setSubmitting] = useState(false);

  const totalCount = useMemo(
    () => count ?? items.reduce((n, it) => n + (Number(it.quantity) || 0), 0),
    [count, items]
  );

  const inc = (item) => set(item.productId, item.title, Number(item.quantity || 0) + 1);
  const dec = (item) => {
    const next = Number(item.quantity || 0) - 1;
    if (next <= 0) remove(item.productId);
    else set(item.productId, item.title, next);
  };
  const onRemove = (item) => remove(item.productId);

  const checkout = async () => {
    if (!items.length) return;

    // arma payload [{ productId, quantity }]
    const payload = items
      .map((it) => ({
        productId: Number(it.productId),
        quantity: Number(it.quantity) || 0,
      }))
      .filter((r) => Number.isFinite(r.productId) && r.productId > 0 && r.quantity > 0);

    if (!payload.length) {
      Alert.alert('Carro', 'No hay cantidades válidas para enviar.');
      return;
    }

    setSubmitting(true);
    try {
      // createOrder(items, emergency=false, note='')
      const resp = await API.createOrder(payload, false, '');
      // limpia carro local
      clear();
      // feedback y navegación a Pedidos
      const id = resp?.id ?? resp?.order?.id;
      Alert.alert('Pedido enviado', id ? `#${id} creado con éxito.` : 'Se creó tu pedido.');
      navigation.navigate('OrdersTab');
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'No se pudo crear el pedido';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{item.title || `Producto #${item.productId}`}</Text>
        <Text style={styles.subtle}>Cantidad: {item.quantity}</Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.btn} onPress={() => dec(item)}>
          <Text style={styles.btnTxt}>-</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={() => inc(item)}>
          <Text style={styles.btnTxt}>+</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnDanger]} onPress={() => onRemove(item)}>
          <Text style={styles.btnDangerTxt}>x</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, padding: 12 }}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Carrito</Text>
        <Text style={styles.subtle}>Total ítems: {totalCount}</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(it, i) => String(it?.productId ?? i)}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={<Text style={styles.subtle}>Tu carro está vacío.</Text>}
      />

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.bigBtn, styles.secondary]}
          onPress={() => clear()}
          disabled={!items.length || submitting}
        >
          <Text style={styles.bigBtnTxtSecondary}>Limpiar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.bigBtn, styles.primary, submitting && { opacity: 0.7 }]}
          onPress={checkout}
          disabled={!items.length || submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.bigBtnTxt}>Continuar</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 4, paddingBottom: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  subtle: { color: '#6b7280' },

  row: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    marginBottom: 10,
  },
  title: { fontWeight: '600', color: '#111827' },

  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btn: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  btnTxt: { fontWeight: '700', color: '#111827' },
  btnDanger: { backgroundColor: '#fee2e2', borderColor: '#fecaca' },
  btnDangerTxt: { color: '#991b1b', fontWeight: '700' },

  footer: { flexDirection: 'row', gap: 10, paddingTop: 8 },
  bigBtn: { flex: 1, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  primary: { backgroundColor: PRIMARY },
  secondary: { backgroundColor: '#eef2ff' },
  bigBtnTxt: { color: '#fff', fontWeight: '700' },
  bigBtnTxtSecondary: { color: '#111827', fontWeight: '700' },
});
