// C:\Users\Crist\kolder-app\src\screens\admin\AdminHome.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useAuth } from '../../auth/context';

function Card({ title, desc, onPress, disabled }) {
  return (
    <TouchableOpacity
      style={[styles.card, disabled && styles.cardDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.9}
    >
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardDesc}>{desc}</Text>
    </TouchableOpacity>
  );
}

export default function AdminHome({ navigation }) {
  const { profile } = useAuth();
  const role = profile?.role;

  const isSuper = role === 'SUPER_ADMIN';
  const isCompanyAdmin = role === 'COMPANY_ADMIN';
  const isAdminGeneral = role === 'ADMIN_GENERAL';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>Panel de administración</Text>

      <Card
        title="Pedidos"
        desc="Lista, filtros y cambio de estado"
        onPress={() => navigation.navigate('AdminOrders')}
      />

      <Card
        title="Usuarios"
        desc="Crear/editar y bloquear (solo SUPER)"
        onPress={() => navigation.navigate('AdminUsers')}
        disabled={!isSuper}
      />

      {/* Nuevo: Catálogo (reemplaza 'Productos habilitados') */}
      <Card
        title="Catálogo"
        desc="Categorías y productos (solo SUPER)"
        onPress={() => navigation.navigate('AdminCatalog')}
        disabled={!isSuper}
      />

      <Card
        title="Empresas"
        desc={isSuper ? 'Alta/edición/eliminación (solo SUPER)' : 'Listado y creación (ADMIN_GENERAL / SUPER)'}
        onPress={() => navigation.navigate('AdminCompanies')}
        disabled={!isSuper && !isAdminGeneral}
      />

      <Card
        title="Config. Emergencia"
        desc={isSuper ? 'Editar costo/horarios globales' : 'Sólo lectura'}
        onPress={() => navigation.navigate('AdminEmergencyConfig')}
        disabled={!isSuper && !isCompanyAdmin}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  header: { fontSize: 22, fontWeight: '700', color: '#084999', marginBottom: 12 },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  cardDisabled: { opacity: 0.45 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  cardDesc: { fontSize: 14, color: '#6b7280' },
});
