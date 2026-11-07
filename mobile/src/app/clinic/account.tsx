// Clinic account: clinic details (edit), report, password, sign out (same order as doctor and desk).
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import { formatClinicAddress } from '@mediarca/shared/utils/address';
import { formatDisplayPhone } from '@mediarca/shared/utils/phoneUtils';
import { AccountActions } from '@/components/AccountSettings';
import { ClinicDetailsSheet } from '@/components/ClinicDetailsSheet';
import { Chip, ClinicImage, InfoRow, ListGroup, ListRow, SectionTitle } from '@/components/kit';
import { ReportSheet } from '@/components/ReportSheet';
import { PhotoPicker } from '@/components/PhotoPicker';
import { Notice, Screen, Title } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useClinic } from '@/context/ClinicContext';
import { colors, radius, shadow, space, type } from '@/theme';

export default function ClinicAccount() {
  const { user } = useAuth();
  const { data, reload } = useClinic();
  const [editing, setEditing] = useState(false);
  const [report, setReport] = useState(false);
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
        {/* One address line (city and state only when the address doesn't already say them) */}
        <InfoRow first label="Address" value={formatClinicAddress(clinic) || '—'} />
        <InfoRow label="Phone" value={phone ? formatDisplayPhone(phone) : '—'} />
      </View>

      <ListGroup>
        <ListRow icon="create" label="Edit details" onPress={() => setEditing(true)} disabled={!clinic} />
      </ListGroup>

      <AccountActions rows={[<ListRow key="report" icon="document-text" label="Report" onPress={() => setReport(true)} />]} />
      <ReportSheet role="CLINIC" visible={report} onClose={() => setReport(false)} />
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
