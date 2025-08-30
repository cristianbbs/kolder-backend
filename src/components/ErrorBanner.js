// C:\Users\Crist\kolder-app\src\components\ErrorBanner.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function ErrorBanner({ message, onRetry }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>{message}</Text>
      {onRetry && <TouchableOpacity onPress={onRetry}><Text style={styles.retry}>Reintentar</Text></TouchableOpacity>}
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { backgroundColor: '#fee2e2', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#fecaca', margin: 12, marginBottom: 0 },
  text: { color: '#7f1d1d' },
  retry: { color: '#084999', fontWeight: '700', marginTop: 6 },
});
