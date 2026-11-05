// In cabin / Stepped out / Away slider for a doctor, with "back in" times when stepped out.
// Doctors set their own; the front desk passes doctorId and the doctor list (tap the name to switch doctor).
// Same server call and choices as frontend/src/components/ui/DoctorCabinPresence.tsx.
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import { api } from '@mediarca/shared/api';
import { ActionMenu } from '@/components/ActionMenu';
import { type DoctorOption } from '@/components/DoctorBar';
import { Avatar } from '@/components/kit';
import { Notice, Segmented } from '@/components/ui';
import { tap } from '@/lib/haptics';
import { FadeIn, smoothLayout } from '@/lib/motion';
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
  doctors,
  onDoctorChange,
}: {
  status?: string | null;
  expectedReturnTime?: string | null;
  doctorId?: string;
  onChange?: (status: CabinStatus, returnTime: string | null) => void;
  /** Front desk: the clinic's doctors; the one matching doctorId is shown on top. */
  doctors?: DoctorOption[];
  onDoctorChange?: (id: string) => void;
}) {
  const [status, setStatus] = useState<CabinStatus>(normal(initial));
  const [returnTime, setReturnTime] = useState<string | null>(expectedReturnTime || null);
  const [mins, setMins] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  // Follow changes made elsewhere (the other phone, the website)
  const [seen, setSeen] = useState({ initial, expectedReturnTime });
  if (seen.initial !== initial || seen.expectedReturnTime !== expectedReturnTime) {
    setSeen({ initial, expectedReturnTime });
    setStatus(normal(initial));
    setReturnTime(expectedReturnTime || null);
  }

  const save = async (next: CabinStatus, estimate?: number) => {
    const before = status;
    if ((next === 'STEPPED_OUT') !== (before === 'STEPPED_OUT')) smoothLayout();
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
  const doctor = doctors?.find((d) => d.id === doctorId) || doctors?.[0];

  return (
    <View style={styles.card}>
      {doctor ? (
        <Pressable
          accessibilityRole={onDoctorChange ? 'button' : undefined}
          accessibilityLabel={onDoctorChange ? `${doctor.name}. Change doctor` : doctor.name}
          disabled={!onDoctorChange}
          onPress={() => {
            tap();
            setPicking(true);
          }}
          style={({ pressed }) => [styles.who, pressed && { opacity: 0.7 }]}
        >
          <Avatar uri={doctor.avatarUrl} name={doctor.name} size={44} />
          <View style={styles.flex}>
            <Text style={type.headline} numberOfLines={1}>
              {doctor.name}
            </Text>
            {doctor.specialty ? (
              <Text style={type.footnote} numberOfLines={1}>
                {doctor.specialty}
              </Text>
            ) : null}
          </View>
          {onDoctorChange ? (
            <View style={styles.switch}>
              <Text style={styles.switchText}>Change</Text>
              <Ionicons name="chevron-down" size={14} color={colors.primary} />
            </View>
          ) : null}
        </Pressable>
      ) : null}
      <Segmented
        options={[
          { value: 'IN_CABIN', label: 'In cabin', dot: colors.success },
          { value: 'STEPPED_OUT', label: 'Stepped out', dot: colors.orange },
          { value: 'NOT_IN_CABIN', label: 'Away', dot: colors.tabInactive },
        ]}
        value={status}
        compact
        onChange={(v) => {
          tap();
          if (v !== status) save(v, v === 'STEPPED_OUT' ? 15 : undefined);
        }}
      />
      {status === 'STEPPED_OUT' ? (
        <FadeIn style={styles.away}>
          <View style={styles.awayHead}>
            <View style={styles.awayIcon}>
              <Ionicons name="time" size={18} color={colors.warning} />
            </View>
            <View style={styles.flex}>
              <Text style={type.footnote}>Back by</Text>
              <Text style={styles.awayTime} numberOfLines={1}>
                {back ? back.replace(/^0(\d)/, '$1') : '—'}
              </Text>
            </View>
          </View>
          <View style={styles.pills}>
            {BACK_IN.map((b) => {
              const active = mins === b.mins;
              return (
                <Pressable
                  key={b.mins}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    tap();
                    save('STEPPED_OUT', b.mins);
                  }}
                  style={({ pressed }) => [styles.pill, active && styles.pillActive, pressed && { opacity: 0.7 }]}
                >
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>{b.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </FadeIn>
      ) : null}
      <Notice tone="error" message={error} />
      {doctors && onDoctorChange ? (
        <ActionMenu
          title="Doctor"
          actions={
            picking
              ? doctors.map((d) => ({ label: d.hint ? `${d.name} · ${d.hint}` : d.name, selected: d.id === doctor?.id, onPress: () => onDoctorChange(d.id) }))
              : null
          }
          onClose={() => setPicking(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.card, paddingVertical: space.lg, paddingHorizontal: space.md, gap: space.md, ...shadow.card },
  away: { backgroundColor: colors.warningSoft, borderRadius: radius.tile, padding: space.md, gap: space.md },
  awayHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  awayIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  awayTime: { fontSize: 20, fontWeight: '600', letterSpacing: -0.3, color: colors.ink },
  pills: { flexDirection: 'row', gap: 6 },
  pill: { flex: 1, height: 36, borderRadius: radius.pill, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  pillActive: { backgroundColor: colors.warning },
  pillText: { fontSize: 15, color: colors.ink },
  pillTextActive: { color: colors.white, fontWeight: '600' },
  who: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  switch: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 32, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: colors.primarySoft },
  switchText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  flex: { flex: 1, minWidth: 0 },
});
