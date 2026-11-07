// Pick one day: the same date strip as booking (weekday letter over the date), edge to edge.
// Used by walk-in and Move; booking uses DateStrip directly.
import { StyleSheet, View } from 'react-native';
import { DateStrip } from '@/components/booking';
import { nextDays } from '@/lib/dates';
import { space } from '@/theme';

export function DayPills({
  value,
  onChange,
  days = 14,
  from = 0,
  workingDays = null,
}: {
  value: string;
  onChange: (ymd: string) => void;
  days?: number;
  from?: number;
  /** Days the doctor works (greys out the rest), when known. */
  workingDays?: Set<string> | null;
}) {
  return (
    <View style={styles.bleed}>
      <DateStrip dates={nextDays(days, from).map((d) => d.value)} value={value} onChange={onChange} workingDays={workingDays} />
    </View>
  );
}

const styles = StyleSheet.create({
  bleed: { marginHorizontal: -(space.lg + 4) },
});
