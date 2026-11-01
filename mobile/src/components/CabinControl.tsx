// In cabin / Stepped out / Away switch for a doctor. Doctors set their own; the front desk passes doctorId.
// Same server call and choices as frontend/src/components/ui/DoctorCabinPresence.tsx.
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '@mediarca/shared/api';
import { PillButton } from '@/components/kit';
import { Notice, Segmented } from '@/components/ui';
import { tap } from '@/lib/haptics';
import { colors, radius, shadow, space, type } from '@/theme';

export type CabinStatus = 'IN_CABIN' | 'STEPPED_OUT' | 'NOT_IN_CABIN';

const BACK_IN = [
  { mins: 15, label: '15m' },
  { mins: 30, label: '30m' },
  { mins: 45, label: '45m' },
  { mins: 60, label: '1h' },
];

const normal = (s?: string | null): CabinStatus => {
  const v = String(s || 'IN_CABIN').toUpperCase();
  return v === 'STEPPED_OUT' || v === 'NOT_IN_CABIN' ? v : 'IN_CABIN';
};

export function CabinControl({
  status: initial,
  expectedReturnTime,
  doctorId,
  onChange,
}: {
  status?: string | null;
  expectedReturnTime?: string | null;
  doctorId?: string;
  onChange?: (status: CabinStatus, returnTime: string | null) => void;
}) {
  const [status, setStatus] = useState<CabinStatus>(normal(initial));
  const [returnTime, setReturnTime] = useState<string | null>(expectedReturnTime || null);
  const [mins, setMins] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Follow changes made elsewhere (the other phone, the website)
  const [seen, setSeen] = useState({ initial, expectedReturnTime });
  if (seen.initial !== initial || seen.expectedReturnTime !== expectedReturnTime) {
    setSeen({ initial, expectedReturnTime });
    setStatus(normal(initial));
    setReturnTime(expectedReturnTime || null);
  }

  const save = async (next: CabinStatus, estimate?: number) => {
    const before = status;
    setStatus(next);
    setError(null);
    if (estimate) setMins(estimate);
    try {
      const res: any = await api.updateDoctorCabinStatus({
        status: next,
        ...(doctorId ? { doctorId } : {}),
        ...(next === 'STEPPED_OUT' && estimate ? { returnEstimateMinutes: estimate } : {}),
      });
      const data = res?.data || res;
      const saved = normal(data?.cabinStatus || next);
      const back = data?.expectedReturnTime ?? (next === 'STEPPED_OUT' && estimate ? `in ${estimate} mins` : null);
      setStatus(saved);
      setReturnTime(back);
      onChange?.(saved, back);
    } catch (err: any) {
      setStatus(before);
      setError(err?.message || 'Couldn’t update. Try again.');
    }
  };

  const back = returnTime ? returnTime.replace(/^~\s*/, '').trim() : null;

  return (
    <View style={styles.card}>
      <Segmented
        options={[
          { value: 'IN_CABIN', label: 'In cabin' },
          { value: 'STEPPED_OUT', label: 'Stepped out' },
          { value: 'NOT_IN_CABIN', label: 'Away' },
        ]}
        value={status}
        onChange={(v) => {
          tap();
          if (v !== status) save(v, v === 'STEPPED_OUT' ? 15 : undefined);
        }}
      />
      {status === 'STEPPED_OUT' ? (
        <View style={styles.backRow}>
          <Text style={type.caption}>{back ? `Back ${back}` : 'Back in'}</Text>
          <View style={styles.pills}>
            {BACK_IN.map((b) => (
              <PillButton key={b.mins} label={b.label} active={mins === b.mins} onPress={() => save('STEPPED_OUT', b.mins)} />
            ))}
          </View>
        </View>
      ) : null}
      <Notice tone="error" message={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.card, padding: space.lg, gap: space.md, ...shadow.card },
  backRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, flexWrap: 'wrap' },
  pills: { flexDirection: 'row', gap: 6 },
});
