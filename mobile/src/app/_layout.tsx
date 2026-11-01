import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFonts } from 'expo-font';
import { appFonts, Text } from '@/components/AppText';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { onSlowChange, setupPlatform } from '@/lib/platform';
import { BotCheckHost } from '@/lib/botCheck';
import { AuthProvider, homeFor, useAuth } from '@/context/AuthContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { setupPush } from '@/lib/push';
import { Loading } from '@/components/ui';
import { colors } from '@/theme';

/** Small notice while the server wakes up, instead of a silent spinner. */
function SlowBanner() {
  const [slow, setSlow] = useState(false);
  const insets = useSafeAreaInsets();
  useEffect(() => onSlowChange((count) => setSlow(count > 0)), []);
  if (!slow) return null;
  return (
    <View pointerEvents="none" style={[styles.banner, { bottom: insets.bottom + 72 }]}>
      <Text style={styles.bannerText}>Server is waking up…</Text>
    </View>
  );
}

/** Tapping a phone alert opens the visit it is about (or the person's home). */
function PushTaps() {
  const { user } = useAuth();
  const role = user?.role;
  const mustChange = Boolean(user?.mustChangePassword);
  useEffect(() => {
    if (!role) return;
    return setupPush((data) => {
      if (role === 'PATIENT' && data.appointmentId) router.push({ pathname: '/visit/[id]', params: { id: data.appointmentId } });
      else if (role === 'PATIENT') router.push('/patient/visits');
      else router.replace(homeFor({ role, mustChangePassword: mustChange }));
    });
  }, [role, mustChange]);
  return null;
}

export default function RootLayout() {
  const [platformReady, setPlatformReady] = useState(false);
  // If the font fails to load the app still opens in the phone's own font
  const [fontsLoaded, fontError] = useFonts(appFonts);
  const ready = platformReady && (fontsLoaded || Boolean(fontError));

  useEffect(() => {
    setupPlatform().finally(() => setPlatformReady(true));
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {ready ? (
        <AuthProvider>
          <NotificationProvider>
            <Stack screenOptions={{ headerShown: false, animation: 'ios_from_right', contentStyle: { backgroundColor: colors.canvas } }} />
            <BotCheckHost />
            <PushTaps />
            <SlowBanner />
          </NotificationProvider>
        </AuthProvider>
      ) : (
        <Loading />
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  banner: { position: 'absolute', alignSelf: 'center', backgroundColor: colors.ink, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  bannerText: { color: colors.white, fontSize: 14 },
});
