// Account tab for doctors and the front desk: who is signed in, photo (doctors), report, password, sign out.
// Doctors edit their profile here; front desk details are set by the clinic.
import React, { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import { formatDisplayPhone } from '@mediarca/shared/utils/phoneUtils';
import { AccountActions } from '@/components/AccountSettings';
import { Avatar, Chip, ListGroup, ListRow } from '@/components/kit';
import { DoctorProfileSheet } from '@/components/DoctorProfileSheet';
import { PhotoPicker } from '@/components/PhotoPicker';
import { ReportSheet } from '@/components/ReportSheet';
import { Notice, Screen, Title } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { deskName, doctorName } from '@/lib/booking';
import { ROLE_LABEL } from '@/lib/roles';
import { doctorBookingUrl } from '@/lib/site';
import { colors, radius, shadow, space, type } from '@/theme';

/** Patients open the link to see the doctor's clinics and book (WhatsApp, SMS, anything). */
const shareLink = (name: string, doctorId: string) => {
  Share.share({ message: `Book a visit with ${name} on MediArca: ${doctorBookingUrl(doctorId)}` }).catch(() => {});
};

export function AccountScreen({ extra, children }: { extra?: string | null; children?: React.ReactNode }) {
  const { user } = useAuth();
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [report, setReport] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  if (!user) return null;
  const isDoctor = user.role === 'DOCTOR';
  const name = isDoctor ? doctorName(user.fullName) : deskName(user.fullName) || user.fullName;
  const avatar = <Avatar uri={user.avatarUrl} name={isDoctor ? user.fullName : name} size={64} />;
  return (
    <Screen edges={['top']}>
      <Title>Account</Title>
      <View style={styles.header}>
        {isDoctor ? (
          <PhotoPicker hasPhoto={Boolean(user.avatarUrl)} onError={setPhotoError}>
            {avatar}
          </PhotoPicker>
        ) : (
          avatar
        )}
        <View style={styles.flex}>
          <Text style={type.heading} numberOfLines={1}>
            {name}
          </Text>
          <Text style={type.caption} numberOfLines={1}>
            {user.email}
          </Text>
          {user.phone ? <Text style={type.caption}>{formatDisplayPhone(user.phone)}</Text> : null}
          <View style={styles.chips}>
            <Chip tone="primary" label={ROLE_LABEL[user.role]} />
            {extra ? <Chip label={extra} /> : null}
          </View>
        </View>
      </View>
      <Notice tone="error" message={photoError} />
      <Notice tone="success" message={saved} />
      {isDoctor ? (
        <ListGroup>
          <ListRow icon="create" label="Edit profile" onPress={() => setEditing(true)} />
          {user.doctorProfile?.id ? (
            <ListRow icon="share-social" tint={colors.success} label="Share my booking link" onPress={() => shareLink(name, user.doctorProfile!.id)} />
          ) : null}
        </ListGroup>
      ) : null}
      {children}
      <AccountActions rows={[<ListRow key="report" icon="document-text" label="Report" onPress={() => setReport(true)} />]} />
      {user.role === 'DOCTOR' || user.role === 'RECEPTIONIST' ? <ReportSheet role={user.role} visible={report} onClose={() => setReport(false)} /> : null}
      {isDoctor ? <DoctorProfileSheet visible={editing} onClose={() => setEditing(false)} onSaved={() => setSaved('Profile saved.')} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0, gap: 2 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.lg, backgroundColor: colors.card, borderRadius: radius.card, padding: space.lg, ...shadow.card },
  chips: { flexDirection: 'row', gap: space.sm, marginTop: space.sm, flexWrap: 'wrap' },
});
