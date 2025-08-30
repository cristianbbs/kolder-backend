// C:\Users\Crist\kolder-app\src\screens\admin\AdminUserForm.js
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import API from '../../api/client';

export default function AdminUserForm({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(''); // opcional
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const e = email.trim().toLowerCase();
    const n = name.trim();

    if (!n) return Alert.alert('Datos faltantes', 'Ingresa el nombre.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return Alert.alert('Email inválido', 'Revisa el formato del correo.');

    try {
      setSaving(true);
      const payload = { email: e, name: n, ...(password ? { password } : {}) };
      await API.adminCreateUser(payload);
      Alert.alert('Listo', 'Admin General creado.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (err) {
      const data = err?.response?.data;
      const fieldErrs = data?.error?.fieldErrors;
      if (fieldErrs) {
        const flat = Object.entries(fieldErrs)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
          .join('\n');
        Alert.alert('Datos inválidos', flat || 'Revisa los campos');
      } else {
        Alert.alert('Error', data?.error || err.message || 'No se pudo crear');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ padding: 12 }}>
      <Text style={styles.label}>Nombre</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Nombre y apellido"
        autoCapitalize="words"
      />

      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="correo@empresa.cl"
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <Text style={styles.label}>Contraseña (opcional)</Text>
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="Mín. 6 caracteres (opcional)"
        secureTextEntry
        autoCapitalize="none"
      />

      <TouchableOpacity style={[styles.btn, saving && { opacity: 0.7 }]} onPress={save} disabled={saving}>
        <Text style={styles.btnText}>{saving ? 'Guardando…' : 'Crear Admin General'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginTop: 10, marginBottom: 6, color: '#374151' },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 10, backgroundColor: '#fff' },
  btn: { marginTop: 16, backgroundColor: '#084999', padding: 12, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },
});
