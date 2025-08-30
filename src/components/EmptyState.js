// C:\Users\Crist\kolder-app\src\components\EmptyState.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function EmptyState({ title, subtitle }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 24 },
  title: { fontWeight: '700', color: '#374151' },
  sub: { color: '#6b7280', marginTop: 6, textAlign: 'center', paddingHorizontal: 12 },
});
