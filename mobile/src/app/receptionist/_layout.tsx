import { Tabs } from 'expo-router';
import { PortalGuard } from '@/components/PortalGuard';
import { tabIcon, tabListeners, tabScreenOptions } from '@/components/tabs';
import { DeskProvider, useDesk } from '@/context/DeskContext';

function DeskTabs() {
  const { pending } = useDesk();
  return (
    <Tabs screenOptions={tabScreenOptions} screenListeners={tabListeners}>
      <Tabs.Screen name="index" options={{ title: 'Queue', tabBarIcon: tabIcon('people', 'people-outline') }} />
      <Tabs.Screen name="doctors" options={{ title: 'Doctors', tabBarIcon: tabIcon('medkit', 'medkit-outline') }} />
      <Tabs.Screen name="walkin" options={{ title: 'Walk-in', tabBarIcon: tabIcon('person-add', 'person-add-outline') }} />
      <Tabs.Screen
        name="requests"
        options={{ title: 'Requests', tabBarIcon: tabIcon('wallet', 'wallet-outline'), tabBarBadge: pending.length ? pending.length : undefined }}
      />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: tabIcon('person-circle', 'person-circle-outline') }} />
    </Tabs>
  );
}

export default function ReceptionistLayout() {
  return (
    <PortalGuard role="RECEPTIONIST">
      <DeskProvider>
        <DeskTabs />
      </DeskProvider>
    </PortalGuard>
  );
}
