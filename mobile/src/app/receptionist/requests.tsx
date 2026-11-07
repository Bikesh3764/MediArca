// Booking requests waiting for payment: call the patient (UPI over call or at the desk), then Mark paid
// to confirm the token, or Decline. Same calls as frontend/src/pages/Receptionist/desk/PendingTab.tsx.
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import { type Appointment, api, formatDisplayDate, shiftLabel } from '@mediarca/shared/api';
import { formatDisplayPhone, toTelUri } from '@mediarca/shared/utils/phoneUtils';
import { visitTag } from '@mediarca/shared/utils/queueDisplay';
import { EmptyState, kitStyles } from '@/components/kit';
import { type MoveTarget, MoveSheet } from '@/components/MoveSheet';
import { Button, Notice, Screen, Title } from '@/components/ui';
import { useDesk } from '@/context/DeskContext';
import { doctorName } from '@/lib/booking';
import { confirmAction } from '@/lib/confirm';
import { success } from '@/lib/haptics';
import { colors, radius, shadow, space, type } from '@/theme';

const nameOf = (a: Appointment) => a.patientName || a.patient?.user?.fullName || 'Patient';

/** "Requested 5 min ago" (or "2 h ago", "Yesterday"). */
const agoLabel = (iso?: string) => {
  const t = iso ? new Date(iso).getTime() : NaN;
  if (!Number.isFinite(t)) return null;
  const min = Math.max(0, Math.floor((Date.now() - t) / 60000));
  if (min < 1) return 'Requested just now';
  if (min < 60) return `Requested ${min} min ago`;
  if (min < 24 * 60) return `Requested ${Math.floor(min / 60)} h ago`;
  return min < 48 * 60 ? 'Requested yesterday' : `Requested ${Math.floor(min / 1440)} days ago`;
};

export default function DeskRequests() {
  const { desk, pending, setPending, reloadPending, reload } = useDesk();
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<{ id?: string; tone: 'success' | 'error'; text: string } | null>(null);
  const [moving, setMoving] = useState<MoveTarget | null>(null);

  useFocusEffect(
    useCallback(() => {
      reloadPending();
    }, [reloadPending])
  );

  const markPaid = async (a: Appointment) => {
    // A paid token can't be taken back, so check first (no Undo)
    const name = nameOf(a);
    const ok = await confirmAction({ title: `Mark ${name} paid?`, message: 'Their token is confirmed and they are told.', confirmLabel: 'Mark paid' });
    if (!ok) return;
    setBusy(`ok-${a.id}`);
    setMessage(null);
    try {
      const res: any = await api.approveAppointment(a.id);
      success();
      setPending((list) => list.filter((x) => x.id !== a.id));
      const token = res?.data?.queueNumber ?? res?.queueNumber;
      setMessage({ tone: 'success', text: token > 0 ? `${name} paid · Token #${token}.` : `${name} paid. Token confirmed.` });
      reloadPending();
      reload();
    } catch (err: any) {
      setMessage({ id: a.id, tone: 'error', text: err?.message || 'Couldn’t confirm. Try again.' });
    } finally {
      setBusy(null);
    }
  };

  const decline = async (a: Appointment) => {
    const ok = await confirmAction({ title: 'Decline booking?', message: 'The patient will be told.', confirmLabel: 'Decline' });
    if (!ok) return;
    setBusy(`no-${a.id}`);
    setMessage(null);
    try {
      await api.rejectAppointment(a.id, 'Booking request declined by reception desk.');
      setPending((list) => list.filter((x) => x.id !== a.id));
      setMessage({ tone: 'success', text: 'Booking declined.' });
      reloadPending();
    } catch (err: any) {
      setMessage({ id: a.id, tone: 'error', text: err?.message || 'Couldn’t decline. Try again.' });
    } finally {
      setBusy(null);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await reloadPending();
    setRefreshing(false);
  };

  const slotsFor = (a: Appointment) => desk?.doctors.find((d) => d.doctorId === a.doctorId)?.slots || [];
  const movingAppt = moving ? pending.find((p) => p.id === moving.id) : undefined;

  return (
    <Screen edges={['top']} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <Title subtitle="Collect the fee, then mark paid.">Requests</Title>
      {message && !message.id ? <Notice tone={message.tone} message={message.text} /> : null}

      {pending.length === 0 ? (
        <EmptyState icon="wallet-outline" title="No requests" message="New online bookings show up here." />
      ) : (
        pending.map((a) => {
          const name = nameOf(a);
          const phone = a.patientPhone || a.patient?.user?.phone || '';
          const fee = a.fee || a.doctor?.consultationFee || 0;
          const tag = visitTag(a);
          return (
            <View key={a.id} style={styles.card}>
              <View style={styles.top}>
                <View style={styles.flex}>
                  <View style={styles.nameRow}>
                    <Text style={[type.headline, styles.shrink]} numberOfLines={1}>
                      {name}
                    </Text>
                    {tag ? <Text style={styles.tag}>{tag}</Text> : null}
                  </View>
                  <Text style={type.footnote} numberOfLines={1}>
                    {doctorName(a.doctor?.user?.fullName)}
                  </Text>
                  <Text style={type.footnote} numberOfLines={1}>
                    {formatDisplayDate(a.appointmentDate)} · {shiftLabel(a)}
                  </Text>
                  <Text style={type.footnote} numberOfLines={1}>
                    {[a.estimatedQueueNumber ? `Est. token #${a.estimatedQueueNumber}` : null, agoLabel(a.createdAt)].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Text style={styles.fee}>₹{fee}</Text>
              </View>

              {phone ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => Linking.openURL(toTelUri(phone))}
                  style={({ pressed }) => [styles.callRow, pressed && kitStyles.pressed]}
                >
                  <View style={styles.callIcon}>
                    <Ionicons name="call" size={14} color={colors.primary} />
                  </View>
                  <Text style={[type.body, styles.flex]}>{formatDisplayPhone(phone)}</Text>
                  <Text style={styles.callText}>Call</Text>
                </Pressable>
              ) : null}

              {message?.id === a.id ? <Notice tone={message.tone} message={message.text} /> : null}

              <Button label="Mark paid" icon="checkmark" onPress={() => markPaid(a)} loading={busy === `ok-${a.id}`} disabled={Boolean(busy)} />
              <View style={styles.links}>
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  disabled={Boolean(busy)}
                  onPress={() => setMoving({ id: a.id, name, date: a.appointmentDate, slotId: a.slotId })}
                >
                  <Text style={styles.link}>Change date</Text>
                </Pressable>
                <Pressable accessibilityRole="button" hitSlop={8} disabled={Boolean(busy)} onPress={() => decline(a)}>
                  <Text style={[styles.link, { color: colors.danger }]}>Decline</Text>
                </Pressable>
              </View>
            </View>
          );
        })
      )}

      <MoveSheet
        target={moving}
        slots={movingAppt ? slotsFor(movingAppt) : []}
        onClose={() => setMoving(null)}
        onMove={async (t, newDate, slotId) => {
          await api.rescheduleAppointment(t.id, { newDate, newSlotId: slotId });
          success();
          setMessage({ tone: 'success', text: `${t.name} moved to ${formatDisplayDate(newDate)}.` });
          reloadPending();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0, gap: 2 },
  shrink: { flexShrink: 1 },
  card: { backgroundColor: colors.card, borderRadius: radius.card, padding: space.lg, gap: space.md, ...shadow.card },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tag: { fontSize: 12, color: colors.secondaryInk, backgroundColor: colors.canvas, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
  fee: { fontSize: 22, fontWeight: '600', color: colors.ink },
  callRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.canvas, borderRadius: radius.tile, paddingHorizontal: space.md, height: 48 },
  callIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  callText: { fontSize: 16, fontWeight: '600', color: colors.primary },
  links: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.sm },
  link: { fontSize: 15, color: colors.primary },
});
