// src/screens/admin/AdminEmergencyConfig.js
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator, Alert, TouchableOpacity, ScrollView } from 'react-native';
import API from '../../api/client';
import ErrorBanner from '../../components/ErrorBanner';

export default function AdminEmergencyConfig() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [cfg, setCfg] = useState({ extraCost: null, hours: null, days: null });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const c = await API.getEmergencyConfig();
      setCfg({
        extraCost: c?.extraCost ?? null,
        hours: c?.hours ?? null,
        days: c?.days ?? null,
      });
    } catch (e) {
      setErr(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const payload = {
        extraCost: cfg.extraCost !== null && cfg.extraCost !== '' ? Number(cfg.extraCost) : null,
        hours: (cfg.hours || '').trim() || null,
        days: (cfg.days || '').trim() || null,
      };
      await API.putEmergencyConfig(payload);
      Alert.alert('OK', 'Configuración guardada');
      await load();
    } catch (e) {
      Alert.alert('Error', e?.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }, [cfg, load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text>Cargando configuración…</Text>
      </View>
    );
  }
  if (err) return <ErrorBanner message={err?.message || 'Error cargando configuración'} />;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Recargo emergencias (CLP)</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        placeholder="ej: 2000"
        value={cfg.extraCost === null ? '' : String(cfg.extraCost)}
        onChangeText={(t) => setCfg((prev) => ({ ...prev, extraCost: t.replace(/[^0-9]/g, '') }))}
      />

      <Text style={styles.label}>Horario (HH:MM-HH:MM)</Text>
      <TextInput
        style={styles.input}
        placeholder="ej: 20:00-07:00"
        value={cfg.hours || ''}
        onChangeText={(t) => setCfg((prev) => ({ ...prev, hours: t }))}
        autoCapitalize="none"
      />

      <Text style={styles.label}>Días (texto libre)</Text>
      <TextInput
        style={styles.input}
        placeholder="ej: Lunes a Domingo"
        value={cfg.days || ''}
        onChangeText={(t) => setCfg((prev) => ({ ...prev, days: t }))}
      />

      <TouchableOpacity style={styles.btn} onPress={save} disabled={saving}>
        <Text style={styles.btnText}>{saving ? 'Guardando…' : 'Guardar'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  container: { padding: 16, gap: 12 },
  label: { fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 },
  btn: { marginTop: 16, backgroundColor: '#111', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  btnText: { color: 'white', fontWeight: '600' },
});
