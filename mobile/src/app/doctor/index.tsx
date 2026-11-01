// Doctor's queue: cabin status, the patient in the cabin, and who is waiting.
// Same server calls and rules as frontend/src/pages/Doctor/dashboard (state.tsx, QueueTab.tsx).
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import { type Appointment, type DoctorAffiliationsData, type DoctorSlot, api, formatDisplayDate, getLocalDateString, getTomorrowDateString, slotTimeLabel } from '@mediarca/shared/api';
import { cleanVisitReason, visitMatchesSlot, visitTag } from '@mediarca/shared/utils/queueDisplay';
import { ActionMenu, type MenuAction } from '@/components/ActionMenu';
import { CabinControl } from '@/components/CabinControl';
import { InCabinCard } from '@/components/InCabinCard';
import { EmptyState, IconButton, PillButton, PlaceholderCard, SectionTitle } from '@/components/kit';
import { type MoveTarget, MoveSheet } from '@/components/MoveSheet';
import { QueueRow } from '@/components/QueueRow';
import { NotificationBell } from '@/components/NotificationBell';
import { Button, Notice, Screen, Segmented, Title } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { confirmAction } from '@/lib/confirm';
import { todayLong, yesterday } from '@/lib/dates';
import { success } from '@/lib/haptics';
import { usePolling, keepIfSame } from '@/lib/usePolling';
import { space, type } from '@/theme';

type Queue = Awaited<ReturnType<typeof api.getDoctorQueue>>;
type Day = 'today' | 'tomorrow' | 'upcoming';

const nameOf = (a: Appointment) => a.patientName || a.patient?.user?.fullName || 'Patient';
const phoneOf = (a: Appointment) => a.patientPhone || a.patient?.user?.phone || null;

export default function DoctorQueue() {
  const { user, updateUser } = useAuth();
  const [day, setDay] = useState<Day>('today');
  const [queue, setQueue] = useState<Queue | null>(null);
  const [aff, setAff] = useState<DoctorAffiliationsData | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [clinicId, setClinicId] = useState('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [menu, setMenu] = useState<{ title: string; actions: MenuAction[] } | null>(null);
  const [moving, setMoving] = useState<MoveTarget | null>(null);

  const load = useCallback(async () => {
    try {
      const data =
        day === 'upcoming' ? await api.getDoctorQueue(undefined, 'all-upcoming') : await api.getDoctorQueue(day === 'today' ? getLocalDateString() : getTomorrowDateString(), 'date');
      setQueue(keepIfSame<Queue | null>(data));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [day]);

  const loadClinics = useCallback(async () => {
    try {
      setAff(await api.getDoctorAffiliations());
    } catch {
      // Filters just stay hidden
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      loadClinics();
    }, [load, loadClinics])
  );
  usePolling(load, 10000, true);

  const clinics = useMemo(() => aff?.clinics || [], [aff]);
  const slots: DoctorSlot[] = useMemo(() => {
    const own = clinicId === 'all' ? clinics.flatMap((c) => c.slots || []) : clinics.find((c) => c.clinicId === clinicId)?.slots || [];
    const seen = new Set<string>();
    return own.filter((s) => {
      const key = `${s.startTime}-${s.endTime}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [clinics, clinicId]);

  const inClinic = (a: Appointment) => clinicId === 'all' || a.clinicId === clinicId;
  const waiting = (queue?.waitingQueue || []).filter(inClinic);
  const done = (queue?.completedQueue || []).filter(inClinic);
  const active = queue?.activeInConsultation && inClinic(queue.activeInConsultation) ? queue.activeInConsultation : null;

  const cabin = user?.doctorProfile?.cabinStatus || 'IN_CABIN';
  const away = cabin !== 'IN_CABIN';
  const today = getLocalDateString();
  const callable = (a: Appointment) => Boolean(a.isCheckedIn) && (a.appointmentDate === today || a.appointmentDate === yesterday());

  const shiftLabel = (a: Appointment) => {
    if (slots.length < 2) return null;
    const i = slots.findIndex((s) => visitMatchesSlot(a, s));
    return i >= 0 ? slotTimeLabel(slots[i]) : null;
  };
  const metaOf = (a: Appointment) =>
    [
      day === 'upcoming' ? formatDisplayDate(a.appointmentDate) : null,
      shiftLabel(a),
      clinics.length > 1 && clinicId === 'all' ? a.clinic?.clinicName : null,
      cleanVisitReason(a.reasonForVisit, nameOf(a)),
    ]
      .filter(Boolean)
      .join(' · ');

  const patch = (change: (q: Queue) => Queue) => setQueue((q) => (q ? change(q) : q));

  const run = async (id: string, work: () => Promise<unknown>, okText?: string, undo?: () => void) => {
    setBusy(id);
    setMessage(null);
    try {
      await work();
      if (okText) {
        success();
        setMessage({ tone: 'success', text: okText });
      }
      load();
    } catch (err: any) {
      undo?.();
      setMessage({ tone: 'error', text: err?.message || 'Couldn’t update. Try again.' });
    } finally {
      setBusy(null);
    }
  };

  const call = (a: Appointment) => {
    if (away) return setMessage({ tone: 'error', text: 'Set your status to In cabin first.' });
    patch((q) => ({ ...q, activeInConsultation: { ...a, status: 'IN_CONSULTATION' }, waitingQueue: q.waitingQueue.filter((w) => w.id !== a.id) }));
    run(a.id, () => api.callPatient(a.id), undefined, load);
  };

  const complete = (a: Appointment) => {
    patch((q) => ({ ...q, activeInConsultation: null, completedQueue: [...q.completedQueue, { ...a, status: 'COMPLETED' }] }));
    run(`done-${a.id}`, () => api.completeConsultation({ appointmentId: a.id }), 'Consultation done', load);
  };

  const hold = (a: Appointment) => run(`hold-${a.id}`, () => api.holdConsultation(a.id), 'Sent back to waiting');

  const toggleArrived = (a: Appointment) => {
    const next = !a.isCheckedIn;
    const set = (v: boolean) => patch((q) => ({ ...q, waitingQueue: q.waitingQueue.map((w) => (w.id === a.id ? { ...w, isCheckedIn: v } : w)) }));
    set(next);
    run(`arr-${a.id}`, () => api.checkInAppointmentDirect(a.id, next), undefined, () => set(!next));
  };

  const cancel = async (a: Appointment) => {
    const ok = await confirmAction({ title: 'Cancel appointment?', message: `${nameOf(a)} will be told. This can’t be undone.`, confirmLabel: 'Cancel appointment' });
    if (!ok) return;
    patch((q) => ({ ...q, waitingQueue: q.waitingQueue.filter((w) => w.id !== a.id) }));
    run(`cancel-${a.id}`, () => api.cancelAppointment(a.id), 'Appointment cancelled', load);
  };

  const more = (a: Appointment) =>
    setMenu({
      title: `#${a.queueNumber} · ${nameOf(a)}`,
      actions: [
        { label: 'Move to another day', onPress: () => setMoving({ id: a.id, name: nameOf(a), date: a.appointmentDate, slotId: a.slotId }) },
        { label: 'Cancel appointment', destructive: true, onPress: () => cancel(a) },
      ],
    });

  const nextUp = day === 'today' && !away ? waiting.find(callable) : undefined;

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([load(), loadClinics()]);
    setRefreshing(false);
  };

  const status = user?.doctorProfile?.verificationStatus;
  const verified = user?.doctorProfile?.isVerified ?? true;

  return (
    <Screen edges={['top']} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.header}>
        <Title eyebrow={todayLong()}>Queue</Title>
        <View style={styles.actions}>
          <NotificationBell />
          <IconButton icon="person-add" label="Add walk-in" onPress={() => router.push('/walkin')} />
        </View>
      </View>

      {status === 'SUSPENDED' ? <Notice tone="error" persist message="Account suspended. Bookings are paused. Please contact MediArca support." /> : null}
      {status === 'REJECTED' ? <Notice tone="error" persist message="Profile not approved. Please contact MediArca support." /> : null}
      {!verified && status !== 'SUSPENDED' && status !== 'REJECTED' ? <Notice tone="info" message="Profile under review. Patients can find you once it’s approved." /> : null}

      <CabinControl
        status={cabin}
        expectedReturnTime={user?.doctorProfile?.expectedReturnTime}
        onChange={(s, back) => {
          if (user?.doctorProfile) updateUser({ ...user, doctorProfile: { ...user.doctorProfile, cabinStatus: s, expectedReturnTime: back } });
        }}
      />

      <Segmented
        options={[
          { value: 'today', label: 'Today' },
          { value: 'tomorrow', label: 'Tomorrow' },
          { value: 'upcoming', label: 'Upcoming' },
        ]}
        value={day}
        onChange={(d) => {
          setDay(d);
          setQueue(null);
        }}
      />

      {clinics.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills} style={styles.bleed}>
          <PillButton label="All clinics" active={clinicId === 'all'} onPress={() => setClinicId('all')} />
          {clinics.map((c) => (
            <PillButton key={c.clinicId} label={c.clinicName} active={clinicId === c.clinicId} onPress={() => setClinicId(c.clinicId)} />
          ))}
        </ScrollView>
      ) : null}

      <Notice tone={message?.tone || 'info'} message={message?.text} stamp={message} />

      {!queue ? (
        failed ? (
          <EmptyState icon="cloud-offline-outline" title="Couldn’t load the queue" message="Check your connection and try again." actionLabel="Try again" onAction={load} />
        ) : (
          <>
            <PlaceholderCard height={150} />
            <PlaceholderCard height={110} />
            <PlaceholderCard height={110} />
          </>
        )
      ) : (
        <>
          {day === 'today' ? (
            <InCabinCard
              token={active?.queueNumber}
              name={active ? nameOf(active) : null}
              tag={active ? visitTag(active) : null}
              meta={active ? [shiftLabel(active), clinics.length > 1 ? active.clinic?.clinicName : null].filter(Boolean).join(' · ') : null}
              reason={active ? cleanVisitReason(active.reasonForVisit, nameOf(active)) : null}
              symptoms={active?.symptoms}
              onComplete={active ? () => complete(active) : undefined}
              onHold={active ? () => hold(active) : undefined}
              completing={busy === `done-${active?.id}`}
              holding={busy === `hold-${active?.id}`}
            />
          ) : null}

          {nextUp && !active ? (
            <Button label={`Call #${nextUp.queueNumber} · ${nameOf(nextUp)}`} icon="play" onPress={() => call(nextUp)} loading={busy === nextUp.id} />
          ) : null}

          <SectionTitle title={`Waiting · ${waiting.length}`} />
          {waiting.length === 0 ? (
            <EmptyState icon="checkmark-circle-outline" title="No one waiting" message={day === 'today' ? 'New bookings show up here.' : undefined} />
          ) : (
            waiting.map((a) => (
              <QueueRow
                key={a.id}
                item={{ id: a.id, token: a.queueNumber, name: nameOf(a), tag: visitTag(a), meta: metaOf(a), phone: phoneOf(a), arrived: a.isCheckedIn, code: a.walkInCode }}
                showArrival={day === 'today'}
                onToggleArrived={() => toggleArrived(a)}
                call={callable(a) ? (away ? 'away' : 'call') : null}
                onCall={() => call(a)}
                calling={busy === a.id}
                onMore={() => more(a)}
              />
            ))
          )}

          {done.length > 0 ? (
            <>
              <SectionTitle title={`Completed · ${done.length}`} />
              {done.map((a) => (
                <QueueRow key={a.id} muted item={{ id: a.id, token: a.queueNumber, name: nameOf(a), tag: visitTag(a), meta: metaOf(a) }} />
              ))}
            </>
          ) : null}
          {day === 'today' && queue.upcomingSummary?.tomorrowCount ? (
            <Text style={[type.caption, styles.center]}>Tomorrow: {queue.upcomingSummary.tomorrowCount} booked</Text>
          ) : null}
        </>
      )}

      <ActionMenu title={menu?.title} actions={menu?.actions || null} onClose={() => setMenu(null)} />
      <MoveSheet
        target={moving}
        slots={
          moving
            ? clinics.find((c) => c.clinicId === (queue?.waitingQueue.find((w) => w.id === moving.id)?.clinicId || ''))?.slots || slots
            : []
        }
        onClose={() => setMoving(null)}
        onMove={async (t, date, slotId) => {
          const res: any = await api.doctorRescheduleAppointment(t.id, { newDate: date, newSlotId: slotId });
          const num = res?.queueNumber ?? res?.data?.queueNumber ?? res?.data?.appointment?.queueNumber;
          success();
          setMessage({ tone: 'success', text: `${t.name} moved to ${formatDisplayDate(date)}${num ? ` (Token #${num})` : ''}.` });
          load();
        }}
      />
      <View style={{ height: space.lg }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  bleed: { marginHorizontal: -(space.lg + 4), flexGrow: 0 },
  pills: { gap: space.sm, paddingHorizontal: space.lg + 4 },
  center: { textAlign: 'center' },
});
