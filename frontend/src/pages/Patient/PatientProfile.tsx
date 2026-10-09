import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api, getLocalDateString } from '../../services/api';
import { AppleButton } from '../../components/ui/AppleButton';
import { UtilityCard } from '../../components/ui/UtilityCard';
import {
  AlertCircle,
  CheckCircle2,
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
          <h1 className="text-2xl font-bold text-[#1d1d1f] tracking-tight">Profile</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
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
          {/* Personal Information */}
          <UtilityCard title="Personal Information">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
              <div>
                <label className="block text-[13px] font-medium text-[#1d1d1f] tracking-[-0.01em] mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full Name"
                  className="w-full h-11 px-3.5 rounded-[12px] border border-[#d2d2d7] text-[15px] tracking-[-0.015em] bg-white text-[#1d1d1f] focus:outline-none focus:ring-[3px] focus:ring-[#0066cc]/15 focus:border-[#0066cc] transition-all"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#1d1d1f] tracking-[-0.01em] mb-1.5">
                  Mobile Number
                </label>
                <div className="flex h-11 rounded-[12px] border border-[#d2d2d7] overflow-hidden focus-within:ring-[3px] focus-within:ring-[#0066cc]/15 focus-within:border-[#0066cc] bg-white transition-all">
                  <span className="inline-flex items-center justify-center px-3.5 bg-[#f5f5f7] border-r border-[#d2d2d7] text-[#1d1d1f] font-semibold text-[15px] tracking-[-0.01em] select-none">
                    +91
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    required
                    value={sanitizeIndianPhone(phone)}
                    onChange={handlePhoneInputChange}
                    placeholder="98765 43210"
                    maxLength={10}
                    className="w-full h-full px-3.5 text-[15px] tracking-[-0.015em] bg-white focus:outline-none text-[#1d1d1f] placeholder:text-[#86868b]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#86868b] tracking-[-0.01em] mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  disabled
                  value={user?.email || ''}
                  className="w-full h-11 px-3.5 rounded-[12px] border border-[#e5e5ea] text-[14px] tracking-[-0.01em] bg-[#f5f5f7] text-[#86868b] cursor-not-allowed select-none"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#1d1d1f] tracking-[-0.01em] mb-1.5">
                  Emergency Contact
                </label>
                <input
                  type="text"
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                  placeholder="Optional contact name & number"
                  className="w-full h-11 px-3.5 rounded-[12px] border border-[#d2d2d7] text-[15px] tracking-[-0.015em] bg-white text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-[3px] focus:ring-[#0066cc]/15 focus:border-[#0066cc] transition-all"
                />
              </div>
            </div>
          </UtilityCard>

          {/* Health Details */}
          <UtilityCard title="Health Details">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
              <div>
                <label className="block text-[13px] font-medium text-[#1d1d1f] tracking-[-0.01em] mb-1.5">
                  Date of Birth
                </label>
                <input
                  type="date"
                  max={getLocalDateString()}
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-[12px] border border-[#d2d2d7] text-[14px] tracking-[-0.01em] bg-white text-[#1d1d1f] focus:outline-none focus:ring-[3px] focus:ring-[#0066cc]/15 focus:border-[#0066cc] transition-all"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#1d1d1f] tracking-[-0.01em] mb-1.5">
                  Gender
                </label>
                <div className="grid grid-cols-3 gap-1 p-1 h-11 rounded-[12px] bg-[#f5f5f7] border border-[#e5e5ea]">
                  {(['Male', 'Female', 'Other'] as const).map((option) => {
                    const active = gender === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setGender(option)}
                        className={`rounded-[9px] text-[13px] font-semibold tracking-[-0.01em] transition-all duration-150 ${
                          active
                            ? 'bg-white text-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                            : 'text-[#86868b] hover:text-[#1d1d1f]'
                        }`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#1d1d1f] tracking-[-0.01em] mb-1.5">
                  Blood Group
                </label>
                <select
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                  className="w-full h-11 px-3 rounded-[12px] border border-[#d2d2d7] text-[14px] tracking-[-0.01em] bg-white text-[#1d1d1f] focus:outline-none focus:ring-[3px] focus:ring-[#0066cc]/15 focus:border-[#0066cc] transition-all cursor-pointer"
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
              </div>
            </div>
          </UtilityCard>

          <div className="flex justify-end pt-2">
            <AppleButton
              type="submit"
              variant="primary"
              size="md"
              disabled={saving}
              className="px-7 py-2.5 font-semibold text-[13px] tracking-tight shadow-none w-full sm:w-auto"
            >
              {saving ? 'Saving...' : 'Save'}
            </AppleButton>
          </div>
        </form>
      </div>
    </div>
  );
};
