// Which doctor this screen is for. Tap the name to switch doctor (always offered, even with one);
// `status` (e.g. the cabin pill) sits under the name in place of the specialty.
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import { ActionMenu } from '@/components/ActionMenu';
import { Avatar } from '@/components/kit';
import { tap } from '@/lib/haptics';
import { colors, radius, shadow, space, type } from '@/theme';

export interface DoctorOption {
  id: string;
  name: string;
  specialty?: string | null;
  avatarUrl?: string | null;
  /** Shown in the switch list, e.g. "4 waiting". */
  hint?: string | null;
}

export function DoctorBar({
  doctors,
  value,
  onChange,
  note,
  status,
}: {
  doctors: DoctorOption[];
  value: string;
  onChange?: (id: string) => void;
  /** Small coloured text next to the status, e.g. "Back 6:30 PM". */
  note?: string | null;
  status?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const doctor = doctors.find((d) => d.id === value) || doctors[0];
  if (!doctor) return null;
  const canSwitch = Boolean(onChange);

  const pick = () => {
    tap();
    setOpen(true);
  };

  return (
    <View style={styles.card}>
      <Pressable accessibilityRole={canSwitch ? 'button' : undefined} accessibilityLabel={canSwitch ? `${doctor.name}. Change doctor` : doctor.name} disabled={!canSwitch} onPress={pick}>
        <Avatar uri={doctor.avatarUrl} name={doctor.name} size={48} />
      </Pressable>
      <View style={styles.flex}>
        <Pressable disabled={!canSwitch} onPress={pick} style={({ pressed }) => [styles.nameRow, pressed && { opacity: 0.7 }]}>
          <Text style={[type.headline, styles.name]} numberOfLines={1}>
            {doctor.name}
          </Text>
          {canSwitch ? <Ionicons name="chevron-down" size={16} color={colors.primary} /> : null}
        </Pressable>
        {status ? (
          <View style={styles.statusRow}>
            {status}
            {note ? (
              <Text style={styles.note} numberOfLines={1}>
                {note}
              </Text>
            ) : null}
          </View>
        ) : doctor.specialty ? (
          <Text style={type.footnote} numberOfLines={1}>
            {doctor.specialty}
          </Text>
        ) : null}
      </View>
      <ActionMenu
        title="Doctor"
        actions={
          open && onChange
            ? doctors.map((d) => ({ label: d.hint ? `${d.name} · ${d.hint}` : d.name, selected: d.id === doctor.id, onPress: () => onChange(d.id) }))
            : null
        }
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.card, borderRadius: radius.card, padding: space.md, paddingRight: space.lg, ...shadow.card },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 4 },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { flexShrink: 1 },
  note: { fontSize: 13, color: colors.warning },
});
