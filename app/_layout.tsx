/**
 * Ember Root Layout
 * Master Plan Part 1 §2.2 & Part 6 §7.2
 */

import React, { useEffect } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Fraunces_300Light } from '@expo-google-fonts/fraunces';
import {
  Inter_200ExtraLight,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import { colors } from '../src/design/tokens';
import { DatabaseProvider, useDatabase } from '../src/providers/DatabaseProvider';
import { SessionProvider } from '../src/features/player/SessionProvider';
import { SheetHost } from '../src/providers/SheetHost';
import { useSessionStore } from '../src/stores/useSessionStore';
import {
  parseDeepLinkProtocol,
  setupNotificationChannel,
  syncNotificationSchedule,
} from '../src/services/NotificationService';
import * as Notifications from 'expo-notifications';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Splash screen already prevented
});

function AppLifecycle() {
  const { sessionRepo, prefsRepo, streakRepo, updatePreferences, preferences } = useDatabase();
  const setProtocol = useSessionStore((state) => state.setProtocol);

  useEffect(() => {
    // 1. Setup gentle notification channel on Android
    setupNotificationChannel().catch(() => {});

    // 2. Track app open timestamp & reset lapsed sent count
    const now = Date.now();
    updatePreferences({
      lastOpenAtMs: now,
      firstLaunchAtMs: preferences.firstLaunchAtMs ?? now,
      lapsedSentCount: 0,
    });

    // 3. Sync notification schedule on app launch
    syncNotificationSchedule({ sessionRepo, prefsRepo, streakRepo }, now).catch(() => {});

    // 4. Handle notification response taps (deep links)
    let notifSub: { remove: () => void } | null = null;
    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      try {
        notifSub = Notifications.addNotificationResponseReceivedListener((response) => {
          const deepLink = response.notification.request.content.data?.deepLink as
            string | undefined;
          const protocol = parseDeepLinkProtocol(deepLink);
          if (
            protocol === 'rapid_reset_5' ||
            protocol === 'afternoon_recharge_10' ||
            protocol === 'deep_rest_30'
          ) {
            setProtocol(protocol);
          }
        });
      } catch (err) {
        console.warn('Failed to attach notification response listener:', err);
      }
    }

    // 5. AppState listener for foregrounding
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        const activeNow = Date.now();
        updatePreferences({ lastOpenAtMs: activeNow });
        syncNotificationSchedule({ sessionRepo, prefsRepo, streakRepo }, activeNow).catch(() => {});
      }
    });

    return () => {
      notifSub?.remove();
      appStateSub.remove();
    };
  }, [
    sessionRepo,
    prefsRepo,
    streakRepo,
    updatePreferences,
    preferences.firstLaunchAtMs,
    setProtocol,
  ]);

  return null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_300Light,
    Inter_200ExtraLight,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return <View style={styles.container} />;
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <DatabaseProvider>
        <AppLifecycle />
        <SessionProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg },
              animation: 'fade',
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen
              name="player"
              options={{
                presentation: 'fullScreenModal',
                gestureEnabled: false,
                animation: 'fade',
              }}
            />
          </Stack>
          <SheetHost />
        </SessionProvider>
      </DatabaseProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
