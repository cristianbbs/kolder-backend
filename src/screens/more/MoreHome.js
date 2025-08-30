// src/screens/more/MoreHome.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Card from '../../ui/Card';

export default function MoreHome({ navigation }) {
  return (
    <ScrollView contentContainerStyle={{ padding: 12 }}>
      <Text style={styles.title}>Más</Text>

      <Card style={{ marginBottom: 10 }}>
        <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('Support')} activeOpacity={0.85}>
          <View style={styles.rowLeft}>
            <Feather name="life-buoy" size={18} color="#64748b" />
            <Text style={styles.rowText}>Soporte</Text>
          </View>
          <Text style={styles.chev}>{'›'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('PersonalData')} activeOpacity={0.85}>
          <View style={styles.rowLeft}>
            <Feather name="user" size={18} color="#64748b" />
            <Text style={styles.rowText}>Datos personales</Text>
          </View>
          <Text style={styles.chev}>{'›'}</Text>
        </TouchableOpacity>

        {/* Si luego agregas Estadísticas, simplemente añade otro TouchableOpacity aquí */}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '800', color: '#0b1f3a', marginBottom: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 10, backgroundColor: '#fff',
    marginBottom: 8,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowText: { fontWeight: '700', color: '#0b1f3a' },
  chev: { fontSize: 22, color: '#94a3b8', paddingHorizontal: 6 },
});
