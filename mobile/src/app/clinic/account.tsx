// Clinic account: clinic details (edit), password, sign out.
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import { formatDisplayPhone } from '@mediarca/shared/utils/phoneUtils';
import { AccountActions } from '@/components/AccountSettings';
import { ClinicDetailsSheet } from '@/components/ClinicDetailsSheet';
import { Chip, ClinicImage, InfoRow, ListRow, SectionTitle } from '@/components/kit';
import { PhotoPicker } from '@/components/PhotoPicker';
import { Notice, Screen, Title } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useClinic } from '@/context/ClinicContext';
import { colors, radius, shadow, space, type } from '@/theme';

export default function ClinicAccount() {
  const { user } = useAuth();
  const { data, reload } = useClinic();
  const [editing, setEditing] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const clinic = data?.clinic;
  const verified = clinic?.verificationStatus === 'VERIFIED' || clinic?.isVerified;
  const phone = clinic?.phone || user?.phone;

  return (
    <Screen edges={['top']}>
      <Title>Account</Title>
      <View style={styles.header}>
        <PhotoPicker rounded hasPhoto={Boolean(user?.avatarUrl)} onChanged={reload} onError={setPhotoError}>
          <ClinicImage uri={user?.avatarUrl || clinic?.avatarUrl} size={64} />
        </PhotoPicker>
        <View style={styles.flex}>
          <Text style={type.heading} numberOfLines={2}>
            {clinic?.clinicName || user?.fullName}
          </Text>
          <Text style={type.caption} numberOfLines={1}>
            {user?.email}
          </Text>
          <View style={styles.chips}>
            <Chip tone="primary" label="Clinic" />
            {clinic ? <Chip tone={verified ? 'success' : 'warning'} label={verified ? 'Verified' : 'In review'} /> : null}
          </View>
        </View>
      </View>
      <Notice tone="error" message={photoError} />

      <SectionTitle title="Clinic details" />
      <View style={styles.group}>
        <InfoRow first label="Address" value={clinic?.address || '—'} />
        <InfoRow label="City" value={clinic?.city || '—'} />
        <InfoRow label="State" value={clinic?.state || '—'} />
        <InfoRow label="Phone" value={phone ? formatDisplayPhone(phone) : '—'} />
      </View>

      <AccountActions rows={[<ListRow key="edit" icon="create" label="Edit details" onPress={() => setEditing(true)} disabled={!clinic} />]} />
      <ClinicDetailsSheet clinic={clinic} visible={editing} onClose={() => setEditing(false)} onSaved={reload} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0, gap: 2 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.lg, backgroundColor: colors.card, borderRadius: radius.card, padding: space.lg, ...shadow.card },
  chips: { flexDirection: 'row', gap: space.sm, marginTop: space.sm, flexWrap: 'wrap' },
  group: { backgroundColor: colors.card, borderRadius: radius.card, paddingHorizontal: space.lg, ...shadow.card },
});
