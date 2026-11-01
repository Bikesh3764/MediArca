// Clinic data shared by its tabs: the clinic, its doctors, requests, front desk staff and bookings.
// Same server call as frontend/src/pages/Clinic/dashboard/state.tsx. Refreshes quietly every 30s.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { type ClinicDashboardData, api } from '@mediarca/shared/api';
import { useAuth } from '@/context/AuthContext';
import { usePolling, keepIfSame } from '@/lib/usePolling';

interface ClinicContextType {
  data: ClinicDashboardData | null;
  failed: boolean;
  reload: () => Promise<void>;
}

const ClinicContext = createContext<ClinicContextType | undefined>(undefined);

export function ClinicProvider({ children }: { children: React.ReactNode }) {
  const { logout } = useAuth();
  const [data, setData] = useState<ClinicDashboardData | null>(null);
  const [failed, setFailed] = useState(false);

  const reload = useCallback(async () => {
    try {
      setData(keepIfSame(await api.getMyClinic()));
      setFailed(false);
    } catch (err: any) {
      if (err?.status === 401) logout();
      setFailed(true);
    }
  }, [logout]);

  useEffect(() => {
    queueMicrotask(() => {
      reload();
    });
  }, [reload]);
  usePolling(reload, 30000, true);

  const value = useMemo(() => ({ data, failed, reload }), [data, failed, reload]);
  return <ClinicContext.Provider value={value}>{children}</ClinicContext.Provider>;
}

export const useClinic = () => {
  const ctx = useContext(ClinicContext);
  if (!ctx) throw new Error('useClinic must be used inside ClinicProvider');
  return ctx;
};
