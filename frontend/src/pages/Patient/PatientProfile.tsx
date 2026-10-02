import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { AppleButton } from '../../components/ui/AppleButton';
import { UtilityCard } from '../../components/ui/UtilityCard';
import {
  AlertCircle,
  CheckCircle2,
  Save,
} from 'lucide-react';
import { sanitizeIndianPhone, formatIndianPhone, isValidIndianPhone } from '../../utils/phoneUtils';

export const PatientProfile: React.FC = () => {
  const { user, updateUser } = useAuth();

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [bloodGroup, setBloodGroup] = useState(user?.patientProfile?.bloodGroup || '');
  const [dateOfBirth, setDateOfBirth] = useState(user?.patientProfile?.dateOfBirth || '');
  const [gender, setGender] = useState(user?.patientProfile?.gender || '');
  const [emergencyContact, setEmergencyContact] = useState(user?.patientProfile?.emergencyContact || '');

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handlePhoneInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = sanitizeIndianPhone(e.target.value);
    setPhone(digits ? `+91 ${digits}` : '');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.trim() && !isValidIndianPhone(phone)) {
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
      setSuccessMsg('Profile information saved successfully.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] pb-16">
      {/* Sleek Apple Header */}
      <div className="bg-white border-b border-[#e5e5ea]/80 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0066cc]">Account Identity</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1d1d1f] tracking-tight">Patient Profile & Info</h1>
          <p className="text-xs sm:text-sm text-[#86868b] mt-0.5">Manage your contact details, demographic info, and health preferences</p>
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
                  className="w-full h-11 px-3.5 rounded-xl border border-[#e5e5ea] text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8] transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">
                  Primary Phone Number (India)
                </label>
                <div className="flex rounded-xl border border-[#e5e5ea] overflow-hidden focus-within:ring-2 focus-within:ring-[#0088e8]/20 focus-within:border-[#0088e8] bg-white transition-all">
                  <span className="inline-flex items-center gap-1 px-3 bg-[#f5f5f7] border-r border-[#e5e5ea] text-[#1d1d1f] font-semibold text-xs select-none">
                    <span>🇮🇳</span>
                    <span>+91</span>
                  </span>
                  <input
                    type="tel"
                    value={sanitizeIndianPhone(phone)}
                    onChange={handlePhoneInputChange}
                    placeholder="98765 43210"
                    maxLength={10}
                    className="w-full h-11 px-3.5 text-xs bg-white focus:outline-none tracking-wider font-mono text-[#1d1d1f]"
                  />
                </div>
                <p className="text-[11px] text-[#86868b] mt-1">
                  Standard 10-digit Indian mobile number
                </p>
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
                  className="w-full h-11 px-3.5 rounded-xl border border-[#e5e5ea] text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8] transition-all"
                />
              </div>
            </div>
          </UtilityCard>

          {/* Demographic & Vital Health Details Card */}
          <UtilityCard title="Medical Vitals & Demographics" subtitle="Basic health demographics for consultations">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-[#e5e5ea] text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8] transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">
                  Gender
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-[#e5e5ea] text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8] transition-all cursor-pointer"
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
                  className="w-full h-11 px-3 rounded-xl border border-[#e5e5ea] text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8] transition-all cursor-pointer"
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
              {saving ? 'Saving Profile...' : 'Save Profile'}
            </AppleButton>
          </div>
        </form>
      </div>
    </div>
  );
};
