// iOS-style action sheet: a short list of choices sliding up from the bottom, with Cancel.
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, space } from '@/theme';

export interface MenuAction {
  label: string;
  onPress: () => void;
  destructive?: boolean;
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
                <Text style={[styles.label, a.destructive && { color: colors.danger }]}>{a.label}</Text>
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
});
