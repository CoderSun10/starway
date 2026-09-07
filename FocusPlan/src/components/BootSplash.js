import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import AppLogo from './AppLogo';
import { APP_NAME, APP_SLOGAN } from '../constants/brand';
import GoldFlowBackground from './GoldFlowBackground';

/**
 * 启动页：鎏金底 + Logo + 中文名 + 三点依次闪烁加载
 */
export default function BootSplash({ onFinish, minMs = 1800 }) {
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.88)).current;
  const d0 = useRef(new Animated.Value(0.25)).current;
  const d1 = useRef(new Animated.Value(0.25)).current;
  const d2 = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 7,
        tension: 60,
        useNativeDriver: true,
      }),
    ]).start();

    const pulse = (v, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, {
            toValue: 1,
            duration: 320,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0.22,
            duration: 320,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );

    const a0 = pulse(d0, 0);
    const a1 = pulse(d1, 180);
    const a2 = pulse(d2, 360);
    a0.start();
    a1.start();
    a2.start();

    const t = setTimeout(() => {
      Animated.timing(fade, {
        toValue: 0,
        duration: 420,
        useNativeDriver: true,
      }).start(() => onFinish?.());
    }, minMs);

    return () => {
      clearTimeout(t);
      a0.stop();
      a1.stop();
      a2.stop();
    };
  }, [d0, d1, d2, fade, minMs, onFinish, scale]);

  return (
    <Animated.View style={[styles.root, { opacity: fade }]}>
      <GoldFlowBackground />
      <Animated.View
        style={[styles.center, { transform: [{ scale }] }]}
      >
        <AppLogo size={132} />
        <Text style={styles.name}>{APP_NAME}</Text>
        <Text style={styles.slogan}>{APP_SLOGAN}</Text>
        <View style={styles.dots}>
          {[d0, d1, d2].map((v, i) => (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                {
                  opacity: v,
                  transform: [
                    {
                      scale: v.interpolate({
                        inputRange: [0.22, 1],
                        outputRange: [0.85, 1.15],
                      }),
                    },
                  ],
                },
              ]}
            />
          ))}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    backgroundColor: '#050403',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
  },
  name: {
    marginTop: 28,
    fontSize: 36,
    fontWeight: '300',
    color: '#F5E6C8',
    letterSpacing: 12,
    paddingLeft: 12,
  },
  slogan: {
    marginTop: 10,
    fontSize: 13,
    color: 'rgba(245,230,200,0.5)',
    letterSpacing: 4,
  },
  dots: {
    flexDirection: 'row',
    marginTop: 40,
    gap: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F0C14D',
  },
});
