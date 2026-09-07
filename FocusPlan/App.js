import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import RootNavigator from './src/navigation/RootNavigator';
import { useSettingsStore } from './src/stores/settingsStore';
import { useTheme } from './src/stores/themeStore';
import { ensureNotificationPermission } from './src/utils/notifications';
import GoldFlowBackground from './src/components/GoldFlowBackground';
import BootSplash from './src/components/BootSplash';

function AppInner() {
  const theme = useTheme();
  const loadSettings = useSettingsStore((s) => s.load);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    loadSettings();
    ensureNotificationPermission().catch(() => {});
  }, [loadSettings]);

  const onBootDone = useCallback(() => setBooting(false), []);

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {theme.id === 'aurum' || booting ? <GoldFlowBackground /> : null}
      <View style={styles.foreground}>
        <StatusBar style={theme.statusBar === 'light' ? 'light' : 'dark'} />
        {!booting ? (
          <>
            <RootNavigator />
            <Toast />
          </>
        ) : null}
      </View>
      {booting ? <BootSplash onFinish={onBootDone} minMs={2000} /> : null}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppInner />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  foreground: { flex: 1, backgroundColor: 'transparent' },
});
