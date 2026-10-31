import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ALL_SPECIALTIES } from '@mediarca/shared/api';
import { formatIndianPhone, isValidIndianPhone, sanitizeIndianPhone } from '@mediarca/shared/utils/phoneUtils';
import { getCitiesForState, INDIAN_STATES } from '@mediarca/shared/utils/indiaStates';
import { Button, Card, Field, LinkText, Notice, Screen, Segmented, SelectField, Title } from '@/components/ui';
import { homeFor, useAuth } from '@/context/AuthContext';
import { parseRole } from '@/lib/roles';

type SignupRole = 'PATIENT' | 'DOCTOR' | 'CLINIC';
const SPECIALTY_OPTIONS = [...ALL_SPECIALTIES, 'Other'];

export default function Signup() {
  const params = useLocalSearchParams<{ role?: string }>();
  const initial = parseRole(params.role);
  const [role, setRole] = useState<SignupRole>(initial === 'DOCTOR' || initial === 'CLINIC' ? initial : 'PATIENT');
  const { register } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  // Doctor
  const [qualifications, setQualifications] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [customSpecialty, setCustomSpecialty] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  // Clinic
  const [address, setAddress] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!fullName.trim() || !email.trim()) {
      setError(role === 'CLINIC' ? 'Enter the clinic name and email.' : 'Enter your name and email.');
      return;
    }
    if (role === 'CLINIC' && !address.trim()) {
      setError('Enter the clinic address.');
      return;
    }
    if (role === 'CLINIC' && !state) {
      setError('Choose your state.');
      return;
    }
    if (role === 'DOCTOR' && !specialty) {
      setError('Choose your specialty.');
      return;
    }
    if (!isValidIndianPhone(phone)) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }
    if (password.trim().length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setError(null);
    setSubmitting(true);

    const cleanEmail = email.trim().toLowerCase();
    let payload: Record<string, unknown>;
    if (role === 'CLINIC') {
      payload = {
        role,
        fullName: fullName.trim(),
        clinicName: fullName.trim(),
        address: address.trim(),
        city: city || undefined,
        state: state || undefined,
        phone: formatIndianPhone(phone),
        email: cleanEmail,
        password,
      };
    } else {
      payload = { role, fullName: fullName.trim(), email: cleanEmail, password, phone: formatIndianPhone(phone) };
      if (role === 'DOCTOR') {
        payload.specialty = specialty === 'Other' ? customSpecialty.trim() || 'General Medicine' : specialty;
        payload.qualifications = qualifications.trim() || 'MBBS, MD';
        payload.experienceYears = Number(experienceYears) || 1;
        payload.consultationFee = 0;
        payload.checkingStartTime = '09:00';
        payload.checkingEndTime = '17:00';
      }
    }

    try {
      const res = await register(payload);
      if (res.requiresVerification && res.email) {
        router.push({ pathname: '/verify', params: { email: res.email, role } });
        return;
      }
      if (res.user) router.replace(homeFor(res.user));
    } catch (err: any) {
      setError(err?.message || 'Couldn’t create the account. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen back="/welcome">
      <Title>Create account</Title>
      <Segmented
        options={[
          { value: 'PATIENT', label: 'Patient' },
          { value: 'DOCTOR', label: 'Doctor' },
          { value: 'CLINIC', label: 'Clinic' },
        ]}
        value={role}
        onChange={(r) => {
          setRole(r);
          setError(null);
        }}
      />
      <Card>
        <Field
          label={role === 'CLINIC' ? 'Clinic name' : 'Full name'}
          value={fullName}
          onChangeText={setFullName}
          autoCapitalize="words"
          autoComplete={role === 'CLINIC' ? 'off' : 'name'}
          placeholder={role === 'DOCTOR' ? 'Dr. First Last' : role === 'CLINIC' ? 'Clinic name' : 'Your full name'}
        />
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          placeholder="you@example.com"
        />
        <Field
          label="Mobile"
          prefix="+91"
          value={phone}
          onChangeText={(t) => setPhone(sanitizeIndianPhone(t))}
          keyboardType="phone-pad"
          autoComplete="tel"
          maxLength={10}
          placeholder="10-digit number"
        />
        {role === 'CLINIC' ? (
          <>
            <Field label="Address" value={address} onChangeText={setAddress} placeholder="Street, area" />
            <SelectField
              label="State"
              value={state}
              options={INDIAN_STATES}
              onChange={(s) => {
                setState(s);
                setCity('');
              }}
            />
            <SelectField
              label="City"
              value={city}
              options={state ? getCitiesForState(state) : []}
              onChange={setCity}
              placeholder={state ? 'Choose' : 'Choose state first'}
              disabled={!state}
            />
          </>
        ) : null}
        {role === 'DOCTOR' ? (
          <>
            <Field label="Qualifications" value={qualifications} onChangeText={setQualifications} placeholder="e.g. MBBS, MD" />
            <SelectField label="Specialty" value={specialty} options={SPECIALTY_OPTIONS} onChange={setSpecialty} />
            {specialty === 'Other' ? (
              <Field label="Your specialty" value={customSpecialty} onChangeText={setCustomSpecialty} />
            ) : null}
            <Field
              label="Experience (years)"
              value={experienceYears}
              onChangeText={(t) => setExperienceYears(t.replace(/\D/g, '').slice(0, 2))}
              keyboardType="number-pad"
              placeholder="e.g. 5"
            />
          </>
        ) : null}
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secure
          autoComplete="new-password"
          textContentType="newPassword"
          placeholder="Min. 8 characters"
        />
        <Notice tone="error" message={error} />
        <Button label="Create account" onPress={submit} loading={submitting} />
      </Card>
      <LinkText label="I have an account" onPress={() => router.replace(`/login?role=${role}`)} />
    </Screen>
  );
}
