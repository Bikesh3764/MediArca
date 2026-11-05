// Shift slider for a queue: "All" plus one chip per shift (name on top, "9–11 AM" below). Tap to show only that shift.
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import { type DoctorSlot, cleanSlotName } from '@mediarca/shared/api';
import { tap } from '@/lib/haptics';
import { slotKey } from '@/lib/queueGroups';
import { colors, radius, space } from '@/theme';

const parts = (hhmm?: string) => {
  const [h = 0, m = 0] = String(hhmm || '').split(':').map(Number);
  return { h: h % 12 || 12, m: m ? `:${String(m).padStart(2, '0')}` : '', ap: h < 12 ? 'AM' : 'PM' };
};

/** "9–11 AM", "11 AM–1 PM", "5:30–8 PM". */
export const shortShiftTime = (slot: { startTime?: string; endTime?: string }) => {
  if (!slot.startTime || !slot.endTime) return '';
  const a = parts(slot.startTime);
  const b = parts(slot.endTime);
  return a.ap === b.ap ? `${a.h}${a.m}–${b.h}${b.m} ${b.ap}` : `${a.h}${a.m} ${a.ap}–${b.h}${b.m} ${b.ap}`;
};

const shortName = (slot: DoctorSlot, i: number) => cleanSlotName(slot.name, '').replace(/\s*shift$/i, '').trim() || `Shift ${i + 1}`;

function Chip({ title, sub, active, onPress }: { title: string; sub?: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={[title, sub].filter(Boolean).join(', ')}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && { opacity: 0.75 }]}
    >
      <Text style={[styles.title, active && styles.onActive]} numberOfLines={1}>
        {title}
      </Text>
      {sub ? (
        <Text style={[styles.sub, active && styles.onActive]} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function ShiftChips({ slots, value, onChange }: { slots: DoctorSlot[]; value: string; onChange: (key: string) => void }) {
  if (slots.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={styles.bleed}>
      {slots.length > 1 ? <Chip title="All" sub="shifts" active={value === 'all'} onPress={() => onChange('all')} /> : null}
      {slots.map((s, i) => (
        <Chip key={slotKey(s)} title={shortName(s, i)} sub={shortShiftTime(s)} active={slots.length === 1 || value === slotKey(s)} onPress={() => onChange(slotKey(s))} />
      ))}
      <View style={{ width: 1 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bleed: { marginHorizontal: -(space.lg + 4), flexGrow: 0 },
  row: { gap: space.sm, paddingHorizontal: space.lg + 4 },
  chip: { minWidth: 72, height: 50, paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: colors.fill, alignItems: 'center', justifyContent: 'center' },
  chipActive: { backgroundColor: colors.primary },
  title: { fontSize: 15, fontWeight: '600', color: colors.ink },
  sub: { fontSize: 12, color: colors.secondaryInk },
  onActive: { color: colors.white },
});
