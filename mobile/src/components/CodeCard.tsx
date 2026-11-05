// Shows a walk-in's 6-character tracking code (from the queue's ⋯ menu). The patient types it with the mobile number on Track walk-in.
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import { Button } from '@/components/ui';
import { colors, radius, space, type } from '@/theme';

export interface CodeTarget {
  token: number;
  name: string;
  code: string;
}

export function CodeCard({ target, onClose }: { target: CodeTarget | null; onClose: () => void }) {
  // Keep the last code on screen while the card fades out
  const [shown, setShown] = useState<CodeTarget | null>(target);
  if (target && target !== shown) setShown(target);
  return (
    <Modal visible={Boolean(target)} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close">
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={type.footnote} numberOfLines={1}>
            #{shown?.token} · {shown?.name}
          </Text>
          <Text style={styles.label}>Walk-in code</Text>
          <View style={styles.codeBox}>
            <Text style={styles.code} selectable>
              {shown?.code}
            </Text>
          </View>
          <Text style={[type.footnote, styles.center]}>Track walk-in · with the mobile number</Text>
          <Button label="Done" onPress={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.32)', alignItems: 'center', justifyContent: 'center', padding: space.xl },
  card: { width: '100%', maxWidth: 340, backgroundColor: colors.card, borderRadius: radius.card, padding: space.xl, gap: space.md, alignItems: 'stretch' },
  label: { fontSize: 13, color: colors.secondaryInk, textAlign: 'center', marginTop: space.sm },
  codeBox: { backgroundColor: colors.primarySoft, borderRadius: radius.tile, paddingVertical: space.lg, alignItems: 'center' },
  code: { fontSize: 32, fontWeight: '600', letterSpacing: 6, color: colors.ink },
  center: { textAlign: 'center' },
});
