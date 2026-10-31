// One booking in Visits: doctor, token, date and shift, live position. Tap opens the queue pass.
// Wording follows frontend/src/components/queue/LiveQueueTicket.tsx.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { type Appointment, cleanSlotName, formatDisplayDate, getLocalDateString } from '@mediarca/shared/api';
import { toTelUri } from '@mediarca/shared/utils/phoneUtils';
import { Avatar, Chip } from '@/components/kit';
import { Button } from '@/components/ui';
import { doctorName } from '@/lib/booking';
import { colors, radius, shadow, space, type } from '@/theme';

/** "Today", "Tomorrow" or "20 Oct" (fits the small tile). */
const shortDate = (date: string) => {
  const label = formatDisplayDate(date);
  return label.includes(', ') ? label.split(', ')[1] : label;
};

const statusChip = (appt: Appointment, isToday: boolean) => {
  const serving = appt.liveQueue?.currentServingQueueNumber;
  switch (appt.status) {
    case 'PENDING_APPROVAL':
      return <Chip dot tone="warning" label="Awaiting payment" />;
    case 'IN_CONSULTATION':
      return <Chip dot tone="primary" label="In consultation" />;
    case 'WAITING':
      return isToday && serving === appt.queueNumber && appt.queueNumber > 0 ? (
        <Chip dot tone="primary" label="Your turn" />
      ) : (
        <Chip dot tone="success" label="Confirmed" />
      );
    case 'COMPLETED':
      return <Chip label="Completed" />;
    case 'EXPIRED':
      return <Chip label="Expired" />;
    case 'REJECTED':
      return <Chip tone="danger" label="Declined" />;
    case 'CANCELLED':
      return <Chip tone="danger" label="Cancelled" />;
    default:
      return null;
  }
};

export function AppointmentCard({ appt }: { appt: Appointment }) {
  const isToday = appt.appointmentDate === getLocalDateString();
  const live = appt.liveQueue;
  const pending = appt.status === 'PENDING_APPROVAL';
  const active = pending || appt.status === 'WAITING' || appt.status === 'IN_CONSULTATION';
  const deskPhone = appt.receptionistPhone || appt.clinic?.phone || null;
  const deskName = appt.receptionistName || 'Front desk';
  const token = pending
    ? Math.max(1, appt.estimatedQueueNumber || live?.estimatedQueueNumber || (appt.queueNumber > 0 ? appt.queueNumber : 1))
    : appt.queueNumber;
  const showLive = isToday && live && (appt.status === 'WAITING' || appt.status === 'IN_CONSULTATION');
  const canCheckIn = isToday && appt.status === 'WAITING' && !appt.isCheckedIn && !live?.isShiftPassed;
  const forName = appt.isForOther ? appt.patientName : null;
  const open = () => router.push({ pathname: '/visit/[id]', params: { id: appt.id } });

  return (
    <View style={[styles.card, !active && styles.cardPast]}>
      <Pressable accessibilityRole="button" onPress={open} style={({ pressed }) => [styles.tapArea, pressed && styles.pressed]}>
      <View style={styles.top}>
        <Avatar uri={appt.doctor?.user?.avatarUrl} name={appt.doctor?.user?.fullName} size={52} />
        <View style={styles.flex}>
          <Text style={type.headline} numberOfLines={1}>
            {doctorName(appt.doctor?.user?.fullName)}
          </Text>
          <Text style={type.footnote} numberOfLines={1}>
            {[appt.doctor?.specialty, appt.clinic?.clinicName].filter(Boolean).join(' · ')}
          </Text>
          <View style={styles.status}>
            {statusChip(appt, isToday)}
            {isToday && active && appt.isCheckedIn ? <Chip tone="success" label="Checked in" /> : null}
          </View>
        </View>
        <View style={styles.tokenBox}>
          <Text style={type.small}>{pending ? 'Est.' : 'Token'}</Text>
          <Text style={[styles.tokenText, !active && { color: colors.muted }]}>#{token}</Text>
        </View>
      </View>

      <View style={styles.when}>
        <Ionicons name="calendar-outline" size={15} color={colors.muted} />
        <Text style={styles.whenText} numberOfLines={1}>
          {shortDate(appt.appointmentDate)} · {cleanSlotName(appt.checkingWindow, 'Shift')}
          {active && (live?.liveEstimatedTime || appt.estimatedTime) ? ` · ${live?.liveEstimatedTime || appt.estimatedTime}` : ''}
        </Text>
      </View>

      {forName ? <Text style={type.footnote}>For {forName}</Text> : null}

      {showLive ? (
        <View style={styles.live}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>
            {appt.status === 'IN_CONSULTATION'
              ? 'In consultation now'
              : live!.isYourTurn
                ? 'It’s your turn'
                : `Now serving #${live!.currentServingQueueNumber || '—'} · ${live!.patientsAway} ahead`}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </View>
      ) : null}
      </Pressable>

      {canCheckIn ? (
        <Button label="Check in" icon="qr-code" onPress={() => router.push({ pathname: '/scan', params: { appointmentId: appt.id } })} />
      ) : null}

      {pending && deskPhone ? (
        <>
          <Text style={type.caption}>Pay the receptionist to confirm your token.</Text>
          <Button icon="call" label={`Call ${deskName}`} onPress={() => Linking.openURL(toTelUri(deskPhone))} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  card: { backgroundColor: colors.card, borderRadius: radius.card, padding: space.lg, gap: space.md, ...shadow.card },
  cardPast: { opacity: 0.9 },
  tapArea: { gap: space.md },
  pressed: { opacity: 0.7 },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  status: { flexDirection: 'row', gap: 6, marginTop: space.sm, flexWrap: 'wrap' },
  tokenBox: { alignItems: 'flex-end', alignSelf: 'flex-start' },
  tokenText: { fontSize: 26, fontWeight: '600', color: colors.primary, letterSpacing: -0.6 },
  when: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  whenText: { fontSize: 15, color: colors.secondaryInk, flex: 1 },
  live: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.primarySoft, borderRadius: radius.tile, paddingVertical: space.md, paddingHorizontal: space.md + 2 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  liveText: { fontSize: 15, color: colors.ink, flex: 1 },
});
