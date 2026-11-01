// Tab bar look shared by every portal (white, soft shadow, filled icon when selected).
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import type { IconName } from '@/components/kit';
import { tap } from '@/lib/haptics';
import { colors, font, shadow } from '@/theme';

export const tabIcon = (on: IconName, off: IconName) =>
  function TabIcon({ color, focused }: { color: unknown; focused: boolean }) {
    return <Ionicons name={focused ? on : off} color={color as string} size={25} />;
  };

// Apple's font on iPhone, Inter SemiBold elsewhere (same rule as components/AppText.tsx)
const semibold = Platform.OS === 'ios' ? { fontWeight: '600' as const } : { fontFamily: font.semibold };

/** Light tap feel when switching tabs. */
export const tabListeners = { tabPress: () => tap() };

export const tabScreenOptions = {
  headerShown: false,
  animation: 'shift' as const,
  tabBarActiveTintColor: colors.primary,
  tabBarInactiveTintColor: colors.tabInactive,
  tabBarLabelStyle: { fontSize: 11, ...semibold },
  tabBarStyle: { backgroundColor: 'rgba(255,255,255,0.98)', borderTopWidth: 0, ...shadow.bar },
  tabBarBadgeStyle: { backgroundColor: colors.danger, fontSize: 11, ...semibold },
  sceneStyle: { backgroundColor: colors.canvas },
};
