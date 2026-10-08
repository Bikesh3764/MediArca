import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api, User, DEFAULT_PHONE_PREFIX, getLocalDateString } from '../../services/api';
import { BrandLogo } from '../ui/BrandLogo';
import { SearchableSpecialtySelect } from '../ui/SearchableSpecialtySelect';
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
  RefreshCw,
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="bg-white/95 backdrop-blur-2xl rounded-t-[28px] sm:rounded-[28px] border border-[#e5e5ea] shadow-[0_24px_64px_rgba(0,0,0,0.12),0_4px_16px_rgba(0,0,0,0.04)] max-w-[450px] w-full max-h-[92vh] sm:max-h-[95vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] p-6 sm:p-7 pb-[max(env(safe-area-inset-bottom),1.5rem)] sm:pb-7 relative animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-2 duration-300">
        {/* Apple Sheet Drag Handle Indicator (Mobile Only) */}
        <div className="sm:hidden w-10 h-1 bg-[#d2d2d7] rounded-full mx-auto mb-4" />

        {/* Brand & Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="mb-2.5">
            <BrandLogo variant="full" size="md" imgClassName="h-7 w-auto object-contain mx-auto" />
          </div>

          <h2 className="text-[22px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">
            {user.role === 'PATIENT' && 'Activate Your Patient Profile'}
            {user.role === 'DOCTOR' && 'Set Up Practitioner Credentials'}
            {user.role === 'CLINIC' && 'Complete Clinic Facility Details'}
          </h2>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5 font-medium animate-fadeIn">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span>Profile setup complete! Loading your console...</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <div>
            <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
              Full Name
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full legal name"
              className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-[14px] text-[#1d1d1f] placeholder:text-[#a1a1a6] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
            />
          </div>

          {/* Mobile Number (+91 Locked) */}
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
                required
                inputMode="numeric"
                maxLength={10}
                value={sanitizeIndianPhone(phone)}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setPhone(digits ? `+91 ${digits}` : '');
                }}
                placeholder="98765 43210"
                className="flex-1 h-full px-3.5 bg-transparent text-[14px] text-[#1d1d1f] placeholder:text-[#a1a1a6] focus:outline-none"
              />
            </div>
          </div>

          {/* PATIENT ROLE FIELDS */}
          {user.role === 'PATIENT' && (
            <>
              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                  Gender
                </label>
                <div className="p-1 bg-[#f5f5f7] border border-[#e5e5ea] rounded-xl flex gap-1 select-none">
                  {(['Male', 'Female', 'Other'] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g)}
                      className={`flex-1 py-2 text-xs rounded-lg transition-all duration-150 cursor-pointer text-center ${
                        gender === g
                          ? 'bg-white text-[#1d1d1f] font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_1px_rgba(0,0,0,0.04)] border border-black/5'
                          : 'text-[#86868b] hover:text-[#1d1d1f] font-medium'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    required
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    max={getLocalDateString()}
                    className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-[13px] text-[#1d1d1f] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                    Blood Group <span className="text-[#86868b] font-normal">(Optional)</span>
                  </label>
                  <div className="relative">
                    <select
                      value={bloodGroup}
                      onChange={(e) => setBloodGroup(e.target.value)}
                      className="w-full h-11 pl-3.5 pr-8 rounded-xl border border-[#d2d2d7] bg-white text-[13px] text-[#1d1d1f] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150 appearance-none cursor-pointer"
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
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                  Medical Qualifications
                </label>
                <input
                  type="text"
                  required
                  value={qualifications}
                  onChange={(e) => setQualifications(e.target.value)}
                  placeholder="e.g. MBBS, MD"
                  className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-[14px] text-[#1d1d1f] placeholder:text-[#a1a1a6] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
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
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
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
                  className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-[14px] text-[#1d1d1f] placeholder:text-[#a1a1a6] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                />
              </div>
            </>
          )}

          {/* CLINIC ROLE FIELDS */}
          {user.role === 'CLINIC' && (
            <>
              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                  Official Clinic Facility Name
                </label>
                <input
                  type="text"
                  required
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                  placeholder="e.g. City Health PolyClinic & Diagnostics"
                  className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-[14px] text-[#1d1d1f] placeholder:text-[#a1a1a6] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                    State / UT
                  </label>
                  <div className="relative">
                    <select
                      required
                      value={state}
                      onChange={(e) => handleStateChange(e.target.value)}
                      className="w-full h-11 pl-3.5 pr-8 rounded-xl border border-[#d2d2d7] bg-white text-[13px] text-[#1d1d1f] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150 appearance-none cursor-pointer"
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
                  <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                    City / Town
                  </label>
                  <div className="relative">
                    <select
                      required={!isCustomCity}
                      disabled={!state}
                      value={isCustomCity ? '__custom__' : city}
                      onChange={(e) => handleCitySelect(e.target.value)}
                      className="w-full h-11 pl-3.5 pr-8 rounded-xl border border-[#d2d2d7] bg-white text-[13px] text-[#1d1d1f] disabled:opacity-50 shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150 appearance-none cursor-pointer"
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
                  <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
                    Enter City Name
                  </label>
                  <input
                    type="text"
                    required
                    value={customCity}
                    onChange={(e) => setCustomCity(e.target.value)}
                    placeholder="Enter your town or city"
                    className="w-full h-11 px-3.5 rounded-xl border border-[#d2d2d7] bg-white text-[14px] text-[#1d1d1f] placeholder:text-[#a1a1a6] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 tracking-tight">
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
                    className="w-full h-11 pl-10 pr-3.5 rounded-xl border border-[#d2d2d7] bg-white text-[14px] text-[#1d1d1f] placeholder:text-[#a1a1a6] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                  />
                </div>
              </div>
            </>
          )}

          {/* Action Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting || success}
              className="w-full h-11 px-6 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-sm font-medium transition-all duration-150 shadow-[0_2px_8px_rgba(0,102,204,0.2),0_1px_2px_rgba(0,0,0,0.06)] flex items-center justify-center gap-2 cursor-pointer select-none disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving Profile...</span>
                </>
              ) : success ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Profile Saved!</span>
                </>
              ) : (
                'Save & Complete Setup'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
