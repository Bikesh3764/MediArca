// Front desk queue for one doctor: cabin status, arrivals, start consultation, complete, move, cancel.
// Same server calls and rules as frontend/src/pages/Receptionist/desk (state.tsx, QueueTab.tsx).
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import { type ReceptionistQueueItem, api, formatDisplayDate, getLocalDateString, getTomorrowDateString, shiftLabel, slotTimeLabel } from '@mediarca/shared/api';
import { visitMatchesSlot, visitTag } from '@mediarca/shared/utils/queueDisplay';
import { ActionMenu, type MenuAction } from '@/components/ActionMenu';
import { CabinControl } from '@/components/CabinControl';
import { CodeCard, type CodeTarget } from '@/components/CodeCard';
import { InCabinCard } from '@/components/InCabinCard';
import { EmptyState, PlaceholderCard, SectionTitle } from '@/components/kit';
import { type MoveTarget, MoveSheet } from '@/components/MoveSheet';
import { QueueRow } from '@/components/QueueRow';
import { ShiftChips } from '@/components/ShiftChips';
import { NotificationBell } from '@/components/NotificationBell';
import { Notice, Screen, Segmented, Title } from '@/components/ui';
import { useDesk } from '@/context/DeskContext';
import { doctorName } from '@/lib/booking';
import { confirmAction } from '@/lib/confirm';
import { todayLong } from '@/lib/dates';
import { success } from '@/lib/haptics';
import { usePolling, keepIfSame } from '@/lib/usePolling';
import { groupByShift, rowMenuTitle, slotKey } from '@/lib/queueGroups';
import { space, type } from '@/theme';

export default function DeskQueue() {
  const { desk, failed: deskFailed, reload, setDoctorCabin } = useDesk();
  const doctors = useMemo(() => desk?.doctors || [], [desk]);
  const [chosenDoctorId, setDoctorId] = useState('');
  // First doctor by default; keep the choice while it still exists
  const doctorId = doctors.some((d) => d.doctorId === chosenDoctorId) ? chosenDoctorId : doctors[0]?.doctorId || '';
  const [date, setDate] = useState(getLocalDateString());
  const [list, setList] = useState<ReceptionistQueueItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [menu, setMenu] = useState<{ title: string; actions: MenuAction[] } | null>(null);
  const [moving, setMoving] = useState<MoveTarget | null>(null);
  const [chosenShift, setShift] = useState('all');
  const [code, setCode] = useState<CodeTarget | null>(null);

  const doctor = doctors.find((d) => d.doctorId === doctorId);
  const isTodayQueue = date === getLocalDateString();

  const load = useCallback(async () => {
    if (!doctorId) return;
    try {
      const res = await api.getReceptionistDoctorQueue(doctorId, date);
      setList(keepIfSame<ReceptionistQueueItem[] | null>(res.appointments));
      setFailed(false);
      if (res.doctor?.cabinStatus) setDoctorCabin(doctorId, res.doctor.cabinStatus, res.doctor.expectedReturnTime ?? null);
    } catch {
      setFailed(true);
    }
  }, [doctorId, date, setDoctorCabin]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );
  usePolling(load, 15000, Boolean(doctorId));

  const items = list || [];
  const away = Boolean(doctor?.cabinStatus && doctor.cabinStatus !== 'IN_CABIN');
  const slots = doctor?.slots || [];
  // Chosen shift; falls back to all shifts when it no longer exists
  const shift = slots.some((s) => slotKey(s) === chosenShift) ? chosenShift : 'all';
  const inShift = (a: ReceptionistQueueItem) => shift === 'all' || slots.some((s) => slotKey(s) === shift && visitMatchesSlot(a, s));
  const inCabin = items.find((a) => a.status === 'IN_CONSULTATION');
  const waiting = items.filter((a) => a.status === 'WAITING' && inShift(a));
  const done = items.filter((a) => (a.status === 'COMPLETED' || a.status === 'CANCELLED') && inShift(a));

  const shiftOf = (a: ReceptionistQueueItem) => {
    if (slots.length < 2) return null;
    const i = slots.findIndex((s) => visitMatchesSlot(a, s));
    return i >= 0 ? slotTimeLabel(slots[i]) : shiftLabel(a);
  };
  const metaOf = (a: ReceptionistQueueItem) => (a.status === 'CANCELLED' ? 'Cancelled' : undefined);
  const waitingGroups = groupByShift(waiting, shift === 'all' ? shiftOf : () => null);

  const patchItem = (id: string, change: Partial<ReceptionistQueueItem>) => setList((l) => (l ? l.map((a) => (a.id === id ? { ...a, ...change } : a)) : l));

  const setStatus = async (a: ReceptionistQueueItem, status: string, okText?: string) => {
    if (status === 'IN_CONSULTATION' && away) {
      return setMessage({ tone: 'error', text: `${doctorName(doctor?.fullName)} isn’t in the cabin. Set In cabin first.` });
    }
    if ((status === 'IN_CONSULTATION' || status === 'COMPLETED') && !isTodayQueue) {
      return setMessage({ tone: 'error', text: 'You can only update today’s appointments.' });
    }
    if ((status === 'IN_CONSULTATION' || status === 'COMPLETED') && !a.isCheckedIn) {
      return setMessage({ tone: 'error', text: 'Mark the patient as arrived first.' });
    }
    const before = a.status;
    setMessage(null);
    setBusy(`${status}-${a.id}`);
    patchItem(a.id, { status });
    try {
      await api.updateAppointmentStatus(a.id, status);
      if (okText) {
        success();
        setMessage({ tone: 'success', text: okText });
      }
      load();
      reload();
    } catch (err: any) {
      patchItem(a.id, { status: before });
      setMessage({ tone: 'error', text: err?.message || 'Couldn’t update. Try again.' });
    } finally {
      setBusy(null);
    }
  };

  const toggleArrived = async (a: ReceptionistQueueItem) => {
    const next = !a.isCheckedIn;
    patchItem(a.id, { isCheckedIn: next });
    setMessage(null);
    try {
      await api.checkInAppointmentDirect(a.id, next);
    } catch (err: any) {
      patchItem(a.id, { isCheckedIn: !next });
      setMessage({ tone: 'error', text: err?.message || 'Couldn’t update arrival. Try again.' });
    }
  };

  const cancel = async (a: ReceptionistQueueItem) => {
    const ok = await confirmAction({ title: 'Cancel appointment?', message: `${a.patientName} will be told. This can’t be undone.`, confirmLabel: 'Cancel appointment' });
    if (ok) setStatus(a, 'CANCELLED', 'Appointment cancelled');
  };

  const more = (a: ReceptionistQueueItem) =>
    setMenu({
      title: rowMenuTitle(a.queueNumber, a.patientName),
      actions: [
        { label: 'Move to another day', onPress: () => setMoving({ id: a.id, name: a.patientName, date: a.appointmentDate || date, slotId: a.slotId }) },
        ...(a.walkInCode ? [{ label: 'Show code', onPress: () => setCode({ token: a.queueNumber, name: a.patientName, code: a.walkInCode! }) }] : []),
        { label: 'Cancel appointment', destructive: true, onPress: () => cancel(a) },
      ],
    });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([reload(), load()]);
    setRefreshing(false);
  };

  if (!desk) {
    return (
      <Screen edges={['top']}>
        <Title>Queue</Title>
        {deskFailed ? (
          <EmptyState icon="cloud-offline-outline" title="Couldn’t load the desk" message="Check your connection and try again." actionLabel="Try again" onAction={reload} />
        ) : (
          <>
            <PlaceholderCard height={120} />
            <PlaceholderCard height={110} />
          </>
        )}
      </Screen>
    );
  }

  if (doctors.length === 0) {
    return (
      <Screen edges={['top']}>
        <View style={styles.header}>
          <Title eyebrow={todayLong()} subtitle={desk.clinic?.clinicName}>Queue</Title>
          <NotificationBell />
        </View>
        <EmptyState icon="medkit-outline" title="No doctors yet" message="Your clinic adds doctors to this desk." />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.header}>
        <Title eyebrow={todayLong()} subtitle={desk.clinic?.clinicName}>Queue</Title>
        <NotificationBell />
      </View>

      {doctor ? (
        <CabinControl
          key={doctor.doctorId}
          doctorId={doctor.doctorId}
          status={doctor.cabinStatus}
          expectedReturnTime={doctor.expectedReturnTime}
          onChange={(st, back) => setDoctorCabin(doctor.doctorId, st, back)}
          doctors={doctors.map((d) => ({
            id: d.doctorId,
            name: doctorName(d.fullName),
            specialty: d.specialty,
            avatarUrl: d.avatarUrl,
            hint: d.todayWaitingPatients ? `${d.todayWaitingPatients} waiting` : null,
          }))}
          onDoctorChange={(id) => {
            if (id === doctorId) return;
            setDoctorId(id);
            setShift('all');
            setList(null);
            setMessage(null);
          }}
        />
      ) : null}

      <Segmented
        options={[
          { value: getLocalDateString(), label: 'Today' },
          { value: getTomorrowDateString(), label: 'Tomorrow' },
        ]}
        value={date}
        onChange={(d) => {
          setDate(d);
          setList(null);
        }}
      />

      <ShiftChips slots={slots} value={shift} onChange={setShift} />

      <Notice tone={message?.tone || 'info'} message={message?.text} stamp={message} />

      {!list ? (
        failed ? (
          <EmptyState icon="cloud-offline-outline" title="Couldn’t load the queue" message="Check your connection and try again." actionLabel="Try again" onAction={load} />
        ) : (
          <>
            <PlaceholderCard height={140} />
            <PlaceholderCard height={110} />
          </>
        )
      ) : (
        <>
          {isTodayQueue ? (
            <InCabinCard
              token={inCabin?.queueNumber}
              name={inCabin?.patientName}
              tag={inCabin ? visitTag(inCabin) : null}
              meta={inCabin ? shiftOf(inCabin) : null}
              onComplete={inCabin ? () => setStatus(inCabin, 'COMPLETED', 'Consultation done') : undefined}
              completing={busy === `COMPLETED-${inCabin?.id}`}
              onHold={inCabin ? () => setStatus(inCabin, 'WAITING', 'Sent back to waiting') : undefined}
              holding={busy === `WAITING-${inCabin?.id}`}
            />
          ) : null}

          <SectionTitle
            title={`Waiting · ${waiting.length}`}
            right={waiting.length > 0 && isTodayQueue ? <Text style={type.footnote}>{waiting.filter((a) => a.isCheckedIn).length} arrived</Text> : null}
          />
          {waiting.length === 0 ? (
            <EmptyState icon="checkmark-circle-outline" title="No one waiting" message={shift === 'all' ? `${formatDisplayDate(date)} is clear.` : 'No one in this shift.'} />
          ) : (
            waitingGroups.map((g) => (
              <View key={g.shift || 'all'} style={styles.group}>
                {g.shift ? <Text style={styles.shift}>{g.shift}</Text> : null}
                {g.items.map((a) => (
                  <QueueRow
                    key={a.id}
                    item={{ id: a.id, token: a.queueNumber, name: a.patientName, tag: visitTag(a), phone: a.patientPhone, arrived: a.isCheckedIn }}
                    showArrival={isTodayQueue}
                    onToggleArrived={() => toggleArrived(a)}
                    start={isTodayQueue && a.isCheckedIn ? (away ? 'away' : 'start') : null}
                    onStart={() => setStatus(a, 'IN_CONSULTATION', 'Consultation started')}
                    starting={busy === `IN_CONSULTATION-${a.id}`}
                    onMore={() => more(a)}
                  />
                ))}
              </View>
            ))
          )}

          {done.length > 0 ? (
            <>
              <SectionTitle title={`Done · ${done.length}`} />
              {done.map((a) => (
                <QueueRow key={a.id} muted item={{ id: a.id, token: a.queueNumber, name: a.patientName, tag: visitTag(a), meta: metaOf(a) }} />
              ))}
            </>
          ) : null}
        </>
      )}

      <ActionMenu title={menu?.title} actions={menu?.actions || null} onClose={() => setMenu(null)} />
      <CodeCard target={code} onClose={() => setCode(null)} />
      <MoveSheet
        target={moving}
        slots={slots}
        onClose={() => setMoving(null)}
        onMove={async (t, newDate, slotId) => {
          const res: any = await api.rescheduleAppointment(t.id, { newDate, newSlotId: slotId });
          const num = res?.data?.queueNumber ?? res?.data?.appointment?.queueNumber ?? res?.queueNumber;
          success();
          setMessage({
            tone: 'success',
            text: `${t.name} moved to ${formatDisplayDate(newDate)}${num > 0 ? ` (Token #${num})` : num < 0 ? ' (waiting for payment)' : ''}.`,
          });
          load();
          reload();
        }}
      />
      <View style={{ height: space.lg }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.md },
  group: { gap: space.md },
  shift: { ...type.footnote, fontWeight: '600', marginLeft: 4 },
});
