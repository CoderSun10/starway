import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../stores/themeStore';
import { spacing } from '../constants/themes';

export default function EmptyState({ title = '暂无数据', subtitle, action }) {
  const theme = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={[styles.dot, { backgroundColor: theme.primarySoft, borderColor: theme.border }]}>
        <Text style={[styles.mark, { color: theme.primary }]}>○</Text>
      </View>
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
      ) : null}
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 1.5,
    paddingHorizontal: spacing.lg,
  },
  dot: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  mark: { fontSize: 22, fontWeight: '300' },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
});
