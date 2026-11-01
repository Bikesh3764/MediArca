import { Tabs } from 'expo-router';
import { PortalGuard } from '@/components/PortalGuard';
import { tabIcon, tabScreenOptions } from '@/components/tabs';
import { ClinicProvider, useClinic } from '@/context/ClinicContext';

function ClinicTabs() {
  const { data } = useClinic();
  const requests = data?.incomingRequests?.length || 0;
  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: tabIcon('business', 'business-outline') }} />
      <Tabs.Screen
        name="doctors"
        options={{ title: 'Doctors', tabBarIcon: tabIcon('medkit', 'medkit-outline'), tabBarBadge: requests ? requests : undefined }}
      />
      <Tabs.Screen name="staff" options={{ title: 'Staff', tabBarIcon: tabIcon('people', 'people-outline') }} />
      <Tabs.Screen name="qr" options={{ title: 'QR Code', tabBarIcon: tabIcon('qr-code', 'qr-code-outline') }} />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: tabIcon('person-circle', 'person-circle-outline') }} />
    </Tabs>
  );
}

export default function ClinicLayout() {
  return (
    <PortalGuard role="CLINIC">
      <ClinicProvider>
        <ClinicTabs />
      </ClinicProvider>
    </PortalGuard>
  );
}
