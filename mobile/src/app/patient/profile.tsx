// Patient profile. Same fields and checks as frontend/src/pages/Patient/PatientProfile.tsx.
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import { api, getLocalDateString } from '@mediarca/shared/api';
import { formatIndianPhone, isValidIndianPhone, sanitizeIndianPhone } from '@mediarca/shared/utils/phoneUtils';
import { AccountActions } from '@/components/AccountSettings';
import { Avatar, Chip } from '@/components/kit';
import { Button, Card, Field, Notice, Screen, Segmented, SelectField } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { success, tap } from '@/lib/haptics';
import { colors, radius, shadow, space, type } from '@/theme';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const thisYear = Number(getLocalDateString().slice(0, 4));
const YEARS = Array.from({ length: thisYear - 1899 }, (_, i) => String(thisYear - i));
const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));

const splitDate = (iso?: string | null) => {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? { year: m[1], month: MONTHS[Number(m[2]) - 1] || '', day: String(Number(m[3])) } : { year: '', month: '', day: '' };
};

export default function PatientProfile() {
  const { user, updateUser } = useAuth();
  const profile = user?.patientProfile;
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(sanitizeIndianPhone(user?.phone));
  const [emergencyContact, setEmergencyContact] = useState(profile?.emergencyContact || '');
  const [dob, setDob] = useState(() => splitDate(profile?.dateOfBirth));
  const [gender, setGender] = useState(profile?.gender || '');
  const [bloodGroup, setBloodGroup] = useState(profile?.bloodGroup || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const dateOfBirth = () => {
    if (!dob.year && !dob.month && !dob.day) return { value: '' };
    if (!dob.year || !dob.month || !dob.day) return { error: 'Pick day, month and year of birth.' };
    const mm = String(MONTHS.indexOf(dob.month) + 1).padStart(2, '0');
    const dd = dob.day.padStart(2, '0');
    const value = `${dob.year}-${mm}-${dd}`;
    const check = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(check.getTime()) || check.toISOString().slice(0, 10) !== value) return { error: 'That date doesn’t exist.' };
    if (value > getLocalDateString()) return { error: 'Date of birth can’t be in the future.' };
    return { value };
  };

  const save = async () => {
    setMessage(null);
    if (!fullName.trim()) return setMessage({ tone: 'error', text: 'Full name is required.' });
    if (!isValidIndianPhone(phone)) return setMessage({ tone: 'error', text: 'Please enter a valid 10-digit Indian mobile number.' });
    const birth = dateOfBirth();
    if (birth.error) return setMessage({ tone: 'error', text: birth.error });
    setSaving(true);
    try {
      const updated = await api.updateUserProfile({
        fullName: fullName.trim(),
        phone: formatIndianPhone(phone),
        bloodGroup,
        dateOfBirth: birth.value,
        gender,
        emergencyContact: emergencyContact.trim(),
      });
      updateUser(updated);
      success();
      setMessage({ tone: 'success', text: 'Profile saved.' });
    } catch (err: any) {
      setMessage({ tone: 'error', text: err?.message || 'Couldn’t update profile. Try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen edges={['top']}>
      <Text style={[type.largeTitle, styles.title]}>Profile</Text>

      <View style={styles.header}>
        <Avatar uri={user?.avatarUrl} name={user?.fullName} size={68} />
        <View style={styles.flex}>
          <Text style={type.heading} numberOfLines={1}>
            {user?.fullName || 'Patient'}
          </Text>
          <Text style={type.caption} numberOfLines={1}>
            {user?.email}
          </Text>
          <View style={styles.chip}>
            <Chip tone="primary" label="Patient" />
          </View>
        </View>
      </View>

      <Card>
        <Text style={type.headline}>Personal</Text>
        <Field label="Full name" value={fullName} onChangeText={setFullName} autoComplete="name" autoCapitalize="words" />
        <Field
          label="Mobile"
          prefix="+91"
          value={phone}
          onChangeText={(t) => setPhone(sanitizeIndianPhone(t))}
          keyboardType="phone-pad"
          placeholder="98765 43210"
          maxLength={10}
          autoComplete="tel"
        />
        <View style={styles.readOnly}>
          <Text style={type.caption}>Email</Text>
          <Text style={type.body} numberOfLines={1}>
            {user?.email}
          </Text>
        </View>
        <Field label="Emergency contact (optional)" value={emergencyContact} onChangeText={setEmergencyContact} placeholder="Name and phone" />
      </Card>

      <Card>
        <Text style={type.headline}>Health</Text>
        <Text style={type.label}>Date of birth</Text>
        <View style={styles.dobRow}>
          <View style={styles.dobDay}>
            <SelectField label="Day" value={dob.day} options={DAYS} onChange={(day) => setDob((d) => ({ ...d, day }))} placeholder="—" />
          </View>
          <View style={styles.dobMonth}>
            <SelectField label="Month" value={dob.month} options={MONTHS} onChange={(month) => setDob((d) => ({ ...d, month }))} placeholder="—" />
          </View>
          <View style={styles.dobYear}>
            <SelectField label="Year" value={dob.year} options={YEARS} onChange={(year) => setDob((d) => ({ ...d, year }))} placeholder="—" />
          </View>
        </View>
        <Text style={type.label}>Gender</Text>
        <Segmented
          options={[
            { value: 'Male', label: 'Male' },
            { value: 'Female', label: 'Female' },
            { value: 'Other', label: 'Other' },
          ]}
          value={gender}
          onChange={(g) => {
            tap();
            setGender(g);
          }}
        />
        <SelectField label="Blood group" value={bloodGroup} options={BLOOD_GROUPS} onChange={setBloodGroup} placeholder="Select" />
      </Card>

      <Notice tone={message?.tone || 'info'} message={message?.text} stamp={message} />
      <Button label="Save" onPress={save} loading={saving} />

      <AccountActions />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  title: { marginTop: space.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.lg, backgroundColor: colors.card, borderRadius: radius.card, padding: space.lg, ...shadow.card },
  chip: { marginTop: space.sm },
  readOnly: { gap: 4, paddingVertical: space.xs },
  dobRow: { flexDirection: 'row', gap: space.sm, marginTop: -space.xs },
  dobDay: { flex: 1 },
  dobMonth: { flex: 1.5 },
  dobYear: { flex: 1.3 },
});
