// src/navigation/MoreStack.js
import React, { Suspense } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import MoreHome from '../screens/more/MoreHome';
import Support from '../screens/more/Support';
import PersonalData from '../screens/more/PersonalData';

// ⚠️ Carga perezosa de Stats para que NO se importe al iniciar la app
const LazyStats = React.lazy(() => import('../screens/more/Stats'));

function StatsScreenWrapper(props) {
  // Suspense sólo alrededor de Stats
  return (
    <Suspense fallback={null /* o algún loader pequeño */}>
      <LazyStats {...props} />
    </Suspense>
  );
}

const Stack = createNativeStackNavigator();

export default function MoreStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="MoreHome">
      <Stack.Screen name="MoreHome" component={MoreHome} />
      <Stack.Screen name="Support" component={Support} />
      <Stack.Screen name="PersonalData" component={PersonalData} />
      {/* 👇 Stats entra sólo cuando navegas a esta screen */}
      <Stack.Screen name="Stats" component={StatsScreenWrapper} />
    </Stack.Navigator>
  );
}
