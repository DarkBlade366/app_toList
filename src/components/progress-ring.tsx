import { ReactNode, useEffect, useState } from 'react';
import { Animated, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Colors } from '@/constants/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * Anillo radial de progreso (0..1). Útil para el orbe del día en la pestaña Hoy.
 * Se anima vía estilo JS (strokeDashoffset) y muestra su contenido centrado.
 */
export function ProgressRing({
  progress,
  size = 112,
  strokeWidth = 10,
  color = Colors.tint,
  trackColor = Colors.border,
  children,
  style,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  children?: ReactNode;
  style?: ViewStyle;
}) {
  const clamped = Math.max(0, Math.min(1, progress));
  const r = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * r;

  const [animated] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(animated, {
      toValue: clamped,
      duration: 650,
      useNativeDriver: false,
    }).start();
  }, [animated, clamped]);

  const dashOffset = animated.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={[styles.center, StyleSheet.absoluteFill]} pointerEvents="none">
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});