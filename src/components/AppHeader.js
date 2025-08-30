// src/components/AppHeader.js
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const COMPANY_FOR_KOLDER = 'KOLDER SPA';

// toma la primera palabra del nombre (o del alias de email)
function firstWord(s) {
  if (!s) return '';
  const w = String(s).trim().split(/\s+/)[0];
  return w || '';
}

/**
 * Props:
 *  - profile: { name, email, role, company?: { name } }
 *  - onLogout?: () => void
 */
export default function AppHeader({ profile, onLogout }) {
  const { line1, line2 } = useMemo(() => {
    const emailAlias = profile?.email ? profile.email.split('@')[0] : '';
    const nombre = firstWord(profile?.name) || firstWord(emailAlias);
    const l1 = <Text>{nombre ? `Hola, ${nombre}` : 'Hola'}</Text>;

    const role = (profile?.role || '').toString().toUpperCase();
    let l2 = '';

    // Regla solicitada: SUPER_ADMIN y ADMIN_GENERAL siempre muestran KOLDER SPA
    if (role === 'SUPER_ADMIN' || role === 'ADMIN_GENERAL') {
      l2 = COMPANY_FOR_KOLDER;
    } else if (profile?.company?.name) {
      // Otros roles: muestra empresa real si existe
      l2 = profile.company.name;
    } else {
      // Sin empresa: opcionalmente podrías mostrar el rol, pero lo dejamos vacío para no “ensuciar”
      l2 = '';
    }

    return { line1: l1, line2: l2 };
  }, [profile]);

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.wrap}>
        <View style={styles.texts}>
          <Text style={styles.h1}>{line1}</Text>
          {!!line2 && <Text style={styles.h2}>{line2}</Text>}
        </View>

        {onLogout && (
          <TouchableOpacity onPress={onLogout} style={styles.btn}>
            <Text style={styles.btnTxt}>Salir</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: '#0D4EA6', // fondo sólido hasta el notch
  },
  wrap: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  texts: { flexShrink: 1 },
  h1: { color: 'white', fontSize: 22, fontWeight: '700' },
  h2: { color: 'white', opacity: 0.9, marginTop: 4, fontSize: 16 },
  btn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  btnTxt: { color: 'white', fontSize: 16, fontWeight: '700' },
});
