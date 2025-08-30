// kolder-app/src/ui/Button.js
import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { colors, radius, spacing, shadow } from './theme';

export default function Button({ title, onPress, disabled, variant = 'primary', style, textStyle }) {
  const bg =
    variant === 'danger' ? colors.danger :
    variant === 'muted'  ? colors.primarySoftBg :
    colors.primary;

  const fg = variant === 'muted' ? colors.text : colors.primaryOn;
  const opacity = disabled ? 0.6 : 1;
  const extra = variant === 'muted' ? { borderWidth: 1, borderColor: colors.primarySoftBorder } : shadow;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[{
        backgroundColor: bg,
        paddingVertical: spacing(1.25),
        paddingHorizontal: spacing(2),
        borderRadius: radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        opacity,
      }, extra, style]}
    >
      <Text style={[{ color: fg, fontWeight: '700' }, textStyle]}>{title}</Text>
    </TouchableOpacity>
  );
}
