import React, { useState, useEffect } from 'react';
import { ChangePasswordCard } from '../../components/auth/ChangePasswordCard';
import { DeleteAccountCard } from '../../components/auth/DeleteAccountCard';
import { SubNav } from '../../components/layout/SubNav';
import { useAuth } from '../../context/AuthContext';
import { api, getLocalDateString, getFileUrl } from '../../services/api';
import { AvatarImage } from '../../components/ui/AvatarImage';
import { UtilityCard } from '../../components/ui/UtilityCard';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
} from 'lucide-react';
import { sanitizeIndianPhone, formatIndianPhone, isValidIndianPhone } from '../../utils/phoneUtils';
import { useToast } from '../../context/ToastContext';

export const PatientProfile: React.FC = () => {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [bloodGroup, setBloodGroup] = useState(user?.patientProfile?.bloodGroup || '');
  const [dateOfBirth, setDateOfBirth] = useState(
    user?.patientProfile?.dateOfBirth ? String(user.patientProfile.dateOfBirth).split('T')[0] : ''
  );
  const [gender, setGender] = useState(user?.patientProfile?.gender || '');
  const [emergencyContact, setEmergencyContact] = useState(user?.patientProfile?.emergencyContact || '');

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    queueMicrotask(() => {
      if (mounted && user) {
        setFullName(user.fullName || '');
        setPhone(user.phone || '');
        setBloodGroup(user.patientProfile?.bloodGroup || '');
        setDateOfBirth(
          user.patientProfile?.dateOfBirth ? String(user.patientProfile.dateOfBirth).split('T')[0] : ''
        );
        setGender(user.patientProfile?.gender || '');
        setEmergencyContact(user.patientProfile?.emergencyContact || '');
      }
    });
    return () => {
      mounted = false;
    };
  }, [user]);

  const handlePhoneInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = sanitizeIndianPhone(e.target.value);
    setPhone(digits ? `+91 ${digits}` : '');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setErrorMsg('Full name is required.');
      return;
    }
    if (!isValidIndianPhone(phone)) {
      setErrorMsg('Please enter a valid 10-digit Indian mobile number.');
      return;
    }
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const formattedPhone = formatIndianPhone(phone);

      const updated = await api.updateUserProfile({
        fullName: fullName.trim(),
        phone: formattedPhone,
        bloodGroup,
        dateOfBirth,
        gender,
        emergencyContact: emergencyContact.trim(),
      });

      updateUser(updated);
      setSuccessMsg('Profile updated.');
      toast.success('Profile saved');
    } catch (err: any) {
      const msg = err.message || 'Couldn’t update profile. Try again.';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] pb-24 md:pb-16 pb-safe">
      <SubNav title="Profile" width="4xl" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Profile header */}
        <div className="relative overflow-clip rounded-[28px] border border-primary-line/60 bg-gradient-to-br from-[#e3effc] via-[#eef5fd] to-white p-6 sm:p-8 flex items-center gap-4 sm:gap-5">
          <div className="pointer-events-none absolute -top-24 -right-16 w-72 h-72 rounded-full bg-[radial-gradient(closest-side,rgba(0,102,204,0.14),transparent)]" />
          <span className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden bg-gradient-to-br from-[#0066cc] to-[#2997ff] text-white text-2xl sm:text-3xl font-semibold inline-flex items-center justify-center shrink-0 ring-4 ring-white">
            {user?.avatarUrl ? (
              <AvatarImage src={getFileUrl(user.avatarUrl)} name={user.fullName} className="w-full h-full object-cover" />
            ) : (
              (user?.fullName || '?').trim().charAt(0).toUpperCase()
            )}
          </span>
          <div className="relative min-w-0">
            <p className="text-xl sm:text-2xl font-semibold tracking-tight text-[#1d1d1f] truncate">{user?.fullName || 'Patient'}</p>
            <p className="text-sm text-[#6e6e73] truncate">{user?.email}</p>
            <span className="mt-2 inline-flex items-center h-6 px-2.5 rounded-full bg-white border border-primary-line/60 text-[11px] font-semibold text-primary">
              Patient
            </span>
          </div>
        </div>

        {successMsg && (
          <div className="p-3.5 rounded-2xl bg-white border border-[#e5e5ea] text-[#1d1d1f] text-xs font-normal flex items-center gap-2.5 ">
            <CheckCircle2 className="w-4 h-4 text-[#0066cc] shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-danger-soft/80 border border-danger-line/80 text-danger text-xs font-normal flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-danger shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* Personal Information */}
          <UtilityCard title="Personal Information">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full Name"
                  className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                />
              </div>

              <div>
                <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                  Mobile
                </label>
                <div className="flex items-center w-full h-11 rounded-xl border border-[#d2d2d7] bg-white  focus-within:border-[#0066cc] focus-within:ring-4 focus-within:ring-[#0066cc]/10 transition-all duration-150 overflow-hidden">
                  <div className="h-full px-3.5 bg-[#f5f5f7] border-r border-[#d2d2d7] flex items-center justify-center select-none text-base sm:text-xs font-semibold text-[#1d1d1f]">
                    +91
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    required
                    value={sanitizeIndianPhone(phone)}
                    onChange={handlePhoneInputChange}
                    placeholder="98765 43210"
                    maxLength={10}
                    className="w-full h-full px-3.5 text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6] bg-transparent focus:outline-none font-normal tracking-wide"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-normal text-[#86868b] mb-1.5 tracking-tight">
                  Email
                </label>
                <input
                  type="email"
                  disabled
                  value={user?.email || ''}
                  className="w-full h-11 px-3.5 rounded-xl border border-[#e5e5ea] text-base sm:text-sm bg-[#f5f5f7] text-[#86868b] cursor-not-allowed select-none"
                />
              </div>

              <div>
                <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                  Emergency Contact <span className="text-[#86868b] font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                  placeholder="Name and phone"
                  className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                />
              </div>
            </div>
          </UtilityCard>

          {/* Health Details */}
          <UtilityCard title="Health Details">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                  Date of Birth
                </label>
                <input
                  type="date"
                  max={getLocalDateString()}
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm text-[#1d1d1f]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                />
              </div>

              <div>
                <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                  Gender
                </label>
                <div className="p-1 bg-[#f5f5f7] border border-[#e5e5ea] rounded-full grid grid-cols-3 gap-0.5 h-11 select-none">
                  {(['Male', 'Female', 'Other'] as const).map((option) => {
                    const active = gender === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setGender(option)}
                        className={`rounded-full text-[13px] transition-all duration-150 cursor-pointer ${
                          active
                            ? 'bg-white text-[#1d1d1f] font-semibold  border border-black/5'
                            : 'text-[#86868b] hover:text-[#1d1d1f] font-normal'
                        }`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-normal text-[#1d1d1f] mb-1.5 tracking-tight">
                  Blood Group
                </label>
                <div className="relative">
                  <select
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    className={`w-full h-11 pl-3.5 pr-9 rounded-xl border border-[#d2d2d7] bg-white text-base sm:text-sm  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150 appearance-none cursor-pointer ${
                      bloodGroup ? 'text-[#1d1d1f] font-normal' : 'text-[#a1a1a6]'
                    }`}
                  >
                    <option value="">Select</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-[#86868b] pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>
            </div>
          </UtilityCard>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto h-11 px-7 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-sm font-normal transition-all duration-150  flex items-center justify-center gap-2 cursor-pointer select-none disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>

        <ChangePasswordCard />
        <DeleteAccountCard />
      </div>
    </div>
  );
};
