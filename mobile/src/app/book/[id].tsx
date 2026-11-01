// Book a token, then show who to call to pay. Same rules as frontend/src/pages/Patient/BookAppointment.tsx.
import { Ionicons } from '@expo/vector-icons';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import { MoreText } from '@/components/MoreText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type Appointment, type Doctor, type QueuePreview, api, formatDisplayDate, getLocalDateString, shiftLabel, slotTimeLabel } from '@mediarca/shared/api';
import { formatClinicAddress } from '@mediarca/shared/utils/address';
import { formatDisplayPhone, toTelUri } from '@mediarca/shared/utils/phoneUtils';
import { Avatar, BottomBar, EmptyState, InfoRow, NavBar, goBack } from '@/components/kit';
import { Button, Field, Loading, Notice, Segmented } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { bookingBlock, clinicFor, doctorName, feeFor, receptionistsFor, sortClinics } from '@/lib/booking';
import { success, tap } from '@/lib/haptics';
import { colors, radius, shadow, space, type } from '@/theme';

export default function Book() {
  const params = useLocalSearchParams<{ id: string; date?: string; slot?: string; clinic?: string }>();
  const id = params.id;
  const date = params.date || getLocalDateString();
  const { user } = useAuth();

  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [preview, setPreview] = useState<QueuePreview | null>(null);
  const [bookingFor, setBookingFor] = useState<'myself' | 'other'>('myself');
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientGender, setPatientGender] = useState('Male');
  const [reason, setReason] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [booked, setBooked] = useState<Appointment | null>(null);

  const clinicId = params.clinic || doctor?.clinics?.[0]?.clinicId || null;

  useEffect(() => {
    if (!user) return;
    api
      .getDoctorById(id)
      .then((data) => {
        setDoctor({ ...data, clinics: sortClinics(data) });
        setLoadState('ready');
      })
      .catch(() => setLoadState('failed'));
  }, [id, user]);

  useEffect(() => {
    if (!doctor) return;
    let stale = false;
    api
      .getQueuePreview(id, date, params.slot || undefined, clinicId || undefined)
      .then((p) => {
        if (!stale) setPreview(p);
      })
      .catch(() => {});
    return () => {
      stale = true;
    };
  }, [id, doctor, date, params.slot, clinicId]);

  if (!user) {
    const next = `/book/${id}?date=${date}${params.slot ? `&slot=${params.slot}` : ''}${params.clinic ? `&clinic=${params.clinic}` : ''}`;
    return <Redirect href={{ pathname: '/login', params: { role: 'PATIENT', next } }} />;
  }
  if (loadState === 'loading') return <Loading />;
  if (!doctor) {
    return (
      <SafeAreaView style={styles.screen}>
        <NavBar title="Book" fallback="/patient" />
        <EmptyState icon="cloud-offline-outline" title="Couldn’t load doctor" message="Check your connection and try again." actionLabel="Back" onAction={() => goBack('/patient')} />
      </SafeAreaView>
    );
  }

  const clinic = clinicFor(doctor, clinicId);
  const fee = feeFor(doctor, clinicId, preview);
  const block = bookingBlock(doctor, clinicId, preview);
  const slotId = preview?.selectedSlotId || params.slot;
  const shiftName = slotTimeLabel(preview?.availableSlots?.find((s) => s.slot.id === slotId)?.slot) || shiftLabel(preview);

  const submit = async () => {
    setError(null);
    if (user.role !== 'PATIENT') return setError('Sign in as a patient to book.');
    if (block) return setError(block.message);
    if (doctor.clinics!.length > 1 && !clinicId) return setError('Please choose a clinic.');
    const isForOther = bookingFor === 'other';
    if (isForOther) {
      if (!patientName.trim()) return setError('Enter the patient’s name.');
      if (!patientAge.trim()) return setError('Enter the patient’s age.');
      const age = parseInt(patientAge.trim(), 10);
      if (!Number.isFinite(age) || age < 0 || age > 125) return setError('Enter an age between 0 and 125.');
    }
    setSubmitting(true);
    try {
      const appt = await api.bookAppointment({
        doctorId: doctor.id,
        clinicId: clinicId || undefined,
        appointmentDate: date,
        slotId: slotId || undefined,
        reasonForVisit: reason.trim() || 'General Medical Consultation',
        symptoms: symptoms.trim() || undefined,
        isForOther,
        patientName: isForOther ? patientName.trim() : undefined,
        patientAge: isForOther ? patientAge.trim() : undefined,
        patientGender: isForOther ? patientGender : undefined,
      });
      success();
      setBooked(appt);
    } catch (err: any) {
      setError(err?.message || 'Booking failed. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (booked) {
    const desk = receptionistsFor(doctor, clinicId)[0];
    const phone = booked.receptionistPhone || desk?.phone || booked.clinic?.phone || clinic?.clinic.phone || null;
    const deskName = booked.receptionistName || desk?.name || 'Front desk';
    const token = booked.estimatedQueueNumber || (booked.queueNumber > 0 ? booked.queueNumber : 1);
    const leave = (path: '/patient/visits' | '/patient') => {
      if (router.canDismiss()) router.dismissAll();
      router.replace(path);
    };
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.doneBody}>
          <View style={styles.doneIcon}>
            <Ionicons name="checkmark" size={40} color={colors.white} />
          </View>
          <Text style={styles.doneEyebrow}>Request sent</Text>
          <Text style={styles.doneTitle}>Pay to confirm your token</Text>
          <Text style={[type.caption, styles.center]}>
            {formatDisplayDate(booked.appointmentDate)} · {shiftLabel(booked)}
          </Text>
          <View style={styles.tokenPill}>
            <Text style={type.caption}>Est. token</Text>
            <Text style={styles.tokenPillNumber}>#{token}</Text>
          </View>

          <View style={styles.deskCard}>
            <View style={styles.deskTop}>
              <View style={styles.flex}>
                <Text style={type.caption}>Receptionist</Text>
                <Text style={type.headline}>{deskName}</Text>
                <MoreText style={type.caption} lines={2}>
                  {`${clinic?.clinic.clinicName || ''}${clinic ? ` · ${formatClinicAddress(clinic.clinic, { withState: false })}` : ''}`}
                </MoreText>
              </View>
              <View style={styles.right}>
                <Text style={type.headline}>₹{fee}</Text>
                <Text style={type.small}>Fee</Text>
              </View>
            </View>
            <Text style={styles.deskNote}>Pay by UPI over a call or at the desk. First to pay is confirmed first.</Text>
            {phone ? (
              <Button icon="call" label={`Call ${formatDisplayPhone(phone)}`} onPress={() => Linking.openURL(toTelUri(phone))} />
            ) : (
              <Text style={[type.caption, styles.center]}>Pay the receptionist to confirm your token.</Text>
            )}
          </View>

          <View style={styles.doneActions}>
            <Button label="View appointments" variant="secondary" onPress={() => leave('/patient/visits')} />
            <Button label="Find doctors" variant="plain" onPress={() => leave('/patient')} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <NavBar title="Book" fallback={`/doctors/${id}`} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={styles.card}>
          <View style={styles.doctorRow}>
            <Avatar uri={doctor.user?.avatarUrl} name={doctor.user?.fullName} size={52} />
            <View style={styles.flex}>
              <Text style={type.headline} numberOfLines={1}>
                {doctorName(doctor.user?.fullName)}
              </Text>
              <Text style={styles.specialty}>{doctor.specialty}</Text>
            </View>
          </View>
          <View style={styles.rows}>
            <InfoRow first label="Clinic" value={clinic?.clinic.clinicName || '—'} />
            <InfoRow label="Date" value={formatDisplayDate(date)} />
            <InfoRow label="Shift" value={shiftName} />
            <InfoRow
              label="Token"
              value={
                <Text style={styles.tokenValue}>
                  {preview && !block ? `#${Math.max(1, preview.nextQueueNumber || 1)} · ${preview.estimatedTime}` : '—'}
                </Text>
              }
            />
          </View>
        </View>

        <Text style={styles.groupLabel}>Booking for</Text>
        <Segmented
          options={[
            { value: 'myself', label: 'Myself' },
            { value: 'other', label: 'Someone else' },
          ]}
          value={bookingFor}
          onChange={(v) => {
            tap();
            setBookingFor(v);
          }}
        />
        {bookingFor === 'other' ? (
          <View style={styles.card}>
            <Field label="Name" value={patientName} onChangeText={setPatientName} maxLength={100} placeholder="e.g. Rahul Ray" autoCapitalize="words" />
            <Field
              label="Age"
              value={patientAge}
              onChangeText={(t) => setPatientAge(t.replace(/\D/g, '').slice(0, 3))}
              keyboardType="number-pad"
              placeholder="e.g. 24"
            />
            <Text style={type.label}>Gender</Text>
            <Segmented
              options={[
                { value: 'Male', label: 'Male' },
                { value: 'Female', label: 'Female' },
                { value: 'Other', label: 'Other' },
              ]}
              value={patientGender}
              onChange={(g) => {
                tap();
                setPatientGender(g);
              }}
            />
          </View>
        ) : null}

        <View style={styles.card}>
          <Field label="Reason" value={reason} onChangeText={setReason} placeholder="e.g. Checkup, follow-up" />
          <Field
            label="Symptoms (optional)"
            value={symptoms}
            onChangeText={setSymptoms}
            placeholder="e.g. Fever since 2 days"
            maxLength={500}
            multiline
            style={styles.multiline}
          />
        </View>

        <View style={styles.feeCard}>
          <View style={styles.feeRow}>
            <Text style={type.caption}>Fee</Text>
            <Text style={type.headline}>₹{fee}</Text>
          </View>
          <Text style={type.caption}>Pay the receptionist by UPI over a call or at the desk. First to pay is confirmed first.</Text>
        </View>

        <Notice tone="info" message={block?.message} />
      </ScrollView>
      <BottomBar>
        {error ? (
          <View style={styles.barNotice}>
            <Notice tone="error" message={error} />
          </View>
        ) : null}
        <Button label={block?.button || `Book token · ₹${fee}`} onPress={submit} loading={submitting} disabled={Boolean(block)} />
      </BottomBar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1, minWidth: 0 },
  center: { textAlign: 'center' },
  right: { alignItems: 'flex-end' },
  body: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  card: { backgroundColor: colors.card, borderRadius: radius.card, padding: space.lg, gap: space.md, ...shadow.card },
  doctorRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  specialty: { fontSize: 14, color: colors.primary },
  rows: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  tokenValue: { fontSize: 16, fontWeight: '600', color: colors.primary },
  groupLabel: { ...type.caption, marginLeft: space.xs, marginTop: space.sm },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  feeCard: { backgroundColor: colors.card, borderRadius: radius.card, padding: space.lg, gap: space.sm, ...shadow.card },
  barNotice: { marginBottom: space.md },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  doneBody: { padding: space.xl, paddingTop: space.xxl * 1.5, alignItems: 'stretch', gap: space.sm },
  doneIcon: { alignSelf: 'center', width: 76, height: 76, borderRadius: 38, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center', marginBottom: space.md },
  doneEyebrow: { fontSize: 15, color: colors.primary, textAlign: 'center' },
  doneTitle: { ...type.title, fontSize: 26, textAlign: 'center' },
  tokenPill: { alignSelf: 'center', flexDirection: 'row', alignItems: 'baseline', gap: space.sm, marginTop: space.md, paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: colors.card, ...shadow.card },
  tokenPillNumber: { fontSize: 24, fontWeight: '600', color: colors.primary, letterSpacing: -0.4 },
  deskCard: { marginTop: space.xl, backgroundColor: colors.card, borderRadius: radius.card, padding: space.lg, gap: space.md, ...shadow.card },
  deskTop: { flexDirection: 'row', gap: space.md },
  deskNote: { ...type.caption, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  doneActions: { marginTop: space.lg, gap: space.sm },
});
