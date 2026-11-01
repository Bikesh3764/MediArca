// Month calendar to pick a From–To range (report). Tap a start day, then an end day.
// Dates are IST "YYYY-MM-DD" strings, so they sort and compare as text.
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import { tap } from '@/lib/haptics';
import { colors, radius, shadow, space } from '@/theme';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEK = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

export function RangeCalendar({
  start,
  end,
  min,
  max,
  onChange,
}: {
  start: string;
  end: string | null;
  min: string;
  max: string;
  /** `end` is null while only the first day is picked. */
  onChange: (start: string, end: string | null) => void;
}) {
  const [y0, m0] = (end || start || max).split('-').map(Number);
  const [view, setView] = useState({ y: y0, m: m0 - 1 });
  const first = ymd(view.y, view.m, 1);
  const days = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const lead = (new Date(Date.UTC(view.y, view.m, 1)).getUTCDay() + 6) % 7; // Monday first
  const canBack = first.slice(0, 7) > min.slice(0, 7);
  const canNext = first.slice(0, 7) < max.slice(0, 7);
  const move = (by: number) => {
    tap();
    setView((v) => {
      const d = new Date(Date.UTC(v.y, v.m + by, 1));
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
    });
  };

  const pick = (day: string) => {
    tap();
    if (!start || end) return onChange(day, null);
    if (day < start) return onChange(day, null);
    onChange(start, day);
  };

  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => ymd(view.y, view.m, i + 1))];
  while (cells.length % 7) cells.push(null);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous month" disabled={!canBack} onPress={() => move(-1)} hitSlop={8} style={[styles.arrow, !canBack && styles.off]}>
          <Ionicons name="chevron-back" size={20} color={colors.primary} />
        </Pressable>
        <Text style={styles.month}>
          {MONTHS[view.m]} {view.y}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Next month" disabled={!canNext} onPress={() => move(1)} hitSlop={8} style={[styles.arrow, !canNext && styles.off]}>
          <Ionicons name="chevron-forward" size={20} color={colors.primary} />
        </Pressable>
      </View>
      <View style={styles.row}>
        {WEEK.map((w, i) => (
          <Text key={i} style={styles.week}>
            {w}
          </Text>
        ))}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, r) => (
        <View key={r} style={styles.row}>
          {cells.slice(r * 7, r * 7 + 7).map((day, i) => {
            if (!day) return <View key={i} style={styles.cell} />;
            const disabled = day < min || day > max;
            const isEdge = day === start || day === end;
            const inside = Boolean(end && day > start && day < end);
            const bandLeft = Boolean(end && end !== start && (inside || day === end));
            const bandRight = Boolean(end && end !== start && (inside || day === start));
            return (
              <View key={day} style={styles.cell}>
                {bandLeft ? <View style={[styles.band, styles.bandLeft]} /> : null}
                {bandRight ? <View style={[styles.band, styles.bandRight]} /> : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: isEdge, disabled }}
                  disabled={disabled}
                  onPress={() => pick(day)}
                  style={({ pressed }) => [styles.day, isEdge && styles.dayEdge, pressed && !isEdge && styles.dayPressed]}
                >
                  <Text style={[styles.dayText, disabled && styles.dayOff, inside && styles.dayInside, isEdge && styles.dayEdgeText]}>
                    {Number(day.slice(8))}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const SIZE = 38;
const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.card, padding: space.md, gap: 2, ...shadow.card },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm },
  arrow: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  off: { opacity: 0.3 },
  month: { fontSize: 17, fontWeight: '600', color: colors.ink },
  row: { flexDirection: 'row' },
  week: { flex: 1, textAlign: 'center', fontSize: 12, color: colors.muted, paddingVertical: 4 },
  cell: { flex: 1, height: SIZE + 2, alignItems: 'center', justifyContent: 'center' },
  band: { position: 'absolute', top: 1, bottom: 1, width: '50%', backgroundColor: colors.primarySoft },
  bandLeft: { left: 0 },
  bandRight: { right: 0 },
  day: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, alignItems: 'center', justifyContent: 'center' },
  dayEdge: { backgroundColor: colors.primary },
  dayPressed: { backgroundColor: colors.fill },
  dayText: { fontSize: 15, color: colors.ink },
  dayInside: { color: colors.primary },
  dayOff: { color: colors.placeholder },
  dayEdgeText: { color: colors.white, fontWeight: '600' },
});
