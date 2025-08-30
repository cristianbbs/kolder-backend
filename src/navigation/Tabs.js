// src/navigation/Tabs.js
import React, { useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';

import CatalogStack from './CatalogStack';
import Orders from '../screens/Orders';
import Cart from '../screens/Cart';
import AdminStack from './AdminStack';
import AdminUsers from '../screens/admin/AdminUsers';
import AdminCatalog from '../screens/admin/AdminCatalog';
import SuperHome from '../screens/admin/SuperHome';
import MoreStack from './MoreStack';

import AppHeader from '../components/AppHeader';
import CartTabIcon from './CartTabIcon';
import { useAuth } from '../auth/context';
import { CartProvider } from '../store/cart';

const Tab = createBottomTabNavigator();
const PRIMARY = '#084999';

export default function AuthedTabs() {
  const { logout, profile } = useAuth();
  const role = (profile?.role || 'USER').toString().toUpperCase();
  const isAdmin = ['COMPANY_ADMIN', 'SUPER_ADMIN', 'ADMIN_GENERAL'].includes(role);
  const isSuper = role === 'SUPER_ADMIN';

  useEffect(() => {
    console.log('[Tabs]', { role, isAdmin, isSuper });
  }, [role, isAdmin, isSuper]);

  const commonScreenOpts = {
    header: () => <AppHeader profile={profile} onLogout={logout} />,
    tabBarHideOnKeyboard: true,
    tabBarActiveTintColor: PRIMARY,
  };

  // ---------- Layout para SUPER_ADMIN ----------
  if (isSuper) {
    return (
      <CartProvider>
        <Tab.Navigator screenOptions={commonScreenOpts} initialRouteName="SuperHomeTab">
          <Tab.Screen
            name="SuperHomeTab"
            component={SuperHome}
            options={{
              title: 'Inicio',
              tabBarIcon: ({ color, size }) => <Feather name="home" color={color} size={size} />,
            }}
          />

          {/* Pedidos (Admin) */}
          <Tab.Screen
            name="AdminOrdersTab"
            component={AdminStack}
            initialParams={{ initial: 'AdminOrders' }}
            options={{
              title: 'Pedidos',
              tabBarIcon: ({ color, size }) => <Feather name="clipboard" color={color} size={size} />,
            }}
          />

          {/* Empresas */}
          <Tab.Screen
            name="AdminCompaniesTab"
            component={AdminStack}
            initialParams={{ initial: 'AdminCompanies' }}
            options={{
              title: 'Empresas',
              tabBarIcon: ({ color, size }) => <Feather name="briefcase" color={color} size={size} />,
            }}
          />

          {/* Usuarios */}
          <Tab.Screen
            name="AdminUsersTab"
            component={AdminUsers}
            options={{
              title: 'Usuarios',
              tabBarIcon: ({ color, size }) => <Feather name="users" color={color} size={size} />,
            }}
          />

          {/* Catálogo Admin */}
          <Tab.Screen
            name="AdminCatalogTab"
            component={AdminCatalog}
            options={{
              title: 'Catálogo',
              tabBarIcon: ({ color, size }) => <Feather name="layers" color={color} size={size} />,
            }}
          />

          {/* Más (Soporte, Estadísticas, Datos personales) */}
          <Tab.Screen
            name="MoreTabSuper"
            component={MoreStack}
            options={{
              title: 'Más',
              tabBarIcon: ({ color, size }) => <Feather name="more-horizontal" color={color} size={size} />,
            }}
          />
        </Tab.Navigator>
      </CartProvider>
    );
  }

  // ---------- Layout para resto de roles (UX original) ----------
  return (
    <CartProvider>
      <Tab.Navigator screenOptions={commonScreenOpts} initialRouteName="CatalogTab">
        <Tab.Screen
          name="CatalogTab"
          component={CatalogStack}
          options={{
            title: 'Catálogo',
            tabBarIcon: ({ color, size }) => <Feather name="home" color={color} size={size} />,
          }}
        />
        <Tab.Screen
          name="OrdersTab"
          component={Orders}
          options={{
            title: 'Pedidos',
            tabBarIcon: ({ color, size }) => <Feather name="clipboard" color={color} size={size} />,
          }}
        />
        <Tab.Screen
          name="CartTab"
          component={Cart}
          options={{
            title: 'Carrito',
            tabBarIcon: (props) => <CartTabIcon {...props} />,
          }}
        />
        {isAdmin && (
          <Tab.Screen
            name="AdminTab"
            component={AdminStack}
            options={{
              title: 'Admin',
              tabBarIcon: ({ color, size }) => <Feather name="settings" color={color} size={size} />,
            }}
          />
        )}

        {/* Más */}
        <Tab.Screen
          name="MoreTab"
          component={MoreStack}
          options={{
            title: 'Más',
            tabBarIcon: ({ color, size }) => <Feather name="more-horizontal" color={color} size={size} />,
          }}
        />
      </Tab.Navigator>
    </CartProvider>
  );
}
