// Patient profile. Same fields and checks as frontend/src/pages/Patient/PatientProfile.tsx.
// Same layout as the doctor and desk Account: details on top, Edit profile opens a sheet.
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import { api } from '@mediarca/shared/api';
import { formatDisplayPhone, formatIndianPhone, isValidIndianPhone, sanitizeIndianPhone } from '@mediarca/shared/utils/phoneUtils';
import { AccountActions } from '@/components/AccountSettings';
import { Avatar, Chip, ListGroup, ListRow, Sheet } from '@/components/kit';
import { Button, Card, Field, Notice, Screen, Segmented } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { success, tap } from '@/lib/haptics';
import { colors, radius, shadow, space, type } from '@/theme';

export default function PatientProfile() {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const gender = user?.patientProfile?.gender;

  return (
    <Screen edges={['top']}>
      <Text style={[type.largeTitle, styles.title]}>Profile</Text>

      <View style={styles.header}>
        <Avatar uri={user?.avatarUrl} name={user?.fullName} size={64} />
        <View style={styles.flex}>
          <Text style={type.heading} numberOfLines={1}>
            {user?.fullName || 'Patient'}
          </Text>
          <Text style={type.caption} numberOfLines={1}>
            {user?.email}
          </Text>
          {user?.phone ? <Text style={type.caption}>{formatDisplayPhone(user.phone)}</Text> : null}
          <View style={styles.chips}>
            <Chip tone="primary" label="Patient" />
            {gender && gender !== 'Not Specified' ? <Chip label={gender} /> : null}
          </View>
        </View>
      </View>
      <Notice tone="success" message={saved} />

      <ListGroup>
        <ListRow icon="create" label="Edit profile" onPress={() => setEditing(true)} />
      </ListGroup>

      <AccountActions />
      <ProfileSheet visible={editing} onClose={() => setEditing(false)} onSaved={() => setSaved('Profile saved.')} />
    </Screen>
  );
}

/** Name, mobile and gender. Save stays off until something changes. */
function ProfileSheet({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: () => void }) {
  const { user, updateUser } = useAuth();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start from the saved values each time the sheet opens
  const [wasOpen, setWasOpen] = useState(false);
  if (visible !== wasOpen) {
    setWasOpen(visible);
    if (visible) {
      setFullName(user?.fullName || '');
      setPhone(sanitizeIndianPhone(user?.phone));
      setGender(user?.patientProfile?.gender || '');
      setError(null);
    }
  }

  const changed =
    fullName.trim() !== (user?.fullName || '') ||
    phone !== sanitizeIndianPhone(user?.phone) ||
    gender !== (user?.patientProfile?.gender || '');

  const save = async () => {
    setError(null);
    if (!fullName.trim()) return setError('Full name is required.');
    if (!isValidIndianPhone(phone)) return setError('Please enter a valid 10-digit Indian mobile number.');
    setSaving(true);
    try {
      const updated = await api.updateUserProfile({ fullName: fullName.trim(), phone: formatIndianPhone(phone), gender });
      updateUser(updated);
      success();
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Couldn’t update profile. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={visible} title="Edit profile" doneLabel="Close" onClose={() => !saving && onClose()}>
      <Card>
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
        <Notice tone="error" message={error} />
        <Button label="Save" onPress={save} loading={saving} disabled={!changed} />
      </Card>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0, gap: 2 },
  title: { marginTop: space.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.lg, backgroundColor: colors.card, borderRadius: radius.card, padding: space.lg, ...shadow.card },
  chips: { flexDirection: 'row', gap: space.sm, marginTop: space.sm, flexWrap: 'wrap' },
});
