import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../stores/themeStore';
import { radius } from '../constants/themes';

export default function ProgressBar({ current = 0, total = 1, label }) {
  const theme = useTheme();
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  return (
    <View style={styles.wrap}>
      {label ? (
        <View style={styles.row}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
          <Text style={[styles.pct, { color: theme.primary }]}>{pct}%</Text>
        </View>
      ) : null}
      <View style={[styles.track, { backgroundColor: theme.progressTrack }]}>
        <View
          style={[
            styles.fill,
            { width: `${pct}%`, backgroundColor: theme.progressFill },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: { fontSize: 12 },
  pct: { fontSize: 12, fontWeight: '600' },
  track: {
    height: 8,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.full,
  },
});
