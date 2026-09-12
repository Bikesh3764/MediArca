import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api, getFileUrl, ALL_SPECIALTIES } from '../../services/api';
import { DashboardLayout, DashboardNavItem } from '../../components/layout/DashboardLayout';
import { AppleButton } from '../../components/ui/AppleButton';
import { UtilityCard } from '../../components/ui/UtilityCard';
import { SearchableSpecialtySelect } from '../../components/ui/SearchableSpecialtySelect';
import { optimizeAvatarImage } from '../../utils/documentOptimizer';
import {
  Building2,
  Settings,
  LayoutDashboard,
  User as UserIcon,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  GraduationCap,
  Save,
  Camera,
  Sparkles,
} from 'lucide-react';

export const DoctorProfile: React.FC = () => {
  const { user, updateUser, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');

  const initialSpec = user?.doctorProfile?.specialty || 'General Medicine';
  const initialIsStandard = ALL_SPECIALTIES.includes(initialSpec) && initialSpec !== 'Other';
  const [specialty, setSpecialty] = useState(initialIsStandard ? initialSpec : 'Other');
  const [customSpecialty, setCustomSpecialty] = useState(initialIsStandard ? '' : initialSpec);

  const [qualifications, setQualifications] = useState(user?.doctorProfile?.qualifications || 'MBBS');
  const [experienceYears, setExperienceYears] = useState(user?.doctorProfile?.experienceYears || 5);
  const [bio, setBio] = useState(user?.doctorProfile?.bio || '');

  const [saving, setSaving] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarOptimization, setAvatarOptimization] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;

    setAvatarLoading(true);
    setAvatarOptimization('Auto-compressing image...');
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const result = await optimizeAvatarImage(rawFile);
      setAvatarOptimization(
        `Optimized: ${result.formattedOriginalSize} → ${result.formattedOptimizedSize} (-${result.reductionPercentage}%)`
      );

      const res = await api.uploadAvatar(result.file);
      updateUser(res.user);
      setSuccessMsg('Doctor profile photo updated successfully.');
      setTimeout(() => setAvatarOptimization(null), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update profile photo');
      setAvatarOptimization(null);
    } finally {
      setAvatarLoading(false);
      if (avatarInputRef.current) {
        avatarInputRef.current.value = '';
      }
    }
  };

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || '');
      setPhone(user.phone || '');
      if (user.doctorProfile) {
        const currentSpec = user.doctorProfile.specialty || 'General Medicine';
        const isStandard = ALL_SPECIALTIES.includes(currentSpec) && currentSpec !== 'Other';
        if (isStandard) {
          setSpecialty(currentSpec);
          setCustomSpecialty('');
        } else {
          setSpecialty('Other');
          setCustomSpecialty(currentSpec);
        }
        setQualifications(user.doctorProfile.qualifications || 'MBBS');
        setExperienceYears(user.doctorProfile.experienceYears || 5);
        setBio(user.doctorProfile.bio || '');
      }
    }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const finalSpecialty =
      specialty === 'Other' && customSpecialty.trim()
        ? customSpecialty.trim()
        : specialty.trim();

    if (!finalSpecialty) {
      setErrorMsg('Please select or specify your clinical specialty.');
      setSaving(false);
      return;
    }

    try {
      const formattedPhone = phone.trim()
        ? phone.trim().startsWith('+91')
          ? phone.trim()
          : `+91 ${phone.trim()}`
        : '';

      const updatedUser = await api.updateDoctorProfile({
        fullName: fullName.trim(),
        phone: formattedPhone,
        specialty: finalSpecialty,
        qualifications: qualifications.trim(),
        experienceYears: Number(experienceYears),
        bio: bio.trim(),
      });

      updateUser(updatedUser);
      await refreshUser();
      setSuccessMsg('Doctor profile and credentials saved successfully!');
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
      id: 'affiliations',
      label: 'Clinics & Staff',
      icon: Building2,
      path: '/doctor/dashboard?tab=affiliations',
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

        {/* Profile Avatar Card with Auto-Compression */}
        <UtilityCard
          title="Doctor Headshot & Profile Photo"
          subtitle="Photos up to 10 MB are automatically compressed for rapid patient search & queue loading"
        >
          <div className="flex flex-col sm:flex-row items-center gap-5 pt-2">
            <div className="relative group">
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-[#0088e8] shadow-sm bg-[#f5f5f7] flex items-center justify-center">
                {user?.avatarUrl ? (
                  <img
                    src={getFileUrl(user.avatarUrl)}
                    alt={user.fullName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <UserIcon className="w-10 h-10 text-[#86868b]" />
                )}
              </div>
              <button
                type="button"
                disabled={avatarLoading}
                onClick={() => avatarInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 bg-[#0088e8] text-white p-2 rounded-full shadow-md hover:bg-[#0284c7] transition-all disabled:opacity-50"
                title="Change doctor headshot"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 text-center sm:text-left space-y-1.5">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={handleAvatarChange}
              />
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <AppleButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={avatarLoading}
                  onClick={() => avatarInputRef.current?.click()}
                  className="flex items-center gap-1.5 text-xs"
                >
                  <Camera className="w-3.5 h-3.5" />
                  {avatarLoading ? 'Optimizing & Uploading...' : 'Upload Headshot'}
                </AppleButton>
                <span className="text-[11px] text-[#86868b]">
                  Accepts JPG, PNG, WebP. Auto-compressed to &lt; 60 KB.
                </span>
              </div>

              {avatarOptimization && (
                <div className="inline-flex items-center gap-1.5 text-[11px] font-mono font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 animate-fadeIn">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{avatarOptimization}</span>
                </div>
              )}
            </div>
          </div>
        </UtilityCard>

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
                  Primary Phone Number (India)
                </label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-[#e5e5ea] bg-[#f5f5f7] text-[#1d1d1f] font-semibold text-xs select-none">
                    +91
                  </span>
                  <input
                    type="tel"
                    value={phone.replace(/^\+91\s?/, '')}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setPhone(`+91 ${val}`);
                    }}
                    placeholder="98765 43210"
                    className="w-full h-11 px-3.5 rounded-r-xl border border-[#e5e5ea] text-xs bg-white focus:outline-none focus:border-[#0088e8] focus:ring-1 focus:ring-[#0088e8]"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">
                  Medical Specialty *
                </label>
                <SearchableSpecialtySelect
                  value={specialty}
                  onChange={setSpecialty}
                  allowOther={true}
                  customValue={customSpecialty}
                  onCustomChange={setCustomSpecialty}
                  placeholder="Select or search medical specialty..."
                />
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
                  Years of Clinical Experience
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

          {/* Facility-Specific Practice Shifts & Fees Card */}
          <UtilityCard
            title="Practicing Clinics, Shifts & Consultation Fees"
            subtitle="Manage practice shifts, consultation fees, and patient caps per clinic facility"
          >
            <div className="p-5 rounded-2xl bg-gradient-to-br from-[#0088e8]/5 to-indigo-50/50 border border-[#0088e8]/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#0088e8]" />
                  <h4 className="text-xs font-bold text-[#1d1d1f] tracking-tight">
                    Facility-Specific Practice Schedules
                  </h4>
                </div>
                <p className="text-[11px] text-[#86868b] max-w-lg leading-relaxed">
                  Your checking hours (e.g. Shift 1: 09:00–13:00, Shift 2: 15:00–18:00), consultation fees, and patient capacity are configured directly for each verified clinic you are affiliated with.
                </p>
              </div>
              <AppleButton
                type="button"
                variant="primary"
                size="sm"
                onClick={() => navigate('/doctor/dashboard?tab=affiliations')}
                className="flex items-center gap-2 whitespace-nowrap bg-[#0088e8] hover:bg-[#0284c7] shadow-sm text-xs"
              >
                <Building2 className="w-3.5 h-3.5" />
                Manage Clinic Shifts
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
              {saving ? 'Saving Credentials...' : 'Save Doctor Profile'}
            </AppleButton>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
};
