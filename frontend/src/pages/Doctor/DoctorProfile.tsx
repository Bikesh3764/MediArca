import { AvatarImage } from '../../components/ui/AvatarImage';
import { ChangePasswordCard } from '../../components/auth/ChangePasswordCard';
import { DeleteAccountCard } from '../../components/auth/DeleteAccountCard';
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api, getFileUrl, ALL_SPECIALTIES } from '../../services/api';
import { DashboardLayout, DashboardNavItem } from '../../components/layout/DashboardLayout';
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
  Camera,
  Sparkles,
  Calendar,
  Trash2,
} from 'lucide-react';
import { AvatarCropModal } from '../../components/ui/AvatarCropModal';
import { useToast } from '../../context/ToastContext';

export const DoctorProfile: React.FC = () => {
  const { user, updateUser, refreshUser } = useAuth();
  const { toast } = useToast();

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
      setErrorMsg('Please choose a JPG, PNG or WebP image.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setTempImageSrc(reader.result as string);
      setCropModalOpen(true);
    };
    reader.onerror = () => {
      setErrorMsg('Couldn’t read that image. Try another one.');
    };
    reader.readAsDataURL(rawFile);
  };

  const handleRemoveAvatar = async () => {
    if (!window.confirm('Remove photo?')) return;
    setAvatarLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await api.removeAvatar();
      updateUser(res.user);
      await refreshUser();
      setSuccessMsg('Photo removed.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Couldn’t remove photo. Try again.');
    } finally {
      setAvatarLoading(false);
    }
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
      setErrorMsg(err.message || 'Couldn’t update profile photo. Try again.');
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

    if (specialty === 'Other' && !customSpecialty.trim()) {
      setErrorMsg('Please enter your specific clinical specialty name.');
      setSaving(false);
      return;
    }

    const finalSpecialty =
      specialty === 'Other' ? customSpecialty.trim() : specialty.trim();

    if (!finalSpecialty) {
      setErrorMsg('Please choose your specialty.');
      setSaving(false);
      return;
    }

    if (!isValidIndianPhone(phone)) {
      setErrorMsg('Enter a valid 10-digit mobile number.');
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
      toast.success('Profile saved');
    } catch (err: any) {
      const errMsg = err.message || 'Couldn’t update doctor profile. Try again.';
      setErrorMsg(errMsg);
      toast.error(errMsg);
    } finally {
      setSaving(false);
    }
  };

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
      navItems={navItems}
      title="Profile"
    >
      <div className="max-w-4xl space-y-6 pb-24 md:pb-16 pb-safe">
        {successMsg && (
          <div className="p-3.5 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f] text-xs flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[#0066cc] flex-shrink-0" />
            <span className="font-normal">{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-danger-soft border border-danger-line/80 text-danger text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-danger flex-shrink-0" />
            <span className="font-normal">{errorMsg}</span>
          </div>
        )}

        {/* Profile Avatar Card with Auto-Compression */}
        <UtilityCard title="Photo">
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <div className="relative group">
              <div className="w-20 h-20 rounded-full overflow-hidden border border-[#e5e5ea] bg-[#f5f5f7] flex items-center justify-center">
                {user?.avatarUrl ? (
                  <AvatarImage src={getFileUrl(user.avatarUrl)} name={user.fullName} className="w-full h-full object-cover" />
                ) : (
                  <UserIcon className="w-9 h-9 text-[#86868b]" />
                )}
              </div>
              <button
                type="button"
                disabled={avatarLoading}
                onClick={() => avatarInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 bg-[#0066cc] hover:bg-[#0071e3] text-white p-2 rounded-full  transition-all disabled:opacity-50 cursor-pointer"
                title="Change photo"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 text-center sm:text-left space-y-2">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={handleAvatarFileSelected}
              />
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <button
                  type="button"
                  disabled={avatarLoading}
                  onClick={() => avatarInputRef.current?.click()}
                  className="h-9 px-4 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea] text-xs font-normal flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Camera className="w-3.5 h-3.5 text-[#86868b]" />
                  <span>{avatarLoading ? 'Uploading...' : 'Change Photo'}</span>
                </button>
                {user?.avatarUrl && (
                  <button
                    type="button"
                    disabled={avatarLoading}
                    onClick={handleRemoveAvatar}
                    className="h-9 px-4 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] border border-[#e5e5ea] text-[#ff3b30] text-xs font-normal flex items-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                )}
              </div>

              {avatarOptimization && (
                <div className="inline-flex items-center gap-1.5 text-xs font-normal text-[#0066cc] bg-[#0066cc]/10 px-3 py-1 rounded-full animate-fadeIn">
                  <Sparkles className="w-3.5 h-3.5 text-[#0066cc]" />
                  <span>{avatarOptimization}</span>
                </div>
              )}
            </div>
          </div>
        </UtilityCard>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Professional Credentials Card */}
          <UtilityCard title="Details">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                  Name
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Dr. Rajesh Verma"
                  className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                />
              </div>

              <div>
                <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                  Mobile
                </label>
                <div className="flex items-center w-full h-11 rounded-xl border border-[#d2d2d7] bg-white  focus-within:border-[#0066cc] focus-within:ring-4 focus-within:ring-[#0066cc]/10 transition-all duration-150 overflow-hidden">
                  <span className="h-full px-3.5 bg-[#f5f5f7] border-r border-[#d2d2d7] flex items-center justify-center select-none text-[13px] font-semibold text-[#1d1d1f]">
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
                    className="w-full h-full px-3.5 bg-transparent text-base sm:text-sm font-normal text-[#1d1d1f] placeholder:text-[#a1a1a6] focus:outline-none"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
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
                <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                  Qualifications
                </label>
                <input
                  type="text"
                  required
                  value={qualifications}
                  onChange={(e) => setQualifications(e.target.value)}
                  placeholder="MBBS, MD"
                  className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                />
              </div>

              <div>
                <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                  Experience (years)
                </label>
                <input
                  type="number"
                  min={0}
                  max={80}
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(Number(e.target.value))}
                  className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                Bio
              </label>
              <textarea
                maxLength={2000}
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="A few lines about your work"
                className="w-full p-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
              />
            </div>
          </UtilityCard>

          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto h-11 px-8 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-sm font-normal transition-all duration-150  flex items-center justify-center gap-2 cursor-pointer select-none disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>

        <ChangePasswordCard />
        <DeleteAccountCard />
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

