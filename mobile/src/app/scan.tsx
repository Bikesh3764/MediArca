// Check in by scanning the QR code at the clinic's front desk (camera only, no codes to type).
// Same server call and messages as frontend/src/pages/Patient/MyAppointments.tsx + ClinicCheckIn.tsx.
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type Appointment, api } from '@mediarca/shared/api';
import { parseBookingQr, parseCheckinQr } from '@mediarca/shared/utils/checkinQr';
import { goBack } from '@/components/kit';
import { Button } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { doctorName } from '@/lib/booking';
import { success as successHaptic, tap } from '@/lib/haptics';
import { colors, radius, shadow, space, type } from '@/theme';

type Result =
  | { kind: 'checking' }
  | { kind: 'done'; appt: Appointment | null; message: string }
  | { kind: 'error'; message: string; code: string | null; scan: { clinicId: string; code: string } };

export default function Scan() {
  const { appointmentId } = useLocalSearchParams<{ appointmentId?: string }>();
  const { user } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [result, setResult] = useState<Result | null>(null);
  const [hint, setHint] = useState<{ text: string; clinicId?: string } | null>(null);
  const busy = useRef(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (hintTimer.current) clearTimeout(hintTimer.current);
  }, []);

  // Show Android's own "Allow camera" popup as soon as the scanner opens
  const asked = useRef(false);
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain && !asked.current) {
      asked.current = true;
      requestPermission();
    }
  }, [permission, requestPermission]);

  const allowCamera = async () => {
    const res = await requestPermission();
    if (!res.granted && !res.canAskAgain) Linking.openSettings();
  };

  const showHint = (text: string, clinicId?: string) => {
    setHint({ text, clinicId });
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHint(null), 3500);
  };

  const checkIn = async (scan: { clinicId: string; code: string }) => {
    busy.current = true;
    setResult({ kind: 'checking' });
    try {
      const res: any = await api.checkInWithQR({ ...scan, appointmentId: appointmentId || undefined });
      const appt = res?.id ? res : res?.data || null;
      successHaptic();
      setResult({ kind: 'done', appt, message: res?.message || (res?.alreadyCheckedIn ? 'You’re already checked in.' : 'You’re checked in.') });
    } catch (err: any) {
      setResult({ kind: 'error', message: err?.message || 'Couldn’t check you in. Please ask the front desk.', code: err?.code || null, scan });
    }
  };

  const onScanned = ({ data }: { data: string }) => {
    if (busy.current || result) return;
    const desk = parseCheckinQr(data);
    if (desk?.code) {
      tap();
      checkIn(desk);
      return;
    }
    const bookingClinic = parseBookingQr(data);
    if (bookingClinic) showHint('That’s the booking QR. Scan the check-in QR at the front desk.', bookingClinic);
    else showHint('This isn’t a clinic check-in QR.');
  };

  const close = () => goBack('/patient/visits');

  // Signed out (or another account type): check-in needs the patient who booked
  if (user?.role !== 'PATIENT') {
    return (
      <Panel icon="qr-code" title="Check in" message={user ? 'Sign in with your patient account to check in.' : 'Sign in with the account you booked with.'} onClose={close}>
        <Button label="Sign in" onPress={() => router.replace({ pathname: '/login', params: { role: 'PATIENT', next: '/scan' } })} />
      </Panel>
    );
  }

  if (result?.kind === 'checking') {
    return (
      <Panel icon="qr-code" title="Checking you in…" message="One moment." onClose={close}>
        <ActivityIndicator color={colors.primary} />
      </Panel>
    );
  }

  if (result?.kind === 'done') {
    const a = result.appt;
    return (
      <Panel icon="checkmark-circle" tone="success" title="You’re checked in" message={result.message} onClose={close}>
        {a ? (
          <View style={styles.summary}>
            <Row label="Token" value={`#${a.queueNumber}`} strong />
            <Row label="Doctor" value={doctorName(a.doctor?.user?.fullName)} />
            {a.clinic ? <Row label="Clinic" value={a.clinic.clinicName} /> : null}
          </View>
        ) : null}
        <Button
          label="View token"
          onPress={() => {
            if (appointmentId) router.back();
            else if (a?.id) router.replace({ pathname: '/visit/[id]', params: { id: a.id } });
            else router.replace('/patient/visits');
          }}
        />
      </Panel>
    );
  }

  if (result?.kind === 'error') {
    const clinicId = result.scan.clinicId;
    return (
      <Panel icon="alert-circle" tone="danger" title="Couldn’t check in" message={result.message} onClose={close}>
        {result.code === 'NO_APPOINTMENT_TODAY' ? (
          <Button label="Book a doctor here" onPress={() => router.replace({ pathname: '/clinics/[id]', params: { id: clinicId } })} />
        ) : result.code !== 'WRONG_QR' ? (
          <Button label="Try again" onPress={() => checkIn(result.scan)} />
        ) : null}
        <Button
          label="Scan again"
          variant="secondary"
          onPress={() => {
            busy.current = false;
            setResult(null);
          }}
        />
      </Panel>
    );
  }

  if (!permission) return <View style={styles.camera} />;

  if (!permission.granted) {
    return (
      <Panel icon="camera" title="Allow camera" message="MediArca needs the camera to scan the QR code at the front desk." onClose={close}>
        <Button label="Allow camera" onPress={allowCamera} />
      </Panel>
    );
  }

  return (
    <View style={styles.camera}>
      <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={onScanned} />
      <SafeAreaView style={styles.overlay}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={close} hitSlop={10} style={styles.closeDark}>
            <Ionicons name="close" size={22} color={colors.white} />
          </Pressable>
        </View>
        <View style={styles.middle}>
          <Text style={styles.cameraTitle}>Scan to check in</Text>
          <View style={styles.frame}>
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
          </View>
          <Text style={styles.cameraHint}>Point at the QR code at the front desk.</Text>
        </View>
        <View style={styles.hintArea}>
          {hint ? (
            <View style={styles.hint}>
              <Text style={styles.hintText}>{hint.text}</Text>
              {hint.clinicId ? (
                <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.replace({ pathname: '/clinics/[id]', params: { id: hint.clinicId! } })}>
                  <Text style={styles.hintLink}>Book here</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

function Panel({
  icon,
  tone = 'primary',
  title,
  message,
  onClose,
  children,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  tone?: 'primary' | 'success' | 'danger';
  title: string;
  message?: string;
  onClose: () => void;
  children?: React.ReactNode;
}) {
  const color = tone === 'success' ? colors.success : tone === 'danger' ? colors.danger : colors.primary;
  const bg = tone === 'success' ? colors.successSoft : tone === 'danger' ? colors.dangerSoft : colors.primarySoft;
  return (
    <SafeAreaView style={styles.panelScreen}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={10} style={styles.closeLight}>
          <Ionicons name="close" size={22} color={colors.ink} />
        </Pressable>
      </View>
      <View style={styles.panelBody}>
        <View style={[styles.panelIcon, { backgroundColor: bg }]}>
          <Ionicons name={icon} size={40} color={color} />
        </View>
        <Text style={[type.title, styles.center]}>{title}</Text>
        {message ? <Text style={[styles.panelMessage, styles.center]}>{message}</Text> : null}
        <View style={styles.panelActions}>{children}</View>
      </View>
    </SafeAreaView>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={type.caption}>{label}</Text>
      <Text style={strong ? styles.rowStrong : styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const FRAME = 248;
const CORNER = 36;

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  camera: { flex: 1, backgroundColor: '#000' },
  overlay: { flex: 1 },
  topBar: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: space.lg },
  closeDark: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  closeLight: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.fill, alignItems: 'center', justifyContent: 'center' },
  middle: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xl },
  cameraTitle: { fontSize: 22, fontWeight: '600', color: colors.white },
  cameraHint: { fontSize: 15, color: 'rgba(255,255,255,0.85)' },
  frame: { width: FRAME, height: FRAME },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: colors.white },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 22 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 22 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 22 },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 22 },
  hintArea: { minHeight: 120, paddingHorizontal: space.xl, justifyContent: 'flex-start' },
  hint: { backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: radius.tile, padding: space.lg, gap: space.sm, ...shadow.raised },
  hintText: { fontSize: 15, color: colors.ink, lineHeight: 20 },
  hintLink: { fontSize: 15, fontWeight: '600', color: colors.primary },
  panelScreen: { flex: 1, backgroundColor: colors.canvas },
  panelBody: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl, gap: space.md, paddingBottom: space.xxl * 2 },
  panelIcon: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: space.sm },
  panelMessage: { fontSize: 17, color: colors.muted, lineHeight: 23 },
  panelActions: { alignSelf: 'stretch', gap: space.md, marginTop: space.xl },
  summary: { backgroundColor: colors.card, borderRadius: radius.card, paddingHorizontal: space.lg, paddingVertical: space.sm, ...shadow.card },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.lg, minHeight: 46 },
  rowValue: { fontSize: 16, color: colors.ink, flexShrink: 1, textAlign: 'right' },
  rowStrong: { fontSize: 22, fontWeight: '600', color: colors.primary },
});
