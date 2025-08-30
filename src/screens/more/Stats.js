import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, FlatList, RefreshControl
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { VictoryChart, VictoryLine, VictoryAxis, VictoryTheme, VictoryVoronoiContainer, VictoryLegend } from 'victory-native';
import { getAdminOrders } from '../../api/admin'; // Asegúrate de que esta función esté bien configurada

const PRIMARY = '#084999';
const STATUS = ['SUBMITTED', 'CONFIRMED', 'PREPARING', 'EN_ROUTE', 'DELIVERED', 'CANCELLED'];
const RANGES = ['30d', '90d', '180d', '365d', 'all']; // Rango temporal
const RANGE_LABEL = {
  '30d': 'Últimos 30 días', '90d': 'Últimos 90 días', '180d': 'Últimos 180 días',
  '365d': 'Últimos 365 días', all: 'Todo el tiempo'
};

function Pill({ active, label, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.pill, active && styles.pillActive]}>
      <Text style={[styles.pillTxt, active && styles.pillTxtActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function Stats() {
  const [range, setRange] = useState('30d'); // Default range
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState(null);
  const [byStatus, setByStatus] = useState({});

  // Cargar las órdenes
  const loadOrders = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const now = new Date();
      const from = new Date(now);
      if (range !== 'all') {
        const days = Number(range.replace('d', ''));
        from.setDate(now.getDate() - days + 1);
      } else {
        from.setFullYear(now.getFullYear() - 2); // Hard cap 2 años
      }

      const res = await getAdminOrders({
        adminScope: 1,
        range,
        from: from.toISOString(),
        to: now.toISOString(),
      });
      setOrders(res.orders);
    } catch (e) {
      setErr(e?.message || 'Error cargando estadísticas');
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [range]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  // KPIs
  const kpis = useMemo(() => {
    const nOrders = orders.length;
    const nItems = orders.reduce((acc, o) => acc + o.items.length, 0);
    return { nOrders, nItems };
  }, [orders]);

  // Series para gráficos
  const seriesGlobal = useMemo(() => {
    const map = new Map(); // key: bucket start time -> count
    for (const o of orders) {
      const bucket = new Date(o.createdAt).toISOString().split('T')[0]; // Agrupar por fecha
      map.set(bucket, (map.get(bucket) || 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([t, y]) => ({ x: new Date(t), y }));
  }, [orders]);

  const onRefresh = () => { setRefreshing(true); loadOrders(); };

  if (loading) {
    return (
      <View style={[styles.page, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 8 }}>Cargando estadísticas…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      {/* Filtros */}
      <View style={styles.section}>
        <Text style={styles.title}>Filtros</Text>
        <View style={styles.row}>
          {RANGES.map(r => {
            const active = range === r;
            return (
              <Pill key={r} label={RANGE_LABEL[r]} active={active} onPress={() => setRange(r)} />
            );
          })}
        </View>
      </View>

      {/* KPIs */}
      <View style={styles.section}>
        <Text style={styles.title}>Resumen</Text>
        <View style={styles.kpiRow}>
          <View style={styles.kpi}><Text style={styles.kpiLabel}>Pedidos</Text><Text style={styles.kpiValue}>{kpis.nOrders}</Text></View>
          <View style={styles.kpi}><Text style={styles.kpiLabel}>Ítems</Text><Text style={styles.kpiValue}>{kpis.nItems}</Text></View>
        </View>
      </View>

      {/* Tendencia global */}
      <View style={styles.section}>
        <Text style={styles.title}>Tendencia global</Text>
        {seriesGlobal.length === 0 ? (
          <Text style={{ color:'#64748b' }}>Sin datos para el período.</Text>
        ) : (
          <VictoryChart
            theme={VictoryTheme.material}
            height={220}
            containerComponent={<VictoryVoronoiContainer />}
            padding={{ top: 12, left: 48, right: 16, bottom: 32 }}
          >
            <VictoryAxis tickFormat={(t) => new Date(t).toLocaleDateString('es-CL', { month: 'short', day: 'numeric' })} />
            <VictoryAxis dependentAxis />
            <VictoryLine
              data={seriesGlobal}
              style={{ data: { stroke: PRIMARY, strokeWidth: 2 } }}
            />
          </VictoryChart>
        )}
      </View>

      {/* Comparativa por cliente */}
      <View style={styles.section}>
        <Text style={styles.title}>Comparativa por cliente (Top 3)</Text>
        {/* Similar código para comparar por cliente */}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f1f5f9' },
  section: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e5e7eb', padding: 12, marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '800', color: '#0b1f3a', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#fff' },
  pillActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  pillTxt: { color: '#334155', fontWeight: '600' },
  pillTxtActive: { color: '#fff', fontWeight: '700' },
  kpiRow: { flexDirection: 'row', gap: 10 },
  kpi: { flex: 1, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff', borderRadius: 12, padding: 12 },
  kpiLabel: { color: '#64748b', fontWeight: '600' },
  kpiValue: { fontSize: 20, fontWeight: '800', color: '#0b1f3a', marginTop: 2 },
});
