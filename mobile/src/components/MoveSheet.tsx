// Move a patient to another day or shift (doctor and front desk). The server gives the new token.
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import { type DoctorSlot } from '@mediarca/shared/api';
import { DayPills } from '@/components/DayPills';
import { ShiftList } from '@/components/booking';
import { Sheet } from '@/components/kit';
import { Button, Notice } from '@/components/ui';
import { nextDays } from '@/lib/dates';
import { space, type } from '@/theme';

export interface MoveTarget {
  id: string;
  name: string;
  date: string;
  slotId?: string | null;
}

export function MoveSheet({
  target,
  slots,
  onClose,
  onMove,
}: {
  target: MoveTarget | null;
  slots: DoctorSlot[];
  onClose: () => void;
  /** Saves the move; throws with a message on failure. */
  onMove: (target: MoveTarget, date: string, slotId?: string) => Promise<void>;
}) {
  const [date, setDate] = useState('');
  const [slotId, setSlotId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A new patient to move: default to the next day, same shift
  const [forTarget, setForTarget] = useState<MoveTarget | null>(null);
  if (target !== forTarget) {
    setForTarget(target);
    if (target) {
      const days = nextDays(2);
      setDate(target.date === days[0].value ? days[1].value : days[0].value);
      setSlotId(target.slotId || slots[0]?.id || '');
      setError(null);
    }
  }

  const save = async () => {
    if (!target) return;
    if (date === target.date && (slotId || '') === (target.slotId || '')) return setError('Pick a different day or shift.');
    setSaving(true);
    setError(null);
    try {
      await onMove(target, date, slotId || undefined);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Couldn’t move. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={Boolean(target)} title="Move" onClose={onClose} doneLabel="Cancel">
      {target ? (
        <>
          <Text style={type.caption}>{target.name}</Text>
          <Text style={type.headline}>Day</Text>
          <DayPills value={date} onChange={setDate} />
          {slots.length > 0 ? (
            <View style={styles.block}>
              <Text style={type.headline}>Shift</Text>
              <ShiftList items={slots.map((slot) => ({ slot }))} selectedId={slotId || null} onSelect={setSlotId} />
            </View>
          ) : null}
          <Notice tone="error" message={error} />
          <Button label="Move" onPress={save} loading={saving} />
        </>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.sm },
});
