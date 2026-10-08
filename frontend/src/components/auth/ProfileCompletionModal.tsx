import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api, User, DEFAULT_PHONE_PREFIX, getLocalDateString } from '../../services/api';
import { BrandLogo } from '../ui/BrandLogo';
import { SearchableSpecialtySelect } from '../ui/SearchableSpecialtySelect';
import { AppleButton } from '../ui/AppleButton';
import { INDIAN_STATES, getCitiesForState } from '../../utils/indiaStates';
import {
  sanitizeIndianPhone,
  formatIndianPhone,
  isValidIndianPhone,
} from '../../utils/phoneUtils';
import {
  AlertCircle,
  CheckCircle2,
  MapPin,
  ChevronDown,
} from 'lucide-react';

// oxlint-disable-next-line react/only-export-components
export const isUserProfileIncomplete = (user: User | null): boolean => {
  if (!user) return false;
  if (user.role === 'PATIENT') {
    return (
      !user.phone ||
      !user.patientProfile?.gender ||
      !user.patientProfile?.dateOfBirth
    );
  }
  if (user.role === 'DOCTOR') {
    return (
      !user.phone ||
      !user.doctorProfile?.qualifications ||
      user.doctorProfile?.qualifications === 'Medical Practitioner' ||
      !user.doctorProfile?.specialty ||
      !user.doctorProfile?.experienceYears
    );
  }
  if (user.role === 'CLINIC') {
    return (
      !user.phone ||
      !user.clinicProfile?.address ||
      !user.clinicProfile?.city ||
      !user.clinicProfile?.state
    );
  }
  return false;
};

export const ProfileCompletionModal: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Common Fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState(DEFAULT_PHONE_PREFIX);

  // Patient Fields
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [bloodGroup, setBloodGroup] = useState('O+');

  // Doctor Fields
  const [qualifications, setQualifications] = useState('');
  const [specialty, setSpecialty] = useState('General Medicine');
  const [customSpecialty, setCustomSpecialty] = useState('');
  const [experienceYears, setExperienceYears] = useState('5');

  // Clinic Fields
  const [clinicName, setClinicName] = useState('');
  const [address, setAddress] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [isCustomCity, setIsCustomCity] = useState(false);
  const [customCity, setCustomCity] = useState('');

  const stateCities = state ? getCitiesForState(state) : [];

  useEffect(() => {
    queueMicrotask(() => {
      if (!user) {
        setIsOpen(false);
        return;
      }

      if (isUserProfileIncomplete(user)) {
        setIsOpen(true);
        // Pre-populate fields
        setFullName(user.fullName || '');
        setPhone(user.phone ? formatIndianPhone(user.phone) : DEFAULT_PHONE_PREFIX);

        if (user.role === 'PATIENT') {
          if (user.patientProfile?.gender) {
            setGender((user.patientProfile.gender as any) || 'Male');
          }
          if (user.patientProfile?.dateOfBirth) {
            setDateOfBirth(user.patientProfile.dateOfBirth.split('T')[0]);
          }
          if (user.patientProfile?.bloodGroup) {
            setBloodGroup(user.patientProfile.bloodGroup);
          }
        } else if (user.role === 'DOCTOR') {
          if (user.doctorProfile?.qualifications && user.doctorProfile.qualifications !== 'Medical Practitioner') {
            setQualifications(user.doctorProfile.qualifications);
          }
          if (user.doctorProfile?.specialty) {
            setSpecialty(user.doctorProfile.specialty);
          }
          if (user.doctorProfile?.experienceYears) {
            setExperienceYears(String(user.doctorProfile.experienceYears));
          }
        } else if (user.role === 'CLINIC') {
          if (user.clinicProfile?.clinicName) {
            setClinicName(user.clinicProfile.clinicName);
          } else {
            setClinicName(user.fullName || '');
          }
          if (user.clinicProfile?.address) {
            setAddress(user.clinicProfile.address);
          }
          if (user.clinicProfile?.state) {
            setState(user.clinicProfile.state);
          }
          if (user.clinicProfile?.city) {
            setCity(user.clinicProfile.city);
          }
        }
      } else {
        setIsOpen(false);
      }
    });
  }, [user]);

  if (!isOpen || !user) return null;

  const handleStateChange = (newState: string) => {
    setState(newState);
    setCity('');
    setIsCustomCity(false);
    setCustomCity('');
  };

  const handleCitySelect = (val: string) => {
    if (val === '__custom__') {
      setIsCustomCity(true);
      setCity(customCity);
    } else {
      setIsCustomCity(false);
      setCity(val);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate phone
    const rawDigits = sanitizeIndianPhone(phone);
    if (!rawDigits || !isValidIndianPhone(phone)) {
      setError('Please enter a valid 10-digit Indian mobile number (+91).');
      return;
    }

    const payload: any = {
      fullName: fullName.trim() || user.fullName,
      phone: formatIndianPhone(phone),
    };

    if (user.role === 'PATIENT') {
      if (!gender) {
        setError('Please select your gender.');
        return;
      }
      if (!dateOfBirth) {
        setError('Please enter your date of birth.');
        return;
      }
      payload.gender = gender;
      payload.dateOfBirth = dateOfBirth;
      payload.bloodGroup = bloodGroup;
    } else if (user.role === 'DOCTOR') {
      if (!qualifications.trim()) {
        setError('Please enter your medical qualifications (e.g. MBBS, MD).');
        return;
      }
      const finalSpecialty = specialty === 'Other' ? customSpecialty.trim() : specialty;
      if (!finalSpecialty) {
        setError('Please select or specify your primary medical specialty.');
        return;
      }
      payload.qualifications = qualifications.trim();
      payload.specialty = finalSpecialty;
      payload.experienceYears = Number(experienceYears) || 1;
    } else if (user.role === 'CLINIC') {
      if (!clinicName.trim()) {
        setError('Please enter your official clinic facility name.');
        return;
      }
      if (!state) {
        setError('Please select the state where your clinic is located.');
        return;
      }
      const finalCity = isCustomCity ? customCity.trim() : city.trim();
      if (!finalCity) {
        setError('Please select or enter your clinic city.');
        return;
      }
      if (!address.trim()) {
        setError('Please enter the clinic street address.');
        return;
      }
      payload.clinicName = clinicName.trim();
      payload.state = state;
      payload.city = finalCity;
      payload.address = address.trim();
    }

    setSubmitting(true);
    try {
      const updatedUser = await api.updateProfile(payload);
      updateUser(updatedUser);
      setSuccess(true);
      if (user) {
        sessionStorage.setItem(`profile_dismissed_${user.id}`, 'true');
      }
      setTimeout(() => {
        setIsOpen(false);
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-[440px] bg-white/95 backdrop-blur-xl rounded-t-[24px] sm:rounded-[24px] border border-[#e5e5ea] shadow-apple-float p-6 sm:p-8 pb-[max(env(safe-area-inset-bottom),1.5rem)] sm:pb-8 max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
        {/* Mobile Sheet Drag Handle */}
        <div className="sm:hidden w-10 h-1 bg-[#d2d2d7] rounded-full mx-auto mb-4" />

        {/* Brand & Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="mb-3">
            <BrandLogo variant="full" size="md" imgClassName="h-7 w-auto object-contain mx-auto" />
          </div>

          <h2 className="text-section-title">
            {user.role === 'PATIENT' && 'Complete Your Patient Profile'}
            {user.role === 'DOCTOR' && 'Complete Practitioner Credentials'}
            {user.role === 'CLINIC' && 'Complete Clinic Facility Details'}
          </h2>
          <p className="text-secondary mt-1">
            Please verify a few essential details before continuing.
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-[#ff3b30]/8 border border-[#ff3b30]/20 text-[#d70015] text-[13px] flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#ff3b30]" />
            <span className="leading-snug">{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-5 p-3.5 rounded-xl bg-[#1d8348]/8 border border-[#1d8348]/20 text-[#1d8348] text-[13px] flex items-start gap-2.5 font-medium">
            <CheckCircle2 className="w-4 h-4 text-[#1d8348] shrink-0 mt-0.5" />
            <span className="leading-snug">Profile setup complete! Loading your console...</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="ui-form-stack">
          {/* Full Name */}
          <div>
            <label className="ui-label">
              Full Name
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full legal name"
              className="ui-input"
            />
          </div>

          {/* Mobile Number (+91 Locked) */}
          <div>
            <label className="ui-label">
              Mobile Number
            </label>
            <div className="flex items-center w-full h-11 rounded-xl border border-[#d2d2d7] bg-white focus-within:border-[#0066cc] focus-within:ring-3 focus-within:ring-[#0066cc]/12 transition-all duration-150 overflow-hidden">
              <div className="h-full px-3.5 bg-[#f5f5f7] border-r border-[#d2d2d7] flex items-center justify-center select-none text-[13px] font-semibold text-[#1d1d1f]">
                +91
              </div>
              <input
                type="tel"
                required
                inputMode="numeric"
                maxLength={10}
                value={sanitizeIndianPhone(phone)}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setPhone(digits ? `+91 ${digits}` : '');
                }}
                placeholder="98765 43210"
                className="flex-1 h-full px-3.5 bg-transparent text-[14px] text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none"
              />
            </div>
          </div>

          {/* PATIENT ROLE FIELDS */}
          {user.role === 'PATIENT' && (
            <>
              <div>
                <label className="ui-label">
                  Gender
                </label>
                <div className="p-1 bg-[#f5f5f7] border border-[#e5e5ea] rounded-xl flex gap-1 select-none">
                  {(['Male', 'Female', 'Other'] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g)}
                      className={`flex-1 h-9 text-[13px] rounded-lg transition-all duration-150 cursor-pointer text-center ${
                        gender === g
                          ? 'bg-white text-[#1d1d1f] font-semibold shadow-xs border border-black/5'
                          : 'text-[#6e6e73] hover:text-[#1d1d1f] font-medium'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="ui-label">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    required
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    max={getLocalDateString()}
                    className="ui-input"
                  />
                </div>

                <div>
                  <label className="ui-label">
                    Blood Group <span className="text-[#86868b] font-normal">(Optional)</span>
                  </label>
                  <div className="relative">
                    <select
                      value={bloodGroup}
                      onChange={(e) => setBloodGroup(e.target.value)}
                      className="ui-select pr-9"
                    >
                      {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                        <option key={bg} value={bg}>
                          {bg}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-[#86868b] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* DOCTOR ROLE FIELDS */}
          {user.role === 'DOCTOR' && (
            <>
              <div>
                <label className="ui-label">
                  Medical Qualifications
                </label>
                <input
                  type="text"
                  required
                  value={qualifications}
                  onChange={(e) => setQualifications(e.target.value)}
                  placeholder="e.g. MBBS, MD"
                  className="ui-input"
                />
              </div>

              <div>
                <label className="ui-label">
                  Medical Specialty
                </label>
                <SearchableSpecialtySelect
                  value={specialty}
                  onChange={setSpecialty}
                  allowOther={true}
                  customValue={customSpecialty}
                  onCustomChange={setCustomSpecialty}
                />
              </div>

              <div>
                <label className="ui-label">
                  Years of Clinical Experience
                </label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  required
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(e.target.value)}
                  placeholder="e.g. 8"
                  className="ui-input"
                />
              </div>
            </>
          )}

          {/* CLINIC ROLE FIELDS */}
          {user.role === 'CLINIC' && (
            <>
              <div>
                <label className="ui-label">
                  Official Clinic Facility Name
                </label>
                <input
                  type="text"
                  required
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                  placeholder="e.g. City Health PolyClinic & Diagnostics"
                  className="ui-input"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="ui-label">
                    State / UT
                  </label>
                  <div className="relative">
                    <select
                      required
                      value={state}
                      onChange={(e) => handleStateChange(e.target.value)}
                      className="ui-select pr-9"
                    >
                      <option value="">Select State</option>
                      {INDIAN_STATES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-[#86868b] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="ui-label">
                    City / Town
                  </label>
                  <div className="relative">
                    <select
                      required={!isCustomCity}
                      disabled={!state}
                      value={isCustomCity ? '__custom__' : city}
                      onChange={(e) => handleCitySelect(e.target.value)}
                      className="ui-select pr-9"
                    >
                      <option value="">Select City</option>
                      {stateCities.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                      <option value="__custom__">+ Other / Not Listed</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-[#86868b] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>

              {isCustomCity && (
                <div>
                  <label className="ui-label">
                    Enter City Name
                  </label>
                  <input
                    type="text"
                    required
                    value={customCity}
                    onChange={(e) => setCustomCity(e.target.value)}
                    placeholder="Enter your town or city"
                    className="ui-input"
                  />
                </div>
              )}

              <div>
                <label className="ui-label">
                  Street Address
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-[#86868b] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Floor, building, street, landmark"
                    className="ui-input pl-10"
                  />
                </div>
              </div>
            </>
          )}

          {/* Action Button */}
          <div className="pt-2">
            <AppleButton
              type="submit"
              variant="primary"
              size="lg"
              disabled={submitting || success}
              className="w-full"
            >
              {submitting
                ? 'Saving Profile...'
                : success
                  ? 'Profile Saved!'
                  : 'Save & Complete Setup'}
            </AppleButton>
          </div>
        </form>
      </div>
    </div>
  );
};
