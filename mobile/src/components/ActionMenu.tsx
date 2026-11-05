// iOS-style action sheet: a short list of choices sliding up from the bottom, with Cancel.
import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, space } from '@/theme';

export interface MenuAction {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  /** Shows a check mark (the current choice). */
  selected?: boolean;
}

export function ActionMenu({ title, actions, onClose }: { title?: string | null; actions: MenuAction[] | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={Boolean(actions)} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close">
        <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
          <View style={styles.group}>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {(actions || []).map((a, i) => (
              <Pressable
                key={a.label}
                accessibilityRole="button"
                onPress={() => {
                  onClose();
                  a.onPress();
                }}
                style={({ pressed }) => [styles.row, (i > 0 || title) && styles.divider, pressed && styles.pressed]}
              >
                <View style={styles.labelRow}>
                  <Text style={[styles.label, a.destructive && { color: colors.danger }, a.selected && styles.selected]} numberOfLines={1}>
                    {a.label}
                  </Text>
                  {a.selected ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
                </View>
              </Pressable>
            ))}
          </View>
          <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.group, styles.row, pressed && styles.pressed]}>
            <Text style={[styles.label, styles.cancel]}>Cancel</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.32)', justifyContent: 'flex-end' },
  wrap: { paddingHorizontal: space.sm + 2, gap: space.sm },
  group: { backgroundColor: 'rgba(255,255,255,0.98)', borderRadius: radius.tile, overflow: 'hidden' },
  title: { fontSize: 13, color: colors.muted, textAlign: 'center', paddingVertical: space.md, paddingHorizontal: space.lg },
  row: { height: 56, alignItems: 'center', justifyContent: 'center' },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  pressed: { backgroundColor: colors.canvas },
  label: { fontSize: 19, color: colors.primary },
  cancel: { fontWeight: '600' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.lg },
  selected: { fontWeight: '600' },
});
