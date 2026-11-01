import { AccountScreen } from '@/components/AccountScreen';
import { useDesk } from '@/context/DeskContext';

export default function DeskAccount() {
  const { desk } = useDesk();
  return <AccountScreen extra={desk?.clinic?.clinicName} />;
}
