// kolder-app/src/screens/more/Support.js
import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, Linking, Platform, ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Card from '../../ui/Card';

const PRIMARY = '#084999';

// ⚠️ Ajusta estos datos a tu realidad:
const SUPPORT_PHONE = '+56 9 1234 5678';
const SUPPORT_EMAIL = 'soporte@tuempresa.cl';
const EMERGENCY_WHATSAPP = '+56 9 9111 2222';
const EMERGENCY_PRESET_MSG = 'Hola, necesito ayuda urgente con mi pedido.';

const onlyDigits = (s = '') => String(s).replace(/[^\d]/g, '');
const openTel = async (phone) => {
  const url = `tel:${phone}`;
  const ok = await Linking.canOpenURL(url);
  if (!ok) return Alert.alert('No disponible', 'Tu dispositivo no puede iniciar llamadas telefónicas.');
  return Linking.openURL(url);
};
const openMail = async (email) => {
  const url = `mailto:${email}`;
  const ok = await Linking.canOpenURL(url);
  if (!ok) return Alert.alert('No disponible', 'No se pudo abrir el correo.');
  return Linking.openURL(url);
};
const openWhatsapp = async (phone, text = '') => {
  const digits = onlyDigits(phone);
  const deep = `whatsapp://send?phone=${digits}&text=${encodeURIComponent(text)}`;
  const web  = `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
  const canDeep = await Linking.canOpenURL(deep);
  return Linking.openURL(canDeep ? deep : web);
};

export default function Support() {
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }}>
      <Text style={styles.title}>Soporte</Text>

      <Card style={{ marginBottom: 10 }}>
        <Text style={styles.cardTitle}>Contáctanos</Text>

        {/* Teléfono */}
        <TouchableOpacity style={styles.rowBtn} onPress={() => openTel(SUPPORT_PHONE)} activeOpacity={0.85}>
          <View style={styles.rowLeft}>
            <Feather name="phone" size={18} color="#64748b" />
            <Text style={styles.rowText}>Teléfono</Text>
          </View>
          <Text style={styles.rowValue}>{SUPPORT_PHONE}</Text>
        </TouchableOpacity>

        {/* Correo */}
        <TouchableOpacity style={styles.rowBtn} onPress={() => openMail(SUPPORT_EMAIL)} activeOpacity={0.85}>
          <View style={styles.rowLeft}>
            <Feather name="mail" size={18} color="#64748b" />
            <Text style={styles.rowText}>Correo</Text>
          </View>
          <Text style={styles.rowValue}>{SUPPORT_EMAIL}</Text>
        </TouchableOpacity>

        {/* Emergencias (WhatsApp) */}
        <TouchableOpacity
          style={[styles.rowBtn, styles.emergency]}
          onPress={() => openWhatsapp(EMERGENCY_WHATSAPP, EMERGENCY_PRESET_MSG)}
          activeOpacity={0.9}
        >
          <View style={styles.rowLeft}>
            <Feather name="alert-triangle" size={18} color="#991b1b" />
            <Text style={[styles.rowText, { color: '#991b1b', fontWeight: '800' }]}>Emergencias</Text>
          </View>
          <Feather name="message-circle" size={18} color="#991b1b" />
        </TouchableOpacity>

        <Text style={styles.note}>
          Horario de atención: Lun a Vie, 9:00–18:00. Para urgencias fuera de horario usa “Emergencias”.
        </Text>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Consejos rápidos</Text>
        <View style={styles.tipItem}>
          <Feather name="info" size={16} color="#64748b" />
          <Text style={styles.tipText}>Revisa el estado de tus pedidos desde “Mis pedidos”.</Text>
        </View>
        <View style={styles.tipItem}>
          <Feather name="shield" size={16} color="#64748b" />
          <Text style={styles.tipText}>Mantén tus datos personales actualizados para un mejor servicio.</Text>
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '800', color: '#0b1f3a', marginBottom: 8 },
  cardTitle: { fontWeight: '800', color: '#0b1f3a', marginBottom: 8 },

  rowBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 10, backgroundColor: '#fff',
    marginBottom: 8,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowText: { fontWeight: '700', color: '#0b1f3a' },
  rowValue: { color: '#334155', fontWeight: '600' },

  emergency: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },

  note: { color: '#64748b', marginTop: 4 },

  tipItem: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  tipText: { color: '#334155' },
});
