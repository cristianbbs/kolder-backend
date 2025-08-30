// src/navigation/AdminStack.js
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Screens
import AdminHome from '../screens/admin/AdminHome';
import AdminOrders from '../screens/admin/AdminOrders';
import AdminOrderDetail from '../screens/admin/AdminOrderDetail';

import AdminUsers from '../screens/admin/AdminUsers';
import AdminUserForm from '../screens/admin/AdminUserForm';

import AdminEmergencyConfig from '../screens/admin/AdminEmergencyConfig';

import AdminCompanies from '../screens/admin/AdminCompanies';
import AdminCompanyDetail from '../screens/admin/AdminCompanyDetail';

// Catálogo
import AdminCatalog from '../screens/admin/AdminCatalog';

const Stack = createNativeStackNavigator();

export default function AdminStack({ route }) {
  // Permite que Tabs pase initialParams { initial: 'AdminCompanies' | 'ORDERS' | ... }
  const initialParam = String(route?.params?.initial || '').toUpperCase();

  const initialRouteName = (() => {
    switch (initialParam) {
      case 'ADMINORDERS':
      case 'ORDERS':
      case 'ORDER':
        return 'AdminOrders';
      case 'ADMINCOMPANIES':
      case 'COMPANIES':
      case 'COMPANY':
        return 'AdminCompanies';
      case 'ADMINUSERS':
      case 'USERS':
      case 'USER':
        return 'AdminUsers';
      case 'ADMINCATALOG':
      case 'CATALOG':
      case 'ALLOWED':
        return 'AdminCatalog';
      case 'ADMINEMERGENCYCONFIG':
      case 'CONFIG':
        return 'AdminEmergencyConfig';
      case 'ADMINHOME':
      case 'HOME':
      default:
        return 'AdminHome';
    }
  })();

  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: true,
      }}
    >
      {/* Home */}
      <Stack.Screen name="AdminHome" component={AdminHome} />

      {/* Pedidos */}
      <Stack.Screen name="AdminOrders" component={AdminOrders} />
      <Stack.Screen name="AdminOrderDetail" component={AdminOrderDetail} />

      {/* Empresas */}
      <Stack.Screen name="AdminCompanies" component={AdminCompanies} />
      <Stack.Screen name="AdminCompanyDetail" component={AdminCompanyDetail} />

      {/* Usuarios */}
      <Stack.Screen name="AdminUsers" component={AdminUsers} />
      <Stack.Screen name="AdminUserForm" component={AdminUserForm} />

      {/* Configuración */}
      <Stack.Screen name="AdminEmergencyConfig" component={AdminEmergencyConfig} />

      {/* Catálogo */}
      <Stack.Screen name="AdminCatalog" component={AdminCatalog} />

      {/* Alias temporal: abre Catálogo */}
      <Stack.Screen
        name="AdminAllowedProducts"
        component={AdminCatalog}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
