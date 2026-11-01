// Doctor edits their own profile: name, mobile, specialty, qualifications, experience, bio.
// Same call and checks as frontend/src/pages/Doctor/DoctorProfile.tsx.
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ALL_SPECIALTIES, api } from '@mediarca/shared/api';
import { formatIndianPhone, isValidIndianPhone } from '@mediarca/shared/utils/phoneUtils';
import { Sheet } from '@/components/kit';
import { Button, Card, Field, Notice, SelectField } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { success } from '@/lib/haptics';
import { space } from '@/theme';

const OPTIONS = [...ALL_SPECIALTIES.filter((s) => s !== 'Other'), 'Other'];
const tenDigits = (p?: string | null) => String(p || '').replace(/\D/g, '').slice(-10);

export function DoctorProfileSheet({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: () => void }) {
  const { user, updateUser, refreshUser } = useAuth();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [custom, setCustom] = useState('');
  const [qualifications, setQualifications] = useState('');
  const [years, setYears] = useState('');
  const [bio, setBio] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fill the form each time the sheet opens
  const [wasOpen, setWasOpen] = useState(false);
  if (visible !== wasOpen) {
    setWasOpen(visible);
    if (visible && user) {
      const p = user.doctorProfile;
      const spec = p?.specialty || '';
      const standard = ALL_SPECIALTIES.includes(spec) && spec !== 'Other';
      setFullName(user.fullName || '');
      setPhone(tenDigits(user.phone));
      setSpecialty(spec ? (standard ? spec : 'Other') : '');
      setCustom(standard ? '' : spec);
      setQualifications(p?.qualifications || '');
      setYears(p?.experienceYears != null ? String(p.experienceYears) : '');
      setBio(p?.bio || '');
      setError(null);
    }
  }

  const save = async () => {
    if (busy) return;
    const finalSpecialty = specialty === 'Other' ? custom.trim() : specialty.trim();
    if (!fullName.trim()) return setError('Enter your name.');
    if (!finalSpecialty) return setError(specialty === 'Other' ? 'Enter your specialty.' : 'Choose your specialty.');
    if (!isValidIndianPhone(phone)) return setError('Enter a valid 10-digit mobile number.');
    const exp = Number(years || 0);
    if (!Number.isFinite(exp) || exp < 0 || exp > 70) return setError('Enter experience in years.');
    setBusy(true);
    setError(null);
    try {
      const updated = await api.updateDoctorProfile({
        fullName: fullName.trim(),
        phone: formatIndianPhone(phone),
        specialty: finalSpecialty,
        qualifications: qualifications.trim(),
        experienceYears: exp,
        bio: bio.trim(),
      });
      if (updated && (updated as any).id) updateUser(updated);
      await refreshUser();
      success();
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Couldn’t save. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} title="Edit profile" doneLabel="Close" onClose={() => !busy && onClose()}>
      <View style={styles.stack}>
        <Card>
          <Field label="Full name" value={fullName} onChangeText={setFullName} autoComplete="name" maxLength={100} />
          <Field label="Mobile" prefix="+91" value={phone} onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 10))} keyboardType="phone-pad" />
        </Card>
        <Card>
          <SelectField label="Specialty" value={specialty} options={OPTIONS} onChange={setSpecialty} />
          {specialty === 'Other' ? <Field label="Your specialty" value={custom} onChangeText={setCustom} maxLength={60} /> : null}
          <Field label="Qualifications" value={qualifications} onChangeText={setQualifications} placeholder="e.g. MBBS, MD" maxLength={120} />
          <Field label="Experience (years)" value={years} onChangeText={(t) => setYears(t.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" />
          <Field label="About" value={bio} onChangeText={setBio} placeholder="Optional" maxLength={500} multiline style={styles.multiline} />
        </Card>
        <Notice tone="error" message={error} />
        <Button label="Save" onPress={save} loading={busy} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
});
