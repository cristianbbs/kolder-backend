import 'react-native-gesture-handler'; // recomendado por React Navigation
import React from 'react';
import { View, ActivityIndicator, Text, StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './src/auth/context';
import Login from './src/screens/Login';
import AuthedTabs from './src/navigation/Tabs';
import OrderTracking from './src/screens/OrderTracking';

const Stack = createNativeStackNavigator();

function Root() {
  const { token, loading } = useAuth();

  // StatusBar dinámico por estado de sesión
  if (!token) {
    // Pantalla de login: fondo azul y texto claro
    StatusBar.setBarStyle('light-content');
    // En Android el backgroundColor sí aplica:
    StatusBar.setBackgroundColor('#0B4DA2');
  } else {
    // App autenticada: fondo claro y texto oscuro
    StatusBar.setBarStyle('dark-content');
    StatusBar.setBackgroundColor('#ffffff');
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: token ? '#fff' : '#0B4DA2' }}>
        <ActivityIndicator size="large" color={token ? '#084999' : '#ffffff'} />
        <Text style={{ marginTop: 8, color: token ? '#222' : '#ffffff' }}>Preparando sesión…</Text>
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {token ? (
        <>
          <Stack.Screen name="HomeTabs" component={AuthedTabs} />
          <Stack.Screen
            name="OrderTracking"
            component={OrderTracking}
            options={{
              // Header nativo visible en esta pantalla
              headerShown: true,
              title: 'Seguimiento',
              headerStyle: { backgroundColor: '#084999' },
              headerTintColor: '#fff',
            }}
          />
        </>
      ) : (
        <Stack.Screen name="Login" component={Login} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <Root />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
