import { Redirect } from 'expo-router';
import { homeFor, useAuth } from '@/context/AuthContext';
import { Loading } from '@/components/ui';

export default function Index() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  return <Redirect href={user ? homeFor(user) : '/welcome'} />;
}
