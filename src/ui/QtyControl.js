// kolder-app/src/ui/QtyControl.js
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { colors, radius, spacing } from './theme';

export default function QtyControl({ value = 1, onInc, onDec, min = 1, max = 999 }) {
  const dec = () => onDec && onDec(Math.max(min, value - 1));
  const inc = () => onInc && onInc(Math.min(max, value + 1));

  const Btn = ({ label, onPress }) => (
    <TouchableOpacity
      onPress={onPress}
      style={{
        backgroundColor: colors.primarySoftBg,
        borderColor: colors.primarySoftBorder,
        borderWidth: 1,
        borderRadius: radius.md,
        paddingVertical: 6,
        paddingHorizontal: 10,
      }}
    >
      <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 16 }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing(1) }}>
      <Btn label="−" onPress={dec} />
      <Text style={{ minWidth: 28, textAlign: 'center', fontWeight: '700', color: colors.text }}>{value}</Text>
      <Btn label="+" onPress={inc} />
    </View>
  );
}
