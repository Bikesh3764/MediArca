// Add a walk-in: pick day and shift (with the next token and time), then the patient's details.
// Used by the front desk (any of its doctors) and by doctors (their own queue).
// Same checks as frontend/src/pages/Receptionist/desk (WalkinTab, state.tsx) and Doctor/dashboard/WalkinModal.tsx.
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import { type QueuePreview, formatDisplayDate, getLocalDateString, shiftLabel, tidyTimes } from '@mediarca/shared/api';
import { api } from '@mediarca/shared/api';
import { formatDisplayPhone, formatIndianPhone, isValidIndianPhone, sanitizeIndianPhone } from '@mediarca/shared/utils/phoneUtils';
import { DayPills } from '@/components/DayPills';
import { DoctorBar } from '@/components/DoctorBar';
import { ShiftList } from '@/components/booking';
import { PillButton } from '@/components/kit';
import { Button, Card, Field, Notice, Segmented } from '@/components/ui';
import { doctorName, workingDaysOf } from '@/lib/booking';
import { trackUrl } from '@/lib/site';
import { success } from '@/lib/haptics';
import { colors, radius, shadow, space, type } from '@/theme';

export interface WalkinValues {
  doctorId: string;
  clinicId?: string;
  appointmentDate: string;
  slotId?: string;
  patientName: string;
  patientPhone?: string;
  patientAge?: string;
  gender: string;
  isForOther: boolean;
  reasonForVisit?: string;
}

export interface IssuedToken {
  queueNumber: number;
  estimatedTime?: string;
  checkingWindow?: string;
  shiftTime?: string | null;
  walkInCode?: string | null;
  patientName: string;
  patientPhone?: string;
  doctorName: string;
  appointmentDate: string;
}

type Choice = { id: string; label: string; specialty?: string | null; avatarUrl?: string | null };

export function WalkinForm({
  doctors,
  clinics,
  fixedDoctorId,
  fixedClinicId,
  phoneRequired,
  forOther,
  submit,
}: {
  /** Front desk: the doctors to choose from. */
  doctors?: Choice[];
  /** Doctor: their clinics (a choice shows only when there are two or more). */
  clinics?: Choice[];
  fixedDoctorId?: string;
  fixedClinicId?: string;
  phoneRequired: boolean;
  /** Doctor walk-ins are always for someone else; the desk lets the server decide from the name. */
  forOther: boolean;
  submit: (values: WalkinValues) => Promise<IssuedToken>;
}) {
  const [chosenDoctor, setDoctorId] = useState('');
  const [chosenClinic, setClinicId] = useState('');
  // Keep a valid doctor/clinic when the lists arrive or change
  const doctorId = fixedDoctorId || (doctors?.some((d) => d.id === chosenDoctor) ? chosenDoctor : doctors?.[0]?.id || '');
  const clinicId = fixedClinicId || (clinics?.some((c) => c.id === chosenClinic) ? chosenClinic : clinics?.[0]?.id || '');
  const [date, setDate] = useState(getLocalDateString());
  const [slotId, setSlotId] = useState('');
  const [preview, setPreview] = useState<QueuePreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('Not Specified');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<IssuedToken | null>(null);

  const loadPreview = useCallback(async () => {
    if (!doctorId || !date) return;
    setLoadingPreview(true);
    try {
      const p = await api.getQueuePreview(doctorId, date, slotId || undefined, clinicId || undefined);
      setPreview(p);
      const current = p.availableSlots?.find((s) => s.slot.id === slotId);
      // Move off a shift that has ended
      if (p.selectedSlotId && (!slotId || ((p.isPassed || current?.isPassed) && p.selectedSlotId !== slotId))) setSlotId(p.selectedSlotId);
    } catch {
      setPreview(null);
    } finally {
      setLoadingPreview(false);
    }
  }, [doctorId, date, slotId, clinicId]);

  useEffect(() => {
    queueMicrotask(() => {
      loadPreview();
    });
  }, [loadPreview]);

  const shifts = preview?.availableSlots || [];
  const chosen = shifts.find((s) => s.slot.id === slotId) || preview?.selectedSlot || null;
  const ended = Boolean(chosen?.isPassed);
  const full = Boolean(chosen?.isFull);
  const closed = preview?.isOnLeave ? 'Doctor is on leave this day.' : preview?.isDayOff ? 'Doctor doesn’t work this day.' : null;

  const add = async () => {
    setError(null);
    if (!doctorId) return setError('Choose a doctor.');
    if (!name.trim()) return setError('Enter the patient’s name.');
    if (phoneRequired && !phone) return setError('Enter the mobile number.');
    if (phone && !isValidIndianPhone(phone)) return setError('Enter a valid 10-digit mobile number.');
    if (age.trim()) {
      const n = parseInt(age.trim(), 10);
      if (!Number.isFinite(n) || n < 0 || n > 125) return setError('Enter an age between 0 and 125.');
    }
    if (closed) return setError(closed);
    if (ended) return setError('This shift has ended. Pick another shift or day.');
    if (full) return setError('This shift is full. Pick another shift or day.');
    setSaving(true);
    try {
      const token = await submit({
        doctorId,
        clinicId: clinicId || undefined,
        appointmentDate: date,
        slotId: slotId || undefined,
        patientName: name.trim(),
        patientPhone: phone ? formatIndianPhone(phone) : undefined,
        patientAge: age.trim() || undefined,
        gender,
        isForOther: forOther,
      });
      success();
      setIssued(token);
      setName('');
      setPhone('');
      setAge('');
      setGender('Not Specified');
      loadPreview();
    } catch (err: any) {
      setError(err?.message || 'Couldn’t add walk-in. Try again.');
    } finally {
      setSaving(false);
    }
  };

  if (issued) return <TokenIssued token={issued} onDone={() => setIssued(null)} />;

  return (
    <>
      {doctors && doctors.length > 0 ? (
        <DoctorBar
          doctors={doctors.map((d) => ({ id: d.id, name: d.label, specialty: d.specialty, avatarUrl: d.avatarUrl }))}
          value={doctorId}
          onChange={(id) => {
            setDoctorId(id);
            setSlotId('');
          }}
        />
      ) : null}
      {clinics && clinics.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills} style={styles.bleed}>
          {clinics.map((c) => (
            <PillButton key={c.id} label={c.label} active={c.id === clinicId} onPress={() => setClinicId(c.id)} />
          ))}
        </ScrollView>
      ) : null}

      <DayPills value={date} onChange={(d) => setDate(d)} days={7} workingDays={workingDaysOf(preview)} />

      {/* Same shift cards as booking (sun / moon, Available / Ended / Full) */}
      {shifts.length > 0 && !closed ? <ShiftList items={shifts} selectedId={slotId || chosen?.slot.id || null} onSelect={setSlotId} /> : null}

      <View style={[styles.preview, Boolean(closed) && !(loadingPreview && !preview) && styles.previewClosed]}>
        {loadingPreview && !preview ? (
          <ActivityIndicator color={colors.primary} />
        ) : closed ? (
          <>
            <Ionicons name="moon-outline" size={20} color={colors.warning} />
            <Text style={[type.body, styles.flexText, { color: colors.warning }]}>{closed}</Text>
          </>
        ) : chosen ? (
          <>
            <View style={styles.previewCell}>
              <Text style={type.footnote}>Next token</Text>
              <Text style={styles.previewBig}>#{preview?.slotQueueNumber ?? preview?.nextQueueNumber ?? '–'}</Text>
            </View>
            <View style={styles.previewCell}>
              <Text style={type.footnote}>Est. time</Text>
              <Text style={styles.previewValue}>{ended ? 'Ended' : full ? 'Full' : tidyTimes(chosen.estimatedTime || preview?.estimatedTime) || '–'}</Text>
            </View>
            <View style={styles.previewCell}>
              <Text style={type.footnote}>Ahead</Text>
              <Text style={styles.previewValue}>{chosen.patientsAhead ?? preview?.patientsAhead ?? 0}</Text>
            </View>
          </>
        ) : (
          <Text style={type.caption}>No shifts this day.</Text>
        )}
      </View>

      <Card>
        <Field label="Name" value={name} onChangeText={setName} placeholder="Patient’s full name" maxLength={100} autoCapitalize="words" />
        <Field
          label={phoneRequired ? 'Mobile number' : 'Mobile number (optional)'}
          prefix="+91"
          value={phone}
          onChangeText={(t) => setPhone(sanitizeIndianPhone(t))}
          keyboardType="phone-pad"
          maxLength={10}
          placeholder="10-digit number"
        />
        <Field label="Age (optional)" value={age} onChangeText={(t) => setAge(t.replace(/\D/g, '').slice(0, 3))} keyboardType="number-pad" placeholder="e.g. 24" />
        <Text style={type.label}>Gender</Text>
        <Segmented
          options={[
            { value: 'Male', label: 'Male' },
            { value: 'Female', label: 'Female' },
            { value: 'Other', label: 'Other' },
          ]}
          value={gender as 'Male' | 'Female' | 'Other'}
          onChange={(g) => setGender(g === gender ? 'Not Specified' : g)}
        />
        <Notice tone="error" message={error} />
        <Button label="Add to queue" icon="add" onPress={add} loading={saving} />
      </Card>
    </>
  );
}

function TokenIssued({ token, onDone }: { token: IssuedToken; onDone: () => void }) {
  return (
    <>
      <View style={styles.pass}>
        <Text style={styles.passLabel}>Token issued</Text>
        <Text style={styles.passToken}>#{token.queueNumber}</Text>
        <View style={styles.passRow}>
          <View style={styles.passCell}>
            <Text style={styles.passSmall}>Est. time</Text>
            <Text style={styles.passValue}>{tidyTimes(token.estimatedTime) || '–'}</Text>
          </View>
          <View style={styles.passWide}>
            <Text style={styles.passSmall}>Shift</Text>
            <Text style={styles.passValue} numberOfLines={2}>
              {shiftLabel(token)}
            </Text>
          </View>
        </View>
      </View>
      {token.walkInCode ? (
        <Card style={styles.center}>
          <Text style={type.footnote}>Tracking code</Text>
          <Text style={styles.code}>{token.walkInCode}</Text>
          <Text style={type.footnote}>Track walk-in · with the mobile number</Text>
          {token.patientPhone ? (
            <View style={styles.sendRow}>
              <View style={styles.flex}>
                <Button label="WhatsApp" icon="logo-whatsapp" variant="secondary" onPress={() => sendCode(token, 'whatsapp')} />
              </View>
              <View style={styles.flex}>
                <Button label="SMS" icon="chatbubble" variant="secondary" onPress={() => sendCode(token, 'sms')} />
              </View>
            </View>
          ) : null}
        </Card>
      ) : null}
      <Card>
        <Detail label="Patient" value={token.patientName} />
        {token.patientPhone ? <Detail label="Mobile" value={formatDisplayPhone(token.patientPhone)} /> : null}
        <Detail label="Doctor" value={doctorName(token.doctorName)} />
        <Detail label="Date" value={formatDisplayDate(token.appointmentDate)} />
      </Card>
      <Button label="Done" onPress={onDone} />
    </>
  );
}

/** Opens WhatsApp or the SMS app with the token and code filled in; the desk taps Send. */
function sendCode(token: IssuedToken, via: 'whatsapp' | 'sms') {
  const digits = sanitizeIndianPhone(token.patientPhone);
  if (digits.length !== 10) return;
  const text =
    `MediArca: Token #${token.queueNumber} with ${doctorName(token.doctorName)}, ${formatDisplayDate(token.appointmentDate)}` +
    `${token.estimatedTime && /\d/.test(token.estimatedTime) ? `, about ${tidyTimes(token.estimatedTime)}` : ''}.` +
    ` Track your turn at ${trackUrl} with code ${token.walkInCode} and this mobile number.`;
  const url = via === 'whatsapp' ? `https://wa.me/91${digits}?text=${encodeURIComponent(text)}` : `sms:+91${digits}?body=${encodeURIComponent(text)}`;
  Linking.openURL(url).catch(() => {});
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <Text style={type.caption}>{label}</Text>
      <Text style={[type.body, styles.detailValue]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  bleed: { marginHorizontal: -(space.lg + 4), flexGrow: 0 },
  pills: { gap: space.sm, paddingHorizontal: space.lg + 4 },
  preview: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primaryTint, borderRadius: radius.card, padding: space.lg, gap: space.md, minHeight: 76 },
  previewClosed: { backgroundColor: colors.warningSoft, minHeight: 0 },
  flexText: { flex: 1 },
  previewCell: { flex: 1, gap: 2 },
  previewBig: { fontSize: 24, fontWeight: '600', color: colors.primary },
  previewValue: { fontSize: 17, fontWeight: '600', color: colors.ink },
  center: { alignItems: 'center', gap: 4 },
  sendRow: { flexDirection: 'row', gap: space.sm, alignSelf: 'stretch', marginTop: space.sm },
  code: { fontSize: 32, fontWeight: '600', letterSpacing: 6, color: colors.ink },
  pass: { backgroundColor: colors.primary, borderRadius: radius.card, padding: space.xl, gap: space.sm, ...shadow.raised },
  passLabel: { fontSize: 15, color: 'rgba(255,255,255,0.85)' },
  passToken: { fontSize: 56, fontWeight: '600', color: colors.white, letterSpacing: -1.5 },
  passRow: { flexDirection: 'row', gap: space.lg, marginTop: space.sm },
  passCell: { flex: 1, minWidth: 0 },
  passWide: { flex: 1.7, minWidth: 0 },
  passSmall: { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
  passValue: { fontSize: 17, fontWeight: '600', color: colors.white },
  detail: { flexDirection: 'row', justifyContent: 'space-between', gap: space.lg, minHeight: 32, alignItems: 'center' },
  detailValue: { flexShrink: 1, textAlign: 'right' },
});
