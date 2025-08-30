// C:\Users\Crist\kolder-app\src\components\StatusBadge.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const map = {
  SUBMITTED: { bg: '#eef2ff', fg: '#3730a3', label: 'Creado' },
  CONFIRMED: { bg: '#dbeafe', fg: '#1d4ed8', label: 'Confirmado' },
  PREPARING: { bg: '#ecfeff', fg: '#155e75', label: 'Preparando' },
  EN_ROUTE:  { bg: '#fef3c7', fg: '#92400e', label: 'En ruta' },
  DELIVERED: { bg: '#ecfdf5', fg: '#065f46', label: 'Entregado' },
  CANCELLED: { bg: '#fee2e2', fg: '#991b1b', label: 'Cancelado' },
};

export default function StatusBadge({ status }) {
  const s = map[status] || { bg: '#e5e7eb', fg: '#374151', label: status || 'Desconocido' };
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Text style={[styles.text, { color: s.fg }]}>{s.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  text: {
    fontWeight: '700',
    fontSize: 12,
  },
});
