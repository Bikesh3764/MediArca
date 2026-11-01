// Front desk data shared by its tabs: the clinic, its doctors, and booking requests waiting for payment.
// Same server calls as frontend/src/pages/Receptionist/desk/state.tsx. Refreshes quietly every 15s.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { type Appointment, type ReceptionistDashboardData, api } from '@mediarca/shared/api';
import { useAuth } from '@/context/AuthContext';
import { usePolling, keepIfSame } from '@/lib/usePolling';

interface DeskContextType {
  desk: ReceptionistDashboardData | null;
  failed: boolean;
  pending: Appointment[];
  reload: () => Promise<void>;
  reloadPending: () => Promise<void>;
  setPending: React.Dispatch<React.SetStateAction<Appointment[]>>;
  /** Keep a doctor's cabin status in step after the desk changes it. */
  setDoctorCabin: (doctorId: string, status: string, returnTime: string | null) => void;
}

const DeskContext = createContext<DeskContextType | undefined>(undefined);

export function DeskProvider({ children }: { children: React.ReactNode }) {
  const { logout } = useAuth();
  const [desk, setDesk] = useState<ReceptionistDashboardData | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState<Appointment[]>([]);

  const reloadPending = useCallback(async () => {
    try {
      setPending(keepIfSame(await api.getPendingAppointments()));
    } catch {
      // Keep the list on screen
    }
  }, []);

  const reload = useCallback(async () => {
    try {
      setDesk(keepIfSame<ReceptionistDashboardData | null>(await api.getMyReceptionist()));
      setFailed(false);
    } catch (err: any) {
      if (err?.status === 401) logout();
      setFailed(true);
    }
    reloadPending();
  }, [logout, reloadPending]);

  useEffect(() => {
    queueMicrotask(() => {
      reload();
    });
  }, [reload]);
  usePolling(reloadPending, 15000, true);

  const setDoctorCabin = useCallback((doctorId: string, status: string, returnTime: string | null) => {
    setDesk((d) =>
      d ? { ...d, doctors: d.doctors.map((doc) => (doc.doctorId === doctorId ? { ...doc, cabinStatus: status, expectedReturnTime: returnTime } : doc)) } : d
    );
  }, []);

  const value = useMemo(
    () => ({ desk, failed, pending, reload, reloadPending, setPending, setDoctorCabin }),
    [desk, failed, pending, reload, reloadPending, setDoctorCabin]
  );
  return <DeskContext.Provider value={value}>{children}</DeskContext.Provider>;
}

export const useDesk = () => {
  const ctx = useContext(DeskContext);
  if (!ctx) throw new Error('useDesk must be used inside DeskProvider');
  return ctx;
};
