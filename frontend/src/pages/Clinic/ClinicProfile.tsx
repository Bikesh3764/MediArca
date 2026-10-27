import { AvatarImage } from '../../components/ui/AvatarImage';
import { ChangePasswordCard } from '../../components/auth/ChangePasswordCard';
import { DeleteAccountCard } from '../../components/auth/DeleteAccountCard';
import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api, getFileUrl } from '../../services/api';
import { DashboardLayout, DashboardNavItem } from '../../components/layout/DashboardLayout';
import { UtilityCard } from '../../components/ui/UtilityCard';
import { AvatarCropModal } from '../../components/ui/AvatarCropModal';
import { ClinicQrStandeeModal } from '../../components/common/ClinicQrStandeeModal';
import { optimizeAvatarImage } from '../../utils/documentOptimizer';
import { sanitizeIndianPhone, formatIndianPhone, isValidIndianPhone } from '../../utils/phoneUtils';
import { INDIAN_STATES, getCitiesForState } from '../../utils/indiaStates';
import { useToast } from '../../context/ToastContext';
import {
  Users,
  UserCheck,
  CalendarCheck,
  Settings,
  Building2,
  Camera,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  Clock,
  QrCode,
  RefreshCw,
  Trash2,
} from 'lucide-react';

export const ClinicProfile: React.FC = () => {
  const { user, updateUser, refreshUser } = useAuth();
  const { toast } = useToast();

  const [clinicName, setClinicName] = useState(
    user?.clinicProfile?.clinicName || user?.fullName || ''
  );
  const [phone, setPhone] = useState(user?.clinicProfile?.phone || user?.phone || '');
  const [address, setAddress] = useState(user?.clinicProfile?.address || '');
  const [state, setState] = useState(user?.clinicProfile?.state || '');
  const [city, setCity] = useState(user?.clinicProfile?.city || '');

  const [saving, setSaving] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarOptimization, setAvatarOptimization] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [tempImageSrc, setTempImageSrc] = useState<string | null>(null);

  const [standeeModalOpen, setStandeeModalOpen] = useState(false);

  // Sync state from active user & clinic profile
  useEffect(() => {
    let mounted = true;
    queueMicrotask(() => {
      if (!mounted || !user) return;
      setClinicName(user.clinicProfile?.clinicName || user.fullName || '');
      setPhone(user.clinicProfile?.phone || user.phone || '');
      setAddress(user.clinicProfile?.address || '');
      setState(user.clinicProfile?.state || '');
      setCity(user.clinicProfile?.city || '');
    });
    return () => {
      mounted = false;
    };
  }, [user]);

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
    setAvatarOptimization('Auto-compressing clinic photo...');
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
      setSuccessMsg('Photo saved.');
      setTimeout(() => setAvatarOptimization(null), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Couldn’t update clinic photo. Try again.');
      setAvatarOptimization(null);
    } finally {
      setAvatarLoading(false);
      if (avatarInputRef.current) {
        avatarInputRef.current.value = '';
      }
    }
  };

  const handlePhoneInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = sanitizeIndianPhone(e.target.value);
    setPhone(digits ? `+91 ${digits}` : '');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicName.trim()) {
      setErrorMsg('Clinic facility name is required.');
      return;
    }
    if (!address.trim()) {
      setErrorMsg('Clinic street address is required.');
      return;
    }
    if (!state) {
      setErrorMsg('Please select the state where your clinic is located.');
      return;
    }
    if (!city.trim()) {
      setErrorMsg('Choose your clinic’s city.');
      return;
    }

    let formattedPhone: string | undefined = undefined;
    if (phone.trim()) {
      if (!isValidIndianPhone(phone.trim())) {
        setErrorMsg('Please enter a valid 10-digit Indian mobile number (+91).');
        return;
      }
      formattedPhone = formatIndianPhone(phone.trim());
    }

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await api.updateClinicProfile({
        clinicName: clinicName.trim(),
        fullName: clinicName.trim(),
        address: address.trim(),
        state: state.trim(),
        city: city.trim(),
        phone: formattedPhone,
      });

      await refreshUser();

      setSuccessMsg('Saved.');
      toast.success('Clinic saved');
    } catch (err: any) {
      const msg = err.message || 'Couldn’t update clinic profile. Try again.';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };


  const clinicProfile = user?.clinicProfile;
  const verificationStatus = clinicProfile?.verificationStatus || 'PENDING';
  const isVerified = clinicProfile?.isVerified && verificationStatus === 'VERIFIED';
  const initialLetter = (clinicName.trim().charAt(0) || 'C').toUpperCase();

  const navItems: DashboardNavItem[] = [
    {
      id: 'doctors',
      label: 'Doctors',
      icon: Users,
      path: '/clinic/dashboard?tab=doctors',
    },
    {
      id: 'receptionists',
      label: 'Staff',
      icon: UserCheck,
      path: '/clinic/dashboard?tab=receptionists',
    },
    {
      id: 'appointments',
      label: 'Bookings',
      icon: CalendarCheck,
      path: '/clinic/dashboard?tab=appointments',
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      path: '/clinic/profile',
      active: true,
    },
  ];

  return (
    <DashboardLayout
      portalType="CLINIC"
      portalSubtitle="Clinic"
      navItems={navItems}
      title="Clinic Settings"
      subtitle={clinicName || 'Facility Details & Location'}
      headerAction={
        <div className="flex items-center gap-2">
          <Link
            to="/clinic/dashboard"
            className="h-9 px-4 rounded-full bg-white hover:bg-[#f5f5f7] active:scale-[0.98] text-[#1d1d1f] border border-[#d2d2d7] text-xs font-normal flex items-center gap-2  transition-all cursor-pointer"
          >
            <Building2 className="w-3.5 h-3.5 text-[#0066cc]" />
            <span>Back</span>
          </Link>
        </div>
      }
    >
      <div className="max-w-4xl space-y-6 pb-24 md:pb-16 pb-safe">
        {successMsg && (
          <div className="p-3.5 rounded-xl bg-white border border-[#e5e5ea] text-[#1d1d1f] text-xs font-normal flex items-center gap-2.5  animate-in fade-in duration-150">
            <CheckCircle2 className="w-4 h-4 text-[#0066cc] shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-danger-soft border border-danger-line text-danger text-xs font-normal flex items-center gap-2.5 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 text-danger shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Clinic Photo & Brand Identity Card */}
        <UtilityCard title="Photo">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative group">
              <div className="w-24 h-24 rounded-2xl overflow-hidden border border-[#e5e5ea] bg-[#f5f5f7] flex items-center justify-center ">
                {user?.avatarUrl ? (
                  <AvatarImage src={getFileUrl(user.avatarUrl)} name={clinicName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-[#0066cc] text-white flex items-center justify-center font-semibold text-3xl">
                    {initialLetter}
                  </div>
                )}
              </div>
              <button
                type="button"
                disabled={avatarLoading}
                onClick={() => avatarInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 bg-[#0066cc] hover:bg-[#0071e3] text-white p-2 rounded-full  transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                title="Change photo"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 text-center sm:text-left space-y-2.5">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={handleAvatarFileSelected}
              />
              <div>
                <h4 className="text-[15px] font-semibold text-[#1d1d1f] tracking-tight">
                  {clinicName || 'Clinic Facility Logo'}
                </h4>
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                <button
                  type="button"
                  disabled={avatarLoading}
                  onClick={() => avatarInputRef.current?.click()}
                  className="h-9 px-4 rounded-full bg-white hover:bg-[#f5f5f7] active:scale-[0.98] text-[#1d1d1f] border border-[#d2d2d7] text-xs font-normal flex items-center gap-2  transition-all cursor-pointer disabled:opacity-50"
                >
                  <Camera className="w-3.5 h-3.5 text-[#86868b]" />
                  <span>{avatarLoading ? 'Uploading...' : 'Upload Photo'}</span>
                </button>
                {user?.avatarUrl && (
                  <button
                    type="button"
                    disabled={avatarLoading}
                    onClick={handleRemoveAvatar}
                    className="h-9 px-4 rounded-full bg-white hover:bg-[#f5f5f7] border border-[#d2d2d7] text-[#ff3b30] text-xs font-normal flex items-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                )}
              </div>

              {avatarOptimization && (
                <div className="inline-flex items-center gap-1.5 text-xs font-normal text-[#0066cc] bg-[#0066cc]/10 px-3 py-1 rounded-full animate-in fade-in duration-150">
                  <Sparkles className="w-3.5 h-3.5 text-[#0066cc]" />
                  <span>{avatarOptimization}</span>
                </div>
              )}
            </div>
          </div>
        </UtilityCard>

        {/* Operational & Verification Overview Card */}
        <UtilityCard title="Status">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] space-y-1">
              <span className="text-xs font-normal text-[#86868b]">Verification</span>
              <div className="flex items-center gap-1.5 pt-0.5">
                {isVerified ? (
                  <>
                    <ShieldCheck className="w-4 h-4 text-success shrink-0" />
                    <span className="text-xs font-semibold text-success">Verified</span>
                  </>
                ) : verificationStatus === 'SUSPENDED' ? (
                  <>
                    <ShieldAlert className="w-4 h-4 text-danger shrink-0" />
                    <span className="text-xs font-semibold text-danger">Suspended</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-4 h-4 text-warning shrink-0" />
                    <span className="text-xs font-semibold text-warning">Under review</span>
                  </>
                )}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] flex flex-col justify-between sm:flex-row sm:items-center gap-3">
              <div className="space-y-0.5 min-w-0">
                <span className="text-xs font-normal text-[#86868b]">Check-in</span>
                <div className="flex items-center gap-1.5 pt-0.5">
                  <QrCode className="w-4 h-4 text-[#0066cc] shrink-0" />
                  <span className="text-xs font-semibold text-[#1d1d1f]">Front desk QR code</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStandeeModalOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-xs font-normal  transition-all cursor-pointer shrink-0"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>View QR Code</span>
              </button>
            </div>
          </div>
        </UtilityCard>

        {/* Profile Details Edit Form */}
        <form onSubmit={handleSave} className="space-y-6">
          <UtilityCard title="Details">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                  Clinic Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                  placeholder="e.g. Metropolis Polyclinic"
                  className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                />
              </div>

              <div>
                <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                  Phone
                </label>
                <div className="flex items-center w-full h-11 rounded-xl border border-[#d2d2d7] bg-white  focus-within:border-[#0066cc] focus-within:ring-4 focus-within:ring-[#0066cc]/10 transition-all duration-150 overflow-hidden">
                  <span className="h-full px-3.5 bg-[#f5f5f7] border-r border-[#d2d2d7] flex items-center justify-center select-none text-[13px] font-semibold text-[#1d1d1f]">
                    +91
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={14}
                    value={phone.replace(/^\+91\s*/, '')}
                    onChange={handlePhoneInputChange}
                    placeholder="98765 43210"
                    className="flex-1 h-full px-3.5 bg-transparent text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                  Login Email
                </label>
                <input
                  type="email"
                  disabled
                  value={user?.email || ''}
                  className="w-full h-11 px-3.5 rounded-xl border border-[#e5e5ea] bg-[#f5f5f7] text-base sm:text-sm text-[#86868b] cursor-not-allowed select-none"
                />
              </div>
            </div>
          </UtilityCard>

          <UtilityCard title="Location">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                  Street Address <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Floor 3, 100 Hill Road, Bandra West"
                  className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                    State <span className="text-danger">*</span>
                  </label>
                  <select
                    required
                    value={state}
                    onChange={(e) => {
                      setState(e.target.value);
                      setCity('');
                    }}
                    className="w-full h-11 px-3 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                  >
                    <option value="">Choose state</option>
                    {INDIAN_STATES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                    City <span className="text-danger">*</span>
                  </label>
                  {state && getCitiesForState(state).length > 0 ? (
                    <select
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full h-11 px-3 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                    >
                      <option value="">Choose city</option>
                      {getCitiesForState(state).map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder={state ? 'Enter City' : 'Select State First'}
                      disabled={!state}
                      className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150 disabled:bg-[#f5f5f7] disabled:cursor-not-allowed"
                    />
                  )}
                </div>
              </div>
            </div>
          </UtilityCard>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Link
              to="/clinic/dashboard"
              className="h-10 px-6 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border border-black/[0.08] text-xs font-normal transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="h-10 px-6 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-normal  transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>

        <ChangePasswordCard />
        <DeleteAccountCard />
      </div>

      {/* Avatar Crop & Frame Modal */}
      {cropModalOpen && tempImageSrc && (
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
      )}

      {/* Front-desk Printable QR Standee Modal */}
      {clinicProfile && (
        <ClinicQrStandeeModal
          isOpen={standeeModalOpen}
          onClose={() => setStandeeModalOpen(false)}
          clinicId={clinicProfile.id}
          clinicName={clinicName}
          clinicAddress={address ? `${address}${city ? `, ${city}` : ''}${state ? `, ${state}` : ''}` : undefined}
          clinicPhone={phone || undefined}
          checkinCode={clinicProfile.checkinCode || undefined}
        />
      )}
    </DashboardLayout>
  );
};
