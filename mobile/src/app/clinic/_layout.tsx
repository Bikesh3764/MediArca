import { Stack } from 'expo-router';
import { PortalGuard } from '@/components/PortalGuard';
import { colors } from '@/theme';

export default function ClinicLayout() {
  return (
    <PortalGuard role="CLINIC">
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }} />
    </PortalGuard>
  );
}
