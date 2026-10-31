import { AccountCard } from '@/components/AccountCard';
import { ComingSoon } from '@/components/ComingSoon';
import { Screen, Title } from '@/components/ui';

export default function ReceptionistHome() {
  return (
    <Screen>
      <Title>Desk</Title>
      <ComingSoon title="Walk-ins and check-in" />
      <AccountCard />
    </Screen>
  );
}
