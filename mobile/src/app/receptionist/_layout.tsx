import { Stack } from 'expo-router';
import { PortalGuard } from '@/components/PortalGuard';
import { colors } from '@/theme';

export default function ReceptionistLayout() {
  return (
    <PortalGuard role="RECEPTIONIST">
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }} />
    </PortalGuard>
  );
}
