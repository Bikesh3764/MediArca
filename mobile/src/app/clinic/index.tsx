import { AccountCard } from '@/components/AccountCard';
import { ComingSoon } from '@/components/ComingSoon';
import { Screen, Title } from '@/components/ui';

export default function ClinicHome() {
  return (
    <Screen>
      <Title>Clinic</Title>
      <ComingSoon title="Doctors and receptionists" />
      <AccountCard />
    </Screen>
  );
}
