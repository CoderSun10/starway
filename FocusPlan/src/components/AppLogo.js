import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, {
  Circle,
  Path,
  Defs,
  LinearGradient,
  Stop,
  G,
} from 'react-native-svg';

/**
 * 凝时专属 Logo：深空圆盘 + 鎏金时针弧，象征时间凝结
 */
export default function AppLogo({ size = 120 }) {
  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 120 120">
        <Defs>
          <LinearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#F5E6C8" />
            <Stop offset="35%" stopColor="#F0C14D" />
            <Stop offset="70%" stopColor="#D4A84B" />
            <Stop offset="100%" stopColor="#A67C2E" />
          </LinearGradient>
          <LinearGradient id="ring" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#A67C2E" stopOpacity="0.3" />
            <Stop offset="50%" stopColor="#F0C14D" stopOpacity="1" />
            <Stop offset="100%" stopColor="#A67C2E" stopOpacity="0.3" />
          </LinearGradient>
        </Defs>

        {/* 外环 */}
        <Circle
          cx="60"
          cy="60"
          r="54"
          fill="#0c0a08"
          stroke="url(#ring)"
          strokeWidth="2.5"
        />
        <Circle
          cx="60"
          cy="60"
          r="46"
          fill="none"
          stroke="url(#gold)"
          strokeWidth="1"
          opacity="0.45"
        />

        {/* 表盘刻度感弧线 */}
        <Path
          d="M60 22 A38 38 0 0 1 98 60"
          fill="none"
          stroke="url(#gold)"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.9"
        />
        <Path
          d="M60 22 A38 38 0 1 0 60 98"
          fill="none"
          stroke="url(#gold)"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.35"
        />

        {/* 指针：凝时 */}
        <G>
          <Path
            d="M60 60 L60 34"
            stroke="url(#gold)"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <Path
            d="M60 60 L78 68"
            stroke="#E8D4A8"
            strokeWidth="2.2"
            strokeLinecap="round"
            opacity="0.85"
          />
          <Circle cx="60" cy="60" r="4.5" fill="url(#gold)" />
          <Circle cx="60" cy="60" r="2" fill="#050403" />
        </G>

        {/* 底部一点余晖 */}
        <Circle cx="60" cy="92" r="2" fill="#F0C14D" opacity="0.7" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
