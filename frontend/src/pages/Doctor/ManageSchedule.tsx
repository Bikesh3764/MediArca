import { formatClinicAddress } from '../../utils/address';
import { formatDisplayPhone } from '../../utils/phoneUtils';
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  api,
  DoctorSlot,
  parseDoctorSlots,
  DoctorAffiliationClinic,
  timeToMinutes,
  cleanSlotName,
  ALL_WEEKDAYS,
  WEEKDAY_SHORT_NAMES,
  DoctorLeave,
} from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout, DashboardNavItem } from '../../components/layout/DashboardLayout';
import { UtilityCard } from '../../components/ui/UtilityCard';
import { DoctorScheduleLeaveModal } from '../../components/common/DoctorScheduleLeaveModal';
import { useToast } from '../../context/ToastContext';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronDown,
  AlertCircle,
  AlertTriangle,
  Plus,
  Trash2,
  LayoutDashboard,
  Building2,
  MapPin,
  Phone,
  Settings,
  Calendar,
  CalendarDays,
  CalendarX,
  CalendarCheck,
} from 'lucide-react';

const minutesToTime = (mins: number): string => {
  const norm = ((mins % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(norm / 60).toString().padStart(2, '0');
  const m = (norm % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
};

export const ManageSchedule: React.FC = () => {
  const { user, loading: loadingAuth, refreshUser } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [clinics, setClinics] = useState<DoctorAffiliationClinic[]>([]);
  const [selectedClinicId, setSelectedClinicId] = useState<string>('');
  const [loadingClinics, setLoadingClinics] = useState(true);

  const [slots, setSlots] = useState<DoctorSlot[]>([
    {
      id: 'slot_1',
      name: 'Shift 1',
      startTime: '09:00',
      endTime: '13:00',
      maxPatients: 25,
      avgConsultationMinutes: 20,
    },
  ]);

  const [workingDays, setWorkingDays] = useState<string[]>(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']);
  const [isOnLeaveToday, setIsOnLeaveToday] = useState<boolean>(false);
  const [todayLeave, setTodayLeave] = useState<DoctorLeave | null>(null);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState<boolean>(false);

  const [consultationFee, setConsultationFee] = useState<number>(500);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const navItems: DashboardNavItem[] = [
    {
      id: 'dashboard',
      label: 'Queue',
      icon: LayoutDashboard,
      path: '/doctor/dashboard',
    },
    {
      id: 'affiliations',
      label: 'Clinics',
      icon: Building2,
      path: '/doctor/dashboard?tab=affiliations',
    },
    {
      id: 'schedule',
      label: 'Shifts',
      icon: Calendar,
      path: '/doctor/schedule',
      active: true,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      path: '/doctor/profile',
    },
  ];

  const syncClinicData = useCallback(
    (clinic: DoctorAffiliationClinic) => {
      if (clinic.slots && clinic.slots.length > 0) {
        setSlots(
          clinic.slots.map((s, idx) => ({
            ...s,
            name: cleanSlotName(s.name, `Shift ${idx + 1}`),
            avgConsultationMinutes: Number(s.avgConsultationMinutes) || 15,
            maxPatients: Number(s.maxPatients) || 25,
          }))
        );
      } else if (user?.doctorProfile) {
        setSlots(
          parseDoctorSlots(user.doctorProfile).map((s, idx) => ({
            ...s,
            name: cleanSlotName(s.name, `Shift ${idx + 1}`),
          }))
        );
      }
      setConsultationFee(clinic.consultationFee ?? user?.doctorProfile?.consultationFee ?? 500);
      if (clinic.workingDays && clinic.workingDays.length > 0) {
        setWorkingDays(clinic.workingDays);
      } else if (user?.doctorProfile?.workingDays) {
        try {
          const parsed = JSON.parse(user.doctorProfile.workingDays);
          setWorkingDays(Array.isArray(parsed) && parsed.length > 0 ? parsed : ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']);
        } catch {
          setWorkingDays(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']);
        }
      } else {
        setWorkingDays(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']);
      }
      setIsOnLeaveToday(Boolean(clinic.isOnLeaveToday));
      setTodayLeave(clinic.todayLeave || null);
      setError(null);
      setSuccessMsg(null);
    },
    [user]
  );

  // Fetch affiliations and active clinics
  const fetchAffiliations = useCallback(async () => {
    setLoadingClinics(true);
    try {
      const aff = await api.getDoctorAffiliations();
      const activeClinics = aff.clinics || [];
      setClinics(activeClinics);

      const targetClinicId = searchParams.get('clinic');
      let currentClinic: DoctorAffiliationClinic | undefined;
      if (targetClinicId && activeClinics.some((c) => c.clinicId === targetClinicId)) {
        setSelectedClinicId(targetClinicId);
        currentClinic = activeClinics.find((c) => c.clinicId === targetClinicId);
      } else if (activeClinics.length > 0) {
        setSelectedClinicId(activeClinics[0].clinicId);
        setSearchParams({ clinic: activeClinics[0].clinicId });
        currentClinic = activeClinics[0];
      }

      if (currentClinic) {
        syncClinicData(currentClinic);
      } else if (user?.doctorProfile) {
        setSlots(
          parseDoctorSlots(user.doctorProfile).map((s, idx) => ({
            ...s,
            name: cleanSlotName(s.name, `Shift ${idx + 1}`),
          }))
        );
        setConsultationFee(user.doctorProfile.consultationFee ?? 500);
        if (user.doctorProfile.workingDays) {
          try {
            const parsed = JSON.parse(user.doctorProfile.workingDays);
            setWorkingDays(Array.isArray(parsed) && parsed.length > 0 ? parsed : ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']);
          } catch {
            setWorkingDays(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']);
          }
        }
        setIsOnLeaveToday(Boolean(user.doctorProfile.isOnLeaveToday));
        setTodayLeave(user.doctorProfile.todayLeave || null);
      }
    } catch (err: any) {
      console.error('Failed to load doctor clinics for schedule:', err);
      setError('Unable to load affiliated clinics.');
    } finally {
      setLoadingClinics(false);
    }
  }, [searchParams, setSearchParams, syncClinicData, user]);

  useEffect(() => {
    let mounted = true;
    if (loadingAuth) return;
    if (!user || user.role?.toUpperCase() !== 'DOCTOR') {
      navigate('/login');
      return;
    }
    queueMicrotask(() => {
      if (mounted) fetchAffiliations();
    });
    return () => {
      mounted = false;
    };
  }, [fetchAffiliations, user, loadingAuth, navigate]);

  const selectedClinic = clinics.find((c) => c.clinicId === selectedClinicId);

  const handleClinicChange = (clinicId: string) => {
    setSelectedClinicId(clinicId);
    setSearchParams({ clinic: clinicId });
    const target = clinics.find((c) => c.clinicId === clinicId);
    if (target) {
      syncClinicData(target);
    }
  };

  // Direct slot editing: values entered by doctor are preserved exactly
  const handleSlotChange = (index: number, field: keyof DoctorSlot, value: any) => {
    setSlots((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleAddSlot = () => {
    setSlots((prev) => {
      let maxShiftNum = 0;
      prev.forEach((s) => {
        const match = s.name.match(/^Shift\s+(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxShiftNum) maxShiftNum = num;
        }
      });
      const newIndex = Math.max(prev.length + 1, maxShiftNum + 1);
      let startTime = '15:00';
      let endTime = '19:00';

      if (prev.length > 0) {
        let maxEndMins = 0;
        prev.forEach((s) => {
          const end = timeToMinutes(s.endTime);
          if (end > maxEndMins) maxEndMins = end;
        });
        let nextStartMins = maxEndMins + 60; // 1-hour break between shifts
        if (nextStartMins >= 22 * 60) {
          nextStartMins = maxEndMins + 15;
        }
        if (nextStartMins >= 23 * 60) {
          nextStartMins = 17 * 60;
        }
        const nextEndMins = Math.min(23 * 60 + 30, nextStartMins + 180);
        startTime = minutesToTime(nextStartMins);
        endTime = minutesToTime(nextEndMins);
      }

      const maxPatients = 25;
      const avgConsultationMinutes = 20;
      return [
        ...prev,
        {
          id: `slot_${Date.now()}`,
          name: `Shift ${newIndex}`,
          startTime,
          endTime,
          maxPatients,
          avgConsultationMinutes,
        },
      ];
    });
  };

  const handleRemoveSlot = (index: number) => {
    if (slots.length <= 1) {
      setError('Add at least one shift.');
      return;
    }
    setSlots((prev) => {
      const remaining = prev.filter((_, i) => i !== index);
      return remaining.map((s, idx) => ({
        ...s,
        name: /^Shift\s+\d+$/i.test(s.name) ? `Shift ${idx + 1}` : s.name,
      }));
    });
  };

  const toggleWorkingDay = (day: string) => {
    setWorkingDays((prev) => {
      if (prev.includes(day)) {
        if (prev.length <= 1) {
          setError('Pick at least one day.');
          return prev;
        }
        setError(null);
        return prev.filter((d) => d !== day);
      } else {
        setError(null);
        return ALL_WEEKDAYS.filter((d) => prev.includes(d) || d === day);
      }
    });
  };

  const handleSetWorkingDaysPreset = (preset: 'ALL' | 'WEEKDAYS' | 'MON_SAT') => {
    setError(null);
    if (preset === 'ALL') {
      setWorkingDays([...ALL_WEEKDAYS]);
    } else if (preset === 'WEEKDAYS') {
      setWorkingDays(['MON', 'TUE', 'WED', 'THU', 'FRI']);
    } else if (preset === 'MON_SAT') {
      setWorkingDays(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']);
    }
  };

  const handleToggleTodayLeave = async () => {
    if (!user?.doctorProfile?.id) return;
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      if (isOnLeaveToday && todayLeave) {
        await api.cancelDoctorLeave(user.doctorProfile.id, todayLeave.id);
        setIsOnLeaveToday(false);
        setTodayLeave(null);
        setSuccessMsg('You’re available today.');
      } else {
        const res = await api.addDoctorLeave(user.doctorProfile.id, {
          type: 'TODAY',
          reason: 'Marked on leave today',
          clinicId: selectedClinic ? selectedClinic.clinicId : undefined,
        });
        setIsOnLeaveToday(true);
        setTodayLeave((res as any)?.data || res || null);
        setSuccessMsg('You’re on leave today.');
      }
      await fetchAffiliations();
    } catch (err: any) {
      setError(err?.message || 'Couldn’t update leave. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const totalMaxDailyPatients = slots.reduce((sum, s) => sum + (Number(s.maxPatients) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (clinics.length > 0 && !selectedClinic) {
      setError('Please select an affiliated clinic first.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    if (workingDays.length === 0) {
      setError('Pick at least one day.');
      setSaving(false);
      return;
    }

    if (isNaN(Number(consultationFee)) || Number(consultationFee) < 0) {
      setError('Enter a fee of ₹0 or more.');
      setSaving(false);
      return;
    }

    // Validate slots
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      if (!s.startTime || !s.endTime) {
        setError(`Add a start and end time for ${s.name || `Shift ${i + 1}`}.`);
        setSaving(false);
        return;
      }
      const startMins = timeToMinutes(s.startTime);
      const endMins = timeToMinutes(s.endTime);
      if (endMins <= startMins) {
        setError(`End time must be after start time (${s.name || `Shift ${i + 1}`}).`);
        setSaving(false);
        return;
      }
      if (!s.maxPatients || s.maxPatients < 1) {
        setError(`Max patients must be at least 1 (${s.name || `Shift ${i + 1}`}).`);
        setSaving(false);
        return;
      }
      if (!s.avgConsultationMinutes || s.avgConsultationMinutes < 1) {
        setError(`Mins per patient must be at least 1 (${s.name || `Shift ${i + 1}`}).`);
        setSaving(false);
        return;
      }
    }

    // Check for overlapping shifts within this facility
    for (let i = 0; i < slots.length; i++) {
      const s1 = slots[i];
      const start1 = timeToMinutes(s1.startTime);
      const end1 = timeToMinutes(s1.endTime);
      for (let j = i + 1; j < slots.length; j++) {
        const s2 = slots[j];
        const start2 = timeToMinutes(s2.startTime);
        const end2 = timeToMinutes(s2.endTime);
        if (start1 < end2 && start2 < end1) {
          setError(`${s1.name || `Shift ${i + 1}`} and ${s2.name || `Shift ${j + 1}`} overlap. Change the times.`);
          setSaving(false);
          return;
        }
      }
    }

    try {
      await api.updateDoctorSchedule({
        ...(selectedClinic ? { clinicId: selectedClinic.clinicId } : {}),
        slots: slots.map((s) => ({
          ...s,
          maxPatients: Number(s.maxPatients),
          avgConsultationMinutes: Number(s.avgConsultationMinutes),
        })),
        consultationFee: Number(consultationFee),
        workingDays,
      });

      await refreshUser();
      const msg = selectedClinic
        ? `Schedule saved for ${selectedClinic.clinicName}.`
        : 'Schedule saved.';
      setSuccessMsg(msg);
      toast.success(msg);
      if (selectedClinic) {
        setClinics((prev) =>
          prev.map((c) =>
            c.clinicId === selectedClinic.clinicId
              ? { ...c, slots, consultationFee: Number(consultationFee), workingDays }
              : c
          )
        );
      }
    } catch (err: any) {
      const errMsg = err.message || 'Couldn’t update schedule. Try again.';
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout
      portalType="DOCTOR"
      navItems={navItems}
      title="Shifts & Fees"
      subtitle={selectedClinic?.clinicName || undefined}
      headerAction={
        <button
          type="button"
          onClick={() => navigate('/doctor/dashboard?tab=affiliations')}
          className="h-9 px-4 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea] text-xs font-normal flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
      }
    >
      <div className="max-w-4xl space-y-6 pb-24 md:pb-16 pb-safe">
        {loadingClinics ? (
          <div className="h-64 rounded-2xl bg-white border border-[#e5e5ea] animate-pulse p-8" />
        ) : (
          <>
            {clinics.length === 0 && (
              <div className="p-5 rounded-2xl bg-white border border-[#e5e5ea] text-[#1d1d1f] text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 ">
                <div>
                  <p className="font-semibold text-[14px] flex items-center gap-2 text-[#1d1d1f]">
                    <AlertTriangle className="w-4 h-4 text-[#0066cc]" />
                    Add a clinic first
                  </p>
                  <p className="text-[#86868b] mt-1 leading-relaxed">
                    Add a clinic to start taking bookings.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/doctor/dashboard?tab=affiliations')}
                  className="h-10 px-5 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-xs font-normal transition-all whitespace-nowrap self-start sm:self-auto cursor-pointer"
                >
                  Add Clinic
                </button>
              </div>
            )}

            <UtilityCard className="p-4 sm:p-7 space-y-6">
              {successMsg && (
                <div className="p-3.5 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f] text-xs flex items-center gap-2.5 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-[#0066cc] flex-shrink-0" />
                  <span className="font-normal">{successMsg}</span>
                </div>
              )}

              {error && (
                <div className="p-3.5 rounded-xl bg-danger-soft border border-danger-line/80 text-danger text-xs flex items-center gap-2.5 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-danger" />
                  <span className="font-normal">{error}</span>
                </div>
              )}

              {/* Clinic Selector & Verified Location Banner */}
              <div className="p-5 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <label className="text-[13px] font-semibold text-[#1d1d1f] flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#0066cc]" />
                    <span>Clinic</span>
                  </label>
                  {clinics.length > 1 ? (
                    <div className="relative w-full sm:w-auto min-w-0">
                      <select
                        value={selectedClinicId}
                        onChange={(e) => handleClinicChange(e.target.value)}
                        className="w-full sm:w-auto max-w-full h-11 pl-3.5 pr-9 rounded-xl border border-[#d2d2d7] text-base sm:text-sm font-normal text-[#1d1d1f] bg-white truncate focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 appearance-none cursor-pointer transition-all"
                      >
                        {clinics.map((c) => (
                          <option key={c.clinicId} value={c.clinicId}>
                            {c.clinicName} {c.city ? `(${c.city})` : ''}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 text-[#86868b] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  ) : (
                    <span className="text-xs font-normal text-[#1d1d1f] bg-white px-3.5 py-1.5 rounded-full border border-[#e5e5ea]">
                      {selectedClinic ? selectedClinic.clinicName : 'Own practice'}
                    </span>
                  )}
                </div>

                {selectedClinic && (
                  <div className="pt-3 border-t border-[#e5e5ea] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#86868b]">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#0066cc] flex-shrink-0" />
                      <span className="text-[#1d1d1f] font-normal">
                        {formatClinicAddress(selectedClinic, { withState: false })}
                      </span>
                    </div>
                    {selectedClinic.phone && (
                      <div className="flex items-center gap-1.5 font-normal">
                        <Phone className="w-3 h-3 text-[#86868b]" />
                        <span>{formatDisplayPhone(selectedClinic.phone)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* 1. Weekly Practice Days Selector */}
                <div className="p-5 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e5e5ea]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-[#0066cc]/10 flex items-center justify-center text-[#0066cc] shrink-0">
                        <CalendarDays className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-[15px] font-semibold text-[#1d1d1f] tracking-tight">
                          Days
                        </h3>
                        <p className="text-xs text-[#86868b] mt-0.5">
                          Days you see patients here
                        </p>
                      </div>
                    </div>

                    {/* Presets */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleSetWorkingDaysPreset('MON_SAT')}
                        className="h-9 px-3.5 rounded-full bg-white hover:bg-[#e8e8ed] text-xs font-normal text-[#1d1d1f] border border-[#e5e5ea] transition-all cursor-pointer active:scale-95"
                      >
                        Mon – Sat
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetWorkingDaysPreset('WEEKDAYS')}
                        className="h-9 px-3.5 rounded-full bg-white hover:bg-[#e8e8ed] text-xs font-normal text-[#1d1d1f] border border-[#e5e5ea] transition-all cursor-pointer active:scale-95"
                      >
                        Mon – Fri
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetWorkingDaysPreset('ALL')}
                        className="h-9 px-3.5 rounded-full bg-white hover:bg-[#e8e8ed] text-xs font-normal text-[#1d1d1f] border border-[#e5e5ea] transition-all cursor-pointer active:scale-95"
                      >
                        All Days
                      </button>
                    </div>
                  </div>

                  {/* Day Pills Grid */}
                  <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                    {ALL_WEEKDAYS.map((day) => {
                      const isSelected = workingDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleWorkingDay(day)}
                          className={`h-11 rounded-full border text-center transition-all cursor-pointer flex items-center justify-center text-xs font-semibold active:scale-95 ${
                            isSelected
                              ? 'bg-[#0066cc] border-[#0066cc] text-white '
                              : 'bg-white border-[#e5e5ea] text-[#1d1d1f] hover:bg-[#e8e8ed]'
                          }`}
                        >
                          {WEEKDAY_SHORT_NAMES[day]}
                        </button>
                      );
                    })}
                  </div>

                  <p className="text-[11px] text-[#86868b]">
                    {workingDays.length} {workingDays.length === 1 ? 'day' : 'days'} selected
                  </p>
                </div>

                {/* 2. Header & Capacity Summary Card */}
                <div className="p-5 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <span className="text-xs font-normal text-[#86868b] block mb-0.5">
                      Daily capacity
                    </span>
                    <h2 className="text-[22px] font-semibold text-[#1d1d1f] tracking-tight">
                      {totalMaxDailyPatients} patients a day
                    </h2>
                    <p className="text-xs text-[#86868b] mt-0.5">
                      {slots.length} shift{slots.length > 1 ? 's' : ''}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddSlot}
                    className="h-10 px-4 rounded-full bg-white hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea] text-xs font-normal flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#0066cc]" />
                    <span>Add Shift</span>
                  </button>
                </div>

                {/* 3. Multiple Checking Shifts Section */}
                <div className="space-y-4">
                  {slots.map((slot, idx) => (
                    <div
                      key={slot.id || idx}
                      className="p-4 sm:p-5 rounded-2xl bg-white border border-[#e5e5ea] space-y-4 transition-all duration-150 "
                    >
                      {/* Shift Header */}
                      <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#e5e5ea]">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span className="w-7 h-7 rounded-full bg-[#0066cc]/10 text-[#0066cc] text-xs font-semibold flex items-center justify-center flex-shrink-0">
                            {idx + 1}
                          </span>
                          <input
                            type="text"
                            value={slot.name}
                            onChange={(e) => handleSlotChange(idx, 'name', e.target.value)}
                            placeholder={`Shift ${idx + 1}`}
                            className="text-base sm:text-sm font-semibold text-[#1d1d1f] bg-transparent border-b border-transparent hover:border-[#d2d2d7] focus:border-[#0066cc] focus:outline-none px-1 py-0.5 transition-all truncate"
                          />
                        </div>

                        {slots.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSlot(idx)}
                            className="text-[#86868b] hover:text-danger p-2 rounded-full hover:bg-danger-soft transition-colors cursor-pointer flex-shrink-0"
                            title="Remove this shift"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* 4 Interactive Inputs */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                        <div>
                          <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                            Start
                          </label>
                          <input
                            type="time"
                            required
                            value={slot.startTime}
                            onChange={(e) => handleSlotChange(idx, 'startTime', e.target.value)}
                            className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                            End
                          </label>
                          <input
                            type="time"
                            required
                            value={slot.endTime}
                            onChange={(e) => handleSlotChange(idx, 'endTime', e.target.value)}
                            className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                            Mins per patient
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={180}
                            required
                            value={slot.avgConsultationMinutes || ''}
                            onChange={(e) =>
                              handleSlotChange(
                                idx,
                                'avgConsultationMinutes',
                                e.target.value === '' ? '' : Math.max(1, Number(e.target.value))
                              )
                            }
                            placeholder="20"
                            className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                            Max Patients
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={200}
                            required
                            value={slot.maxPatients || ''}
                            onChange={(e) =>
                              handleSlotChange(
                                idx,
                                'maxPatients',
                                e.target.value === '' ? '' : Math.max(1, Number(e.target.value))
                              )
                            }
                            placeholder="25"
                            className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 4. Consultation Fee in Indian Rupees (₹ INR) */}
                <div className="p-5 rounded-2xl bg-white border border-[#e5e5ea] space-y-4">
                  <div className="max-w-sm">
                    <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                      Fee (₹)
                    </label>
                    <div className="flex items-center w-full h-11 rounded-xl border border-[#d2d2d7] bg-white  focus-within:border-[#0066cc] focus-within:ring-4 focus-within:ring-[#0066cc]/10 transition-all duration-150 overflow-hidden">
                      <span className="h-full px-3.5 bg-[#f5f5f7] border-r border-[#d2d2d7] flex items-center justify-center select-none text-[14px] font-semibold text-[#1d1d1f]">
                        ₹
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={10}
                        required
                        value={consultationFee}
                        onChange={(e) => setConsultationFee(Number(e.target.value))}
                        placeholder="500"
                        className="w-full h-full px-3.5 bg-transparent text-base sm:text-sm font-normal text-[#1d1d1f] placeholder:text-[#a1a1a6] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* 5. Leaves & Out-of-Office Section */}
                <div className="p-5 rounded-2xl bg-white border border-[#e5e5ea] space-y-4 ">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#f0f0f2]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-danger-soft flex items-center justify-center text-danger shrink-0">
                        <CalendarX className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-[15px] font-semibold text-[#1d1d1f] tracking-tight">
                          Leave
                        </h3>
                        <p className="text-xs text-[#86868b] mt-0.5">
                          Take today off or plan leave
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsLeaveModalOpen(true)}
                      className="h-8 px-3.5 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] text-xs font-semibold text-[#0066cc] border border-[#e5e5ea] transition-all cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>All leaves</span>
                    </button>
                  </div>

                  {/* Today attendance banner & toggle */}
                  <div className="p-4 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      {isOnLeaveToday ? (
                        <>
                          <div className="w-2.5 h-2.5 rounded-full bg-warning-dot shrink-0" />
                          <div>
                            <span className="text-xs font-semibold text-[#1d1d1f] block">
                              On leave today
                            </span>
                            <span className="text-[11px] text-[#86868b]">
                              {todayLeave?.reason ? todayLeave.reason : 'Bookings are paused today.'}
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-2.5 h-2.5 rounded-full bg-success-dot shrink-0" />
                          <div>
                            <span className="text-xs font-semibold text-[#1d1d1f] block">
                              Available today
                            </span>
                            <span className="text-[11px] text-[#86868b]">
                              Patients can book.
                            </span>
                          </div>
                        </>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleToggleTodayLeave}
                      disabled={saving}
                      className={`h-9 px-4 rounded-full text-xs font-normal transition-all cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-[0.98] disabled:opacity-60 ${
                        isOnLeaveToday
                          ? 'bg-[#0066cc] hover:bg-[#0071e3] text-white'
                          : 'bg-white hover:bg-[#f5f5f7] text-[#1d1d1f] border border-[#e5e5ea]'
                      }`}
                    >
                      {isOnLeaveToday ? (
                        <>
                          <CalendarCheck className="w-3.5 h-3.5" />
                          <span>Resume</span>
                        </>
                      ) : (
                        <>
                          <CalendarX className="w-3.5 h-3.5" />
                          <span>Take today off</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Save Button */}
                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full sm:w-auto h-11 px-8 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-sm font-normal transition-all duration-150  flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {saving
                      ? 'Saving...'
                      : 'Save'}
                  </button>
                </div>
              </form>
            </UtilityCard>
          </>
        )}
      </div>

      {/* Practitioner Schedule & Leave Management Modal */}
      {isLeaveModalOpen && (
        <DoctorScheduleLeaveModal
          isOpen={true}
          onClose={() => setIsLeaveModalOpen(false)}
          doctorId={user?.doctorProfile?.id || ''}
          doctorName={user?.fullName || 'Practitioner'}
          clinicId={selectedClinic ? selectedClinic.clinicId : undefined}
          clinicName={selectedClinic ? selectedClinic.clinicName : undefined}
          onSuccess={async () => {
            await fetchAffiliations();
          }}
        />
      )}
    </DashboardLayout>
  );
};

