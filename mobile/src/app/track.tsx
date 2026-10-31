// Walk-in patients follow their queue with the mobile number and the 6-character code on their slip.
// No account needed. Only shows the queue; it never checks anyone in (FIX-058). Mirrors TrackWalkin.tsx.
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { type WalkinTrackResult, api, getLocalDateString } from '@mediarca/shared/api';
import { isValidIndianPhone, sanitizeIndianPhone } from '@mediarca/shared/utils/phoneUtils';
import { DeskCard, type PassData, QueuePass } from '@/components/QueuePass';
import { Button, Card, Field, Notice, Screen, Title } from '@/components/ui';
import { usePolling } from '@/lib/usePolling';
import { colors, space } from '@/theme';

const cleanCode = (value: string) => value.toUpperCase().replace(/[^A-HJKMNP-Z2-9]/g, '').slice(0, 6);

const toPass = (r: WalkinTrackResult): PassData => ({
  status: r.status,
  token: r.queueNumber,
  date: r.appointmentDate,
  slot: r.checkingWindow,
  estimatedTime: r.estimatedTime,
  isToday: r.appointmentDate === getLocalDateString(),
  doctor: r.doctor ? { name: r.doctor.fullName, avatarUrl: r.doctor.avatarUrl, specialty: r.doctor.specialty, cabinStatus: r.doctor.cabinStatus, expectedReturnTime: r.doctor.expectedReturnTime } : {},
  clinic: r.clinic ? { name: r.clinic.clinicName, city: r.clinic.city } : null,
  forName: r.patientName,
  live: r.liveQueue,
});

export default function Track() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [result, setResult] = useState<WalkinTrackResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState<{ phone: string; code: string } | null>(null);

  const lookup = useCallback(async (q: { phone: string; code: string }, quiet = false) => {
    if (!quiet) {
      setLoading(true);
      setError(null);
    }
    try {
      setResult(await api.trackWalkin(q.phone, q.code));
      setError(null);
    } catch (err: any) {
      // A background refresh keeps the last ticket on screen
      if (!quiet) {
        setResult(null);
        setError(err?.message || 'Couldn’t load your queue. Try again.');
      }
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  const submit = () => {
    const digits = sanitizeIndianPhone(phone);
    if (!isValidIndianPhone(digits)) return setError('Enter a valid 10-digit mobile number.');
    if (code.length !== 6) return setError('Enter the 6-character code.');
    const q = { phone: digits, code };
    setQuery(q);
    lookup(q);
  };

  const active = result?.status === 'WAITING' || result?.status === 'IN_CONSULTATION';
  const pollMs = result?.liveQueue && result.liveQueue.patientsAway <= 5 ? 30000 : 60000;
  usePolling(() => (query ? lookup(query, true) : Promise.resolve()), pollMs, Boolean(query && result && active));

  return (
    <Screen back="/welcome">
      <Title subtitle="Use the mobile number and code from your walk-in slip.">Track walk-in</Title>

      {result ? (
        <>
          <QueuePass pass={toPass(result)} />
          {active ? <DeskCard name={result.receptionistName} phone={result.receptionistPhone} /> : null}
          <Button
            label="Track another"
            variant="secondary"
            onPress={() => {
              setResult(null);
              setQuery(null);
              setCode('');
            }}
          />
        </>
      ) : (
        <Card>
          <Field
            label="Mobile number"
            prefix="+91"
            value={phone}
            onChangeText={(t) => setPhone(sanitizeIndianPhone(t))}
            keyboardType="phone-pad"
            autoComplete="tel"
            maxLength={10}
            placeholder="10-digit number"
          />
          <Field
            label="Code"
            value={code}
            onChangeText={(t) => setCode(cleanCode(t))}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            placeholder="e.g. K7MX4P"
            style={code ? styles.code : undefined}
            onSubmitEditing={submit}
            returnKeyType="search"
          />
          <Text style={styles.help}>The code is printed on the slip from the front desk.</Text>
          <Notice tone="error" message={error} />
          <Button label="Show my queue" icon="search" onPress={submit} loading={loading} />
        </Card>
      )}
      <View style={styles.spacer} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  code: { letterSpacing: 6, fontWeight: '600' },
  help: { fontSize: 13, color: colors.muted, marginTop: -space.sm, marginLeft: 4 },
  spacer: { height: space.lg },
});
