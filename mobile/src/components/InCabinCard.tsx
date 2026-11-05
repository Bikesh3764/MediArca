// The patient with the doctor right now, with Complete and Hold.
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import { Button } from '@/components/ui';
import { colors, radius, shadow, space, type } from '@/theme';

export function InCabinCard({
  token,
  name,
  tag,
  meta,
  onComplete,
  onHold,
  completing = false,
  holding = false,
}: {
  token?: number | null;
  name?: string | null;
  tag?: string | null;
  meta?: string | null;
  onComplete?: () => void;
  onHold?: () => void;
  completing?: boolean;
  holding?: boolean;
}) {
  if (!token) {
    return (
      <View style={[styles.card, styles.empty]}>
        <View style={styles.emptyIcon}>
          <Ionicons name="person-outline" size={22} color={colors.primary} />
        </View>
        <View style={styles.flex}>
          <Text style={type.headline}>No one in cabin</Text>
          <Text style={type.caption}>Tap Start consultation on an arrived patient.</Text>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.flex}>
          <Text style={styles.label}>In cabin</Text>
          <Text style={type.heading} numberOfLines={1}>
            {name || 'Patient'}
          </Text>
          {[tag, meta].filter(Boolean).length ? <Text style={type.footnote}>{[tag, meta].filter(Boolean).join(' · ')}</Text> : null}
        </View>
        <Text style={styles.token}>#{token}</Text>
      </View>
      <View style={styles.buttons}>
        {onComplete ? (
          <View style={styles.flex}>
            <Button label="Complete" icon="checkmark" onPress={onComplete} loading={completing} />
          </View>
        ) : null}
        {onHold ? (
          <View style={styles.hold}>
            <Button label="Hold" variant="secondary" onPress={onHold} loading={holding} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  card: { backgroundColor: colors.card, borderRadius: radius.card, padding: space.lg + 2, gap: space.md, ...shadow.card },
  empty: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  emptyIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  label: { fontSize: 13, fontWeight: '600', color: colors.primary, marginBottom: 2 },
  token: { fontSize: 34, fontWeight: '600', color: colors.primary, letterSpacing: -0.8 },
  notes: { backgroundColor: colors.canvas, borderRadius: radius.tile, padding: space.md, gap: 4 },
  buttons: { flexDirection: 'row', gap: space.md },
  hold: { width: 110 },
});
