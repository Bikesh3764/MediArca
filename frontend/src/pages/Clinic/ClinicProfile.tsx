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
  Printer,
  RefreshCw,
} from 'lucide-react';

export const ClinicProfile: React.FC = () => {
  const { user, updateUser, refreshUser } = useAuth();

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
      setErrorMsg('Could not read the selected image file. Please try another image.');
    };
    reader.readAsDataURL(rawFile);
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
      setSuccessMsg('Clinic logo/photo updated successfully.');
      setTimeout(() => setAvatarOptimization(null), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update clinic photo.');
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
      setErrorMsg('Please enter or select the city where your clinic is located.');
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
      const res = await api.updateClinicProfile({
        clinicName: clinicName.trim(),
        fullName: clinicName.trim(),
        address: address.trim(),
        state: state.trim(),
        city: city.trim(),
        phone: formattedPhone,
      });

      if (res?.data?.user) {
        updateUser(res.data.user);
      } else {
        await refreshUser();
      }

      setSuccessMsg('Clinic profile and location details saved successfully.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update clinic profile.');
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
      label: 'Affiliated Doctors',
      icon: Users,
      path: '/clinic/dashboard?tab=doctors',
    },
    {
      id: 'receptionists',
      label: 'Desk Staff & Reception',
      icon: UserCheck,
      path: '/clinic/dashboard?tab=receptionists',
    },
    {
      id: 'appointments',
      label: 'Facility Bookings',
      icon: CalendarCheck,
      path: '/clinic/dashboard?tab=appointments',
    },
    {
      id: 'settings',
      label: 'Clinic Settings',
      icon: Settings,
      path: '/clinic/profile',
      active: true,
    },
  ];

  return (
    <DashboardLayout
      portalType="CLINIC"
      portalSubtitle="Clinic Portal"
      navItems={navItems}
      title="Clinic Profile & Settings"
      subtitle={clinicName || 'Facility Details & Location'}
      headerAction={
        <div className="flex items-center gap-2">
          <Link
            to="/clinic/dashboard"
            className="h-9 px-3.5 rounded-full bg-white hover:bg-[#f5f5f7] text-[#1d1d1f] border border-[#e5e5ea] text-xs font-medium flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
          >
            <Building2 className="w-3.5 h-3.5 text-[#0066cc]" />
            <span>Return to Dashboard</span>
          </Link>
        </div>
      }
    >
      <div className="max-w-4xl space-y-6">
        {successMsg && (
          <div className="p-3.5 rounded-xl bg-white border border-[#e5e5ea] text-[#1d1d1f] text-xs font-medium flex items-center gap-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] animate-in fade-in duration-150">
            <CheckCircle2 className="w-4 h-4 text-[#0066cc] shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2.5 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Clinic Photo & Brand Identity Card */}
        <UtilityCard title="Facility Photo & Brand Identity">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative group">
              <div className="w-24 h-24 rounded-2xl overflow-hidden border border-[#e5e5ea] bg-[#f5f5f7] flex items-center justify-center shadow-xs">
                {user?.avatarUrl ? (
                  <img
                    src={getFileUrl(user.avatarUrl)}
                    alt={clinicName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-[#0066cc] text-white flex items-center justify-center font-bold text-3xl">
                    {initialLetter}
                  </div>
                )}
              </div>
              <button
                type="button"
                disabled={avatarLoading}
                onClick={() => avatarInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 bg-[#0066cc] hover:bg-[#0071e3] text-white p-2 rounded-full shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                title="Change clinic logo or photo"
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
                <p className="text-xs text-[#86868b] mt-0.5 leading-relaxed">
                  Upload a high-resolution logo or clinic exterior photo. Visible to patients during discovery and on digital booking passes.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                <button
                  type="button"
                  disabled={avatarLoading}
                  onClick={() => avatarInputRef.current?.click()}
                  className="h-9 px-4 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea] text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Camera className="w-3.5 h-3.5 text-[#86868b]" />
                  <span>{avatarLoading ? 'Uploading Photo...' : 'Upload New Photo'}</span>
                </button>
              </div>

              {avatarOptimization && (
                <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0066cc] bg-[#0066cc]/10 px-3 py-1 rounded-full animate-in fade-in duration-150">
                  <Sparkles className="w-3.5 h-3.5 text-[#0066cc]" />
                  <span>{avatarOptimization}</span>
                </div>
              )}
            </div>
          </div>
        </UtilityCard>

        {/* Operational & Verification Overview Card */}
        <UtilityCard title="Verification & Facility Credentials">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] space-y-1">
              <span className="text-xs font-medium text-[#86868b]">Accreditation Status</span>
              <div className="flex items-center gap-1.5 pt-0.5">
                {isVerified ? (
                  <>
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-xs font-semibold text-emerald-700">Verified Clinical Facility</span>
                  </>
                ) : verificationStatus === 'SUSPENDED' ? (
                  <>
                    <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                    <span className="text-xs font-semibold text-rose-700">Suspended</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="text-xs font-semibold text-amber-700">Pending Verification</span>
                  </>
                )}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] flex flex-col justify-between sm:flex-row sm:items-center gap-3">
              <div className="space-y-0.5 min-w-0">
                <span className="text-xs font-medium text-[#86868b]">Arrival Check-In</span>
                <p className="text-xs font-semibold text-[#1d1d1f] flex items-center gap-1.5">
                  <QrCode className="w-3.5 h-3.5 text-[#0066cc]" />
                  <span>Physical QR Standee (Phone Camera Only)</span>
                </p>
                <p className="text-[11px] text-[#86868b] leading-tight">
                  Arriving patients scan your front-desk poster to verify physical arrival.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStandeeModalOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-full bg-white hover:bg-[#e8e8ed] text-xs font-medium text-[#0066cc] border border-[#d2d2d7] transition-all cursor-pointer shrink-0 shadow-xs active:scale-[0.98]"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>View Standee</span>
              </button>
            </div>
          </div>
        </UtilityCard>

        {/* Profile Details Edit Form */}
        <form onSubmit={handleSave} className="space-y-6">
          <UtilityCard title="Facility Details">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                  Clinic / Hospital / Facility Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                  placeholder="e.g. Metropolis Polyclinic & Diagnostic Centre"
                  className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-[14px] text-[#1d1d1f] placeholder:text-[#a1a1a6] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                  Facility Mobile / Contact Phone
                </label>
                <div className="flex items-center w-full h-11 rounded-xl border border-[#d2d2d7] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus-within:border-[#0066cc] focus-within:ring-4 focus-within:ring-[#0066cc]/10 transition-all duration-150 overflow-hidden">
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
                    className="flex-1 h-full px-3.5 bg-transparent text-[14px] text-[#1d1d1f] placeholder:text-[#a1a1a6] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                  Account Login Email (Read Only)
                </label>
                <input
                  type="email"
                  disabled
                  value={user?.email || ''}
                  className="w-full h-11 px-3.5 rounded-xl border border-[#e5e5ea] bg-[#f5f5f7] text-[14px] text-[#86868b] cursor-not-allowed select-none"
                />
              </div>
            </div>
          </UtilityCard>

          <UtilityCard title="Physical Clinic Location">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                  Street Address & Building Details <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Floor 3, 100 Hill Road, Bandra West, Near St. Andrews Church"
                  className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-[14px] text-[#1d1d1f] placeholder:text-[#a1a1a6] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                    State <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={state}
                    onChange={(e) => {
                      setState(e.target.value);
                      setCity('');
                    }}
                    className="w-full h-11 px-3 rounded-xl border border-[#d2d2d7] bg-white text-[14px] text-[#1d1d1f] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                  >
                    <option value="">Select State</option>
                    {INDIAN_STATES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                    City <span className="text-rose-500">*</span>
                  </label>
                  {state && getCitiesForState(state).length > 0 ? (
                    <select
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full h-11 px-3 rounded-xl border border-[#d2d2d7] bg-white text-[14px] text-[#1d1d1f] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                    >
                      <option value="">Select City</option>
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
                      className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-[14px] text-[#1d1d1f] placeholder:text-[#a1a1a6] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150 disabled:bg-[#f5f5f7] disabled:cursor-not-allowed"
                    />
                  )}
                </div>
              </div>
            </div>
          </UtilityCard>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Link
              to="/clinic/dashboard"
              className="h-10 px-5 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea] text-xs font-semibold transition-all cursor-pointer flex items-center justify-center"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="h-10 px-6 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-semibold shadow-sm transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                'Save Clinic Settings'
              )}
            </button>
          </div>
        </form>
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
