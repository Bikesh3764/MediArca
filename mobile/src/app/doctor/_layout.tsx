import { Tabs } from 'expo-router';
import { PortalGuard } from '@/components/PortalGuard';
import { tabIcon, tabListeners, tabScreenOptions } from '@/components/tabs';

export default function DoctorLayout() {
  return (
    <PortalGuard role="DOCTOR">
      <Tabs screenOptions={tabScreenOptions} screenListeners={tabListeners}>
        <Tabs.Screen name="index" options={{ title: 'Queue', tabBarIcon: tabIcon('people', 'people-outline') }} />
        <Tabs.Screen name="shifts" options={{ title: 'Shifts', tabBarIcon: tabIcon('calendar', 'calendar-outline') }} />
        <Tabs.Screen name="clinics" options={{ title: 'Clinics', tabBarIcon: tabIcon('business', 'business-outline') }} />
        <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: tabIcon('person-circle', 'person-circle-outline') }} />
      </Tabs>
    </PortalGuard>
  );
}
