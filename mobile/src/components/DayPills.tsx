// Sideways row of day pills: Today, Tomorrow, Tue 3 Nov…
import { ScrollView, StyleSheet } from 'react-native';
import { PillButton } from '@/components/kit';
import { nextDays } from '@/lib/dates';
import { space } from '@/theme';

export function DayPills({ value, onChange, days = 14, from = 0 }: { value: string; onChange: (ymd: string) => void; days?: number; from?: number }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={styles.bleed}>
      {nextDays(days, from).map((d) => (
        <PillButton key={d.value} label={d.label} active={d.value === value} onPress={() => onChange(d.value)} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bleed: { marginHorizontal: -(space.lg + 4), flexGrow: 0 },
  row: { gap: space.sm, paddingHorizontal: space.lg + 4 },
});
