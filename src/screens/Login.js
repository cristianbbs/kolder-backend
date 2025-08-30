// kolder-app/src/screens/Login.js
import React, { useState } from 'react';
import { View, TextInput, Text, Alert, Image, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../auth/context';
import { api } from '../api/client';
import Button from '../ui/Button';
import { colors, spacing, radius } from '../ui/theme';

const BG = '#0B4DA2';        // fondo solicitado
const WHITE = '#FFFFFF';

export default function Login() {
  const [email, setEmail] = useState('super@kolder.cl');   // útil para pruebas
  const [password, setPassword] = useState('TuPass123');   // útil para pruebas
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const validate = () => {
    const mail = (email || '').trim().toLowerCase();
    if (!mail || !mail.includes('@')) {
      Alert.alert('Error', 'Ingresa un email válido');
      return null;
    }
    if (!password || password.length < 6) {
      Alert.alert('Error', 'Ingresa tu contraseña (mínimo 6 caracteres)');
      return null;
    }
    return { mail };
  };

  const onLogin = async () => {
    if (loading) return;
    const v = validate();
    if (!v) return;

    setLoading(true);
    try {
      console.log('[LOGIN] baseURL:', api?.defaults?.baseURL);
      const res = await login(v.mail, password); // guarda token y profile
      console.log('[LOGIN OK]', {
        tokenLen: res?.token?.length,
        role: res?.profile?.role,
        email: res?.profile?.email,
      });
    } catch (e) {
      const status = e?.response?.status;
      const serverMsg = e?.response?.data?.error || e?.response?.data?.message;
      const msg =
        status === 401
          ? 'Credenciales inválidas'
          : serverMsg || e?.message || 'No fue posible iniciar sesión';
      console.warn('[LOGIN ERR]', { status, serverMsg, message: msg });
      Alert.alert('Error', String(msg));
    } finally {
      setLoading(false);
    }
  };

  const onForgot = () => {
    // Placeholder: sólo UI. Cuando implementemos el flujo, navegamos a esa pantalla.
    Alert.alert('Recuperar contraseña', 'Pronto habilitaremos la recuperación de contraseña desde la app.');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      <View
        style={{
          flex: 1,
          backgroundColor: BG,
          paddingHorizontal: spacing(2),
          // Empujamos el contenido hacia arriba (logo + bienvenida)
          justifyContent: 'flex-start',
          alignItems: 'center',
        }}
      >
        {/* Logo arriba */}
        <Image
          source={require('../../assets/logo-kolder.png')}
          style={{
            width: 190,
            height: 100,
            resizeMode: 'contain',
            marginTop: spacing(6),     // más arriba
            marginBottom: spacing(6)
          }}
        />

        {/* Bienvenida */}
        <Text
          style={{
            color: WHITE,
            fontSize: 18,
            fontWeight: '700',
            marginBottom: spacing(6),
            textAlign: 'center',
          }}
        >
          Bienvenidos a la app de pedidos
        </Text>

        {/* Contenedor del formulario */}
        <View style={{ width: '100%', maxWidth: 420 }}>

          {/* Email */}
          <Text style={{ color: WHITE, opacity: 0.9 }}>Email</Text>
          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="tu@correo.cl"
            placeholderTextColor="rgba(255,255,255,0.6)"
            style={{
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.35)',
              backgroundColor: WHITE,       // campo claro para buena legibilidad
              color: '#0A2540',
              padding: spacing(1.25),
              borderRadius: radius.md,
            }}
            value={email}
            onChangeText={setEmail}
            onSubmitEditing={onLogin}
            returnKeyType="go"
          />

          {/* Password */}
          <Text style={{ color: WHITE, opacity: 0.9, marginTop: spacing(1) }}>Contraseña</Text>
          <TextInput
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor="rgba(255,255,255,0.6)"
            style={{
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.35)',
              backgroundColor: WHITE,
              color: '#0A2540',
              padding: spacing(1.25),
              borderRadius: radius.md,
            }}
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={onLogin}
            returnKeyType="go"
          />

          {/* Botón Entrar */}
            <Button
              title={loading ? 'Ingresando…' : 'Entrar'}
              onPress={onLogin}
              disabled={loading}
              style={{
                marginTop: spacing(3),
                backgroundColor: '#79bde8',  // Fondo celeste
              }}
              textStyle={{ color: '#fff' }}   // Texto blanco (si tu Button soporta textStyle)
            />

          {/* Recuperar contraseña */}
          <TouchableOpacity onPress={onForgot} style={{ alignSelf: 'center', marginTop: spacing(3) }}>
            <Text style={{ color: WHITE, textDecorationLine: 'underline' }}>
              Recupera tu contraseña
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
