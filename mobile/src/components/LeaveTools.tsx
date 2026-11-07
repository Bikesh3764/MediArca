// Pieces shared by the doctor's Shifts screen and the front desk's Doctors screen:
// weekday circles (M T W T F S S), the list of planned leave, and the Add leave sheet.
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import { ALL_WEEKDAYS, type DoctorLeave, formatDisplayDate, getLocalDateString } from '@mediarca/shared/api';
import { kitStyles, Sheet } from '@/components/kit';
import { RangeCalendar } from '@/components/RangeCalendar';
import { Button, Card, Notice } from '@/components/ui';
import { nextDays } from '@/lib/dates';
import { colors, radius, shadow, space, type } from '@/theme';

const DAY_LETTER: Record<string, string> = { MON: 'M', TUE: 'T', WED: 'W', THU: 'T', FRI: 'F', SAT: 'S', SUN: 'S' };
const LEAVE_DAYS = nextDays(90);

/** Leave still to come (today's one-day leave is shown by the switch instead). */
export const upcomingLeaves = (leaves?: DoctorLeave[] | null) => {
  const today = getLocalDateString();
  return (leaves || []).filter((l) => l.endDate >= today && l.type !== 'TODAY').sort((a, b) => a.startDate.localeCompare(b.startDate));
};

export const leaveDates = (l: DoctorLeave) =>
  l.startDate === l.endDate ? formatDisplayDate(l.startDate) : `${formatDisplayDate(l.startDate)} – ${formatDisplayDate(l.endDate)}`;

/** M T W T F S S circles. Pass onToggle to let people change them. */
export function WeekdayDiscs({ days, onToggle, small = false }: { days: string[]; onToggle?: (day: string) => void; small?: boolean }) {
  const size = small ? 30 : 40;
  return (
    <View style={[styles.days, small && styles.daysSmall]}>
      {ALL_WEEKDAYS.map((d) => {
        const on = days.includes(d);
        const disc = (
          <View style={[styles.disc, { width: size, height: size, borderRadius: size / 2 }, small && styles.discSmall, on && styles.discOn]}>
            <Text style={[styles.discText, small && styles.discTextSmall, on && styles.discTextOn]}>{DAY_LETTER[d]}</Text>
          </View>
        );
        if (!onToggle) return <View key={d}>{disc}</View>;
        return (
          <Pressable
            key={d}
            accessibilityRole="checkbox"
            accessibilityLabel={d}
            accessibilityState={{ checked: on }}
            onPress={() => onToggle(d)}
            style={({ pressed }) => pressed && kitStyles.pressed}
          >
            {disc}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Planned leave with Remove on each. */
export function LeaveList({ leaves, onRemove }: { leaves: DoctorLeave[]; onRemove: (l: DoctorLeave) => void }) {
  if (!leaves.length) return <Text style={[type.caption, styles.empty]}>No leave planned.</Text>;
  return (
    <View style={styles.group}>
      {leaves.map((l, i) => (
        <View key={l.id} style={[styles.leaveRow, i > 0 && styles.divider]}>
          <View style={styles.flex}>
            <Text style={type.body}>{leaveDates(l)}</Text>
          </View>
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => onRemove(l)}>
            <Text style={styles.remove}>Remove</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

type SaveLeave = (start: string, end: string) => Promise<void>;

/** Add leave in its own sheet (Shifts screen). */
export function LeaveSheet({ visible, onClose, onSave }: { visible: boolean; onClose: () => void; onSave: SaveLeave }) {
  return (
    <Sheet visible={visible} title="Add leave" onClose={onClose} doneLabel="Cancel">
      <LeaveForm onDone={onClose} onSave={onSave} />
    </Sheet>
  );
}

/** Pick the leave days on a calendar (next 90 days): tap the first day, then the last. Used inside another sheet too. */
export function LeaveForm({ onDone, onSave, onCancel }: { onDone: () => void; onSave: SaveLeave; onCancel?: () => void }) {
  const [start, setStart] = useState(LEAVE_DAYS[1].value);
  const [end, setEnd] = useState<string | null>(LEAVE_DAYS[1].value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const last = end || start;

  const save = async () => {
    if (!start) return setError('Pick the leave days.');
    setSaving(true);
    setError(null);
    try {
      await onSave(start, last);
      onDone();
    } catch (err: any) {
      setError(err?.message || 'Couldn’t add leave. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <Text style={type.headline}>{start === last ? formatDisplayDate(start) : `${formatDisplayDate(start)} – ${formatDisplayDate(last)}`}</Text>
      <RangeCalendar
        start={start}
        end={end}
        min={LEAVE_DAYS[0].value}
        max={LEAVE_DAYS[LEAVE_DAYS.length - 1].value}
        onChange={(a, b) => {
          setStart(a);
          setEnd(b);
          setError(null);
        }}
      />
      <Notice tone="error" message={error} />
      <Button label="Add leave" onPress={save} loading={saving} />
      {onCancel ? <Button label="Cancel" variant="plain" onPress={onCancel} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  days: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.card, borderRadius: radius.pill, padding: 6, ...shadow.card },
  daysSmall: { backgroundColor: colors.canvas, padding: 4, shadowOpacity: 0, elevation: 0 },
  disc: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas },
  discSmall: { backgroundColor: colors.card },
  discOn: { backgroundColor: colors.ink },
  discText: { fontSize: 15, fontWeight: '600', color: colors.muted },
  discTextSmall: { fontSize: 13 },
  discTextOn: { color: colors.white },
  group: { backgroundColor: colors.card, borderRadius: radius.card, overflow: 'hidden', ...shadow.card },
  leaveRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 56 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  remove: { fontSize: 15, color: colors.danger },
  empty: { marginLeft: 4 },
});
