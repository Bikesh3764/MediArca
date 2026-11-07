import { Tabs } from 'expo-router';
import { PortalGuard } from '@/components/PortalGuard';
import { tabIcon, tabListeners, tabScreenOptions } from '@/components/tabs';

export default function PatientLayout() {
  return (
    <PortalGuard role="PATIENT">
      <Tabs screenOptions={tabScreenOptions} screenListeners={tabListeners}>
        <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: tabIcon('home', 'home-outline') }} />
        <Tabs.Screen name="visits" options={{ title: 'Visits', tabBarIcon: tabIcon('ticket', 'ticket-outline') }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: tabIcon('person', 'person-outline') }} />
      </Tabs>
    </PortalGuard>
  );
}
