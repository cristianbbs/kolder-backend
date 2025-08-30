// kolder-app/src/ui/Header.js
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';

/**
 * Header con look KOLDER.
 * - Muestra "Hola, {nombre}" si existe kolder_profile en SecureStore.
 * - Muestra empresa si está en ese perfil.
 * - Botón "Salir" si viene onLogout.
 */
export default function AppHeader({ onLogout }) {
  const [name, setName] = useState(null);
  const [companyName, setCompanyName] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync('kolder_profile');
        if (raw) {
          const p = JSON.parse(raw);
          if (p?.name) setName(p.name);
          if (p?.company?.name) setCompanyName(p.company.name);
        }
      } catch {}
    })();
  }, []);

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={{ backgroundColor: '#084999' }}
    >
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
            Hola{ name && `, ${name}` }
          </Text>
          <Text style={{ color: '#cfe3ff', fontSize: 12, marginTop: 2 }}>
            KOLDER SPA{ companyName ? ` • ${companyName}` : '' }
          </Text>
        </View>

        {onLogout ? (
          <TouchableOpacity
            onPress={onLogout}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 8,
              backgroundColor: 'rgba(255,255,255,0.18)',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Salir</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
