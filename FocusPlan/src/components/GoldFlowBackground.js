import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions, Easing } from 'react-native';

const { width: W, height: H } = Dimensions.get('window');

/**
 * 对齐 grok-style-page.html 的鎏金流动：
 * 金色河带漂移 + 光球 + 金属光泽扫过
 * 仅在鎏金主题下渲染
 */
export default function GoldFlowBackground() {
  const river1 = useRef(new Animated.Value(0)).current;
  const river2 = useRef(new Animated.Value(0)).current;
  const orb1 = useRef(new Animated.Value(0)).current;
  const orb2 = useRef(new Animated.Value(0)).current;
  const sheen = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = (val, duration, reverse = false) =>
      Animated.loop(
        reverse
          ? Animated.sequence([
              Animated.timing(val, {
                toValue: 1,
                duration,
                easing: Easing.inOut(Easing.sin),
                useNativeDriver: true,
              }),
              Animated.timing(val, {
                toValue: 0,
                duration,
                easing: Easing.inOut(Easing.sin),
                useNativeDriver: true,
              }),
            ])
          : Animated.sequence([
              Animated.timing(val, {
                toValue: 1,
                duration,
                easing: Easing.inOut(Easing.sin),
                useNativeDriver: true,
              }),
              Animated.timing(val, {
                toValue: 0,
                duration,
                easing: Easing.inOut(Easing.sin),
                useNativeDriver: true,
              }),
            ])
      );

    const a1 = loop(river1, 7000);
    const a2 = loop(river2, 9000);
    const a3 = loop(orb1, 8000);
    const a4 = loop(orb2, 10000);
    const a5 = loop(sheen, 4000);
    a1.start();
    a2.start();
    a3.start();
    a4.start();
    a5.start();
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
      a4.stop();
      a5.stop();
    };
  }, [river1, river2, orb1, orb2, sheen]);

  const r1x = river1.interpolate({ inputRange: [0, 1], outputRange: [-W * 0.06, W * 0.08] });
  const r1y = river1.interpolate({ inputRange: [0, 1], outputRange: [0, 18] });
  const r1s = river1.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  const r2x = river2.interpolate({ inputRange: [0, 1], outputRange: [W * 0.05, -W * 0.06] });
  const r2y = river2.interpolate({ inputRange: [0, 1], outputRange: [0, -16] });

  const o1x = orb1.interpolate({ inputRange: [0, 1], outputRange: [0, 40] });
  const o1y = orb1.interpolate({ inputRange: [0, 1], outputRange: [0, 32] });
  const o1s = orb1.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });

  const o2x = orb2.interpolate({ inputRange: [0, 1], outputRange: [0, -36] });
  const o2y = orb2.interpolate({ inputRange: [0, 1], outputRange: [0, 28] });

  const sheenX = sheen.interpolate({
    inputRange: [0, 1],
    outputRange: [-W * 0.6, W * 0.8],
  });
  const sheenOp = sheen.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.15, 0.55, 0.15],
  });

  return (
    <View style={styles.root} pointerEvents="none">
      {/* 深空底 */}
      <View style={styles.void} />

      {/* 金色河带 1 */}
      <Animated.View
        style={[
          styles.river,
          styles.river1,
          {
            transform: [
              { translateX: r1x },
              { translateY: r1y },
              { rotate: '-8deg' },
              { scaleY: r1s },
            ],
          },
        ]}
      >
        <View style={[styles.riverCore, { backgroundColor: 'rgba(166,124,46,0.12)' }]} />
        <View style={[styles.riverCore, styles.riverMid, { backgroundColor: 'rgba(212,168,75,0.28)' }]} />
        <View style={[styles.riverCore, styles.riverBright, { backgroundColor: 'rgba(240,193,77,0.38)' }]} />
      </Animated.View>

      {/* 金色河带 2 */}
      <Animated.View
        style={[
          styles.river,
          styles.river2,
          {
            transform: [
              { translateX: r2x },
              { translateY: r2y },
              { rotate: '7deg' },
            ],
          },
        ]}
      >
        <View style={[styles.riverCore, { backgroundColor: 'rgba(166,124,46,0.1)' }]} />
        <View style={[styles.riverCore, styles.riverMid, { backgroundColor: 'rgba(212,168,75,0.22)' }]} />
        <View style={[styles.riverCore, styles.riverBright, { backgroundColor: 'rgba(240,193,77,0.28)' }]} />
      </Animated.View>

      {/* 光球 */}
      <Animated.View
        style={[
          styles.orb,
          styles.orb1,
          { transform: [{ translateX: o1x }, { translateY: o1y }, { scale: o1s }] },
        ]}
      />
      <Animated.View
        style={[
          styles.orb,
          styles.orb2,
          { transform: [{ translateX: o2x }, { translateY: o2y }] },
        ]}
      />
      <View style={[styles.orb, styles.orb3]} />

      {/* 金属光泽条纹扫过 */}
      <Animated.View
        style={[
          styles.sheen,
          {
            opacity: sheenOp,
            transform: [{ translateX: sheenX }, { rotate: '18deg' }],
          },
        ]}
      />

      {/* 细金纹斜线组：更接近 HTML 里流动条纹的感觉 */}
      <Animated.View
        style={[
          styles.stripeBand,
          {
            transform: [
              { translateX: r1x },
              { rotate: '-12deg' },
            ],
          },
        ]}
      >
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View
            key={i}
            style={[
              styles.stripe,
              {
                opacity: 0.04 + i * 0.02,
                marginTop: i === 0 ? 0 : 14,
              },
            ]}
          />
        ))}
      </Animated.View>

      {/* 暗角 */}
      <View style={styles.vignetteTop} />
      <View style={styles.vignetteBottom} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#050403',
    overflow: 'hidden',
  },
  void: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#050403',
  },
  river: {
    position: 'absolute',
    width: W * 1.6,
    height: H * 0.42,
    left: -W * 0.3,
    opacity: 0.9,
  },
  river1: {
    top: H * 0.12,
  },
  river2: {
    bottom: H * 0.06,
    height: H * 0.32,
    opacity: 0.7,
  },
  riverCore: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: H,
  },
  riverMid: {
    left: '12%',
    right: '12%',
    top: '18%',
    bottom: '18%',
  },
  riverBright: {
    left: '28%',
    right: '28%',
    top: '32%',
    bottom: '32%',
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orb1: {
    width: W * 0.9,
    height: W * 0.9,
    top: -W * 0.2,
    right: -W * 0.25,
    backgroundColor: 'rgba(240,193,77,0.16)',
  },
  orb2: {
    width: W * 0.7,
    height: W * 0.7,
    bottom: H * 0.05,
    left: -W * 0.2,
    backgroundColor: 'rgba(212,168,75,0.14)',
  },
  orb3: {
    width: W * 0.4,
    height: W * 0.4,
    top: H * 0.42,
    left: W * 0.32,
    backgroundColor: 'rgba(245,230,200,0.08)',
  },
  sheen: {
    position: 'absolute',
    width: 56,
    height: H * 1.5,
    top: -H * 0.25,
    backgroundColor: 'rgba(255,248,230,0.08)',
  },
  stripeBand: {
    position: 'absolute',
    width: W * 1.8,
    left: -W * 0.4,
    top: H * 0.28,
  },
  stripe: {
    height: 2,
    width: '100%',
    backgroundColor: '#F0C14D',
  },
  vignetteTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: H * 0.22,
    backgroundColor: 'rgba(5,4,3,0.55)',
  },
  vignetteBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: H * 0.28,
    backgroundColor: 'rgba(5,4,3,0.65)',
  },
});
