// kolder-app/src/ui/Card.js
import React from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { colors, radius, spacing, shadow } from './theme';

export default function Card({
  children,
  style,
  onPress,              // opcional: si viene, la Card es presionable
  padded = true,        // opcional: padding interno (default: true)
  elevated = false,     // opcional: sombra más marcada
  contentStyle,         // opcional: estilos extra para el contenedor interno
  testID,
  ...rest
}) {
  // Normaliza children primitivos
  const textColor = (colors && colors.text) ? colors.text : '#111827';
  const safeChildren = React.Children.map(children, (child, idx) => {
    if (typeof child === 'string' || typeof child === 'number') {
      return <Text key={idx} style={{ color: textColor }}>{child}</Text>;
    }
    return child;
  });

  // Sombras: base + opción elevada
  const elevatedShadow = elevated
    ? {
        shadowOpacity: 0.12,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
      }
    : {};

  const Outer = onPress ? Pressable : View;

  return (
    <Outer
      testID={testID}
      android_ripple={onPress ? { color: '#e5e7eb', borderless: false } : undefined}
      style={({ pressed }) => [
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          // la sombra va en el contenedor externo
          ...shadow,
          ...elevatedShadow,
          // feedback sutil al presionar
          ...(onPress && pressed ? { opacity: Platform.OS === 'ios' ? 0.8 : 1 } : null),
        },
        style,
      ]}
      onPress={onPress}
      {...rest}
    >
      {/* Contenedor interno: asegura esquinas redondeadas reales para imágenes */}
      <View
        style={[
          {
            overflow: 'hidden',          // 🔒 importante p/ imágenes con borde redondo
            borderRadius: radius.lg,
            padding: padded ? spacing(2) : 0,
          },
          contentStyle,
        ]}
      >
        {safeChildren}
      </View>
    </Outer>
  );
}
