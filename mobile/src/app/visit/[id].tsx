// Live queue pass for one booking. Refreshes quietly (10s near your turn, up to 60s otherwise).
// Check in = scan the desk QR (no codes to type). Same rules as LiveQueueTicket.tsx / MyAppointments.tsx.
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import { type Appointment, api, getLocalDateString } from '@mediarca/shared/api';
import { DeskCard, QueuePass, passFromAppointment } from '@/components/QueuePass';
import { EmptyState, PlaceholderCard } from '@/components/kit';
import { Button, Notice, Screen } from '@/components/ui';
import { confirmAction } from '@/lib/confirm';
import { success } from '@/lib/haptics';
import { usePolling, keepIfSame } from '@/lib/usePolling';
import { colors, radius, shadow, space, type } from '@/theme';

export default function Visit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [appt, setAppt] = useState<Appointment | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      // The "my visits" list carries the live queue (now serving, ahead, live time); fall back to the single lookup
      const active = await api.getPatientAppointments({ status: 'active' }).catch(() => [] as Appointment[]);
      const found = active.find((a) => a.id === String(id));
      setAppt(keepIfSame(found || (await api.getAppointmentById(String(id)))));
      setFailed(false);
    } catch {
      // Keep the last pass on screen during background refreshes
      setFailed(true);
    }
  }, [id]);

  // Fresh data each time the screen shows (e.g. back from the scanner)
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const isToday = appt?.appointmentDate === getLocalDateString();
  const active = appt?.status === 'WAITING' || appt?.status === 'IN_CONSULTATION';
  const pollMs = useMemo(() => {
    const ahead = appt?.liveQueue?.patientsAway ?? 99;
    if (appt?.status === 'IN_CONSULTATION' || ahead <= 1) return 10000;
    if (ahead <= 5) return 15000;
    return 60000;
  }, [appt]);
  usePolling(load, pollMs, Boolean(appt && (active || appt.status === 'PENDING_APPROVAL')));

  if (!appt) {
    return (
      <Screen back="/patient/visits">
        {failed ? (
          <EmptyState icon="cloud-offline-outline" title="Couldn’t load your token" message="Check your connection and try again." actionLabel="Try again" onAction={load} />
        ) : (
          <>
            <PlaceholderCard height={330} />
            <PlaceholderCard height={76} />
          </>
        )}
      </Screen>
    );
  }

  const pending = appt.status === 'PENDING_APPROVAL';
  const deskPhone = appt.receptionistPhone || appt.clinic?.phone || null;
  const canCheckIn = isToday && appt.status === 'WAITING' && !appt.isCheckedIn && !appt.liveQueue?.isShiftPassed;
  const checkedIn = isToday && active && Boolean(appt.isCheckedIn);

  const stepOut = async () => {
    const ok = await confirmAction({ title: 'Step out?', message: 'Scan the QR again when you’re back.', confirmLabel: 'Step out' });
    if (!ok) return;
    setMessage(null);
    setBusy(true);
    setAppt((a) => (a ? { ...a, isCheckedIn: false } : a));
    try {
      await api.checkInAppointmentDirect(appt.id, false);
      setMessage({ tone: 'success', text: 'Marked as stepped out' });
      load();
    } catch (err: any) {
      setAppt((a) => (a ? { ...a, isCheckedIn: true } : a));
      setMessage({ tone: 'error', text: err?.message || 'Couldn’t update. Try again.' });
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    const ok = await confirmAction({
      title: pending ? 'Cancel request?' : 'Cancel token?',
      message: 'This can’t be undone.',
      confirmLabel: 'Cancel',
    });
    if (!ok) return;
    setMessage(null);
    setBusy(true);
    try {
      await api.cancelAppointment(appt.id);
      success();
      router.back();
    } catch (err: any) {
      setMessage({ tone: 'error', text: err?.message || 'Couldn’t cancel appointment. Try again.' });
    } finally {
      setBusy(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <Screen back="/patient/visits" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.muted} />}>
      <QueuePass pass={passFromAppointment(appt)} />

      {canCheckIn ? (
        <View style={styles.checkin}>
          <View style={styles.checkinText}>
            <Text style={type.headline}>Not checked in</Text>
            <Text style={type.caption}>Scan the QR code at the front desk when you arrive.</Text>
          </View>
          <Button label="Check in" icon="qr-code" onPress={() => router.push({ pathname: '/scan', params: { appointmentId: appt.id } })} />
        </View>
      ) : null}

      {checkedIn ? (
        <View style={styles.checkedRow}>
          <Ionicons name="checkmark-circle" size={24} color={colors.success} />
          <View style={styles.flex}>
            <Text style={type.headline}>You’re checked in</Text>
            <Text style={type.caption}>{appt.status === 'IN_CONSULTATION' ? 'With doctor' : 'Wait for your turn'}</Text>
          </View>
          {appt.status === 'WAITING' ? (
            <Pressable accessibilityRole="button" disabled={busy} onPress={stepOut} hitSlop={8} style={styles.stepOut}>
              <Text style={styles.stepOutText}>Step out</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <Notice tone={message?.tone || 'info'} message={message?.text} stamp={message} />

      {(pending || active) && deskPhone ? <DeskCard name={appt.receptionistName} phone={deskPhone} prominent={pending} /> : null}

      {appt.status === 'EXPIRED' && appt.doctorId ? (
        <Button
          label="Book again"
          variant="secondary"
          onPress={() => router.push({ pathname: '/doctors/[id]', params: { id: appt.doctorId, ...(appt.clinicId ? { clinicId: appt.clinicId } : {}) } })}
        />
      ) : null}

      {pending || appt.status === 'WAITING' ? (
        <Pressable accessibilityRole="button" disabled={busy} onPress={cancel} hitSlop={8} style={styles.cancel}>
          <Text style={styles.cancelText}>{pending ? 'Cancel request' : 'Cancel token'}</Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  checkin: { backgroundColor: colors.card, borderRadius: radius.card, padding: space.lg + 2, gap: space.lg, ...shadow.card },
  checkinText: { gap: 4 },
  checkedRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.card, borderRadius: radius.card, padding: space.lg, ...shadow.card },
  stepOut: { height: 34, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.fill, justifyContent: 'center' },
  stepOutText: { fontSize: 14, color: colors.ink },
  cancel: { alignSelf: 'center', paddingVertical: space.md },
  cancelText: { fontSize: 16, color: colors.danger },
});
