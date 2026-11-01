// Front desk queue for one doctor: cabin status, arrivals, call in, complete, move, cancel.
// Same server calls and rules as frontend/src/pages/Receptionist/desk (state.tsx, QueueTab.tsx).
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { type ReceptionistQueueItem, api, formatDisplayDate, getLocalDateString, getTomorrowDateString, shiftLabel, slotTimeLabel } from '@mediarca/shared/api';
import { cleanVisitReason, visitMatchesSlot, visitTag } from '@mediarca/shared/utils/queueDisplay';
import { ActionMenu, type MenuAction } from '@/components/ActionMenu';
import { CabinControl } from '@/components/CabinControl';
import { InCabinCard } from '@/components/InCabinCard';
import { EmptyState, PillButton, PlaceholderCard } from '@/components/kit';
import { type MoveTarget, MoveSheet } from '@/components/MoveSheet';
import { QueueRow } from '@/components/QueueRow';
import { NotificationBell } from '@/components/NotificationBell';
import { Notice, Screen, Segmented, Title } from '@/components/ui';
import { useDesk } from '@/context/DeskContext';
import { doctorName } from '@/lib/booking';
import { confirmAction } from '@/lib/confirm';
import { todayLong } from '@/lib/dates';
import { success } from '@/lib/haptics';
import { usePolling, keepIfSame } from '@/lib/usePolling';
import { space } from '@/theme';

type Showing = 'waiting' | 'done';

export default function DeskQueue() {
  const { desk, failed: deskFailed, reload, setDoctorCabin } = useDesk();
  const doctors = useMemo(() => desk?.doctors || [], [desk]);
  const [chosenDoctorId, setDoctorId] = useState('');
  // First doctor by default; keep the choice while it still exists
  const doctorId = doctors.some((d) => d.doctorId === chosenDoctorId) ? chosenDoctorId : doctors[0]?.doctorId || '';
  const [date, setDate] = useState(getLocalDateString());
  const [list, setList] = useState<ReceptionistQueueItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [show, setShow] = useState<Showing>('waiting');
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [menu, setMenu] = useState<{ title: string; actions: MenuAction[] } | null>(null);
  const [moving, setMoving] = useState<MoveTarget | null>(null);

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
  const inCabin = items.find((a) => a.status === 'IN_CONSULTATION');
  const waiting = items.filter((a) => a.status === 'WAITING');
  const done = items.filter((a) => a.status === 'COMPLETED' || a.status === 'CANCELLED');
  const away = Boolean(doctor?.cabinStatus && doctor.cabinStatus !== 'IN_CABIN');
  const slots = doctor?.slots || [];

  const shiftOf = (a: ReceptionistQueueItem) => {
    if (slots.length < 2) return null;
    const i = slots.findIndex((s) => visitMatchesSlot(a, s));
    return i >= 0 ? slotTimeLabel(slots[i]) : shiftLabel(a);
  };
  const metaOf = (a: ReceptionistQueueItem) =>
    [shiftOf(a), a.status === 'CANCELLED' ? 'Cancelled' : null, cleanVisitReason(a.reasonForVisit, a.patientName)].filter(Boolean).join(' · ');

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
      title: `#${a.queueNumber} · ${a.patientName}`,
      actions: [
        { label: 'Move to another day', onPress: () => setMoving({ id: a.id, name: a.patientName, date: a.appointmentDate || date, slotId: a.slotId }) },
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

      {doctors.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills} style={styles.bleed}>
          {doctors.map((d) => (
            <PillButton
              key={d.doctorId}
              label={doctorName(d.fullName)}
              active={d.doctorId === doctorId}
              onPress={() => {
                setDoctorId(d.doctorId);
                setList(null);
                setMessage(null);
              }}
            />
          ))}
        </ScrollView>
      ) : null}

      {doctor ? (
        <CabinControl
          key={doctor.doctorId}
          doctorId={doctor.doctorId}
          status={doctor.cabinStatus}
          expectedReturnTime={doctor.expectedReturnTime}
          onChange={(s, back) => setDoctorCabin(doctor.doctorId, s, back)}
          doctor={{ name: doctorName(doctor.fullName), specialty: doctor.specialty, avatarUrl: doctor.avatarUrl }}
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
              reason={inCabin ? cleanVisitReason(inCabin.reasonForVisit, inCabin.patientName) : null}
              symptoms={inCabin?.symptoms}
              onComplete={inCabin ? () => setStatus(inCabin, 'COMPLETED', 'Consultation done') : undefined}
              completing={busy === `COMPLETED-${inCabin?.id}`}
            />
          ) : null}

          <Segmented
            options={[
              { value: 'waiting', label: `Waiting · ${waiting.length}` },
              { value: 'done', label: `Done · ${done.length}` },
            ]}
            value={show}
            onChange={setShow}
          />

          {show === 'waiting' ? (
            waiting.length === 0 ? (
              <EmptyState icon="checkmark-circle-outline" title="No one waiting" message={`${formatDisplayDate(date)} is clear.`} />
            ) : (
              waiting.map((a) => (
                <QueueRow
                  key={a.id}
                  item={{ id: a.id, token: a.queueNumber, name: a.patientName, tag: visitTag(a), meta: metaOf(a), phone: a.patientPhone, arrived: a.isCheckedIn, code: a.walkInCode }}
                  showArrival={isTodayQueue}
                  onToggleArrived={() => toggleArrived(a)}
                  call={isTodayQueue && a.isCheckedIn ? (away ? 'away' : 'call') : null}
                  onCall={() => setStatus(a, 'IN_CONSULTATION')}
                  calling={busy === `IN_CONSULTATION-${a.id}`}
                  onMore={() => more(a)}
                />
              ))
            )
          ) : done.length === 0 ? (
            <EmptyState icon="time-outline" title="None done yet" />
          ) : (
            done.map((a) => <QueueRow key={a.id} muted item={{ id: a.id, token: a.queueNumber, name: a.patientName, tag: visitTag(a), meta: metaOf(a) }} />)
          )}
        </>
      )}

      <ActionMenu title={menu?.title} actions={menu?.actions || null} onClose={() => setMenu(null)} />
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
  bleed: { marginHorizontal: -(space.lg + 4), flexGrow: 0 },
  pills: { gap: space.sm, paddingHorizontal: space.lg + 4 },
});
