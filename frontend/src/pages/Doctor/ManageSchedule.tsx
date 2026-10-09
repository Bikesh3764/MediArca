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
import { UtilityCard } from '../../components/ui/UtilityCard';
import {
  Clock,
  CheckCircle2,
  ChevronLeft,
  AlertCircle,
  AlertTriangle,
  Plus,
  Trash2,
  LayoutDashboard,
  Building2,
  MapPin,
  Phone,
  Settings,
  Timer,
  Users,
  Calendar,
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
      label: 'Live Queue',
      icon: LayoutDashboard,
      path: '/doctor/dashboard',
    },
    {
      id: 'affiliations',
      label: 'Clinics & Staff',
      icon: Building2,
      path: '/doctor/dashboard?tab=affiliations',
    },
    {
      id: 'schedule',
      label: 'Shifts & Fees',
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
      navItems={navItems}
      title="Clinic Practice Schedule"
      subtitle={
        selectedClinic
          ? `Manage shifts, consultation time, and fee for ${selectedClinic.clinicName}`
          : 'Configure daily shifts and consultation fee'
      }
      headerAction={
        <button
          type="button"
          onClick={() => navigate('/doctor/dashboard?tab=affiliations')}
          className="h-9 px-4 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea] text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Clinics & Staff</span>
        </button>
      }
    >
      <div className="max-w-4xl space-y-6">
        {loadingClinics ? (
          <div className="h-64 rounded-[24px] bg-white border border-[#e5e5ea] animate-pulse p-8" />
        ) : (
          <>
            {clinics.length === 0 && (
              <div className="p-5 rounded-[24px] bg-white border border-[#e5e5ea] text-[#1d1d1f] text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
                <div>
                  <p className="font-semibold text-[14px] flex items-center gap-2 text-[#1d1d1f]">
                    <AlertTriangle className="w-4 h-4 text-[#0066cc]" />
                    Clinic Affiliation Required for Online Bookings
                  </p>
                  <p className="text-[#86868b] mt-1 leading-relaxed">
                    Online patient bookings and live queue tokens require affiliation with at least one verified clinic partner.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/doctor/dashboard?tab=affiliations')}
                  className="h-10 px-5 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-xs font-medium transition-all whitespace-nowrap self-start sm:self-auto cursor-pointer"
                >
                  Affiliate with a Clinic
                </button>
              </div>
            )}

            <UtilityCard className="p-5 sm:p-7 space-y-6">
              {successMsg && (
                <div className="p-3.5 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f] text-xs flex items-center gap-2.5 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-[#0066cc] flex-shrink-0" />
                  <span className="font-medium">{successMsg}</span>
                </div>
              )}

              {error && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-700 text-xs flex items-center gap-2.5 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                  <span className="font-medium">{error}</span>
                </div>
              )}

              {/* Clinic Selector & Verified Location Banner */}
              <div className="p-5 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <label className="text-[13px] font-semibold text-[#1d1d1f] flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#0066cc]" />
                    <span>Practicing Facility</span>
                  </label>
                  {clinics.length > 1 ? (
                    <select
                      value={selectedClinicId}
                      onChange={(e) => handleClinicChange(e.target.value)}
                      className="h-11 px-3.5 rounded-xl border border-[#d2d2d7] text-[14px] font-medium text-[#1d1d1f] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 cursor-pointer transition-all"
                    >
                      {clinics.map((c) => (
                        <option key={c.clinicId} value={c.clinicId}>
                          {c.clinicName} {c.city ? `(${c.city})` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs font-medium text-[#1d1d1f] bg-white px-3.5 py-1.5 rounded-full border border-[#e5e5ea]">
                      {selectedClinic ? selectedClinic.clinicName : 'Independent Practice'}
                    </span>
                  )}
                </div>

                {selectedClinic && (
                  <div className="pt-3 border-t border-[#e5e5ea] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#86868b]">
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
                )}
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Header & Capacity Summary Card */}
                <div className="p-5 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <span className="text-xs font-medium text-[#86868b] block mb-0.5">
                      {selectedClinic ? `${selectedClinic.clinicName} Capacity` : 'Daily Capacity'}
                    </span>
                    <h2 className="text-[22px] font-semibold text-[#1d1d1f] tracking-tight">
                      {totalMaxDailyPatients} Max Daily Patients
                    </h2>
                    <p className="text-xs text-[#86868b] mt-0.5">
                      {slots.length} configured shift{slots.length > 1 ? 's' : ''}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddSlot}
                    className="h-10 px-4 rounded-full bg-white hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea] text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#0066cc]" />
                    <span>Add Shift</span>
                  </button>
                </div>

                {/* Multiple Checking Shifts Section */}
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
                        className="p-5 rounded-2xl bg-white border border-[#e5e5ea] space-y-4 transition-all duration-150"
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
                              placeholder="Shift Name (e.g. Morning Shift)"
                              className="text-[15px] font-semibold text-[#1d1d1f] bg-transparent border-b border-transparent hover:border-[#d2d2d7] focus:border-[#0066cc] focus:outline-none px-1 py-0.5 transition-all truncate"
                            />
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="px-3 py-1 rounded-full bg-[#f5f5f7] text-[#1d1d1f] border border-[#e5e5ea] text-xs font-medium flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-[#0066cc]" />
                              <span>
                                {format12Hour(slot.startTime)} – {format12Hour(slot.endTime)}
                              </span>
                            </span>

                            {slots.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveSlot(idx)}
                                className="text-[#86868b] hover:text-rose-600 p-2 rounded-full hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Remove this shift"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* 4 Interactive Inputs */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                              Start Time
                            </label>
                            <input
                              type="time"
                              required
                              value={slot.startTime}
                              onChange={(e) => handleSlotChange(idx, 'startTime', e.target.value)}
                              className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-[14px] text-[#1d1d1f] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                              End Time
                            </label>
                            <input
                              type="time"
                              required
                              value={slot.endTime}
                              onChange={(e) => handleSlotChange(idx, 'endTime', e.target.value)}
                              className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-[14px] text-[#1d1d1f] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                              Avg Consultation (mins)
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
                              className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-[14px] text-[#1d1d1f] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
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
                              className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-[14px] text-[#1d1d1f] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                            />
                          </div>
                        </div>

                        {/* Shift Pacing Insights & Assistance Bar */}
                        <div className="p-3 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
                          <div className="flex flex-wrap items-center gap-2 text-[#86868b]">
                            <span className="font-medium text-[#1d1d1f]">
                              Duration: {durationMinutes} mins
                            </span>
                            <span>•</span>
                            <span>
                              Pace: <strong className="text-[#1d1d1f]">~{slot.avgConsultationMinutes || 15}m / patient</strong>
                            </span>
                            <span>•</span>
                            <span>
                              Capacity: <strong className="text-[#1d1d1f]">{slot.maxPatients} patients</strong>
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleAutoPace(idx)}
                              className="px-3 py-1 rounded-full bg-white border border-[#e5e5ea] text-[#0066cc] font-medium text-xs hover:bg-[#0066cc]/5 transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <Timer className="w-3 h-3 text-[#0066cc]" />
                              <span>Auto-calc Pace</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAutoCapacity(idx)}
                              className="px-3 py-1 rounded-full bg-white border border-[#e5e5ea] text-[#1d1d1f] font-medium text-xs hover:bg-[#e8e8ed] transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <Users className="w-3 h-3 text-[#86868b]" />
                              <span>Auto-calc Capacity</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Consultation Fee in Indian Rupees (₹ INR) */}
                <div className="p-5 rounded-2xl bg-white border border-[#e5e5ea] space-y-4">
                  <div className="max-w-sm">
                    <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                      Consultation Fee (₹ INR){selectedClinic ? ` at ${selectedClinic.clinicName}` : ''}
                    </label>
                    <div className="flex items-center w-full h-11 rounded-xl border border-[#d2d2d7] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus-within:border-[#0066cc] focus-within:ring-4 focus-within:ring-[#0066cc]/10 transition-all duration-150 overflow-hidden">
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
                        className="w-full h-full px-3.5 bg-transparent text-[14px] font-medium text-[#1d1d1f] placeholder:text-[#a1a1a6] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Save Button */}
                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full sm:w-auto h-11 px-8 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-sm font-medium transition-all duration-150 shadow-[0_2px_8px_rgba(0,102,204,0.2),0_1px_2px_rgba(0,0,0,0.06)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {saving
                      ? 'Saving Schedule...'
                      : selectedClinic
                      ? `Save Schedule for ${selectedClinic.clinicName}`
                      : 'Save Schedule'}
                  </button>
                </div>
              </form>
            </UtilityCard>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

