// Clinic account: clinic details (edit), password, sign out.
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatDisplayPhone } from '@mediarca/shared/utils/phoneUtils';
import { ChangePasswordCard, SignOutAndDelete } from '@/components/AccountSettings';
import { ClinicDetailsSheet } from '@/components/ClinicDetailsSheet';
import { Chip, ClinicImage, InfoRow, SectionTitle } from '@/components/kit';
import { Button, Screen, Title } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useClinic } from '@/context/ClinicContext';
import { colors, radius, shadow, space, type } from '@/theme';

export default function ClinicAccount() {
  const { user } = useAuth();
  const { data, reload } = useClinic();
  const [editing, setEditing] = useState(false);
  const clinic = data?.clinic;
  const verified = clinic?.verificationStatus === 'VERIFIED' || clinic?.isVerified;
  const phone = clinic?.phone || user?.phone;

  return (
    <Screen edges={['top']}>
      <Title>Account</Title>
      <View style={styles.header}>
        <ClinicImage uri={clinic?.avatarUrl || user?.avatarUrl} size={64} />
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

      <SectionTitle title="Clinic details" />
      <View style={styles.group}>
        <InfoRow first label="Address" value={clinic?.address || '—'} />
        <InfoRow label="City" value={clinic?.city || '—'} />
        <InfoRow label="State" value={clinic?.state || '—'} />
        <InfoRow label="Phone" value={phone ? formatDisplayPhone(phone) : '—'} />
      </View>
      <Button label="Edit details" variant="secondary" icon="create-outline" onPress={() => setEditing(true)} disabled={!clinic} />

      <ChangePasswordCard />
      <SignOutAndDelete />
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
