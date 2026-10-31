import { Stack } from 'expo-router';
import { PortalGuard } from '@/components/PortalGuard';
import { colors } from '@/theme';

export default function DoctorLayout() {
  return (
    <PortalGuard role="DOCTOR">
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }} />
    </PortalGuard>
  );
}
