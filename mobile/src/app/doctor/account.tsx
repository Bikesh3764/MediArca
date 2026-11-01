import { AccountScreen } from '@/components/AccountScreen';
import { useAuth } from '@/context/AuthContext';

export default function DoctorAccount() {
  const { user } = useAuth();
  return <AccountScreen extra={user?.doctorProfile?.specialty} />;
}
