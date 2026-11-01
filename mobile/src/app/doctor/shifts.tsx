// Doctor's shifts, working days, fee and leave, per clinic.
// Same server calls and checks as frontend/src/pages/Doctor/ManageSchedule.tsx and DoctorScheduleLeaveModal.tsx.
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Text } from '@/components/AppText';
import {
  ALL_WEEKDAYS,
  type DoctorAffiliationClinic,
  type DoctorLeave,
  type DoctorSlot,
  api,
  cleanSlotName,
  format12Hour,
  timeToMinutes,
} from '@mediarca/shared/api';
import { EmptyState, PillButton, PlaceholderCard, SectionTitle } from '@/components/kit';
import { LeaveList, LeaveSheet, leaveDates, upcomingLeaves, WeekdayDiscs } from '@/components/LeaveTools';
import { Button, Card, Field, Notice, Screen, SelectField, Title } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { confirmAction } from '@/lib/confirm';
import { success, tap } from '@/lib/haptics';
import { colors, radius, shadow, space, type } from '@/theme';

const TIMES = Array.from({ length: 96 }, (_, i) => {
  const value = `${String(Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`;
  return { value, label: format12Hour(value) };
});
const timeLabel = (v: string) => TIMES.find((t) => t.value === v)?.label || format12Hour(v);
const timeValue = (label: string) => TIMES.find((t) => t.label === label)?.value || label;

type EditSlot = Omit<DoctorSlot, 'maxPatients' | 'avgConsultationMinutes'> & { maxPatients: string; avgConsultationMinutes: string };

const toEdit = (slots: DoctorSlot[]): EditSlot[] =>
  slots.map((s, i) => ({
    ...s,
    name: cleanSlotName(s.name, `Shift ${i + 1}`),
    maxPatients: String(s.maxPatients ?? 25),
    avgConsultationMinutes: String(Math.round(Number(s.avgConsultationMinutes) || 20)),
  }));

export default function DoctorShifts() {
  const { user, refreshUser } = useAuth();
  const doctorId = user?.doctorProfile?.id || '';
  const [clinics, setClinics] = useState<DoctorAffiliationClinic[] | null>(null);
  const [clinicId, setClinicId] = useState('');
  const [failed, setFailed] = useState(false);
  const [slots, setSlots] = useState<EditSlot[]>([]);
  const [fee, setFee] = useState('');
  const [days, setDays] = useState<string[]>([]);
  const [leaves, setLeaves] = useState<DoctorLeave[]>([]);
  const [todayLeave, setTodayLeave] = useState<DoctorLeave | null>(null);
  const [saving, setSaving] = useState(false);
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [leaveMessage, setLeaveMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [addingLeave, setAddingLeave] = useState(false);

  const fill = useCallback((c: DoctorAffiliationClinic) => {
    setSlots(toEdit(c.slots || []));
    setFee(String(c.consultationFee ?? ''));
    setDays(c.workingDays?.length ? c.workingDays : ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']);
    setLeaves(c.leaves || []);
    setTodayLeave(c.isOnLeaveToday ? c.todayLeave || null : null);
  }, []);

  const load = useCallback(
    async (keepEdits = false) => {
      try {
        const aff = await api.getDoctorAffiliations();
        const list = aff.clinics || [];
        setClinics(list);
        setFailed(false);
        const current = list.find((c) => c.clinicId === clinicId) || list[0];
        if (current) {
          setClinicId(current.clinicId);
          if (keepEdits) {
            setLeaves(current.leaves || []);
            setTodayLeave(current.isOnLeaveToday ? current.todayLeave || null : null);
          } else fill(current);
        }
      } catch {
        setFailed(true);
      }
    },
    [clinicId, fill]
  );

  useFocusEffect(
    useCallback(() => {
      load();
      // Only when the screen opens; switching clinics fills from the loaded list
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const clinic = clinics?.find((c) => c.clinicId === clinicId);
  const upcoming = useMemo(() => upcomingLeaves(leaves), [leaves]);

  const pickClinic = (c: DoctorAffiliationClinic) => {
    setClinicId(c.clinicId);
    fill(c);
    setMessage(null);
    setLeaveMessage(null);
  };

  const setSlot = (i: number, change: Partial<EditSlot>) => setSlots((prev) => prev.map((s, j) => (j === i ? { ...s, ...change } : s)));

  const addSlot = () =>
    setSlots((prev) => {
      const lastEnd = prev.reduce((m, s) => Math.max(m, timeToMinutes(s.endTime)), 0);
      let start = prev.length ? lastEnd + 60 : 9 * 60;
      if (start >= 22 * 60) start = Math.min(lastEnd + 15, 23 * 60);
      const end = Math.min(23 * 60 + 45, start + 180);
      const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
      return [...prev, { id: `slot_${Date.now()}`, name: `Shift ${prev.length + 1}`, startTime: hhmm(start), endTime: hhmm(end), maxPatients: '25', avgConsultationMinutes: '20' }];
    });

  const removeSlot = (i: number) => {
    if (slots.length <= 1) return setMessage({ tone: 'error', text: 'Add at least one shift.' });
    setSlots((prev) => prev.filter((_, j) => j !== i).map((s, j) => ({ ...s, name: /^Shift\s+\d+$/i.test(s.name) ? `Shift ${j + 1}` : s.name })));
  };

  const toggleDay = (d: string) => {
    tap();
    setDays((prev) => {
      if (prev.includes(d)) {
        if (prev.length <= 1) {
          setMessage({ tone: 'error', text: 'Pick at least one day.' });
          return prev;
        }
        return prev.filter((x) => x !== d);
      }
      return ALL_WEEKDAYS.filter((x) => prev.includes(x) || x === d);
    });
  };

  const save = async () => {
    setMessage(null);
    if (!clinic) return;
    if (!days.length) return setMessage({ tone: 'error', text: 'Pick at least one day.' });
    if (fee === '' || Number.isNaN(Number(fee)) || Number(fee) < 0) return setMessage({ tone: 'error', text: 'Enter a fee of ₹0 or more.' });
    for (const [i, s] of slots.entries()) {
      const label = s.name || `Shift ${i + 1}`;
      if (timeToMinutes(s.endTime) <= timeToMinutes(s.startTime)) return setMessage({ tone: 'error', text: `End time must be after start time (${label}).` });
      if (!(Number(s.maxPatients) >= 1)) return setMessage({ tone: 'error', text: `Max patients must be at least 1 (${label}).` });
      if (!(Number(s.avgConsultationMinutes) >= 1)) return setMessage({ tone: 'error', text: `Mins per patient must be at least 1 (${label}).` });
    }
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const a = slots[i];
        const b = slots[j];
        if (timeToMinutes(a.startTime) < timeToMinutes(b.endTime) && timeToMinutes(b.startTime) < timeToMinutes(a.endTime)) {
          return setMessage({ tone: 'error', text: `${a.name} and ${b.name} overlap. Change the times.` });
        }
      }
    }
    setSaving(true);
    try {
      await api.updateDoctorSchedule({
        clinicId: clinic.clinicId,
        slots: slots.map((s) => ({ ...s, name: s.name.trim() || 'Shift', maxPatients: Number(s.maxPatients), avgConsultationMinutes: Number(s.avgConsultationMinutes) })),
        consultationFee: Number(fee),
        workingDays: days,
      });
      success();
      setMessage({ tone: 'success', text: `Saved for ${clinic.clinicName}.` });
      refreshUser();
      load(true);
    } catch (err: any) {
      setMessage({ tone: 'error', text: err?.message || 'Couldn’t save. Try again.' });
    } finally {
      setSaving(false);
    }
  };

  const toggleToday = async () => {
    if (!doctorId || !clinic) return;
    setLeaveBusy(true);
    setLeaveMessage(null);
    try {
      if (todayLeave) {
        await api.cancelDoctorLeave(doctorId, todayLeave.id);
        setTodayLeave(null);
        setLeaveMessage({ tone: 'success', text: 'You’re available today.' });
      } else {
        const res: any = await api.addDoctorLeave(doctorId, { type: 'TODAY', reason: 'Marked on leave today', clinicId: clinic.clinicId });
        setTodayLeave(res?.data || res || ({ id: '' } as DoctorLeave));
        setLeaveMessage({ tone: 'success', text: 'You’re on leave today.' });
      }
      load(true);
    } catch (err: any) {
      setLeaveMessage({ tone: 'error', text: err?.message || 'Couldn’t update leave. Try again.' });
    } finally {
      setLeaveBusy(false);
    }
  };

  const cancelLeave = async (l: DoctorLeave) => {
    const ok = await confirmAction({ title: 'Remove leave?', message: leaveDates(l), confirmLabel: 'Remove' });
    if (!ok) return;
    setLeaveMessage(null);
    try {
      await api.cancelDoctorLeave(doctorId, l.id);
      setLeaves((prev) => prev.filter((x) => x.id !== l.id));
      setLeaveMessage({ tone: 'success', text: 'Leave removed.' });
      load(true);
    } catch (err: any) {
      setLeaveMessage({ tone: 'error', text: err?.message || 'Couldn’t remove leave. Try again.' });
    }
  };

  if (!clinics) {
    return (
      <Screen edges={['top']}>
        <Title>Shifts</Title>
        {failed ? (
          <EmptyState icon="cloud-offline-outline" title="Couldn’t load your shifts" message="Check your connection and try again." actionLabel="Try again" onAction={() => load()} />
        ) : (
          <>
            <PlaceholderCard height={120} />
            <PlaceholderCard height={220} />
          </>
        )}
      </Screen>
    );
  }

  if (clinics.length === 0) {
    return (
      <Screen edges={['top']}>
        <Title>Shifts</Title>
        <EmptyState icon="business-outline" title="No clinics yet" message="Join a clinic, then set your shifts here." actionLabel="Join a clinic" onAction={() => router.navigate('/doctor/clinics')} />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <Title>Shifts</Title>

      {clinics.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills} style={styles.bleed}>
          {clinics.map((c) => (
            <PillButton key={c.clinicId} label={c.clinicName} active={c.clinicId === clinicId} onPress={() => pickClinic(c)} />
          ))}
        </ScrollView>
      ) : (
        <Text style={type.caption}>{clinic?.clinicName}</Text>
      )}

      <View style={styles.group}>
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text style={type.headline}>On leave today</Text>
            <Text style={type.footnote}>{todayLeave ? 'Patients can’t book today.' : 'Available'}</Text>
          </View>
          <Switch value={Boolean(todayLeave)} onValueChange={toggleToday} disabled={leaveBusy} trackColor={{ true: colors.primary, false: undefined }} />
        </View>
      </View>

      <SectionTitle title="Leave" right={<PillButton label="Add" icon="add" onPress={() => setAddingLeave(true)} />} />
      <LeaveList leaves={upcoming} onRemove={cancelLeave} />
      <Notice tone={leaveMessage?.tone || 'info'} message={leaveMessage?.text} />

      <SectionTitle title="Days" />
      <WeekdayDiscs days={days} onToggle={toggleDay} />

      <SectionTitle title="Shifts" right={<PillButton label="Add" icon="add" onPress={addSlot} />} />
      {slots.map((s, i) => (
        <Card key={s.id}>
          <View style={styles.slotHead}>
            <View style={styles.flex}>
              <Field label="Name" value={s.name} onChangeText={(t) => setSlot(i, { name: t })} maxLength={40} />
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Remove shift" hitSlop={8} onPress={() => removeSlot(i)} style={styles.trash}>
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </Pressable>
          </View>
          <View style={styles.row}>
            <View style={styles.flex}>
              <SelectField label="Start" value={timeLabel(s.startTime)} options={TIMES.map((t) => t.label)} onChange={(l) => setSlot(i, { startTime: timeValue(l) })} />
            </View>
            <View style={styles.flex}>
              <SelectField label="End" value={timeLabel(s.endTime)} options={TIMES.map((t) => t.label)} onChange={(l) => setSlot(i, { endTime: timeValue(l) })} />
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Field label="Max patients" value={s.maxPatients} onChangeText={(t) => setSlot(i, { maxPatients: t.replace(/\D/g, '').slice(0, 3) })} keyboardType="number-pad" />
            </View>
            <View style={styles.flex}>
              <Field
                label="Mins per patient"
                value={s.avgConsultationMinutes}
                onChangeText={(t) => setSlot(i, { avgConsultationMinutes: t.replace(/\D/g, '').slice(0, 3) })}
                keyboardType="number-pad"
              />
            </View>
          </View>
        </Card>
      ))}

      <Card>
        <Field label="Consultation fee" prefix="₹" value={fee} onChangeText={(t) => setFee(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" />
      </Card>

      <Notice tone={message?.tone || 'info'} message={message?.text} stamp={message} />
      <Button label="Save" onPress={save} loading={saving} />

      <LeaveSheet
        visible={addingLeave}
        onClose={() => setAddingLeave(false)}
        onSave={async (startDate, endDate, reason) => {
          await api.addDoctorLeave(doctorId, { type: 'DATE_RANGE', startDate, endDate, reason: reason || undefined, clinicId: clinic?.clinicId });
          success();
          setLeaveMessage({ tone: 'success', text: 'Leave added.' });
          load(true);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  bleed: { marginHorizontal: -(space.lg + 4), flexGrow: 0 },
  pills: { gap: space.sm, paddingHorizontal: space.lg + 4 },
  group: { backgroundColor: colors.card, borderRadius: radius.card, overflow: 'hidden', ...shadow.card },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  slotHead: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  trash: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  row: { flexDirection: 'row', gap: space.md },
});
