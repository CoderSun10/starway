import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../stores/themeStore';
import { radius, spacing } from '../constants/themes';

export default function PrimaryButton({
  title,
  onPress,
  disabled,
  loading,
  variant = 'primary',
  style,
  textStyle,
}) {
  const theme = useTheme();
  const isOutline = variant === 'outline';
  const isAccent = variant === 'accent';
  const isDanger = variant === 'danger';
  const isGhost = variant === 'ghost';

  // 实心按钮字色统一走 theme.buttonText，与背景主题成对
  let bg = theme.primary;
  let borderColor = 'transparent';
  let textColor = theme.buttonText || '#FFFFFF';

  if (isAccent) {
    bg = theme.accent;
    textColor = theme.buttonText || '#FFFFFF';
  }
  if (isDanger) {
    bg = theme.danger;
    textColor = '#FFFFFF';
  }
  if (isOutline) {
    bg = 'transparent';
    borderColor = theme.primary;
    textColor = theme.primary;
  }
  if (isGhost) {
    bg = theme.primarySoft;
    textColor = theme.primary;
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        styles.base,
        { backgroundColor: bg, borderColor, borderWidth: isOutline ? 1.5 : 0 },
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.text, { color: textColor }, textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  disabled: { opacity: 0.5 },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
});
