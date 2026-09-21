import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Colors } from '@/constants/theme';

const COLORS = [Colors.tint, Colors.success, Colors.warning, Colors.danger, Colors.textSecondary];
const COUNT = 28;

interface Particle {
  id: number;
  x: number;
  size: number;
  round: boolean;
  color: string;
  tilt: number;
  delay: number;
  duration: number;
  y: Animated.Value;
  rotate: Animated.Value;
  opacity: Animated.Value;
}

/**
 * Confeti ligero que dispara una ráfaga cada vez que `burst` cambia.
 * Solo ocupa overlay mientras hay partículas en vuelo.
 */
export function Confetti({ burst }: { burst: number }) {
  const { height, width } = useWindowDimensions();
  const [particles, setParticles] = useState<Particle[]>([]);
  const running = useRef(false);
  const idRef = useRef(0);

  useEffect(() => {
    if (burst === 0 || running.current) return;
    running.current = true;

    const next: Particle[] = [];
    for (let i = 0; i < COUNT; i++) {
      next.push({
        id: ++idRef.current,
        x: Math.random() * width,
        size: 5 + Math.random() * 5,
        round: Math.random() > 0.55,
        color: COLORS[i % COLORS.length],
        tilt: Math.random() * 360,
        delay: Math.random() * 220,
        duration: 950 + Math.random() * 650,
        y: new Animated.Value(-30),
        rotate: new Animated.Value(0),
        opacity: new Animated.Value(1),
      });
    }
    setParticles(next);

    const anims = next.flatMap((p) => [
      Animated.timing(p.y, {
        toValue: height + 60,
        duration: p.duration,
        delay: p.delay,
        useNativeDriver: true,
      }),
      Animated.timing(p.rotate, {
        toValue: 3 + Math.random() * 3,
        duration: p.duration,
        delay: p.delay,
        useNativeDriver: true,
      }),
      Animated.timing(p.opacity, {
        toValue: 0,
        duration: 420,
        delay: p.delay + p.duration - 420,
        useNativeDriver: true,
      }),
    ]);

    Animated.parallel(anims, { stopTogether: false }).start(() => {
      running.current = false;
      setParticles([]);
    });
  }, [burst, height, width]);

  if (particles.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p) => (
        <Animated.View
          key={p.id}
          style={{
            position: 'absolute',
            left: p.x,
            width: p.size,
            height: p.round ? p.size : p.size * 0.6,
            borderRadius: p.round ? p.size / 2 : 1,
            backgroundColor: p.color,
            transform: [
              { translateY: p.y },
              {
                rotate: p.rotate.interpolate({
                  inputRange: [0, 1],
                  outputRange: [`${p.tilt}deg`, `${p.tilt + 360}deg`],
                }),
              },
            ],
            opacity: p.opacity,
          }}
        />
      ))}
    </View>
  );
}