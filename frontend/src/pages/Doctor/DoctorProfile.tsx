import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api, getFileUrl, ALL_SPECIALTIES } from '../../services/api';
import { DashboardLayout, DashboardNavItem } from '../../components/layout/DashboardLayout';
import { AppleButton } from '../../components/ui/AppleButton';
import { UtilityCard } from '../../components/ui/UtilityCard';
import { SearchableSpecialtySelect } from '../../components/ui/SearchableSpecialtySelect';
import { optimizeAvatarImage } from '../../utils/documentOptimizer';
import { sanitizeIndianPhone, formatIndianPhone, isValidIndianPhone } from '../../utils/phoneUtils';
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
import { AvatarCropModal } from '../../components/ui/AvatarCropModal';

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

  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [tempImageSrc, setTempImageSrc] = useState<string | null>(null);

  const handleAvatarFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;

    if (!rawFile.type.startsWith('image/')) {
      setErrorMsg('Please upload a valid image file (JPEG, PNG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setTempImageSrc(reader.result as string);
      setCropModalOpen(true);
    };
    reader.onerror = () => {
      setErrorMsg('Could not read the selected image file. Please try another image.');
    };
    reader.readAsDataURL(rawFile);
  };

  const handleCroppedAvatarComplete = async (croppedFile: File) => {
    setCropModalOpen(false);
    setTempImageSrc(null);
    setAvatarLoading(true);
    setAvatarOptimization('Auto-compressing framed photo...');
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const result = await optimizeAvatarImage(croppedFile);
      setAvatarOptimization(
        `Optimized: ${result.formattedOriginalSize} → ${result.formattedOptimizedSize} (-${result.reductionPercentage}%)`
      );

      const res = await api.uploadAvatar(result.file);
      updateUser(res.user);
      await refreshUser();
      setSuccessMsg('Profile photo updated.');
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
    queueMicrotask(() => {
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
    });
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

    if (!isValidIndianPhone(phone)) {
      setErrorMsg('Please enter a valid 10-digit Indian mobile number.');
      setSaving(false);
      return;
    }
    const formattedPhone = formatIndianPhone(phone);

    try {
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
      setSuccessMsg('Doctor profile saved.');
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
      title="Profile & Settings"
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
        <UtilityCard title="Profile Photo">
          <div className="flex flex-col sm:flex-row items-center gap-5 pt-2">
            <div className="relative group">
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-[#0066cc] shadow-sm bg-[#f5f5f7] flex items-center justify-center">
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
                className="absolute -bottom-1 -right-1 bg-[#0066cc] hover:bg-[#0071e3] text-white p-2 rounded-full shadow-md transition-all disabled:opacity-50"
                title="Change photo"
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
                onChange={handleAvatarFileSelected}
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
                  {avatarLoading ? 'Uploading...' : 'Change Photo'}
                </AppleButton>
              </div>

              {avatarOptimization && (
                <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#0066cc] bg-[#0066cc]/10 px-2.5 py-1 rounded-full border border-[#0066cc]/20 animate-fadeIn">
                  <Sparkles className="w-3.5 h-3.5 text-[#0066cc]" />
                  <span>{avatarOptimization}</span>
                </div>
              )}
            </div>
          </div>
        </UtilityCard>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Professional Credentials Card */}
          <UtilityCard title="Professional Details">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
              <div>
                <label className="block text-[13px] font-medium text-[#1d1d1f] tracking-[-0.01em] mb-1.5">
                  Full Name & Title
                </label>
                <div className="relative">
                  <UserIcon className="w-3.5 h-3.5 text-[#86868b] absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Dr. Rajesh Verma"
                    className="w-full h-11 pl-9 pr-3.5 rounded-[12px] border border-[#d2d2d7] text-[15px] tracking-[-0.015em] bg-white text-[#1d1d1f] placeholder:text-[#86868b] transition-all focus:outline-none focus:ring-[3px] focus:ring-[#0066cc]/15 focus:border-[#0066cc]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#1d1d1f] tracking-[-0.01em] mb-1.5">
                  Mobile Number
                </label>
                <div className="flex h-11 rounded-[12px] border border-[#d2d2d7] overflow-hidden focus-within:ring-[3px] focus-within:ring-[#0066cc]/15 focus-within:border-[#0066cc] transition-all bg-white">
                  <span className="inline-flex items-center justify-center px-3.5 border-r border-[#d2d2d7] bg-[#f5f5f7] text-[#1d1d1f] font-semibold text-[15px] tracking-[-0.01em] select-none">
                    +91
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    required
                    value={sanitizeIndianPhone(phone)}
                    onChange={(e) => {
                      const val = sanitizeIndianPhone(e.target.value);
                      setPhone(val ? `+91 ${val}` : '');
                    }}
                    placeholder="98765 43210"
                    maxLength={10}
                    className="w-full h-full px-3.5 text-[15px] tracking-[-0.015em] bg-white text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[13px] font-medium text-[#1d1d1f] tracking-[-0.01em] mb-1.5">
                  Specialty
                </label>
                <SearchableSpecialtySelect
                  value={specialty}
                  onChange={setSpecialty}
                  allowOther={true}
                  customValue={customSpecialty}
                  onCustomChange={setCustomSpecialty}
                  placeholder="Select specialty"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#1d1d1f] tracking-[-0.01em] mb-1.5">
                  Qualifications
                </label>
                <div className="relative">
                  <GraduationCap className="w-3.5 h-3.5 text-[#86868b] absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    value={qualifications}
                    onChange={(e) => setQualifications(e.target.value)}
                    placeholder="MBBS, MD"
                    className="w-full h-11 pl-9 pr-3.5 rounded-[12px] border border-[#d2d2d7] text-[15px] tracking-[-0.015em] bg-white text-[#1d1d1f] placeholder:text-[#86868b] transition-all focus:outline-none focus:ring-[3px] focus:ring-[#0066cc]/15 focus:border-[#0066cc]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#1d1d1f] tracking-[-0.01em] mb-1.5">
                  Experience (Years)
                </label>
                <div className="relative">
                  <Briefcase className="w-3.5 h-3.5 text-[#86868b] absolute left-3.5 top-3.5" />
                  <input
                    type="number"
                    min={0}
                    max={80}
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(Number(e.target.value))}
                    className="w-full h-11 pl-9 pr-3.5 rounded-[12px] border border-[#d2d2d7] text-[15px] tracking-[-0.015em] bg-white text-[#1d1d1f] placeholder:text-[#86868b] transition-all focus:outline-none focus:ring-[3px] focus:ring-[#0066cc]/15 focus:border-[#0066cc]"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-[13px] font-medium text-[#1d1d1f] tracking-[-0.01em] mb-1.5">
                Bio
              </label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Clinical background and focus areas"
                className="w-full p-3.5 rounded-[12px] border border-[#d2d2d7] text-[14px] tracking-[-0.01em] bg-white text-[#1d1d1f] placeholder:text-[#86868b] transition-all focus:outline-none focus:ring-[3px] focus:ring-[#0066cc]/15 focus:border-[#0066cc]"
              />
            </div>
          </UtilityCard>

          {/* Facility-Specific Practice Shifts & Fees Card */}
          <UtilityCard title="Clinic Shifts & Fees">
            <div className="p-5 rounded-[20px] bg-[#f5f5f7] border border-[#e5e5ea] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#0066cc]" />
                  <h4 className="text-xs font-bold text-[#1d1d1f] tracking-tight">
                    Facility Schedules
                  </h4>
                </div>
                <p className="text-[12px] text-[#86868b] max-w-lg leading-relaxed">
                  Configure checking hours, consultation fees, and patient capacity per affiliated clinic.
                </p>
              </div>
              <AppleButton
                type="button"
                variant="primary"
                size="sm"
                onClick={() => navigate('/doctor/dashboard?tab=affiliations')}
                className="flex items-center justify-center gap-2 whitespace-nowrap shadow-xs text-xs w-full sm:w-auto"
              >
                <Building2 className="w-3.5 h-3.5" />
                Manage Clinic Shifts
              </AppleButton>
            </div>
          </UtilityCard>

          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
            <AppleButton
              type="submit"
              variant="primary"
              size="md"
              disabled={saving}
              className="flex items-center justify-center gap-2 shadow-sm w-full sm:w-auto"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </AppleButton>
          </div>
        </form>
      </div>

      <AvatarCropModal
        isOpen={cropModalOpen}
        imageSrc={tempImageSrc}
        onClose={() => {
          setCropModalOpen(false);
          setTempImageSrc(null);
          if (avatarInputRef.current) {
            avatarInputRef.current.value = '';
          }
        }}
        onCropComplete={handleCroppedAvatarComplete}
      />
    </DashboardLayout>
  );
};
