import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  api,
  DoctorSlot,
  parseDoctorSlots,
  calculateSlotMetrics,
  format12Hour,
  DoctorAffiliationClinic,
} from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout, DashboardNavItem } from '../../components/layout/DashboardLayout';
import { AppleButton } from '../../components/ui/AppleButton';
import { UtilityCard } from '../../components/ui/UtilityCard';
import {
  Clock,
  DollarSign,
  CheckCircle2,
  ChevronLeft,
  AlertCircle,
  Plus,
  Trash2,
  Calendar,
  Sparkles,
  LayoutDashboard,
  Building2,
  MapPin,
  Phone,
  Settings,
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
      name: 'Morning Shift',
      startTime: '09:00',
      endTime: '13:00',
      maxPatients: 30,
      avgConsultationMinutes: 8,
    },
  ]);

  const [consultationFee, setConsultationFee] = useState<number>(80);
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
        setSlots(clinic.slots);
      } else if (user?.doctorProfile) {
        setSlots(parseDoctorSlots(user.doctorProfile));
      }
      setConsultationFee(clinic.consultationFee ?? user?.doctorProfile?.consultationFee ?? 80);
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
      }
    } catch (err: any) {
      console.error('Failed to load doctor clinics for schedule:', err);
      setError('Unable to load affiliated clinics.');
    } finally {
      setLoadingClinics(false);
    }
  }, [searchParams, setSearchParams, syncClinicData]);

  useEffect(() => {
    if (loadingAuth) return;
    if (!user || user.role?.toUpperCase() !== 'DOCTOR') {
      navigate('/login');
      return;
    }
    fetchAffiliations();
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

  const handleSlotChange = (index: number, field: keyof DoctorSlot, value: any) => {
    setSlots((prev) => {
      const next = [...prev];
      const target = { ...next[index], [field]: value };
      const { avgConsultationMinutes } = calculateSlotMetrics(
        target.startTime,
        target.endTime,
        Number(target.maxPatients) || 1
      );
      target.avgConsultationMinutes = avgConsultationMinutes;
      next[index] = target;
      return next;
    });
  };

  const handleAddSlot = () => {
    setSlots((prev) => {
      const newIndex = prev.length + 1;
      const startTime = '15:00';
      const endTime = '19:00';
      const maxPatients = 30;
      const { avgConsultationMinutes } = calculateSlotMetrics(startTime, endTime, maxPatients);
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
    if (!selectedClinic) {
      setError('Please select an affiliated clinic first.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    if (isNaN(Number(consultationFee)) || Number(consultationFee) < 0) {
      setError('Please enter a valid consultation fee (must be 0 or greater).');
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
    }

    try {
      await api.updateDoctorSchedule({
        clinicId: selectedClinic.clinicId,
        slots,
        consultationFee: Number(consultationFee),
      });

      await refreshUser();
      setSuccessMsg(`Practice schedule & consultation fee for ${selectedClinic.clinicName} updated successfully!`);
      // Refresh local clinics state
      setClinics((prev) =>
        prev.map((c) =>
          c.clinicId === selectedClinic.clinicId
            ? { ...c, slots, consultationFee: Number(consultationFee) }
            : c
        )
      );
    } catch (err: any) {
      setError(err.message || 'Failed to update schedule for this clinic');
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
          ? `Managing shifts and fees for ${selectedClinic.clinicName}`
          : 'Configure daily shifts & dynamic capacities per clinic facility'
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
      <div className="max-w-3xl space-y-6">
        {loadingClinics ? (
          <div className="h-64 rounded-2xl bg-white border border-[#e5e5ea] animate-pulse p-8" />
        ) : clinics.length === 0 ? (
          /* Empty State: Doctor has no affiliated clinics yet */
          <div className="bg-white rounded-[24px] border border-[#e5e5ea] p-10 text-center shadow-sm">
            <div className="w-16 h-16 rounded-3xl bg-[#0088e8]/10 text-[#0088e8] flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-[#1d1d1f] tracking-tight mb-2">
              No Affiliated Clinics Yet
            </h3>
            <p className="text-sm text-[#86868b] max-w-md mx-auto mb-6 leading-relaxed">
              In MediArca, doctor checking shifts, timings, and consultation fees are configured individually for each practicing clinic. Please join or affiliate with a clinic to set up your schedule.
            </p>
            <AppleButton
              variant="primary"
              size="md"
              onClick={() => navigate('/doctor/dashboard?tab=affiliations')}
              className="px-6 py-2.5 rounded-full"
            >
              Affiliate with a Clinic
            </AppleButton>
          </div>
        ) : (
          <UtilityCard>
            {successMsg && (
              <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {error && (
              <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Clinic Selector & Verified Location Banner */}
            <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-[#fafafc] border border-[#e5e5ea] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <label className="text-xs font-semibold text-[#1d1d1f] flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-[#0088e8]" />
                  <span>Select Practicing Clinic:</span>
                </label>
                {clinics.length > 1 && (
                  <select
                    value={selectedClinicId}
                    onChange={(e) => handleClinicChange(e.target.value)}
                    className="h-9 px-3 rounded-xl border border-[#e5e5ea] text-xs font-semibold text-[#1d1d1f] bg-white focus:outline-none focus:border-[#0088e8] cursor-pointer"
                  >
                    {clinics.map((c) => (
                      <option key={c.clinicId} value={c.clinicId}>
                        {c.clinicName} {c.city ? `(${c.city})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {selectedClinic && (
                <div className="pt-2 border-t border-[#f0f0f0] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#86868b]">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#0088e8] flex-shrink-0" />
                    <span className="text-[#1d1d1f] font-medium">{selectedClinic.address}{selectedClinic.city ? `, ${selectedClinic.city}` : ''}</span>
                  </div>
                  {selectedClinic.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3 h-3 text-[#86868b]" />
                      <span>{selectedClinic.phone}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Header & Capacity Summary Card */}
              <div className="p-5 rounded-2xl bg-[#1d1d1f] text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-[#2997ff] tracking-wider block">
                    {selectedClinic?.clinicName} Capacity
                  </span>
                  <strong className="text-2xl font-bold tracking-tight">
                    {totalMaxDailyPatients} Max Patients / Day
                  </strong>
                  <p className="text-xs text-[#cccccc] mt-0.5 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#2997ff]" />
                    Configured Shifts: {slots.length} shift(s) at this clinic
                  </p>
                </div>

                <div className="bg-white/10 px-4 py-2 rounded-xl text-left sm:text-right border border-white/15">
                  <span className="text-[10px] text-white/70 block uppercase">Consultation Pace</span>
                  <span className="text-sm font-semibold text-[#2997ff]">
                    Auto-calculated from capacity
                  </span>
                </div>
              </div>

              {/* Multiple Checking Shifts Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-semibold text-[#1d1d1f] flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-[#0088e8]" />
                    Checking Shifts at {selectedClinic?.clinicName}
                  </h3>
                  <AppleButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleAddSlot}
                    className="flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Shift</span>
                  </AppleButton>
                </div>

                <p className="text-xs text-[#86868b] mb-4">
                  Define working windows specifically for this clinic (e.g. Shift 1: 09:00–13:00 for 30 patients, Shift 2: 15:00–18:00 for 25 patients). MediArca dynamically calculates patient interval pacing (shift duration ÷ patient capacity).
                </p>

                <div className="space-y-4">
                  {slots.map((slot, idx) => {
                    const { durationMinutes, avgConsultationMinutes } = calculateSlotMetrics(
                      slot.startTime,
                      slot.endTime,
                      slot.maxPatients
                    );

                    return (
                      <div
                        key={slot.id || idx}
                        className="p-4 sm:p-5 rounded-2xl bg-[#fafafc] border border-[#e5e5ea] space-y-4 relative transition-all duration-200 hover:border-[#0088e8]/40"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-[#0088e8] text-white text-xs font-bold flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <input
                              type="text"
                              value={slot.name}
                              onChange={(e) => handleSlotChange(idx, 'name', e.target.value)}
                              placeholder="e.g. Morning Shift"
                              className="text-sm font-semibold text-[#1d1d1f] bg-transparent border-b border-transparent hover:border-[#0088e8] focus:border-[#0088e8] focus:outline-none px-1 py-0.5"
                            />
                          </div>

                          {slots.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveSlot(idx)}
                              className="text-rose-500 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                              title="Remove this shift"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {/* Time and Capacity Inputs */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[11px] font-medium text-[#86868b] mb-1">
                              Start Time
                            </label>
                            <input
                              type="time"
                              required
                              value={slot.startTime}
                              onChange={(e) => handleSlotChange(idx, 'startTime', e.target.value)}
                              className="w-full h-10 px-3 rounded-xl border border-[#e5e5ea] text-xs bg-white focus:outline-none focus:border-[#0088e8]"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-medium text-[#86868b] mb-1">
                              End Time
                            </label>
                            <input
                              type="time"
                              required
                              value={slot.endTime}
                              onChange={(e) => handleSlotChange(idx, 'endTime', e.target.value)}
                              className="w-full h-10 px-3 rounded-xl border border-[#e5e5ea] text-xs bg-white focus:outline-none focus:border-[#0088e8]"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-medium text-[#86868b] mb-1">
                              Max Patients (Capacity)
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={200}
                              required
                              value={slot.maxPatients}
                              onChange={(e) => handleSlotChange(idx, 'maxPatients', Number(e.target.value))}
                              className="w-full h-10 px-3 rounded-xl border border-[#e5e5ea] text-xs bg-white focus:outline-none focus:border-[#0088e8]"
                            />
                          </div>
                        </div>

                        {/* Live Calculation Indicator */}
                        <div className="p-3 rounded-xl bg-white border border-[#e5e5ea] flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-1.5 text-[#86868b]">
                            <Sparkles className="w-3.5 h-3.5 text-[#0088e8]" />
                            <span>
                              Shift Window: <strong>{format12Hour(slot.startTime)} – {format12Hour(slot.endTime)}</strong> ({durationMinutes} mins)
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[#86868b]">Pace: {durationMinutes}m ÷ {slot.maxPatients} pts =</span>
                            <span className="px-2.5 py-1 rounded-full bg-[#0088e8]/10 text-[#0088e8] font-semibold">
                              ~{avgConsultationMinutes} mins / consultation
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Consultation Fee at this Clinic */}
              <div className="pt-4 border-t border-[#f0f0f0]">
                <h3 className="text-base font-semibold text-[#1d1d1f] mb-3 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-[#0088e8]" />
                  <span>Consultation Fee at {selectedClinic?.clinicName}</span>
                </h3>
                <div className="max-w-xs">
                  <label className="block text-xs font-medium text-[#86868b] mb-1">
                    Fee Amount ($ USD)
                  </label>
                  <div className="relative">
                    <DollarSign className="w-4 h-4 text-[#86868b] absolute left-3 top-3" />
                    <input
                      type="number"
                      min={0}
                      required
                      value={consultationFee}
                      onChange={(e) => setConsultationFee(Number(e.target.value))}
                      className="w-full h-11 pl-9 pr-3.5 rounded-xl border border-[#e5e5ea] text-sm focus:outline-none focus:border-[#0088e8]"
                    />
                  </div>
                  <p className="text-[11px] text-[#86868b] mt-1">
                    Direct consultation charge applied to patients booking tokens at {selectedClinic?.clinicName}.
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-[#f0f0f0] flex justify-end">
                <AppleButton
                  variant="primary"
                  size="md"
                  type="submit"
                  disabled={saving}
                  className="px-6"
                >
                  {saving ? 'Saving Clinic Schedule...' : `Save Schedule for ${selectedClinic?.clinicName || 'Clinic'}`}
                </AppleButton>
              </div>
            </form>
          </UtilityCard>
        )}
      </div>
    </DashboardLayout>
  );
};
