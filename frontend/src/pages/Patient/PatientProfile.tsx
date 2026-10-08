import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api, getLocalDateString } from '../../services/api';
import { SubNav } from '../../components/layout/SubNav';
import { AppleButton } from '../../components/ui/AppleButton';
import { UtilityCard } from '../../components/ui/UtilityCard';
import {
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
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
      setSuccessMsg('Your profile has been updated.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const userInitial = (fullName || user?.fullName || 'P').trim().charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-[#f5f5f7] pb-20">
      <SubNav
        title="Profile"
        subtitle="Manage your personal details and health profile"
      />

      <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Profile Header Card */}
        <div className="apple-card p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#0066cc] text-white font-bold text-xl sm:text-2xl flex items-center justify-center shrink-0 select-none">
              {userInitial}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-[18px] sm:text-[20px] font-bold text-[#1d1d1f] tracking-tight truncate">
                  {fullName || user?.fullName || 'Patient'}
                </h2>
                <ShieldCheck className="w-4 h-4 text-[#0066cc] shrink-0" />
              </div>
              <p className="text-secondary truncate mt-0.5">{user?.email || 'No email on file'}</p>
              {phone && (
                <p className="text-meta mt-0.5">{formatIndianPhone(phone)}</p>
              )}
            </div>
          </div>

          <div className="self-start sm:self-center shrink-0">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#0066cc]/10 text-[#0066cc]">
              Patient Account
            </span>
          </div>
        </div>

        {/* Feedback Banners */}
        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-900 text-[13px] font-medium flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-4 rounded-xl bg-[#ff3b30]/8 border border-[#ff3b30]/20 text-[#d70015] text-[13px] font-medium flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-[#ff3b30] shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* Personal & Contact Information */}
          <UtilityCard title="Personal & Contact Information">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-2">
              <div>
                <label className="ui-label">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full Name"
                  className="ui-input"
                />
              </div>

              <div>
                <label className="ui-label">Mobile Number</label>
                <div className="flex h-11 rounded-xl border border-[#d2d2d7] overflow-hidden focus-within:ring-[3px] focus-within:ring-[#0066cc]/15 focus-within:border-[#0066cc] bg-white transition-all">
                  <span className="inline-flex items-center justify-center px-3.5 bg-[#f5f5f7] border-r border-[#d2d2d7] text-[#1d1d1f] font-semibold text-sm select-none">
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
                    className="w-full h-full px-3.5 text-sm bg-white focus:outline-none text-[#1d1d1f] placeholder:text-[#86868b]"
                  />
                </div>
              </div>

              <div>
                <label className="ui-label text-[#86868b]">Email Address</label>
                <input
                  type="email"
                  disabled
                  value={user?.email || ''}
                  className="ui-input cursor-not-allowed select-none"
                />
              </div>

              <div>
                <label className="ui-label">
                  Emergency Contact <span className="text-[#86868b] font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                  placeholder="Contact name & phone number"
                  className="ui-input"
                />
              </div>
            </div>
          </UtilityCard>

          {/* Health Details */}
          <UtilityCard title="Health Details">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-2">
              <div>
                <label className="ui-label">Date of Birth</label>
                <input
                  type="date"
                  max={getLocalDateString()}
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="ui-input"
                />
              </div>

              <div>
                <label className="ui-label">Gender</label>
                <div className="grid grid-cols-3 gap-1 p-1 h-11 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea]">
                  {(['Male', 'Female', 'Other'] as const).map((option) => {
                    const active = gender === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setGender(option)}
                        className={`rounded-lg text-[13px] font-semibold transition-all duration-150 cursor-pointer ${
                          active
                            ? 'bg-white text-[#1d1d1f] shadow-2xs'
                            : 'text-[#6e6e73] hover:text-[#1d1d1f]'
                        }`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="ui-label">Blood Group</label>
                <select
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                  className="ui-select"
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

          <div className="flex justify-end pt-1">
            <AppleButton
              type="submit"
              variant="primary"
              size="lg"
              disabled={saving}
              className="w-full sm:w-auto px-8"
            >
              {saving ? 'Saving Changes...' : 'Save Changes'}
            </AppleButton>
          </div>
        </form>
      </div>
    </div>
  );
};
