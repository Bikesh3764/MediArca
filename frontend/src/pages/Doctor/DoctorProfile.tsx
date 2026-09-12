import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api, DoctorSlot, parseDoctorSlots, calculateSlotMetrics, format12Hour } from '../../services/api';
import { DashboardLayout, DashboardNavItem } from '../../components/layout/DashboardLayout';
import { AppleButton } from '../../components/ui/AppleButton';
import { UtilityCard } from '../../components/ui/UtilityCard';
import {
  Users,
  Building2,
  Clock,
  Settings,
  LayoutDashboard,
  User as UserIcon,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  DollarSign,
  MapPin,
  Stethoscope,
  Briefcase,
  GraduationCap,
  Save,
} from 'lucide-react';

export const DoctorProfile: React.FC = () => {
  const { user, updateUser, refreshUser } = useAuth();

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [specialty, setSpecialty] = useState(user?.doctorProfile?.specialty || 'General Physician');
  const [qualifications, setQualifications] = useState(user?.doctorProfile?.qualifications || 'MBBS');
  const [experienceYears, setExperienceYears] = useState(user?.doctorProfile?.experienceYears || 5);
  const [consultationFee, setConsultationFee] = useState(user?.doctorProfile?.consultationFee || 80);
  const [clinicAddress, setClinicAddress] = useState(user?.doctorProfile?.clinicAddress || '');
  const [bio, setBio] = useState(user?.doctorProfile?.bio || '');

  const [slots, setSlots] = useState<DoctorSlot[]>(() => {
    if (user?.doctorProfile) {
      return parseDoctorSlots(user.doctorProfile);
    }
    return [
      {
        id: 'slot_1',
        name: 'Morning Shift',
        startTime: '09:00',
        endTime: '11:00',
        maxPatients: 50,
        avgConsultationMinutes: 2.4,
      },
    ];
  });

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || '');
      setPhone(user.phone || '');
      if (user.doctorProfile) {
        setSpecialty(user.doctorProfile.specialty || 'General Physician');
        setQualifications(user.doctorProfile.qualifications || 'MBBS');
        setExperienceYears(user.doctorProfile.experienceYears || 5);
        setConsultationFee(user.doctorProfile.consultationFee || 80);
        setClinicAddress(user.doctorProfile.clinicAddress || '');
        setBio(user.doctorProfile.bio || '');
        setSlots(parseDoctorSlots(user.doctorProfile));
      }
    }
  }, [user]);

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
      const startTime = '17:00';
      const endTime = '20:00';
      const maxPatients = 50;
      const { avgConsultationMinutes } = calculateSlotMetrics(startTime, endTime, maxPatients);
      return [
        ...prev,
        {
          id: `slot_${Date.now()}`,
          name: `Evening Shift (${newIndex})`,
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
      setErrorMsg('You must have at least one active shift slot for your practice.');
      return;
    }
    setSlots((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    // Validate slots
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      if (!s.startTime || !s.endTime) {
        setErrorMsg(`Please specify start and end time for ${s.name || `Slot ${i + 1}`}.`);
        setSaving(false);
        return;
      }
      if (!s.maxPatients || s.maxPatients < 1) {
        setErrorMsg(`Patient capacity for ${s.name || `Slot ${i + 1}`} must be at least 1.`);
        setSaving(false);
        return;
      }
    }

    try {
      // 1. Update basic profile info
      const updatedUser = await api.updateDoctorProfile({
        fullName: fullName.trim(),
        phone: phone.trim(),
        specialty: specialty.trim(),
        qualifications: qualifications.trim(),
        experienceYears: Number(experienceYears),
        consultationFee: Number(consultationFee),
        clinicAddress: clinicAddress.trim(),
        bio: bio.trim(),
      });

      // 2. Update shifts schedule
      await api.updateDoctorSchedule({
        slots,
        consultationFee: Number(consultationFee),
        clinicAddress: clinicAddress.trim(),
        bio: bio.trim(),
      });

      updateUser(updatedUser);
      await refreshUser();
      setSuccessMsg('Doctor profile, credentials, and checking shifts saved successfully!');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update doctor profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

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
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      path: '/doctor/profile',
      active: true,
    },
  ];

  return (
    <DashboardLayout
      portalType="DOCTOR"
      portalSubtitle="DOCTOR PORTAL"
      navItems={navItems}
      title="Doctor Profile & Practice Settings"
      subtitle="Edit your credentials, clinical specialty, bio, consultation fee, and checking shifts"
    >
      <div className="max-w-4xl space-y-6">
        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5 shadow-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="font-medium">{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5 shadow-sm">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span className="font-medium">{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* Professional Credentials Card */}
          <UtilityCard title="Professional Identity & Contact" subtitle="Displayed publicly to patients across search and discovery">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">
                  Full Name & Title *
                </label>
                <div className="relative">
                  <UserIcon className="w-3.5 h-3.5 text-[#86868b] absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Dr. Rajesh Verma"
                    className="w-full h-11 pl-9 pr-3.5 rounded-xl border border-[#e5e5ea] text-xs bg-white focus:outline-none focus:border-[#0088e8] focus:ring-1 focus:ring-[#0088e8]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">
                  Primary Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full h-11 px-3.5 rounded-xl border border-[#e5e5ea] text-xs bg-white focus:outline-none focus:border-[#0088e8] focus:ring-1 focus:ring-[#0088e8]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">
                  Medical Specialty *
                </label>
                <div className="relative">
                  <Stethoscope className="w-3.5 h-3.5 text-[#86868b] absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    placeholder="e.g. Cardiologist, Dermatologist, General Physician"
                    className="w-full h-11 pl-9 pr-3.5 rounded-xl border border-[#e5e5ea] text-xs bg-white focus:outline-none focus:border-[#0088e8] focus:ring-1 focus:ring-[#0088e8]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">
                  Qualifications & Degrees *
                </label>
                <div className="relative">
                  <GraduationCap className="w-3.5 h-3.5 text-[#86868b] absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    value={qualifications}
                    onChange={(e) => setQualifications(e.target.value)}
                    placeholder="e.g. MBBS, MD (Medicine), DM (Cardiology)"
                    className="w-full h-11 pl-9 pr-3.5 rounded-xl border border-[#e5e5ea] text-xs bg-white focus:outline-none focus:border-[#0088e8] focus:ring-1 focus:ring-[#0088e8]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">
                  Years of Experience
                </label>
                <div className="relative">
                  <Briefcase className="w-3.5 h-3.5 text-[#86868b] absolute left-3.5 top-3.5" />
                  <input
                    type="number"
                    min={0}
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(Number(e.target.value))}
                    className="w-full h-11 pl-9 pr-3.5 rounded-xl border border-[#e5e5ea] text-xs bg-white focus:outline-none focus:border-[#0088e8] focus:ring-1 focus:ring-[#0088e8]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">
                  Consultation Fee ($) *
                </label>
                <div className="relative">
                  <DollarSign className="w-3.5 h-3.5 text-[#86868b] absolute left-3.5 top-3.5" />
                  <input
                    type="number"
                    min={0}
                    required
                    value={consultationFee}
                    onChange={(e) => setConsultationFee(Number(e.target.value))}
                    className="w-full h-11 pl-9 pr-3.5 rounded-xl border border-[#e5e5ea] text-xs bg-white focus:outline-none focus:border-[#0088e8] focus:ring-1 focus:ring-[#0088e8]"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">
                Primary Clinic / Chamber Address
              </label>
              <div className="relative">
                <MapPin className="w-3.5 h-3.5 text-[#86868b] absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  value={clinicAddress}
                  onChange={(e) => setClinicAddress(e.target.value)}
                  placeholder="e.g. MediArca Medical Center, 2nd Floor, Room 204, Indiranagar"
                  className="w-full h-11 pl-9 pr-3.5 rounded-xl border border-[#e5e5ea] text-xs bg-white focus:outline-none focus:border-[#0088e8] focus:ring-1 focus:ring-[#0088e8]"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">
                Professional Bio & Practice Philosophy
              </label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Share your background, clinical expertise, and approach to patient care..."
                className="w-full p-3 rounded-xl border border-[#e5e5ea] text-xs bg-white focus:outline-none focus:border-[#0088e8] focus:ring-1 focus:ring-[#0088e8]"
              />
            </div>
          </UtilityCard>

          {/* Practice Checking Shifts Card */}
          <UtilityCard
            title="Daily Practice Shifts & Checking Windows"
            subtitle="Configure multiple daily consultation shifts with dynamic patient pace calculation"
          >
            <div className="space-y-4 mt-2">
              {slots.map((slot, index) => (
                <div
                  key={slot.id || index}
                  className="p-4 rounded-2xl border border-[#e5e5ea] bg-[#fafafc] space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#1d1d1f]">
                      Shift {index + 1}
                    </span>
                    {slots.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveSlot(index)}
                        className="text-rose-600 hover:text-rose-800 p-1 rounded-lg hover:bg-rose-50 text-xs flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove Shift</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="sm:col-span-1">
                      <label className="block text-[11px] font-medium text-[#86868b] mb-1">
                        Shift Label
                      </label>
                      <input
                        type="text"
                        value={slot.name}
                        onChange={(e) => handleSlotChange(index, 'name', e.target.value)}
                        placeholder="e.g. Morning Shift"
                        className="w-full h-10 px-3 rounded-xl border border-[#e5e5ea] text-xs bg-white focus:outline-none focus:border-[#0088e8]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-[#86868b] mb-1">
                        Start Time
                      </label>
                      <input
                        type="time"
                        value={slot.startTime}
                        onChange={(e) => handleSlotChange(index, 'startTime', e.target.value)}
                        className="w-full h-10 px-2.5 rounded-xl border border-[#e5e5ea] text-xs bg-white focus:outline-none focus:border-[#0088e8]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-[#86868b] mb-1">
                        End Time
                      </label>
                      <input
                        type="time"
                        value={slot.endTime}
                        onChange={(e) => handleSlotChange(index, 'endTime', e.target.value)}
                        className="w-full h-10 px-2.5 rounded-xl border border-[#e5e5ea] text-xs bg-white focus:outline-none focus:border-[#0088e8]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-[#86868b] mb-1">
                        Max Patients (Cap)
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={slot.maxPatients}
                        onChange={(e) =>
                          handleSlotChange(index, 'maxPatients', Number(e.target.value))
                        }
                        className="w-full h-10 px-2.5 rounded-xl border border-[#e5e5ea] text-xs bg-white focus:outline-none focus:border-[#0088e8]"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#e5e5ea]/60 flex items-center justify-between text-[11px] text-[#86868b]">
                    <span>
                      Window: <strong>{format12Hour(slot.startTime)}</strong> – <strong>{format12Hour(slot.endTime)}</strong>
                    </span>
                    <span className="text-[#0088e8] font-medium">
                      Calculated Pace: ~{slot.avgConsultationMinutes} min/patient
                    </span>
                  </div>
                </div>
              ))}

              <AppleButton
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleAddSlot}
                className="w-full flex items-center justify-center gap-1.5 border border-dashed border-[#0088e8]/40 text-[#0088e8] hover:bg-[#0088e8]/5 py-2.5 rounded-xl text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Another Checking Shift
              </AppleButton>
            </div>
          </UtilityCard>

          <div className="flex justify-end gap-3 pt-2">
            <AppleButton
              type="submit"
              variant="primary"
              size="md"
              disabled={saving}
              className="flex items-center gap-2 shadow-sm"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving Profile...' : 'Save Doctor Profile & Shifts'}
            </AppleButton>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
};
