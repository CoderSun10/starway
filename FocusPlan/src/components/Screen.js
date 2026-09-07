import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../stores/themeStore';
import { spacing } from '../constants/themes';

/**
 * 统一页面容器：顶部避开状态栏/刘海
 */
export default function Screen({
  children,
  scroll = false,
  style,
  contentStyle,
  edgesTop = true,
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const padTop = edgesTop ? Math.max(insets.top, 12) + 10 : 0;

  // 鎏金主题用透明底，露出全局流动金纹
  const bg =
    theme.id === 'aurum' ? 'transparent' : theme.background;

  const base = [
    styles.root,
    {
      backgroundColor: bg,
      paddingTop: padTop,
    },
    style,
  ];

  if (scroll) {
    return (
      <ScrollView
        style={base}
        contentContainerStyle={[{ paddingBottom: spacing.xl + insets.bottom }, contentStyle]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    );
  }

  return <View style={base}>{children}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
