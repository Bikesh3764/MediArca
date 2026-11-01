import { Tabs } from 'expo-router';
import { PortalGuard } from '@/components/PortalGuard';
import { tabIcon, tabScreenOptions } from '@/components/tabs';

export default function PatientLayout() {
  return (
    <PortalGuard role="PATIENT">
      <Tabs screenOptions={tabScreenOptions}>
        <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: tabIcon('home', 'home-outline') }} />
        <Tabs.Screen name="visits" options={{ title: 'Visits', tabBarIcon: tabIcon('ticket', 'ticket-outline') }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: tabIcon('person-circle', 'person-circle-outline') }} />
      </Tabs>
    </PortalGuard>
  );
}
