// Front desk doctors: who is available today, quick Leave / Resume for today, and each doctor's
// working days and planned leave at this clinic. Same calls as frontend/src/pages/Receptionist/desk/DoctorsTab.tsx
// and components/common/DoctorScheduleLeaveModal.tsx.
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import { ALL_WEEKDAYS, type DoctorLeave, type DoctorScheduleConfig, type ReceptionistLinkedDoctor, api } from '@mediarca/shared/api';
import { Avatar, Chip, EmptyState, PillButton, PlaceholderCard, SectionTitle, Sheet, Toggle } from '@/components/kit';
import { LeaveForm, LeaveList, leaveDates, upcomingLeaves, WeekdayDiscs } from '@/components/LeaveTools';
import { Button, Notice, Screen, Title } from '@/components/ui';
import { useDesk } from '@/context/DeskContext';
import { doctorName } from '@/lib/booking';
import { confirmAction } from '@/lib/confirm';
import { success, tap } from '@/lib/haptics';
import { colors, radius, shadow, space, type } from '@/theme';

const DEFAULT_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export default function DeskDoctors() {
  const { desk, failed, reload } = useDesk();
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [open, setOpen] = useState<ReceptionistLinkedDoctor | null>(null);
  const clinicId = desk?.clinic?.id || undefined;
  const doctors = desk?.doctors || [];

  const onRefresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  const toggleToday = async (doc: ReceptionistLinkedDoctor) => {
    const name = doctorName(doc.fullName);
    setBusy(doc.doctorId);
    setMessage(null);
    try {
      if (doc.isOnLeaveToday && doc.todayLeave) {
        await api.cancelDoctorLeave(doc.doctorId, doc.todayLeave.id);
        setMessage({ tone: 'success', text: `${name} is available today.` });
      } else {
        await api.addDoctorLeave(doc.doctorId, { type: 'TODAY', reason: 'Marked on leave today', clinicId });
        setMessage({ tone: 'success', text: `${name} is on leave today.` });
      }
      success();
      await reload();
    } catch (err: any) {
      setMessage({ tone: 'error', text: err?.message || 'Couldn’t update leave. Try again.' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen edges={['top']} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <Title subtitle={desk?.clinic?.clinicName}>Doctors</Title>
      <Notice tone={message?.tone || 'info'} message={message?.text} stamp={message} />

      {!desk ? (
        failed ? (
          <EmptyState icon="cloud-offline-outline" title="Couldn’t load" message="Check your connection." actionLabel="Try again" onAction={reload} />
        ) : (
          <PlaceholderCard height={160} />
        )
      ) : doctors.length === 0 ? (
        <EmptyState icon="medkit-outline" title="No doctors yet" message="Your clinic adds doctors to this desk." />
      ) : (
        doctors.map((doc) => {
          const leave = Boolean(doc.isOnLeaveToday);
          const status = leave
            ? { label: 'On leave', tone: 'danger' as const }
            : doc.isWorkingToday === false
              ? { label: 'Day off', tone: 'warning' as const }
              : { label: 'Available', tone: 'success' as const };
          const next = upcomingLeaves(doc.leaves)[0];
          return (
            <View key={doc.doctorId} style={styles.card}>
              <View style={styles.head}>
                <Avatar uri={doc.avatarUrl} name={doc.fullName} size={48} />
                <View style={styles.flex}>
                  <Text style={type.headline} numberOfLines={1}>
                    {doctorName(doc.fullName)}
                  </Text>
                  <Text style={type.footnote} numberOfLines={1}>
                    {doc.specialty}
                  </Text>
                </View>
                <Chip label={status.label} tone={status.tone} dot />
              </View>

              <WeekdayDiscs small days={doc.workingDays?.length ? doc.workingDays : DEFAULT_DAYS} />

              <View style={styles.switchRow}>
                <View style={styles.flex}>
                  <Text style={type.body}>On leave today</Text>
                  {next ? (
                    <Text style={type.footnote} numberOfLines={1}>
                      Next leave: {leaveDates(next)}
                    </Text>
                  ) : null}
                </View>
                <Toggle
                  accessibilityLabel={`${doctorName(doc.fullName)} on leave today`}
                  value={leave}
                  onValueChange={() => toggleToday(doc)}
                  disabled={busy === doc.doctorId}
                />
              </View>

              <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setOpen(doc)} style={styles.linkRow}>
                <Text style={styles.link}>Days and leave</Text>
              </Pressable>
            </View>
          );
        })
      )}

      <ScheduleSheet
        doctor={open}
        clinicId={clinicId}
        onClose={() => setOpen(null)}
        onChanged={(text) => {
          setMessage({ tone: 'success', text });
          reload();
        }}
      />
    </Screen>
  );
}

/** One doctor's working days and planned leave at this clinic. */
function ScheduleSheet({
  doctor,
  clinicId,
  onClose,
  onChanged,
}: {
  doctor: ReceptionistLinkedDoctor | null;
  clinicId?: string;
  onClose: () => void;
  onChanged: (message: string) => void;
}) {
  const [config, setConfig] = useState<DoctorScheduleConfig | null>(null);
  const [days, setDays] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const doctorId = doctor?.doctorId || '';

  const load = useCallback(async () => {
    if (!doctorId) return;
    try {
      const c = await api.getDoctorScheduleConfig(doctorId, clinicId);
      setConfig(c);
      setDays(c.workingDays?.length ? c.workingDays : DEFAULT_DAYS);
    } catch (err: any) {
      setError(err?.message || 'Couldn’t load the schedule. Try again.');
    }
  }, [doctorId, clinicId]);

  // Fresh each time the sheet opens for a doctor
  const [seen, setSeen] = useState('');
  if (doctorId !== seen) {
    setSeen(doctorId);
    setConfig(null);
    setError(null);
    setNote(null);
    setAdding(false);
  }
  useEffect(() => {
    if (!doctorId) return;
    queueMicrotask(() => {
      load();
    });
  }, [doctorId, load]);

  const toggleDay = (d: string) => {
    tap();
    setNote(null);
    setDays((prev) => {
      if (prev.includes(d)) {
        if (prev.length <= 1) {
          setError('Pick at least one day.');
          return prev;
        }
        return prev.filter((x) => x !== d);
      }
      return ALL_WEEKDAYS.filter((x) => prev.includes(x) || x === d);
    });
  };

  const saveDays = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.updateDoctorWorkingDays(doctorId, days, clinicId);
      setConfig((c) => (c ? { ...c, workingDays: days } : c));
      success();
      setNote('Days saved.');
      onChanged(`Days saved for ${doctorName(doctor?.fullName)}.`);
    } catch (err: any) {
      setError(err?.message || 'Couldn’t save the days. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const removeLeave = async (l: DoctorLeave) => {
    const ok = await confirmAction({ title: 'Remove leave?', message: leaveDates(l), confirmLabel: 'Remove' });
    if (!ok) return;
    setError(null);
    try {
      await api.cancelDoctorLeave(doctorId, l.id);
      setNote('Leave removed.');
      onChanged('Leave removed.');
      load();
    } catch (err: any) {
      setError(err?.message || 'Couldn’t remove leave. Try again.');
    }
  };

  const savedDays = config?.workingDays?.length ? config.workingDays : DEFAULT_DAYS;
  const changed = days.join() !== savedDays.join();

  return (
    <Sheet visible={Boolean(doctor)} title={doctorName(doctor?.fullName) || 'Doctor'} doneLabel="Close" onClose={() => !saving && onClose()}>
      {!config ? (
        error ? <Notice tone="error" message={error} /> : <PlaceholderCard height={160} />
      ) : (
        <>
          <SectionTitle title="Days" />
          <WeekdayDiscs days={days} onToggle={toggleDay} />
          {changed ? <Button label="Save days" onPress={saveDays} loading={saving} /> : null}

          <SectionTitle title="Leave" right={adding ? null : <PillButton label="Add" icon="add" onPress={() => setAdding(true)} />} />
          {adding ? (
            <LeaveForm
              onDone={() => setAdding(false)}
              onCancel={() => setAdding(false)}
              onSave={async (startDate, endDate) => {
                setError(null);
                await api.addDoctorLeave(doctorId, { type: 'DATE_RANGE', startDate, endDate, clinicId });
                success();
                setNote('Leave added.');
                onChanged(`Leave added for ${doctorName(doctor?.fullName)}.`);
                load();
              }}
            />
          ) : null}
          <LeaveList leaves={upcomingLeaves(config.leaves)} onRemove={removeLeave} />
          <Notice tone="error" message={error} />
          <Notice tone="success" message={note} />
        </>
      )}

    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0, gap: 2 },
  card: { backgroundColor: colors.card, borderRadius: radius.card, padding: space.lg, gap: space.md, ...shadow.card },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  linkRow: { alignSelf: 'flex-start' },
  link: { fontSize: 15, color: colors.primary },
});
