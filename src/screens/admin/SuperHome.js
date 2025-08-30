// src/screens/admin/SuperHome.js
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';

const PRIMARY = '#084999';

function Row({ icon, label, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.row}>
      <View style={styles.rowLeft}>
        <Feather name={icon} size={20} color={PRIMARY} />
        <Text style={styles.rowText}>{label}</Text>
      </View>
      <Feather name="chevron-right" size={20} color="#94a3b8" />
    </TouchableOpacity>
  );
}

export default function SuperHome({ navigation }) {
  // Cambiar de tab dentro del TabNavigator
  const goTab = (tabName) => {
    // Desde una pantalla de tab, esto navega a la tab hermana por nombre
    navigation.navigate(tabName);
  };

  // Abrir la tab "Más" (MoreStack) y empujar una pantalla hija
  const goMore = (childScreen) => {
    navigation.navigate('MoreTabSuper', { screen: childScreen });
  };

  return (
    <ScrollView style={{ flex: 1, padding: 12 }} contentContainerStyle={{ paddingBottom: 24 }}>
      {/* Gestión */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Gestión</Text>
        <View style={styles.divider} />
        <Row icon="clipboard" label="Pedidos"  onPress={() => goTab('AdminOrdersTab')} />
        <View style={styles.hr} />
        <Row icon="briefcase" label="Empresas" onPress={() => goTab('AdminCompaniesTab')} />
        <View style={styles.hr} />
        <Row icon="users" label="Usuarios"   onPress={() => goTab('AdminUsersTab')} />
        <View style={styles.hr} />
        <Row icon="layers" label="Catálogo"  onPress={() => goTab('AdminCatalogTab')} />
      </View>

      {/* Más */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Más</Text>
        <View style={styles.divider} />
        <Row icon="help-circle" label="Soporte"          onPress={() => goMore('Support')} />
        <View style={styles.hr} />
        <Row icon="bar-chart-2" label="Estadísticas"     onPress={() => goMore('Stats')} />
        <View style={styles.hr} />
        <Row icon="user" label="Datos personales"        onPress={() => goMore('PersonalData')} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingTop: 12,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#0b1f3a', paddingHorizontal: 4, paddingBottom: 8 },
  divider: { height: 1, backgroundColor: '#e5e7eb' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowText: { fontSize: 16, color: '#0b1f3a', fontWeight: '600' },
  hr: { height: 1, backgroundColor: '#f1f5f9' },
});
