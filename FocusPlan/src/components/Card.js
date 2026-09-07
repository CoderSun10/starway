import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../stores/themeStore';
import { radius, spacing } from '../constants/themes';

export default function Card({ children, style }) {
  const theme = useTheme();
  const isDarkish =
    theme.id === 'aurum' || theme.id === 'mist' || theme.id === 'dark';

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.card,
          borderColor: theme.border,
          shadowColor: isDarkish ? theme.primary : '#0F172A',
          shadowOpacity: isDarkish ? 0.12 : 0.06,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
});
