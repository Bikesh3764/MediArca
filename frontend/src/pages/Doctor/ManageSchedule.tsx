import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  api,
  DoctorSlot,
  parseDoctorSlots,
  calculateSlotMetrics,
  format12Hour,
  DoctorAffiliationClinic,
  timeToMinutes,
} from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout, DashboardNavItem } from '../../components/layout/DashboardLayout';
import { AppleButton } from '../../components/ui/AppleButton';
import { UtilityCard } from '../../components/ui/UtilityCard';
import {
  Clock,
  IndianRupee,
  CheckCircle2,
  ChevronLeft,
  AlertCircle,
  AlertTriangle,
  Plus,
  Trash2,
  Calendar,
  Sparkles,
  LayoutDashboard,
  Building2,
  MapPin,
  Phone,
  Settings,
  Timer,
  Users,
} from 'lucide-react';

export const ManageSchedule: React.FC = () => {
  const { user, loading: loadingAuth, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [clinics, setClinics] = useState<DoctorAffiliationClinic[]>([]);
  const [selectedClinicId, setSelectedClinicId] = useState<string>('');
  const [loadingClinics, setLoadingClinics] = useState(true);

  const [slots, setSlots] = useState<DoctorSlot[]>([
    {
      id: 'slot_1',
      name: 'Shift 1 (Morning)',
      startTime: '09:00',
      endTime: '13:00',
      maxPatients: 25,
      avgConsultationMinutes: 20,
    },
  ]);

  const [consultationFee, setConsultationFee] = useState<number>(500);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const navItems: DashboardNavItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      path: '/doctor/dashboard',
    },
    {
      id: 'affiliations',
      label: 'Clinics & Staff',
      icon: Building2,
      path: '/doctor/dashboard?tab=affiliations',
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
          clinic.slots.map((s) => ({
            ...s,
            avgConsultationMinutes: Number(s.avgConsultationMinutes) || 15,
            maxPatients: Number(s.maxPatients) || 25,
          }))
        );
      } else if (user?.doctorProfile) {
        setSlots(parseDoctorSlots(user.doctorProfile));
      }
      setConsultationFee(clinic.consultationFee ?? user?.doctorProfile?.consultationFee ?? 500);
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
        setSlots(parseDoctorSlots(user.doctorProfile));
        setConsultationFee(user.doctorProfile.consultationFee ?? 500);
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

  // Optional quick helper: compute pace from duration / maxPatients
  const handleAutoPace = (index: number) => {
    setSlots((prev) => {
      const next = [...prev];
      const slot = next[index];
      const { avgConsultationMinutes } = calculateSlotMetrics(
        slot.startTime,
        slot.endTime,
        Number(slot.maxPatients) || 1
      );
      next[index] = { ...slot, avgConsultationMinutes };
      return next;
    });
  };

  // Optional quick helper: compute capacity from duration / avgConsultationMinutes
  const handleAutoCapacity = (index: number) => {
    setSlots((prev) => {
      const next = [...prev];
      const slot = next[index];
      const startMins = timeToMinutes(slot.startTime);
      let endMins = timeToMinutes(slot.endTime);
      if (endMins <= startMins) endMins += 24 * 60;
      const duration = Math.max(1, endMins - startMins);
      const pace = Math.max(1, Number(slot.avgConsultationMinutes) || 15);
      const calculatedCap = Math.max(1, Math.floor(duration / pace));
      next[index] = { ...slot, maxPatients: calculatedCap };
      return next;
    });
  };

  const handleAddSlot = () => {
    setSlots((prev) => {
      const newIndex = prev.length + 1;
      const startTime = '15:00';
      const endTime = '19:00';
      const maxPatients = 25;
      const avgConsultationMinutes = 20;
      return [
        ...prev,
        {
          id: `slot_${Date.now()}`,
          name: `Shift ${newIndex} (Evening)`,
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
      setError('You must configure at least one checking shift for this clinic.');
      return;
    }
    setSlots((prev) => prev.filter((_, i) => i !== index));
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

    if (isNaN(Number(consultationFee)) || Number(consultationFee) < 0) {
      setError('Please enter a valid consultation fee in ₹ INR (must be 0 or greater).');
      setSaving(false);
      return;
    }

    // Validate slots
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      if (!s.startTime || !s.endTime) {
        setError(`Please specify both start and end time for ${s.name || `Shift ${i + 1}`}.`);
        setSaving(false);
        return;
      }
      if (!s.maxPatients || s.maxPatients < 1) {
        setError(`Max patients capacity for ${s.name || `Shift ${i + 1}`} must be at least 1.`);
        setSaving(false);
        return;
      }
      if (!s.avgConsultationMinutes || s.avgConsultationMinutes < 1) {
        setError(`Average consultation time for ${s.name || `Shift ${i + 1}`} must be at least 1 minute.`);
        setSaving(false);
        return;
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
      });

      await refreshUser();
      setSuccessMsg(
        selectedClinic
          ? `Practice schedule & consultation fee for ${selectedClinic.clinicName} updated successfully!`
          : 'Independent practice schedule & consultation fee updated successfully!'
      );
      if (selectedClinic) {
        setClinics((prev) =>
          prev.map((c) =>
            c.clinicId === selectedClinic.clinicId
              ? { ...c, slots, consultationFee: Number(consultationFee) }
              : c
          )
        );
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update schedule');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout
      portalType="DOCTOR"
      portalSubtitle="DOCTOR PORTAL"
      navItems={navItems}
      title="Clinic Practice Schedule"
      subtitle={
        selectedClinic
          ? `Managing shifts, consultation time, and fees for ${selectedClinic.clinicName}`
          : 'Configure daily shifts & practice timings per clinic facility'
      }
      headerAction={
        <AppleButton
          variant="ghost"
          size="sm"
          onClick={() => navigate('/doctor/dashboard?tab=affiliations')}
          className="flex items-center gap-1.5 text-xs font-medium"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Clinics & Staff</span>
        </AppleButton>
      }
    >
      <div className="max-w-4xl space-y-6">
        {loadingClinics ? (
          <div className="h-64 rounded-3xl bg-white border border-[#e5e5ea] animate-pulse p-8" />
        ) : (
          <>
            {clinics.length === 0 && (
              <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div>
                  <p className="font-semibold text-[13px] flex items-center gap-1.5 text-amber-950">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    Clinic Affiliation Required for Online Bookings
                  </p>
                  <p className="text-amber-800/90 mt-0.5">
                    You are not currently linked to an active clinic facility. While you can set your base shifts and fees below, online patient bookings and live queue tokens require affiliation with at least one verified clinic partner.
                  </p>
                </div>
                <AppleButton
                  variant="primary"
                  size="sm"
                  onClick={() => navigate('/doctor/dashboard?tab=affiliations')}
                  className="whitespace-nowrap self-start sm:self-auto bg-amber-600 hover:bg-amber-700 text-white"
                >
                  Affiliate with a Clinic
                </AppleButton>
              </div>
            )}

            <UtilityCard className="p-4 sm:p-8 space-y-6">
              {successMsg && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span className="font-medium">{successMsg}</span>
                </div>
              )}

              {error && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2.5 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span className="font-medium">{error}</span>
                </div>
              )}

              {/* Clinic Selector & Verified Location Banner */}
              <div className="p-5 rounded-[22px] bg-[#fafafc] border border-[#e5e5ea] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <label className="text-xs font-bold text-[#1d1d1f] flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#0066cc]" />
                    <span>Practicing Facility</span>
                  </label>
                  {clinics.length > 1 ? (
                    <select
                      value={selectedClinicId}
                      onChange={(e) => handleClinicChange(e.target.value)}
                      className="h-10 px-4 rounded-full border border-[#e5e5ea] text-xs font-semibold text-[#1d1d1f] bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 focus:border-[#0066cc] cursor-pointer transition-all hover:bg-[#fafafc] shadow-2xs"
                    >
                      {clinics.map((c) => (
                        <option key={c.clinicId} value={c.clinicId}>
                          {c.clinicName} {c.city ? `(${c.city})` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs font-medium text-[#86868b] bg-white px-3 py-1.5 rounded-full border border-[#e5e5ea]">
                      {selectedClinic ? selectedClinic.clinicName : 'Independent Practice / Direct Consultations'}
                    </span>
                  )}
                </div>

                {selectedClinic ? (
                  <div className="pt-3 border-t border-[#f0f0f0] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#86868b]">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#0066cc] flex-shrink-0" />
                      <span className="text-[#1d1d1f] font-medium">
                        {selectedClinic.address}{selectedClinic.city ? `, ${selectedClinic.city}` : ''}
                      </span>
                    </div>
                    {selectedClinic.phone && (
                      <div className="flex items-center gap-1.5 font-medium">
                        <Phone className="w-3 h-3 text-[#86868b]" />
                        <span>{selectedClinic.phone}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="pt-3 border-t border-[#f0f0f0] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#86868b]">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#0066cc] flex-shrink-0" />
                      <span className="text-[#1d1d1f] font-medium">
                        Direct Consultations & Telehealth Practice
                      </span>
                    </div>
                    <span className="text-[11px] text-[#86868b]">
                      Configures schedule across direct and non-clinic appointments
                    </span>
                  </div>
                )}
              </div>

            <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
              {/* Header & Capacity Summary Card */}
              <div className="p-4 sm:p-6 rounded-[20px] sm:rounded-[22px] bg-[#f5f5f7] border border-[#e5e5ea] shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#0066cc]/10 text-[#0066cc] border border-[#0066cc]/20">
                      {selectedClinic?.clinicName} Capacity Overview
                    </span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-[#1d1d1f] tracking-tight">
                    {totalMaxDailyPatients} Max Daily Patients
                  </h2>
                  <p className="text-xs text-[#86868b] mt-1 flex items-center gap-1.5 font-medium">
                    <Clock className="w-3.5 h-3.5 text-[#0066cc]" />
                    <span>Configured Shifts: {slots.length} shift{slots.length > 1 ? 's' : ''} at this facility</span>
                  </p>
                </div>

                <div className="bg-white/90 backdrop-blur-md px-4 py-3 rounded-2xl border border-[#e5e5ea] shadow-2xs text-left sm:text-right">
                  <span className="text-[10px] font-semibold text-[#86868b] uppercase tracking-wide block">
                    Consultation Pace Mode
                  </span>
                  <span className="text-xs font-bold text-[#0066cc] flex items-center gap-1.5 mt-0.5 justify-start sm:justify-end">
                    <Timer className="w-3.5 h-3.5 text-[#0066cc]" />
                    Doctor-Entered Consultation Time
                  </span>
                </div>
              </div>

              {/* Multiple Checking Shifts Section */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#f0f0f0]">
                  <div>
                    <h3 className="text-base font-bold text-[#1d1d1f] flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#0066cc]" />
                      Checking Shifts & Timings
                    </h3>
                    <p className="text-xs text-[#86868b] mt-0.5">
                      Specify each shift's working hours, your average consultation time per patient, and maximum daily patient capacity.
                    </p>
                  </div>
                  <AppleButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleAddSlot}
                    className="flex items-center gap-1.5 self-start sm:self-auto rounded-full px-4"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Another Shift</span>
                  </AppleButton>
                </div>

                <div className="space-y-4">
                  {slots.map((slot, idx) => {
                    const { durationMinutes } = calculateSlotMetrics(
                      slot.startTime,
                      slot.endTime,
                      slot.maxPatients
                    );

                    return (
                      <div
                        key={slot.id || idx}
                        className="p-4 sm:p-6 rounded-[20px] sm:rounded-[22px] bg-white border border-[#e5e5ea] space-y-4 relative transition-all duration-200 hover:border-[#0066cc]/40 shadow-xs"
                      >
                        {/* Shift Header */}
                        <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#f5f5f7]">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <span className="w-7 h-7 rounded-full bg-[#0066cc]/10 text-[#0066cc] text-xs font-bold flex items-center justify-center flex-shrink-0">
                              {idx + 1}
                            </span>
                            <input
                              type="text"
                              value={slot.name}
                              onChange={(e) => handleSlotChange(idx, 'name', e.target.value)}
                              placeholder="e.g. Shift 1: Morning & Afternoon"
                              className="text-sm font-bold text-[#1d1d1f] bg-transparent border-b border-transparent hover:border-[#0066cc]/50 focus:border-[#0066cc] focus:outline-none px-1 py-0.5 transition-all truncate"
                            />
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="px-3 py-1 rounded-full bg-[#0066cc]/10 text-[#0066cc] border border-[#0066cc]/20 text-xs font-semibold flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5" />
                              <span>
                                {format12Hour(slot.startTime)} – {format12Hour(slot.endTime)}
                              </span>
                            </span>

                            {slots.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveSlot(idx)}
                                className="text-rose-500 hover:text-rose-700 p-2 rounded-full hover:bg-rose-50 transition-colors"
                                title="Remove this shift"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* 4 Interactive Inputs: Start Time, End Time, Avg Consultation Time, Max Patients */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-[#0066cc]" />
                              <span>Start Time</span>
                            </label>
                            <input
                              type="time"
                              required
                              value={slot.startTime}
                              onChange={(e) => handleSlotChange(idx, 'startTime', e.target.value)}
                              className="w-full h-11 px-3.5 rounded-xl border border-[#e5e5ea] text-xs font-semibold bg-white text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 focus:border-[#0066cc] transition-all"
                            />
                            <span className="text-[10px] text-[#86868b] mt-1 block">
                              {format12Hour(slot.startTime)}
                            </span>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-[#0066cc]" />
                              <span>End Time</span>
                            </label>
                            <input
                              type="time"
                              required
                              value={slot.endTime}
                              onChange={(e) => handleSlotChange(idx, 'endTime', e.target.value)}
                              className="w-full h-11 px-3.5 rounded-xl border border-[#e5e5ea] text-xs font-semibold bg-white text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 focus:border-[#0066cc] transition-all"
                            />
                            <span className="text-[10px] text-[#86868b] mt-1 block">
                              {format12Hour(slot.endTime)}
                            </span>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 flex items-center gap-1.5">
                              <Timer className="w-3.5 h-3.5 text-[#0066cc]" />
                              <span>Avg Consultation Time</span>
                            </label>
                            <div className="relative">
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
                                className="w-full h-11 pl-3.5 pr-14 rounded-xl border border-[#0066cc]/40 text-xs font-bold bg-[#0066cc]/5 text-[#0066cc] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 focus:border-[#0066cc] transition-all"
                              />
                              <span className="absolute right-3 top-3 text-[11px] font-semibold text-[#0066cc]">
                                mins
                              </span>
                            </div>
                            <span className="text-[10px] text-[#86868b] mt-1 block">
                              Doctor consultation pace
                            </span>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 flex items-center gap-1.5">
                              <Users className="w-3.5 h-3.5 text-[#10b981]" />
                              <span>Max Patients (Capacity)</span>
                            </label>
                            <div className="relative">
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
                                className="w-full h-11 pl-3.5 pr-12 rounded-xl border border-[#e5e5ea] text-xs font-bold bg-white text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 focus:border-[#0066cc] transition-all"
                              />
                              <span className="absolute right-3 top-3 text-[11px] font-semibold text-[#86868b]">
                                pts
                              </span>
                            </div>
                            <span className="text-[10px] text-[#86868b] mt-1 block">
                              Total shift intake limit
                            </span>
                          </div>
                        </div>

                        {/* Shift Pacing Insights & Assistance Bar */}
                        <div className="p-3.5 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea]/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
                          <div className="flex flex-wrap items-center gap-2 text-[#48484a]">
                            <span className="font-semibold text-[#1d1d1f]">
                              Shift Duration: {durationMinutes} mins
                            </span>
                            <span className="text-[#86868b]">•</span>
                            <span>
                              Doctor Pace: <strong className="text-[#0066cc]">~{slot.avgConsultationMinutes || 15}m per patient</strong>
                            </span>
                            <span className="text-[#86868b]">•</span>
                            <span>
                              Daily Quota: <strong className="text-[#1d1d1f]">{slot.maxPatients} patients</strong>
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 self-start sm:self-end md:self-auto">
                            <button
                              type="button"
                              onClick={() => handleAutoPace(idx)}
                              title="Calculate pace by dividing shift duration by max patients"
                              className="px-2.5 py-1 rounded-lg bg-white border border-[#e5e5ea] text-[#0066cc] font-semibold text-[11px] hover:bg-blue-50 transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                            >
                              <Sparkles className="w-3 h-3 text-[#0066cc]" />
                              <span>Auto-calc Pace</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAutoCapacity(idx)}
                              title="Calculate max patients capacity by dividing shift duration by pace"
                              className="px-2.5 py-1 rounded-lg bg-white border border-[#e5e5ea] text-[#48484a] font-semibold text-[11px] hover:bg-[#e8e8ed] transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                            >
                              <Users className="w-3 h-3 text-[#48484a]" />
                              <span>Auto-calc Capacity</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Consultation Fee in Indian Rupees (₹ INR) */}
              <div className="p-4 sm:p-6 rounded-[20px] sm:rounded-[22px] bg-white border border-[#e5e5ea] shadow-xs space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-[#f0f0f0]">
                  <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <IndianRupee className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#1d1d1f]">
                      Consultation Fee at {selectedClinic?.clinicName}
                    </h3>
                    <p className="text-xs text-[#86868b]">
                      Indian Rupees (₹ INR) consultation fee applied to patients booking at this facility.
                    </p>
                  </div>
                </div>

                <div className="max-w-sm">
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">
                    Fee Amount (₹ INR)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-base font-bold text-[#1d1d1f]">
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
                      className="w-full h-11 pl-9 pr-4 rounded-xl border border-[#e5e5ea] text-sm font-bold bg-white text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 focus:border-[#0066cc] transition-all"
                    />
                  </div>
                  <p className="text-[11px] text-[#86868b] mt-1.5 leading-relaxed">
                    Patients will see ₹{consultationFee || 0} when booking an appointment token for your desk{selectedClinic ? ` at ${selectedClinic.clinicName}` : ''}.
                  </p>
                </div>
              </div>

              {/* Save Button */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-xs text-[#86868b]">
                  Changes to timings, pace, and fees update live queue allocation immediately.
                </p>
                <AppleButton
                  variant="primary"
                  size="md"
                  type="submit"
                  disabled={saving}
                  className="w-full sm:w-auto px-8 py-3 rounded-full text-sm font-semibold shadow-xs"
                >
                  {saving
                    ? 'Saving Schedule...'
                    : selectedClinic
                    ? `Save Schedule for ${selectedClinic.clinicName} (₹${consultationFee || 0})`
                    : `Save Independent Schedule (₹${consultationFee || 0})`}
                </AppleButton>
              </div>
            </form>
          </UtilityCard>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};
