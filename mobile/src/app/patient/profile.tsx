// Patient profile. Same fields and checks as frontend/src/pages/Patient/PatientProfile.tsx.
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import { api } from '@mediarca/shared/api';
import { formatIndianPhone, isValidIndianPhone, sanitizeIndianPhone } from '@mediarca/shared/utils/phoneUtils';
import { AccountActions } from '@/components/AccountSettings';
import { Avatar, Chip } from '@/components/kit';
import { Button, Card, Field, Notice, Screen, Segmented } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { success, tap } from '@/lib/haptics';
import { colors, radius, shadow, space, type } from '@/theme';

export default function PatientProfile() {
  const { user, updateUser } = useAuth();
  const profile = user?.patientProfile;
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(sanitizeIndianPhone(user?.phone));
  const [gender, setGender] = useState(profile?.gender || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const save = async () => {
    setMessage(null);
    if (!fullName.trim()) return setMessage({ tone: 'error', text: 'Full name is required.' });
    if (!isValidIndianPhone(phone)) return setMessage({ tone: 'error', text: 'Please enter a valid 10-digit Indian mobile number.' });
    setSaving(true);
    try {
      const updated = await api.updateUserProfile({
        fullName: fullName.trim(),
        phone: formatIndianPhone(phone),
        gender,
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
      </Card>

      <Card>
        <Text style={type.headline}>Gender</Text>
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
});
