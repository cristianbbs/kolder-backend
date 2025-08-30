// C:\Users\Crist\kolder-app\src\components\StatusTimeline.js
import React from 'react';
import { View, Text } from 'react-native';

// Orden y etiquetas que debe ver SUPER (mismo que USER)
const STAGES = ['SUBMITTED', 'PREPARING', 'EN_ROUTE', 'DELIVERED', 'CANCELLED'];
const LABEL_ES = {
  SUBMITTED: 'Recibido',
  PREPARING: 'Preparando',
  EN_ROUTE: 'En ruta',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
};

// Normalización de estados “externos” al flujo de 5 etapas
function normalizeStatus(s) {
  switch (String(s || '').toUpperCase()) {
    case 'SUBMITTED':
      return 'SUBMITTED';
    case 'CONFIRMED':    // lo mapeamos a "Preparando" para no introducir 6ª etapa
    case 'PACKING':
    case 'PREPARING':
      return 'PREPARING';
    case 'EN_ROUTE':
    case 'EN-ROUTE':     // por si acaso viene con guion
      return 'EN_ROUTE';
    case 'DELIVERED':
      return 'DELIVERED';
    case 'CANCELLED':
      return 'CANCELLED';
    default:
      return 'SUBMITTED';
  }
}

// colores base
const C = {
  primary: '#1e40af',  // azul (actual / pasados)
  text: '#111827',
  muted: '#6b7280',    // gris texto
  dotMuted: '#9ca3af', // gris punto para futuros
  green: '#065f46',    // entregado
  red: '#991b1b',      // cancelado
};

function fmt(ts) {
  if (!ts) return '—';
  try { return new Date(ts).toLocaleString('es-CL'); } catch { return String(ts); }
}

function getCreatedAt(order) {
  return order?.createdAt || order?.created_at || null;
}
function getUpdatedAt(order) {
  return order?.updatedAt || order?.updated_at || getCreatedAt(order) || null;
}

function mapLogs(order) {
  // Devuelve un Map { stage(normalizada) -> firstTimestamp } si existen logs reales
  const logs = Array.isArray(order?.statusLogs) ? order.statusLogs : [];
  if (!logs.length) return null;
  const m = new Map();
  logs
    .slice()
    .sort((a, b) => new Date(a.at) - new Date(b.at))
    .forEach((l) => {
      const st = normalizeStatus(l.status);
      if (!m.has(st)) m.set(st, l.at);
    });
  return m;
}

function buildSynthetic(order) {
  // Fallback: ponemos fechas confiables en "Recibido" (createdAt) y estado actual (updatedAt)
  const current = normalizeStatus(order?.status);
  const createdAt = getCreatedAt(order);
  const updatedAt = getUpdatedAt(order);
  const currentIdx = Math.max(0, STAGES.indexOf(current));

  const tsMap = new Map();
  if (createdAt) tsMap.set('SUBMITTED', createdAt);
  if (updatedAt && STAGES[currentIdx]) tsMap.set(STAGES[currentIdx], updatedAt);
  return { tsMap, currentIdx };
}

export default function StatusTimeline({ order, title = 'Línea de tiempo' }) {
  // 1) Intentamos usar logs reales
  const logsMap = mapLogs(order);
  const normalizedStatus = normalizeStatus(order?.status);
  let currentIdx = Math.max(0, STAGES.indexOf(normalizedStatus));
  let tsMap = logsMap ?? new Map();

  // 2) Si no hay logs reales, construimos fallback
  if (!logsMap) {
    const { tsMap: synMap, currentIdx: synIdx } = buildSynthetic(order);
    tsMap = synMap;
    currentIdx = synIdx;
  }

  return (
    <View style={{ marginTop: 16 }}>
      <Text style={{ fontWeight: '700', fontSize: 16, marginBottom: 8 }}>{title}</Text>

      {STAGES.map((st, i) => {
        const at = tsMap.get(st) || null;
        const isFuture = i > currentIdx;
        const isCurrent = i === currentIdx;

        // estilo del punto
        const dotColor = isFuture ? C.dotMuted : C.primary;

        // estilo del texto
        let labelColor = C.text;
        if (st === 'DELIVERED') labelColor = C.green;
        else if (st === 'CANCELLED') labelColor = C.red;
        else if (isCurrent) labelColor = C.primary;
        else if (isFuture) labelColor = C.muted;

        return (
          <View key={st} style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <View
                style={{
                  width: 10, height: 10, borderRadius: 5,
                  backgroundColor: dotColor, marginTop: 5, marginRight: 8,
                }}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: isCurrent ? '700' : '600', color: labelColor }}>
                  {LABEL_ES[st]}
                </Text>
                {/* Solo fecha; no mostramos "· sistema" */}
                <Text style={{ color: C.muted }}>{fmt(at)}</Text>
              </View>
            </View>

            {/* conector vertical (como en USER) */}
            {i < STAGES.length - 1 && (
              <View style={{ marginLeft: 4, height: 10, borderLeftWidth: 1, borderLeftColor: '#e5e7eb' }} />
            )}
          </View>
        );
      })}
    </View>
  );
}
