import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api, getFileUrl } from '../../services/api';
import { DashboardLayout, DashboardNavItem } from '../../components/layout/DashboardLayout';
import { AppleButton } from '../../components/ui/AppleButton';
import { UtilityCard } from '../../components/ui/UtilityCard';
import { optimizeAvatarImage } from '../../utils/documentOptimizer';
import {
  Calendar,
  FileText,
  User as UserIcon,
  Stethoscope,
  Heart,
  Shield,
  Phone,
  AlertCircle,
  CheckCircle2,
  Save,
  Camera,
  Sparkles,
} from 'lucide-react';

export const PatientProfile: React.FC = () => {
  const { user, updateUser } = useAuth();

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [bloodGroup, setBloodGroup] = useState(user?.patientProfile?.bloodGroup || '');
  const [dateOfBirth, setDateOfBirth] = useState(user?.patientProfile?.dateOfBirth || '');
  const [gender, setGender] = useState(user?.patientProfile?.gender || '');
  const [emergencyContact, setEmergencyContact] = useState(user?.patientProfile?.emergencyContact || '');
  const [allergies, setAllergies] = useState(user?.patientProfile?.allergies || '');
  const [existingConditions, setExistingConditions] = useState(user?.patientProfile?.existingConditions || '');
  const [currentMedications, setCurrentMedications] = useState(user?.patientProfile?.currentMedications || '');

  const [saving, setSaving] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarOptimization, setAvatarOptimization] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const navItems: DashboardNavItem[] = [
    {
      id: 'appointments',
      label: 'Live Queue & Passes',
      icon: Calendar,
      path: '/patient/appointments',
    },
    {
      id: 'records',
      label: 'Medical Records Vault',
      icon: FileText,
      path: '/patient/records',
    },
    {
      id: 'find-doctors',
      label: 'Find Specialists',
      icon: Stethoscope,
      path: '/patient/doctors',
    },
    {
      id: 'profile',
      label: 'Patient Profile',
      icon: UserIcon,
      path: '/patient/profile',
      active: true,
    },
  ];

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const updated = await api.updateUserProfile({
        fullName: fullName.trim(),
        phone: phone.trim(),
        bloodGroup,
        dateOfBirth,
        gender,
        emergencyContact: emergencyContact.trim(),
        allergies: allergies.trim(),
        existingConditions: existingConditions.trim(),
        currentMedications: currentMedications.trim(),
      });

      updateUser(updated);
      setSuccessMsg('Profile and medical records information saved successfully.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

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
      setSuccessMsg('Profile photo updated successfully.');
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

  return (
    <DashboardLayout
      portalType="PATIENT"
      portalSubtitle="PATIENT HEALTH RECORD"
      navItems={navItems}
      title="Personal Profile & Health Info"
      subtitle="Manage your personal contact details, vital information, and clinical background"
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
          title="Profile Photo & Avatar"
          subtitle="Photos up to 10 MB are automatically downscaled and compressed client-side"
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
                title="Change profile photo"
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
                  {avatarLoading ? 'Optimizing & Uploading...' : 'Change Photo'}
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
          {/* Identity & Contact Card */}
          <UtilityCard title="Account & Contact Identity" subtitle="Visible to doctors and clinics during appointments">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">
                  Full Legal Name *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full h-11 px-3.5 rounded-xl border border-[#e5e5ea] text-xs bg-white focus:outline-none focus:border-[#0088e8] focus:ring-1 focus:ring-[#0088e8]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">
                  Primary Phone Number
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-[#86868b] absolute left-3.5 top-3.5" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full h-11 pl-9 pr-3.5 rounded-xl border border-[#e5e5ea] text-xs bg-white focus:outline-none focus:border-[#0088e8] focus:ring-1 focus:ring-[#0088e8]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#86868b] mb-1.5">
                  Registered Email Address (Locked)
                </label>
                <input
                  type="email"
                  disabled
                  value={user?.email || ''}
                  className="w-full h-11 px-3.5 rounded-xl border border-[#e5e5ea] text-xs bg-[#f5f5f7] text-[#86868b] cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">
                  Emergency Contact (Name & Phone)
                </label>
                <input
                  type="text"
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                  placeholder="e.g. Anjali (Spouse) - 9876543210"
                  className="w-full h-11 px-3.5 rounded-xl border border-[#e5e5ea] text-xs bg-white focus:outline-none focus:border-[#0088e8] focus:ring-1 focus:ring-[#0088e8]"
                />
              </div>
            </div>
          </UtilityCard>

          {/* Demographic & Vital Health Details Card */}
          <UtilityCard title="Medical Vitals & Demographics" subtitle="Used to assist doctors in personalized diagnosis">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-[#e5e5ea] text-xs bg-white focus:outline-none focus:border-[#0088e8] focus:ring-1 focus:ring-[#0088e8]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">
                  Gender
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-[#e5e5ea] text-xs bg-white focus:outline-none focus:border-[#0088e8] focus:ring-1 focus:ring-[#0088e8]"
                >
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">
                  Blood Group
                </label>
                <select
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-[#e5e5ea] text-xs bg-white focus:outline-none focus:border-[#0088e8] focus:ring-1 focus:ring-[#0088e8]"
                >
                  <option value="">Select Blood Group</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">
                  Known Allergies
                </label>
                <textarea
                  rows={2}
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  placeholder="e.g. Penicillin, Peanuts, Sulfa drugs, None"
                  className="w-full p-3 rounded-xl border border-[#e5e5ea] text-xs bg-white focus:outline-none focus:border-[#0088e8] focus:ring-1 focus:ring-[#0088e8]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">
                  Pre-Existing Conditions & Chronic Illness
                </label>
                <textarea
                  rows={2}
                  value={existingConditions}
                  onChange={(e) => setExistingConditions(e.target.value)}
                  placeholder="e.g. Type 2 Diabetes, Hypertension, Asthma"
                  className="w-full p-3 rounded-xl border border-[#e5e5ea] text-xs bg-white focus:outline-none focus:border-[#0088e8] focus:ring-1 focus:ring-[#0088e8]"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">
                Current Medications & Dosages
              </label>
              <textarea
                rows={2}
                value={currentMedications}
                onChange={(e) => setCurrentMedications(e.target.value)}
                placeholder="e.g. Metformin 500mg daily, Amlodipine 5mg morning"
                className="w-full p-3 rounded-xl border border-[#e5e5ea] text-xs bg-white focus:outline-none focus:border-[#0088e8] focus:ring-1 focus:ring-[#0088e8]"
              />
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
              {saving ? 'Saving Profile...' : 'Save Health Profile'}
            </AppleButton>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
};
