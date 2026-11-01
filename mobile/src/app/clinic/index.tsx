// Clinic home: status notices, three numbers, and recent bookings.
// Same data as frontend/src/pages/Clinic/ClinicDashboard.tsx + BookingsSection.tsx.
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import { MoreText } from '@/components/MoreText';
import { type ClinicAppointment, formatDisplayDate, shiftLabel } from '@mediarca/shared/api';
import { formatClinicAddress } from '@mediarca/shared/utils/address';
import { ClinicDetailsSheet } from '@/components/ClinicDetailsSheet';
import { Chip, ClinicImage, EmptyState, type IconName, ListGroup, ListRow, PlaceholderCard, SectionTitle } from '@/components/kit';
import { NotificationBell } from '@/components/NotificationBell';
import { ReportSheet } from '@/components/ReportSheet';
import { Button, Notice, Screen, Title } from '@/components/ui';
import { useClinic } from '@/context/ClinicContext';
import { doctorName } from '@/lib/booking';
import { isToday, todayLong } from '@/lib/dates';
import { colors, radius, shadow, space, type } from '@/theme';

const STATUS: Record<string, { label: string; tone: 'primary' | 'warning' | 'danger' | 'neutral' }> = {
  COMPLETED: { label: 'Done', tone: 'primary' },
  IN_CONSULTATION: { label: 'In cabin', tone: 'primary' },
  PENDING_APPROVAL: { label: 'Unpaid', tone: 'warning' },
  CANCELLED: { label: 'Cancelled', tone: 'danger' },
  REJECTED: { label: 'Declined', tone: 'danger' },
  EXPIRED: { label: 'Expired', tone: 'neutral' },
};

const rupees = (n?: number | null) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;

export default function ClinicHome() {
  const { data, failed, reload } = useClinic();
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [report, setReport] = useState(false);
  const clinic = data?.clinic;

  const onRefresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  const status = clinic?.verificationStatus;
  const needsLocation = Boolean(clinic) && (!clinic?.address || !clinic?.city || !clinic?.state);
  const bookings = data?.recentAppointments || [];
  const shown = showAll ? bookings : bookings.slice(0, 8);

  return (
    <Screen edges={['top']} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      {!data ? (
        failed ? (
          <EmptyState icon="cloud-offline-outline" title="Couldn’t load" message="Check your connection." actionLabel="Try again" onAction={reload} />
        ) : (
          <>
            <Title eyebrow={todayLong()}>Home</Title>
            <PlaceholderCard height={88} />
            <PlaceholderCard height={140} />
          </>
        )
      ) : (
        <>
          <View style={styles.titleRow}>
            <Title eyebrow={todayLong()}>Home</Title>
            <NotificationBell />
          </View>
          <View style={[styles.card, styles.head]}>
            <ClinicImage uri={clinic?.avatarUrl} size={56} />
            <View style={styles.flex}>
              <Text style={type.heading} numberOfLines={2}>
                {clinic?.clinicName}
              </Text>
              {clinic?.address || clinic?.city ? (
                <MoreText style={type.caption}>{formatClinicAddress(clinic as any) || clinic?.city || ''}</MoreText>
              ) : null}
            </View>
          </View>

          {status === 'SUSPENDED' ? <Notice tone="error" persist message="Clinic suspended. Bookings are paused. Contact MediArca support." /> : null}
          {status === 'REJECTED' ? <Notice tone="error" persist message="Not approved. Contact MediArca support." /> : null}
          {(status === 'PENDING' || clinic?.isVerified === false) && status !== 'SUSPENDED' && status !== 'REJECTED' ? (
            <Notice tone="info" message="Waiting for verification. You can add doctors and staff now." />
          ) : null}

          {needsLocation ? (
            <View style={styles.card}>
              <Text style={type.headline}>Add your city and state</Text>
              <Text style={type.caption}>Patients find clinics by city.</Text>
              <Button label="Add location" icon="location" onPress={() => setEditing(true)} />
            </View>
          ) : null}

          <View style={styles.stats}>
            <Stat icon="medkit" tint={colors.primary} label="Doctors" value={String(data.totalDoctors ?? data.doctors.length)} />
            <Stat icon="calendar" tint={colors.orange} label="Bookings" value={String(data.totalBookings || 0)} />
            <Stat icon="wallet" tint={colors.success} label="Revenue" value={rupees(data.totalRevenue)} />
          </View>
          <ListGroup>
            <ListRow icon="document-text" label="Report" onPress={() => setReport(true)} />
          </ListGroup>

          <SectionTitle title="Recent bookings" />
          {bookings.length === 0 ? (
            <EmptyState icon="calendar-outline" title="No bookings yet" message="New bookings show up here." />
          ) : (
            <View style={styles.group}>
              {shown.map((a, i) => (
                <BookingRow key={a.id} a={a} first={i === 0} />
              ))}
            </View>
          )}
          {bookings.length > shown.length ? <Button label={`Show all ${bookings.length}`} variant="plain" onPress={() => setShowAll(true)} /> : null}
        </>
      )}

      <ClinicDetailsSheet clinic={clinic} visible={editing} onClose={() => setEditing(false)} onSaved={reload} />
      <ReportSheet role="CLINIC" visible={report} onClose={() => setReport(false)} />
    </Screen>
  );
}

function Stat({ label, value, icon, tint }: { label: string; value: string; icon: IconName; tint: string }) {
  return (
    <View style={styles.stat}>
      <View style={[styles.statIcon, { backgroundColor: tint }]}>
        <Ionicons name={icon} size={14} color={colors.white} />
      </View>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={type.footnote}>{label}</Text>
    </View>
  );
}

function BookingRow({ a, first }: { a: ClinicAppointment; first: boolean }) {
  const s = STATUS[a.status] || { label: 'Waiting', tone: 'neutral' as const };
  return (
    <View style={[styles.row, !first && styles.divider]}>
      <View style={styles.token}>
        <Text style={styles.tokenText}>#{a.queueNumber}</Text>
      </View>
      <View style={styles.flex}>
        <Text style={type.headline} numberOfLines={1}>
          {a.patientName}
        </Text>
        <Text style={type.footnote} numberOfLines={1}>
          {[doctorName(a.doctorName), isToday(String(a.date || '').slice(0, 10)) ? '' : formatDisplayDate(a.date), a.estimatedTime || shiftLabel(a, '')].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <View style={styles.right}>
        <Chip label={s.label} tone={s.tone} />
        <Text style={type.footnote}>{rupees(a.fee)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0, gap: 2 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.md },
  statIcon: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center', marginBottom: space.sm },
  card: { backgroundColor: colors.card, borderRadius: radius.card, padding: space.lg, gap: space.sm, ...shadow.card },
  stats: { flexDirection: 'row', gap: space.sm },
  stat: { flex: 1, backgroundColor: colors.card, borderRadius: radius.tile + 2, paddingVertical: space.md + 2, paddingHorizontal: space.md, gap: 2, ...shadow.card },
  statValue: { fontSize: 22, fontWeight: '600', letterSpacing: -0.4, color: colors.ink },
  group: { backgroundColor: colors.card, borderRadius: radius.card, overflow: 'hidden', ...shadow.card },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  token: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' },
  tokenText: { fontSize: 14, fontWeight: '600', color: colors.ink },
  right: { alignItems: 'flex-end', gap: 4 },
});
