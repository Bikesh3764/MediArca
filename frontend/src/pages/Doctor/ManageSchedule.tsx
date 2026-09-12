import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, DoctorSlot, parseDoctorSlots, calculateSlotMetrics, format12Hour } from '../../services/api';
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
  Settings,
} from 'lucide-react';

export const ManageSchedule: React.FC = () => {
  const { user, loading: loadingAuth, refreshUser } = useAuth();
  const navigate = useNavigate();

  const navItems: DashboardNavItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      path: '/doctor/dashboard',
    },
    {
      id: 'schedule',
      label: 'Manage Schedule',
      icon: Clock,
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

  const [slots, setSlots] = useState<DoctorSlot[]>([
    {
      id: 'slot_1',
      name: 'Morning Shift',
      startTime: '09:00',
      endTime: '11:00',
      maxPatients: 50,
      avgConsultationMinutes: 2.4,
    },
  ]);

  const [consultationFee, setConsultationFee] = useState(80);
  const [clinicAddress, setClinicAddress] = useState('');
  const [bio, setBio] = useState('');

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loadingAuth) return;
    if (!user || user.role?.toUpperCase() !== 'DOCTOR') {
      navigate('/login');
      return;
    }
    if (user.doctorProfile) {
      const p = user.doctorProfile;
      const parsed = parseDoctorSlots(p);
      setSlots(parsed);
      setConsultationFee(p.consultationFee || 70);
      setClinicAddress(p.clinicAddress || '');
      setBio(p.bio || '');
    }
  }, [user, loadingAuth, navigate]);

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
      let newStart = '17:00';
      let newEnd = '20:00';
      const maxPatients = 60;
      const { avgConsultationMinutes } = calculateSlotMetrics(newStart, newEnd, maxPatients);
      return [
        ...prev,
        {
          id: `slot_${Date.now()}`,
          name: `Shift ${newIndex} (Evening)`,
          startTime: newStart,
          endTime: newEnd,
          maxPatients,
          avgConsultationMinutes,
        },
      ];
    });
  };

  const handleRemoveSlot = (index: number) => {
    if (slots.length <= 1) {
      setError('You must have at least one active checking slot for your practice.');
      return;
    }
    setSlots((prev) => prev.filter((_, i) => i !== index));
  };

  const totalMaxDailyPatients = slots.reduce((sum, s) => sum + (Number(s.maxPatients) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    // Validate slots
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      if (!s.startTime || !s.endTime) {
        setError(`Please specify both start and end time for ${s.name || `Slot ${i + 1}`}.`);
        setSaving(false);
        return;
      }
      if (!s.maxPatients || s.maxPatients < 1) {
        setError(`Max patients capacity for ${s.name || `Slot ${i + 1}`} must be at least 1.`);
        setSaving(false);
        return;
      }
    }

    try {
      await api.updateDoctorSchedule({
        slots,
        consultationFee: Number(consultationFee),
        clinicAddress,
        bio,
      });

      await refreshUser();
      setSuccessMsg('Practice schedule and checking slots updated successfully!');
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
      title="Manage Practice Schedule"
      subtitle="Configure daily checking slots & dynamic capacities"
      headerAction={
        <AppleButton
          variant="ghost"
          size="sm"
          onClick={() => navigate('/doctor/dashboard')}
          className="flex items-center gap-1.5 text-xs font-medium"
        >
          <ChevronLeft className="w-4 h-4" />
          Dashboard
        </AppleButton>
      }
    >
      <div className="max-w-3xl space-y-6">
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

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Header & Capacity Summary Card */}
            <div className="p-5 rounded-2xl bg-[#1d1d1f] text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <span className="text-[10px] uppercase font-semibold text-[#2997ff] tracking-wider block">
                  Active Clinical Capacity
                </span>
                <strong className="text-2xl font-bold tracking-tight">
                  {totalMaxDailyPatients} Max Daily Patients
                </strong>
                <p className="text-xs text-[#cccccc] mt-0.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#2997ff]" />
                  Configured Slots: {slots.length} shift(s) per day
                </p>
              </div>

              <div className="bg-white/10 px-4 py-2 rounded-xl text-left sm:text-right border border-white/15">
                <span className="text-[10px] text-white/70 block uppercase">Dynamic Consultation Pace</span>
                <span className="text-sm font-semibold text-[#2997ff]">
                  Auto-calculated from capacity
                </span>
              </div>
            </div>

            {/* Multiple Checking Slots Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-[#1d1d1f] flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-[#0088e8]" />
                  Doctor Checking Slots (Shifts)
                </h3>
                <AppleButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleAddSlot}
                  className="flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Slot
                </AppleButton>
              </div>

              <p className="text-xs text-[#86868b] mb-4">
                Define distinct working windows (e.g. Morning 09:00–11:00 for 50 patients, Evening 17:00–20:00 for 60 patients). MediArca automatically computes the expected consultation duration (duration ÷ capacity).
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
                            placeholder="e.g. Morning OPD Shift"
                            className="text-sm font-semibold text-[#1d1d1f] bg-transparent border-b border-transparent hover:border-[#0088e8] focus:border-[#0088e8] focus:outline-none px-1 py-0.5"
                          />
                        </div>

                        {slots.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSlot(idx)}
                            className="text-rose-500 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                            title="Remove this slot"
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
                            Slot Window: <strong>{format12Hour(slot.startTime)} – {format12Hour(slot.endTime)}</strong> ({durationMinutes} mins)
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[#86868b]">Formula: {durationMinutes}m ÷ {slot.maxPatients} pts =</span>
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

            {/* Practice Parameters (Fee, Address, Bio) */}
            <div className="pt-4 border-t border-[#f0f0f0]">
              <h3 className="text-base font-semibold text-[#1d1d1f] mb-3 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-[#0088e8]" />
                Consultation Fee & Clinic Profile
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#86868b] mb-1">
                    Consultation Fee ($ USD)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={consultationFee}
                    onChange={(e) => setConsultationFee(Number(e.target.value))}
                    className="w-full h-11 px-3.5 rounded-xl border border-[#e5e5ea] text-sm focus:outline-none focus:border-[#0088e8]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#86868b] mb-1">
                    Clinic / Hospital Address
                  </label>
                  <input
                    type="text"
                    value={clinicAddress}
                    onChange={(e) => setClinicAddress(e.target.value)}
                    placeholder="e.g. Apex Health Center, Suite 300, New York, NY"
                    className="w-full h-11 px-3.5 rounded-xl border border-[#e5e5ea] text-sm focus:outline-none focus:border-[#0088e8]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#86868b] mb-1">
                    Professional Bio
                  </label>
                  <textarea
                    rows={3}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Describe your areas of clinical focus, background, and patient care philosophy..."
                    className="w-full p-3 rounded-xl border border-[#e5e5ea] text-sm focus:outline-none focus:border-[#0088e8]"
                  ></textarea>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#f0f0f0] flex justify-end">
              <AppleButton
                variant="primary"
                size="md"
                type="submit"
                disabled={saving}
              >
                {saving ? 'Saving Changes...' : 'Save Practice Parameters'}
              </AppleButton>
            </div>
          </form>
        </UtilityCard>
      </div>
    </DashboardLayout>
  );
};
