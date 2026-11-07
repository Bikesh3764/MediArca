// Doctor profile: who they are, where they sit, and the token you'd get.
// Same rules as frontend/src/pages/Patient/DoctorDetail.tsx.
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type Doctor, type QueuePreview, api, formatDisplayDate, formatDoctorDegrees, getLocalDateString } from '@mediarca/shared/api';
import { ClinicChoice, DateStrip, ShiftList, TokenTile } from '@/components/booking';
import { Avatar, BottomBar, CabinBadge, EmptyState, IconButton, SectionTitle, goBack } from '@/components/kit';
import { Button, Notice, PagePlaceholder } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { bookableDates, bookingBlock, doctorName, feeFor, slotsFor, sortClinics, workingDaysOf } from '@/lib/booking';
import { colors, radius, shadow, space, type } from '@/theme';

export default function DoctorProfile() {
  const params = useLocalSearchParams<{ id: string; clinicId?: string; date?: string }>();
  const id = params.id;
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'missing' | 'failed'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [date, setDate] = useState(params.date || getLocalDateString());
  const [slotId, setSlotId] = useState<string | null>(null);
  const [preview, setPreview] = useState<QueuePreview | null>(null);
  const [updating, setUpdating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const dates = useMemo(() => bookableDates(), []);

  useEffect(() => {
    let cancelled = false;
    api
      .getDoctorById(id)
      .then((data) => {
        if (cancelled) return;
        const clinics = sortClinics(data);
        const next = { ...data, clinics };
        const target = clinics.find((c) => c.clinicId === params.clinicId) || clinics[0];
        setDoctor(next);
        setClinicId((prev) => prev || target?.clinicId || null);
        setSlotId((prev) => prev || slotsFor(next, target?.clinicId)[0]?.id || null);
        setLoadState('ready');
      })
      .catch((err) => {
        if (!cancelled) setLoadState(err?.status === 404 || err?.status === 400 ? 'missing' : 'failed');
      });
    return () => {
      cancelled = true;
    };
  }, [id, params.clinicId, attempt]);

  useEffect(() => {
    // A slow answer for an old choice must not replace the current one
    let stale = false;
    if (!doctor) return undefined;
    queueMicrotask(() => {
      if (!stale) setUpdating(true);
    });
    api
      .getQueuePreview(id, date, slotId || undefined, clinicId || undefined)
      .then((p) => {
        if (stale) return;
        setPreview(p);
        if (p.selectedSlotId && (!slotId || (p.isPassed && p.selectedSlotId !== slotId))) setSlotId(p.selectedSlotId);
      })
      .catch(() => {})
      .finally(() => {
        if (!stale) setUpdating(false);
      });
    return () => {
      stale = true;
    };
  }, [id, doctor, date, slotId, clinicId]);

  if (loadState === 'loading') return <PagePlaceholder />;

  if (!doctor) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.backRow}>
          <IconButton icon="chevron-back" label="Back" onPress={() => goBack('/patient')} />
        </View>
        {loadState === 'failed' ? (
          <EmptyState
            icon="cloud-offline-outline"
            title="Couldn’t load doctor"
            message="Check your connection and try again."
            actionLabel="Try again"
            onAction={() => {
              setLoadState('loading');
              setAttempt((a) => a + 1);
            }}
          />
        ) : (
          <EmptyState icon="person-outline" title="Doctor not found" message="This doctor isn’t available." actionLabel="Find doctors" onAction={() => goBack('/patient')} />
        )}
      </View>
    );
  }

  const clinics = doctor.clinics || [];
  const fee = feeFor(doctor, clinicId, preview);
  const slots = slotsFor(doctor, clinicId);
  const shiftItems = preview?.availableSlots?.length ? preview.availableSlots : slots.map((slot) => ({ slot }));
  const block = bookingBlock(doctor, clinicId, preview);

  const selectClinic = (next: string) => {
    setClinicId(next);
    const nextSlots = slotsFor(doctor, next);
    if (nextSlots.length > 0 && !nextSlots.some((s) => s.id === slotId)) setSlotId(nextSlots[0].id);
  };

  const onContinue = () => {
    setNotice(null);
    const query = [`date=${date}`, slotId && `slot=${encodeURIComponent(slotId)}`, clinicId && `clinic=${encodeURIComponent(clinicId)}`]
      .filter(Boolean)
      .join('&');
    const target = `/book/${encodeURIComponent(doctor.id)}?${query}`;
    if (!user) {
      router.push({ pathname: '/login', params: { role: 'PATIENT', next: target, why: `to book ${doctorName(doctor.user?.fullName)}` } });
      return;
    }
    if (user.role !== 'PATIENT') {
      setNotice('Sign in as a patient to book.');
      return;
    }
    router.push(target as never);
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={{ height: insets.top + 56 }} />
        <View style={[styles.backFloat, { top: insets.top + space.sm }]}>
          <IconButton icon="chevron-back" label="Back" onPress={() => goBack('/patient')} />
        </View>

        <View style={styles.identity}>
          <View style={styles.avatarLift}>
            <Avatar uri={doctor.user?.avatarUrl} name={doctor.user?.fullName} size={112} />
          </View>
          <Text style={styles.name} numberOfLines={2}>
            {doctorName(doctor.user?.fullName)}
          </Text>
          <Text style={styles.specialty}>{doctor.specialty}</Text>
          <Text style={[type.caption, styles.center]}>{formatDoctorDegrees(doctor.qualifications)}</Text>
          <View style={styles.badgeRow}>
            <CabinBadge status={doctor.cabinStatus} expectedReturnTime={doctor.expectedReturnTime} />
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.facts}>
            {[
              { label: 'Experience', value: doctor.experienceYears ? `${doctor.experienceYears} yrs` : '—' },
              { label: 'Fee', value: fee ? `₹${fee}` : '—' },
              { label: clinics.length === 1 ? 'Clinic' : 'Clinics', value: String(clinics.length) },
            ].map((f, i) => (
              <View key={f.label} style={[styles.fact, i > 0 && styles.factDivider]}>
                <Text style={styles.factValue}>{f.value}</Text>
                <Text style={type.small}>{f.label}</Text>
              </View>
            ))}
          </View>

          {clinics.length > 0 ? (
            <>
              <SectionTitle title={clinics.length > 1 ? 'Choose a clinic' : 'Clinic'} />
              <ClinicChoice doctor={doctor} clinics={clinics} selectedId={clinicId} onSelect={selectClinic} />

              <SectionTitle title="Date" right={<Text style={type.caption}>{formatDisplayDate(date)}</Text>} />
              <View style={styles.bleed}>
                <DateStrip dates={dates} value={date} onChange={setDate} workingDays={workingDaysOf(preview)} />
              </View>

              <SectionTitle title="Shift" />
              <ShiftList items={shiftItems} selectedId={slotId} onSelect={setSlotId} />

              {/* No token preview when nothing can be booked; the notice below says why */}
              {preview && !block ? (
                <View style={updating && styles.dim}>
                  <TokenTile preview={preview} blocked={Boolean(preview.isOnLeave || preview.isDayOff || preview.isPassed)} />
                </View>
              ) : null}
            </>
          ) : null}

          <Notice tone="info" message={block?.message} />

          <SectionTitle title="About" />
          <View style={styles.about}>
            <Text style={styles.aboutText}>{doctor.bio || `${doctor.specialty || 'Doctor'} consultations.`}</Text>
          </View>
        </View>
      </ScrollView>

      <BottomBar>
        {notice ? (
          <View style={styles.barNotice}>
            <Notice tone="error" message={notice} />
          </View>
        ) : null}
        <View style={styles.barRow}>
          <View>
            <Text style={styles.barFee}>₹{fee}</Text>
            <Text style={type.small}>Pay the receptionist</Text>
          </View>
          <View style={styles.barButton}>
            <Button label={block?.button || 'Continue'} onPress={onContinue} disabled={Boolean(block)} />
          </View>
        </View>
      </BottomBar>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  scroll: { paddingBottom: space.xl },
    backFloat: { position: 'absolute', left: space.lg },
  backRow: { paddingHorizontal: space.lg, paddingTop: space.sm },
  identity: { alignItems: 'center', paddingHorizontal: space.xl, gap: 4 },
  avatarLift: { borderRadius: 56, ...shadow.raised },
  name: { ...type.title, textAlign: 'center', marginTop: space.lg },
  specialty: { fontSize: 17, color: colors.primary },
  center: { textAlign: 'center' },
  badgeRow: { marginTop: space.sm },
  body: { paddingHorizontal: space.lg + 4, paddingTop: space.lg, gap: space.md },
  facts: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.card, paddingVertical: space.lg, ...shadow.card },
  fact: { flex: 1, alignItems: 'center', gap: 2 },
  factDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.border },
  factValue: { fontSize: 20, fontWeight: '600', color: colors.ink, letterSpacing: -0.3 },
  bleed: { marginHorizontal: -(space.lg + 4) },
  dim: { opacity: 0.6 },
  about: { backgroundColor: colors.card, borderRadius: radius.card, padding: space.lg, ...shadow.card },
  aboutText: { fontSize: 16, lineHeight: 22, color: colors.secondaryInk },
  barNotice: { marginBottom: space.md },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  barFee: { fontSize: 22, fontWeight: '600', color: colors.ink },
  barButton: { flex: 1 },
});
