import { AccountCard } from '@/components/AccountCard';
import { ComingSoon } from '@/components/ComingSoon';
import { Screen, Title } from '@/components/ui';

export default function DoctorHome() {
  return (
    <Screen>
      <Title>Queue</Title>
      <ComingSoon title="Today’s queue" />
      <AccountCard />
    </Screen>
  );
}
