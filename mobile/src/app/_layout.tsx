import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { onSlowChange, setupPlatform } from '@/lib/platform';
import { BotCheckHost } from '@/lib/botCheck';
import { AuthProvider } from '@/context/AuthContext';
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

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setupPlatform().finally(() => setReady(true));
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {ready ? (
        <AuthProvider>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }} />
          <BotCheckHost />
          <SlowBanner />
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
