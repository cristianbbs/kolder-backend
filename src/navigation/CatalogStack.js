// src/navigation/CatalogStack.js
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import Catalog from '../screens/Catalog';
import CategoryProducts from '../screens/CategoryProducts';

const Stack = createNativeStackNavigator();

export default function CatalogStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false, // 👈 desactiva header del stack
      }}
    >
      <Stack.Screen name="Catalog" component={Catalog} />
      <Stack.Screen name="CategoryProducts" component={CategoryProducts} />
    </Stack.Navigator>
  );
}
