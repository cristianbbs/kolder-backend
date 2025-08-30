// C:\Users\Crist\kolder-app\src\components\Timeline.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function Timeline({ logs }) {
  if (!logs?.length) return <Text style={{ color: '#6b7280' }}>Sin eventos registrados.</Text>;
  return (
    <View>
      {logs.map((l, idx) => (
        <View key={idx} style={styles.row}>
          <View style={styles.dotCol}>
            <View style={styles.dot} />
            {idx < logs.length - 1 && <View style={styles.line} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{l.toStatus} <Text style={styles.meta}>({l.fromStatus} → {l.toStatus})</Text></Text>
            <Text style={styles.meta}>{new Date(l.createdAt).toLocaleString()} • {l.actorEmail || l.actor || 'sistema'}</Text>
            {l.reason ? <Text style={styles.reason}>{l.reason}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginBottom: 12 },
  dotCol: { width: 20, alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#084999', marginTop: 2 },
  line: { width: 2, flex: 1, backgroundColor: '#e5e7eb', marginTop: 2, marginBottom: -6 },
  title: { fontWeight: '700' },
  meta: { color: '#6b7280' },
  reason: { marginTop: 2 },
});
