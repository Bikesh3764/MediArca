// Grouped list where several rows can be ticked (which doctors a receptionist looks after).
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { tap } from '@/lib/haptics';
import { colors, radius, space, type } from '@/theme';

export function CheckList({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string; note?: string }[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <View style={styles.group}>
      {options.map((o, i) => {
        const on = value.includes(o.value);
        return (
          <Pressable
            key={o.value}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            onPress={() => {
              tap();
              onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value]);
            }}
            style={({ pressed }) => [styles.row, i > 0 && styles.divider, pressed && { backgroundColor: colors.canvas }]}
          >
            <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={on ? colors.primary : colors.border} />
            <View style={styles.flex}>
              <Text style={type.body} numberOfLines={1}>
                {o.label}
              </Text>
              {o.note ? (
                <Text style={type.footnote} numberOfLines={1}>
                  {o.note}
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  group: { backgroundColor: colors.card, borderRadius: radius.tile, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, minHeight: 52, paddingVertical: space.sm },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
});
