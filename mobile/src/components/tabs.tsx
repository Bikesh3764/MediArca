// Tab bar look shared by every portal: white bar, soft shadow, and the chosen tab's icon
// filled inside a light blue pill.
import { Ionicons } from '@expo/vector-icons';
import { Platform, StyleSheet, View } from 'react-native';
import type { IconName } from '@/components/kit';
import { colors, font, shadow } from '@/theme';

export const tabIcon = (on: IconName, off: IconName) =>
  function TabIcon({ color, focused }: { color: unknown; focused: boolean }) {
    return (
      <View style={[pill.base, focused && pill.on]}>
        <Ionicons name={focused ? on : off} color={color as string} size={22} />
      </View>
    );
  };

// Apple's font on iPhone, Inter SemiBold elsewhere (same rule as components/AppText.tsx)
const semibold = Platform.OS === 'ios' ? { fontWeight: '600' as const } : { fontFamily: font.semibold };

/** Kept for the tab layouts; nothing extra on tab press (no vibration, no animation). */
export const tabListeners = {};

export const tabScreenOptions = {
  headerShown: false,
  // Instant switch between tabs (the slide made the app feel slow)
  animation: 'none' as const,
  tabBarActiveTintColor: colors.primary,
  tabBarInactiveTintColor: colors.tabInactive,
  tabBarLabelStyle: { fontSize: 11, ...semibold },
  tabBarIconStyle: { width: 52, height: 28 },
  tabBarStyle: { backgroundColor: 'rgba(255,255,255,0.98)', borderTopWidth: 0, ...shadow.bar },
  tabBarBadgeStyle: { backgroundColor: colors.danger, fontSize: 11, ...semibold },
  sceneStyle: { backgroundColor: colors.canvas },
};

const pill = StyleSheet.create({
  base: { width: 52, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  on: { backgroundColor: colors.primarySoft },
});
