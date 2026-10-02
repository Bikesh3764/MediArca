import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api, User } from '../../services/api';
import { AppleButton } from '../ui/AppleButton';
import { BrandLogo } from '../ui/BrandLogo';
import { SearchableSpecialtySelect } from '../ui/SearchableSpecialtySelect';
import { INDIAN_STATES, getCitiesForState } from '../../utils/indiaStates';
import { DEFAULT_PHONE_PREFIX } from '../../services/api';
import {
  sanitizeIndianPhone,
  formatIndianPhone,
  isValidIndianPhone,
} from '../../utils/phoneUtils';
import {
  UserCheck,
  Stethoscope,
  Building2,
  AlertCircle,
  CheckCircle2,
  Phone,
  Sparkles,
  MapPin,
  X,
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
  const [dismissed, setDismissed] = useState(false);
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

      const sessionDismissed = sessionStorage.getItem(`profile_dismissed_${user.id}`);
      if (sessionDismissed === 'true') {
        setDismissed(true);
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

  if (!isOpen || !user || dismissed) return null;

  const handleDismiss = () => {
    if (user) {
      sessionStorage.setItem(`profile_dismissed_${user.id}`, 'true');
    }
    setDismissed(true);
    setIsOpen(false);
  };

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fadeIn">
      <div className="bg-white rounded-[28px] border border-[#e5e5ea] shadow-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto p-6 sm:p-8 relative">
        {/* Close / Dismiss */}
        <button
          onClick={handleDismiss}
          className="absolute top-5 right-5 p-2 rounded-full text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#f5f5f7] transition-all"
          title="Remind me later"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand & Badge Header */}
        <div className="text-center mb-6">
          <BrandLogo variant="full" size="md" imgClassName="h-7 w-auto mx-auto mb-3" />
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0088e8]/10 text-[#0088e8] text-xs font-semibold mb-3 border border-[#0088e8]/20">
            {user.role === 'PATIENT' && <UserCheck className="w-3.5 h-3.5" />}
            {user.role === 'DOCTOR' && <Stethoscope className="w-3.5 h-3.5" />}
            {user.role === 'CLINIC' && <Building2 className="w-3.5 h-3.5" />}
            <span>
              {user.role === 'PATIENT' && 'Complete Patient Setup'}
              {user.role === 'DOCTOR' && 'Complete Doctor Setup'}
              {user.role === 'CLINIC' && 'Complete Clinic Setup'}
            </span>
          </div>
          <h2 className="text-2xl font-semibold text-[#1d1d1f] tracking-tight">
            {user.role === 'PATIENT' && 'Activate Your Patient Profile'}
            {user.role === 'DOCTOR' && 'Set Up Practitioner Credentials'}
            {user.role === 'CLINIC' && 'Complete Clinic Facility Details'}
          </h2>
          <p className="text-xs sm:text-sm text-[#86868b] mt-1.5 leading-relaxed max-w-sm mx-auto">
            {user.role === 'PATIENT' && 'Enter your mobile number and details to enable seamless appointment bookings and live queue passes.'}
            {user.role === 'DOCTOR' && 'Provide your degrees and practice details so patients and clinics can discover and book with you.'}
            {user.role === 'CLINIC' && 'Provide your official clinic facility name and location to activate your partner desk.'}
          </p>

          {/* User ID Pill */}
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] text-[11px] text-[#48484a]">
            <Sparkles className="w-3 h-3 text-[#0088e8]" />
            <span>Signed in as <strong className="text-[#1d1d1f]">{user.email}</strong></span>
          </div>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5 font-medium animate-fadeIn">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span>Profile setup complete! Loading your console...</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <div>
            <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
              Full Name
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full legal name"
              className="w-full h-11 px-4 rounded-xl border border-[#e5e5ea] text-[14px] bg-[#f5f5f7] focus:bg-white text-[#1d1d1f] transition-all focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8]"
            />
          </div>

          {/* Mobile Number (+91) */}
          <div>
            <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
              Indian Mobile Number (+91)
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-[#86868b] absolute left-3.5 top-3.5" />
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full h-11 pl-10 pr-4 rounded-xl border border-[#e5e5ea] text-[14px] bg-[#f5f5f7] focus:bg-white text-[#1d1d1f] font-mono transition-all focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8]"
              />
            </div>
            <p className="text-[11px] text-[#86868b] mt-1">
              Used for live queue token updates and appointment verification.
            </p>
          </div>

          {/* PATIENT ROLE FIELDS */}
          {user.role === 'PATIENT' && (
            <>
              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5">
                  Gender
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Male', 'Female', 'Other'] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g)}
                      className={`py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                        gender === g
                          ? 'bg-[#0088e8] text-white border-[#0088e8] shadow-2xs'
                          : 'bg-[#f5f5f7] text-[#1d1d1f] border-[#e5e5ea] hover:bg-white'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    required
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full h-11 px-3 rounded-xl border border-[#e5e5ea] text-[13px] bg-[#f5f5f7] focus:bg-white text-[#1d1d1f] transition-all focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                    Blood Group (Optional)
                  </label>
                  <select
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-[#e5e5ea] text-[13px] bg-[#f5f5f7] focus:bg-white text-[#1d1d1f] transition-all focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8]"
                  >
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          {/* DOCTOR ROLE FIELDS */}
          {user.role === 'DOCTOR' && (
            <>
              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                  Medical Qualifications
                </label>
                <input
                  type="text"
                  required
                  value={qualifications}
                  onChange={(e) => setQualifications(e.target.value)}
                  placeholder="e.g. MBBS, MD (General Medicine), DNB"
                  className="w-full h-11 px-4 rounded-xl border border-[#e5e5ea] text-[14px] bg-[#f5f5f7] focus:bg-white text-[#1d1d1f] transition-all focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
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
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
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
                  className="w-full h-11 px-4 rounded-xl border border-[#e5e5ea] text-[14px] bg-[#f5f5f7] focus:bg-white text-[#1d1d1f] transition-all focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8]"
                />
              </div>
            </>
          )}

          {/* CLINIC ROLE FIELDS */}
          {user.role === 'CLINIC' && (
            <>
              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                  Official Clinic Facility Name
                </label>
                <input
                  type="text"
                  required
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                  placeholder="e.g. City Health PolyClinic & Diagnostics"
                  className="w-full h-11 px-4 rounded-xl border border-[#e5e5ea] text-[14px] bg-[#f5f5f7] focus:bg-white text-[#1d1d1f] transition-all focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                    State / UT
                  </label>
                  <select
                    required
                    value={state}
                    onChange={(e) => handleStateChange(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-[#e5e5ea] text-[13px] bg-[#f5f5f7] focus:bg-white text-[#1d1d1f] transition-all focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8]"
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
                  <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                    City / Town
                  </label>
                  <select
                    required={!isCustomCity}
                    disabled={!state}
                    value={isCustomCity ? '__custom__' : city}
                    onChange={(e) => handleCitySelect(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-[#e5e5ea] text-[13px] bg-[#f5f5f7] focus:bg-white text-[#1d1d1f] disabled:opacity-50 transition-all focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8]"
                  >
                    <option value="">Select City</option>
                    {stateCities.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    <option value="__custom__">+ Other / Not Listed</option>
                  </select>
                </div>
              </div>

              {isCustomCity && (
                <div>
                  <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                    Enter City Name
                  </label>
                  <input
                    type="text"
                    required
                    value={customCity}
                    onChange={(e) => setCustomCity(e.target.value)}
                    placeholder="Enter your town or city"
                    className="w-full h-11 px-4 rounded-xl border border-[#e5e5ea] text-[14px] bg-[#f5f5f7] focus:bg-white text-[#1d1d1f] transition-all focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8]"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                  Street Address
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-[#86868b] absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Floor, building, street, landmark"
                    className="w-full h-11 pl-10 pr-4 rounded-xl border border-[#e5e5ea] text-[14px] bg-[#f5f5f7] focus:bg-white text-[#1d1d1f] transition-all focus:outline-none focus:ring-2 focus:ring-[#0088e8]/20 focus:border-[#0088e8]"
                  />
                </div>
              </div>
            </>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
            <AppleButton
              type="submit"
              variant="primary"
              size="lg"
              disabled={submitting || success}
              className="w-full sm:flex-1"
            >
              {submitting ? 'Saving Profile...' : success ? 'Saved!' : 'Save & Complete Setup'}
            </AppleButton>
            <button
              type="button"
              onClick={handleDismiss}
              className="w-full sm:w-auto px-4 py-2.5 rounded-full text-xs font-medium text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#f5f5f7] transition-all text-center"
            >
              Remind Me Later
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
