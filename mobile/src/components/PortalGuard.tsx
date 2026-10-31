// Keeps each area to its own account type; sends everyone else to the right place.
import type React from 'react';
import { Redirect } from 'expo-router';
import { homeFor, type Role, useAuth } from '@/context/AuthContext';
import { Loading } from '@/components/ui';

export function PortalGuard({ role, children }: { role: Role; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Redirect href={`/login?role=${role}`} />;
  if (user.role !== role || (user.role === 'RECEPTIONIST' && user.mustChangePassword)) {
    return <Redirect href={homeFor(user)} />;
  }
  return <>{children}</>;
}
