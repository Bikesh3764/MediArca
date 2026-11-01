// Live queue pass: a Wallet-style ticket with the token, now serving, people ahead and wait.
// Used for booked visits (visit/[id]) and walk-ins (track). Wording follows
// frontend/src/components/queue/LiveQueueTicket.tsx and TrackWalkin.tsx.
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Animated, Easing, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import { type Appointment, formatDisplayDate, getLocalDateString, shiftLabel } from '@mediarca/shared/api';
import { formatDisplayPhone, toTelUri } from '@mediarca/shared/utils/phoneUtils';
import { Avatar, type IconName } from '@/components/kit';
import { doctorName } from '@/lib/booking';
import { colors, radius, shadow, space, type } from '@/theme';

export type PassLive = {
  currentServingQueueNumber: number;
  patientsAway: number;
  estimatedWaitMinutes: number;
  isYourTurn: boolean;
  isShiftPassed?: boolean;
  liveEstimatedTime?: string;
  delayReason?: 'BEFORE_SHIFT' | 'STEPPED_OUT' | 'DOCTOR_NOT_IN' | null;
};

export type PassData = {
  status: string;
  token: number;
  /** Before payment the number is only an estimate. */
  estimated?: boolean;
  date: string;
  slot: string;
  estimatedTime?: string;
  isToday: boolean;
  doctor: { name?: string | null; avatarUrl?: string | null; specialty?: string | null; cabinStatus?: string | null; expectedReturnTime?: string | null };
  clinic?: { name: string; city?: string | null } | null;
  forName?: string | null;
  live?: PassLive | null;
};

/** Pass data for a booked visit. */
export const passFromAppointment = (a: Appointment): PassData => {
  const pending = a.status === 'PENDING_APPROVAL';
  return {
    status: a.status,
    token: pending ? Math.max(1, a.estimatedQueueNumber || a.liveQueue?.estimatedQueueNumber || (a.queueNumber > 0 ? a.queueNumber : 1)) : a.queueNumber,
    estimated: pending,
    date: a.appointmentDate,
    slot: shiftLabel(a),
    estimatedTime: a.estimatedTime,
    isToday: a.appointmentDate === getLocalDateString(),
    doctor: {
      name: a.doctor?.user?.fullName,
      avatarUrl: a.doctor?.user?.avatarUrl,
      specialty: a.doctor?.specialty,
      cabinStatus: a.doctor?.cabinStatus,
      expectedReturnTime: a.doctor?.expectedReturnTime,
    },
    clinic: a.clinic ? { name: a.clinic.clinicName, city: a.clinic.city } : null,
    forName: a.isForOther ? a.patientName : null,
    live: a.liveQueue ?? null,
  };
};


const ACTIVE = new Set(['WAITING', 'IN_CONSULTATION']);

export const waitLabel = (min: number) => {
  if (min <= 0) return 'Now';
  if (min >= 60) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? `${h} hr ${m} min` : `${h} hr`;
  }
  return `${min} min`;
};

const statusLabel = (p: PassData): string => {
  switch (p.status) {
    case 'PENDING_APPROVAL':
      return 'Awaiting payment';
    case 'IN_CONSULTATION':
      return 'In consultation';
    case 'WAITING':
      return p.isToday && p.live?.isYourTurn ? 'Your turn' : 'Confirmed';
    case 'COMPLETED':
      return 'Completed';
    case 'EXPIRED':
      return 'Expired';
    case 'REJECTED':
      return 'Declined';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return 'Waiting';
  }
};

/** One line under the stats when something is holding the queue. */
const banner = (p: PassData): { icon: IconName; text: string; tone: 'go' | 'wait' | 'info' } | null => {
  if (!p.isToday || !ACTIVE.has(p.status) || !p.live) return null;
  const doc = doctorName(p.doctor.name);
  if (p.status === 'IN_CONSULTATION') return { icon: 'checkmark-circle', text: `With ${doc}.`, tone: 'go' };
  if (p.live.isYourTurn || (p.live.currentServingQueueNumber === p.token && p.token > 0)) {
    return { icon: 'walk', text: `Please go in. ${doc} is ready.`, tone: 'go' };
  }
  if (p.live.isShiftPassed) return { icon: 'time', text: `Shift time is over · Token #${p.token} is still valid`, tone: 'wait' };
  if (p.doctor.cabinStatus === 'STEPPED_OUT') {
    return { icon: 'cafe', text: `Doctor stepped out. Back ${p.doctor.expectedReturnTime ? `around ${p.doctor.expectedReturnTime}` : 'soon'}.`, tone: 'wait' };
  }
  if (p.doctor.cabinStatus === 'NOT_IN_CABIN' || p.live.delayReason === 'DOCTOR_NOT_IN') return { icon: 'time', text: 'Doctor hasn’t arrived yet.', tone: 'wait' };
  if (p.live.delayReason === 'BEFORE_SHIFT') return { icon: 'time', text: 'Shift not started', tone: 'info' };
  return null;
};

export function QueuePass({ pass }: { pass: PassData }) {
  const live = pass.live;
  const showLive = pass.isToday && ACTIVE.has(pass.status) && Boolean(live);
  const inactive = !ACTIVE.has(pass.status) && pass.status !== 'PENDING_APPROVAL';
  const note = banner(pass);
  const time = ACTIVE.has(pass.status) || pass.status === 'PENDING_APPROVAL' ? live?.liveEstimatedTime || pass.estimatedTime : null;

  return (
    <View style={[styles.pass, inactive && styles.passInactive]}>
      {/* Top: doctor and token */}
      <View style={[styles.top, inactive && styles.topInactive]}>
        <View style={styles.doctorRow}>
          <Avatar uri={pass.doctor.avatarUrl} name={pass.doctor.name} size={44} ring={false} />
          <View style={styles.flex}>
            <Text style={styles.doctor} numberOfLines={1}>
              {doctorName(pass.doctor.name)}
            </Text>
            <Text style={styles.topSub} numberOfLines={1}>
              {[pass.doctor.specialty, pass.clinic?.name].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </View>

        <View style={styles.tokenRow}>
          <View>
            <Text style={styles.topLabel}>{pass.estimated ? 'Est. token' : 'Token'}</Text>
            <Text style={styles.token}>#{pass.token}</Text>
          </View>
          <View style={styles.statusPill}>
            <Text style={styles.statusText}>{statusLabel(pass)}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <Meta label="Date" value={formatDisplayDate(pass.date)} />
          <Meta label="Shift" value={pass.slot || 'Shift'} wide />
          <Meta label="Time" value={time || '—'} />
        </View>
        {pass.forName ? <Text style={styles.forName}>For {pass.forName}</Text> : null}
      </View>

      {/* Ticket notch */}
      <View style={styles.notchRow}>
        <View style={[styles.notch, styles.notchLeft]} />
        <View style={styles.perforation} />
        <View style={[styles.notch, styles.notchRight]} />
      </View>

      {/* Bottom: live queue */}
      <View style={styles.bottom}>
        {showLive && live ? (
          <>
            <View style={styles.liveHead}>
              <LiveDot />
              <Text style={styles.liveTitle}>Live queue</Text>
            </View>
            <View style={styles.stats}>
              <Stat label="Now serving" value={live.currentServingQueueNumber > 0 ? `#${live.currentServingQueueNumber}` : '—'} />
              <View style={styles.statDivider} />
              <Stat label="Ahead" value={pass.status === 'IN_CONSULTATION' ? '0' : String(live.patientsAway)} />
              <View style={styles.statDivider} />
              <Stat label="Wait" value={pass.status === 'IN_CONSULTATION' || live.isYourTurn ? 'Now' : live.isShiftPassed ? '—' : `~${waitLabel(live.estimatedWaitMinutes)}`} />
            </View>
            <Progress token={pass.token} serving={live.currentServingQueueNumber} />
          </>
        ) : (
          <Text style={styles.quiet}>
            {pass.status === 'PENDING_APPROVAL'
              ? 'Pay the receptionist to confirm your token.'
              : ACTIVE.has(pass.status)
                ? 'Live queue starts on the day of your visit.'
                : pass.status === 'EXPIRED'
                  ? 'Not confirmed before the shift ended.'
                  : pass.status === 'COMPLETED'
                    ? 'Visit complete'
                    : 'This token is no longer active.'}
          </Text>
        )}
        {note ? (
          <View style={[styles.banner, note.tone === 'go' ? styles.bannerGo : note.tone === 'wait' ? styles.bannerWait : styles.bannerInfo]}>
            <Ionicons name={note.icon} size={18} color={note.tone === 'go' ? colors.success : note.tone === 'wait' ? colors.warning : colors.primary} />
            <Text style={[styles.bannerText, { color: note.tone === 'go' ? colors.success : note.tone === 'wait' ? colors.warning : colors.ink }]}>{note.text}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function Meta({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <View style={[styles.meta, wide && { flex: 1.6 }]}>
      <Text style={styles.topLabel}>{label}</Text>
      <Text style={styles.metaValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={type.footnote}>{label}</Text>
    </View>
  );
}

/** Green dot with a soft ring that keeps pulsing while the queue is live. */
function LiveDot() {
  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.out(Easing.ease), useNativeDriver: Platform.OS !== 'web' }));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const ring = {
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }],
  };
  return (
    <View style={styles.liveDotBox}>
      <Animated.View style={[styles.liveDot, styles.liveRing, ring]} />
      <View style={styles.liveDot} />
    </View>
  );
}

/** How far the queue has come towards your token. */
function Progress({ token, serving }: { token: number; serving: number }) {
  const pct = token > 0 ? Math.min(1, Math.max(0.04, serving / token)) : 0;
  return (
    <View style={styles.track} accessibilityLabel={`Serving ${serving} of ${token}`}>
      <View style={[styles.fill, { width: `${pct * 100}%` }]} />
    </View>
  );
}

/** Receptionist name and phone with a Call button (always shown on tickets). */
export function DeskCard({ name, phone, prominent = false }: { name?: string | null; phone?: string | null; prominent?: boolean }) {
  if (!phone) return null;
  return (
    <View style={styles.desk}>
      <View style={styles.deskIcon}>
        <Ionicons name="person" size={20} color={colors.primary} />
      </View>
      <View style={styles.flex}>
        <Text style={type.footnote}>{name || 'Front desk'}</Text>
        <Text style={styles.deskPhone}>{formatDisplayPhone(phone)}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Call ${name || 'front desk'}`}
        onPress={() => Linking.openURL(toTelUri(phone))}
        style={({ pressed }) => [styles.callButton, !prominent && styles.callButtonSoft, pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] }]}
      >
        <Ionicons name="call" size={16} color={prominent ? colors.white : colors.primary} />
        <Text style={[styles.callText, !prominent && { color: colors.primary }]}>Call</Text>
      </Pressable>
    </View>
  );
}

const CANVAS = colors.canvas;

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  pass: { borderRadius: radius.card + 4, backgroundColor: colors.card, overflow: 'hidden', ...shadow.raised },
  passInactive: { opacity: 0.96 },
  top: { backgroundColor: colors.primary, padding: space.xl - 4, gap: space.lg },
  topInactive: { backgroundColor: colors.inactive },
  doctorRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  doctor: { fontSize: 17, fontWeight: '600', color: colors.white },
  topSub: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  tokenRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  topLabel: { fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  token: { fontSize: 64, lineHeight: 70, fontWeight: '600', color: colors.white, letterSpacing: -2 },
  statusPill: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: radius.pill, paddingHorizontal: 12, height: 28, justifyContent: 'center', marginBottom: 12 },
  statusText: { color: colors.white, fontSize: 13, fontWeight: '600' },
  metaRow: { flexDirection: 'row', gap: space.md },
  meta: { flex: 1, minWidth: 0, gap: 2 },
  metaValue: { fontSize: 15, fontWeight: '600', color: colors.white },
  forName: { fontSize: 14, color: 'rgba(255,255,255,0.85)' },
  notchRow: { height: 24, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card },
  notch: { width: 24, height: 24, borderRadius: 12, backgroundColor: CANVAS },
  notchLeft: { marginLeft: -12 },
  notchRight: { marginRight: -12 },
  perforation: { flex: 1, borderTopWidth: 2, borderStyle: 'dashed', borderColor: colors.hairline, marginHorizontal: space.sm },
  bottom: { paddingHorizontal: space.xl - 4, paddingBottom: space.xl - 4, paddingTop: space.xs, gap: space.lg },
  liveHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDotBox: { width: 8, height: 8, alignItems: 'center', justifyContent: 'center' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  liveRing: { position: 'absolute' },
  liveTitle: { fontSize: 13, fontWeight: '600', color: colors.success },
  stats: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 24, fontWeight: '600', color: colors.ink, letterSpacing: -0.5 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 36, backgroundColor: colors.border },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.fill, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
  quiet: { fontSize: 15, color: colors.muted, textAlign: 'center', paddingVertical: space.sm },
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.tile, padding: space.md },
  bannerGo: { backgroundColor: colors.successSoft },
  bannerWait: { backgroundColor: colors.warningSoft },
  bannerInfo: { backgroundColor: colors.primarySoft },
  bannerText: { flex: 1, fontSize: 15, lineHeight: 20 },
  desk: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.card, borderRadius: radius.card, padding: space.lg, ...shadow.card },
  deskIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  deskPhone: { fontSize: 17, fontWeight: '600', color: colors.ink, marginTop: 1 },
  callButton: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 18, borderRadius: radius.pill, backgroundColor: colors.primary },
  callButtonSoft: { backgroundColor: colors.primarySoft },
  callText: { fontSize: 15, fontWeight: '600', color: colors.white },
});
