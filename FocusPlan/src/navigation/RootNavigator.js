import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../stores/themeStore';
import { useUiStore } from '../stores/uiStore';
import {
  TimerTabIcon,
  ScheduleTabIcon,
  StatsTabIcon,
  SettingsTabIcon,
} from '../components/TabIcons';

import ScheduleListScreen from '../screens/ScheduleListScreen';
import ScheduleFormScreen from '../screens/ScheduleFormScreen';
import ScheduleDetailScreen from '../screens/ScheduleDetailScreen';
import TimerScreen from '../screens/TimerScreen';
import StatsScreen from '../screens/StatsScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();
const ScheduleStack = createNativeStackNavigator();

function ScheduleStackScreen() {
  const theme = useTheme();
  return (
    <ScheduleStack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor:
            theme.id === 'aurum' || theme.id === 'mist' || theme.id === 'dark'
              ? theme.tabBar
              : theme.background,
        },
        headerShadowVisible: false,
        headerTintColor: theme.primary,
        headerTitleStyle: { fontWeight: '700', color: theme.text },
        contentStyle: {
          backgroundColor:
            theme.id === 'aurum' ? 'transparent' : theme.background,
        },
        // 与底部 Tab 页统一的顶部呼吸感
        headerStatusBarHeight: undefined,
      }}
    >
      <ScheduleStack.Screen
        name="ScheduleList"
        component={ScheduleListScreen}
        options={{ headerShown: false }}
      />
      <ScheduleStack.Screen
        name="ScheduleForm"
        component={ScheduleFormScreen}
        options={{ title: '计划表单' }}
      />
      <ScheduleStack.Screen
        name="ScheduleDetail"
        component={ScheduleDetailScreen}
        options={{ title: '计划详情' }}
      />
    </ScheduleStack.Navigator>
  );
}

function renderTabIcon(routeName, focused, theme) {
  const color = focused ? theme.tabActive : theme.tabInactive;
  const activeBg = theme.tabActiveBg;
  const props = { focused, color, activeBg };
  switch (routeName) {
    case 'TimerTab':
      return <TimerTabIcon {...props} />;
    case 'ScheduleTab':
      return <ScheduleTabIcon {...props} />;
    case 'StatsTab':
      return <StatsTabIcon {...props} />;
    case 'SettingsTab':
      return <SettingsTabIcon {...props} />;
    default:
      return null;
  }
}

export default function RootNavigator() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const hideTabBar = useUiStore((s) => s.hideTabBar);

  const navTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: theme.id === 'aurum' ? 'transparent' : theme.background,
      card: theme.card,
      text: theme.text,
      border: theme.border,
      primary: theme.primary,
    },
  };

  const tabBarVisibleStyle = hideTabBar
    ? {
        display: 'none',
        height: 0,
        opacity: 0,
        borderTopWidth: 0,
        position: 'absolute',
      }
    : {
        backgroundColor: theme.tabBar,
        borderTopColor: theme.border,
        height: 58 + Math.max(insets.bottom, 6),
        paddingBottom: Math.max(insets.bottom, 6),
        paddingTop: 6,
      };

  return (
    <NavigationContainer theme={navTheme}>
      <Tab.Navigator
        initialRouteName="TimerTab"
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: theme.tabActive,
          tabBarInactiveTintColor: theme.tabInactive,
          tabBarStyle: tabBarVisibleStyle,
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
          tabBarIcon: ({ focused }) => renderTabIcon(route.name, focused, theme),
          // 切换 Tab 时的轻微过渡（native-stack 自带，这里保证页面不跳切）
          animation: 'fade',
        })}
      >
        <Tab.Screen
          name="TimerTab"
          component={TimerScreen}
          options={{ title: '计时器' }}
        />
        <Tab.Screen
          name="ScheduleTab"
          component={ScheduleStackScreen}
          options={{ title: '计划' }}
        />
        <Tab.Screen
          name="StatsTab"
          component={StatsScreen}
          options={{ title: '统计' }}
        />
        <Tab.Screen
          name="SettingsTab"
          component={SettingsScreen}
          options={{ title: '设置' }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
