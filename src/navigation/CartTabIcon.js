// src/navigation/CartTabIcon.js
import React from 'react';
import { View, Text } from 'react-native';
import { useCart } from '../store/cart';

export default function CartTabIcon({ focused }) {
  const { count } = useCart();

  return (
    <View style={{ width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }}>
      {/* Ícono simple */}
      <View
        style={{
          width: 18,
          height: 18,
          borderRadius: 3,
          borderWidth: 2,
          borderColor: focused ? '#084999' : '#6b7280',
        }}
      />
      {count > 0 && (
        <View
          style={{
            position: 'absolute',
            top: -6,
            right: -10,
            minWidth: 16,
            height: 16,
            borderRadius: 8,
            backgroundColor: '#ef4444',
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 4,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{count}</Text>
        </View>
      )}
    </View>
  );
}
