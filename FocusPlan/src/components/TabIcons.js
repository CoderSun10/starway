import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Path, Rect, Line } from 'react-native-svg';

/** 自绘底部 Tab 图标 + 选中背景 */

function IconWrap({ focused, activeBg, children }) {
  return (
    <View
      style={[
        styles.wrap,
        focused && { backgroundColor: activeBg },
      ]}
    >
      {children}
    </View>
  );
}

export function TimerTabIcon({ focused, color, activeBg }) {
  return (
    <IconWrap focused={focused} activeBg={activeBg}>
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Circle cx="12" cy="13.5" r="7.5" stroke={color} strokeWidth="1.8" />
        <Path
          d="M12 10.2v3.4l2.2 1.3"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M9.2 4.2h5.6"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <Path
          d="M12 4.2V6"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </Svg>
    </IconWrap>
  );
}

export function ScheduleTabIcon({ focused, color, activeBg }) {
  return (
    <IconWrap focused={focused} activeBg={activeBg}>
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Rect
          x="4"
          y="5"
          width="16"
          height="15"
          rx="2.5"
          stroke={color}
          strokeWidth="1.8"
        />
        <Path d="M8 3.5v3M16 3.5v3" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        <Line x1="4" y1="10" x2="20" y2="10" stroke={color} strokeWidth="1.6" />
        <Path
          d="M8.5 14h3M8.5 17h7"
          stroke={color}
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </Svg>
    </IconWrap>
  );
}

export function StatsTabIcon({ focused, color, activeBg }) {
  return (
    <IconWrap focused={focused} activeBg={activeBg}>
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Path
          d="M5 18V11.5M10.5 18V7M16 18v-5.5M21 18H3"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M5 11.5l5.5-4.5L16 12.5"
          stroke={color}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </IconWrap>
  );
}

export function SettingsTabIcon({ focused, color, activeBg }) {
  return (
    <IconWrap focused={focused} activeBg={activeBg}>
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Circle cx="12" cy="12" r="3.2" stroke={color} strokeWidth="1.8" />
        <Path
          d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6.1 6.1l1.55 1.55M16.35 16.35l1.55 1.55M17.9 6.1l-1.55 1.55M7.65 16.35l-1.55 1.55"
          stroke={color}
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </Svg>
    </IconWrap>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 42,
    height: 30,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
