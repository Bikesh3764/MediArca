// Tab bar look shared by every portal (white, soft shadow, filled icon when selected).
import { Ionicons } from '@expo/vector-icons';
import type { IconName } from '@/components/kit';
import { colors, shadow } from '@/theme';

export const tabIcon = (on: IconName, off: IconName) =>
  function TabIcon({ color, focused }: { color: unknown; focused: boolean }) {
    return <Ionicons name={focused ? on : off} color={color as string} size={25} />;
  };

export const tabScreenOptions = {
  headerShown: false,
  tabBarActiveTintColor: colors.primary,
  tabBarInactiveTintColor: '#8e8e93',
  tabBarLabelStyle: { fontSize: 11, fontWeight: '600' as const },
  tabBarStyle: { backgroundColor: 'rgba(255,255,255,0.98)', borderTopWidth: 0, ...shadow.bar },
  tabBarBadgeStyle: { backgroundColor: colors.danger, fontSize: 11 },
  sceneStyle: { backgroundColor: colors.canvas },
};
