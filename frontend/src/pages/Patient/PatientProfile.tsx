import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api, getLocalDateString } from '../../services/api';
import { UtilityCard } from '../../components/ui/UtilityCard';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
} from 'lucide-react';
import { sanitizeIndianPhone, formatIndianPhone, isValidIndianPhone } from '../../utils/phoneUtils';

export const PatientProfile: React.FC = () => {
  const { user, updateUser } = useAuth();

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
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] pb-16">
      {/* Sleek Apple Header */}
      <div className="bg-white border-b border-[#e5e5ea]/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
          <h1 className="text-[22px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">Profile</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {successMsg && (
          <div className="p-3.5 rounded-2xl bg-white border border-[#e5e5ea] text-[#1d1d1f] text-xs font-medium flex items-center gap-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <CheckCircle2 className="w-4 h-4 text-[#0066cc] shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-rose-50/80 border border-rose-200/80 text-rose-700 text-xs font-medium flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* Personal Information */}
          <UtilityCard title="Personal Information">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full Name"
                  className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-[14px] text-[#1d1d1f] placeholder:text-[#a1a1a6] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                  Mobile Number
                </label>
                <div className="flex items-center w-full h-11 rounded-xl border border-[#d2d2d7] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus-within:border-[#0066cc] focus-within:ring-4 focus-within:ring-[#0066cc]/10 transition-all duration-150 overflow-hidden">
                  <div className="h-full px-3.5 bg-[#f5f5f7] border-r border-[#d2d2d7] flex items-center justify-center select-none text-[13px] font-semibold text-[#1d1d1f]">
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
                    className="w-full h-full px-3.5 text-[14px] text-[#1d1d1f] placeholder:text-[#a1a1a6] bg-transparent focus:outline-none font-medium tracking-wide"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#86868b] mb-1.5 tracking-tight">
                  Email
                </label>
                <input
                  type="email"
                  disabled
                  value={user?.email || ''}
                  className="w-full h-11 px-3.5 rounded-xl border border-[#e5e5ea] text-[14px] bg-[#f5f5f7] text-[#86868b] cursor-not-allowed select-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                  Emergency Contact <span className="text-[#86868b] font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                  placeholder="Optional contact name & number"
                  className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-[14px] text-[#1d1d1f] placeholder:text-[#a1a1a6] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                />
              </div>
            </div>
          </UtilityCard>

          {/* Health Details */}
          <UtilityCard title="Health Details">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                  Date of Birth
                </label>
                <input
                  type="date"
                  max={getLocalDateString()}
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-[14px] text-[#1d1d1f] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
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
                            ? 'bg-white text-[#1d1d1f] font-semibold shadow-xs border border-black/5'
                            : 'text-[#86868b] hover:text-[#1d1d1f] font-medium'
                        }`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                  Blood Group
                </label>
                <div className="relative">
                  <select
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    className={`w-full h-11 pl-3.5 pr-9 rounded-xl border border-[#d2d2d7] bg-white text-[14px] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150 appearance-none cursor-pointer ${
                      bloodGroup ? 'text-[#1d1d1f] font-medium' : 'text-[#a1a1a6]'
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
              className="w-full sm:w-auto h-11 px-7 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-sm font-medium transition-all duration-150 shadow-[0_2px_8px_rgba(0,102,204,0.2),0_1px_2px_rgba(0,0,0,0.06)] flex items-center justify-center gap-2 cursor-pointer select-none disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
