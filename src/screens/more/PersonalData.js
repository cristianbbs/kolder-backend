// kolder-app/src/screens/more/PersonalData.js
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import Card from '../../ui/Card';
import API from '../../api/client';
import { useAuth } from '../../auth/context';

const PRIMARY = '#084999';

export default function PersonalData() {
  const { profile } = useAuth();
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      name: profile?.name || '',
      phone: profile?.phone || profile?.phoneNumber || '',
      email: profile?.email || '',
      password: '',
    });
  }, [profile]);

  const onChange = (k, v) => setForm(s => ({ ...s, [k]: v }));

  const save = async () => {
    try {
      if (!form.name.trim() || !form.email.trim()) {
        Alert.alert('Faltan datos', 'Nombre y correo son obligatorios.');
        return;
      }
      setSaving(true);

      const payload = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || null,
      };
      if (form.password && form.password.trim()) {
        payload.password = form.password.trim();
      }

      // Intentamos endpoints comunes; se usa el primero que exista en tu backend
      try {
        await API.put('/auth/me', payload);
      } catch (e1) {
        if (e1?.response?.status === 404) {
          try {
            await API.patch('/auth/me', payload);
          } catch (e2) {
            if (e2?.response?.status === 404) {
              await API.put('/users/me', payload);
            } else {
              throw e2;
            }
          }
        } else {
          throw e1;
        }
      }

      Alert.alert('Listo', 'Tus datos fueron actualizados.');
      setForm(s => ({ ...s, password: '' }));
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'No fue posible actualizar tus datos.';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={{ padding: 12 }}>
        <Text style={styles.title}>Datos personales</Text>

        <Card>
          <Text style={styles.label}>Nombre</Text>
          <TextInput
            value={form.name}
            onChangeText={(t) => onChange('name', t)}
            placeholder="Nombre y apellido"
            style={styles.input}
            autoCapitalize="words"
          />

          <Text style={styles.label}>Teléfono</Text>
          <TextInput
            value={form.phone}
            onChangeText={(t) => onChange('phone', t)}
            placeholder="+56 9 1234 5678"
            style={styles.input}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Correo</Text>
          <TextInput
            value={form.email}
            onChangeText={(t) => onChange('email', t)}
            placeholder="correo@dominio.cl"
            style={styles.input}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            value={form.password}
            onChangeText={(t) => onChange('password', t)}
            placeholder="Dejar vacío para no cambiar"
            style={styles.input}
            secureTextEntry
          />

          <View style={{ height: 12 }} />

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              style={[styles.bigBtn, styles.primary]}
              onPress={save}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.bigBtnTxt}>Guardar cambios</Text>}
            </TouchableOpacity>
          </View>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '800', color: '#0b1f3a', marginBottom: 8 },

  label: { fontWeight: '700', color: '#334155', marginBottom: 6, marginTop: 10 },
  input: {
    borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 10, backgroundColor: '#fff',
  },

  bigBtn: { flex: 1, borderRadius: 10, paddingVertical: 16, alignItems: 'center' },
  primary: { backgroundColor: PRIMARY },
  bigBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
