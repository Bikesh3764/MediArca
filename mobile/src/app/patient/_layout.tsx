import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { PortalGuard } from '@/components/PortalGuard';
import type { IconName } from '@/components/kit';
import { colors, shadow } from '@/theme';

const icon = (on: IconName, off: IconName) =>
  function TabIcon({ color, focused }: { color: unknown; focused: boolean }) {
    return <Ionicons name={focused ? on : off} color={color as string} size={25} />;
  };

export default function PatientLayout() {
  return (
    <PortalGuard role="PATIENT">
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: '#8e8e93',
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
          tabBarStyle: { backgroundColor: 'rgba(255,255,255,0.98)', borderTopWidth: 0, ...shadow.bar },
          sceneStyle: { backgroundColor: colors.canvas },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home', 'home-outline') }} />
        <Tabs.Screen name="visits" options={{ title: 'Visits', tabBarIcon: icon('ticket', 'ticket-outline') }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('person-circle', 'person-circle-outline') }} />
      </Tabs>
    </PortalGuard>
  );
}
