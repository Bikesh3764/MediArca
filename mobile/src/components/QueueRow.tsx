// One patient in a doctor's or front desk queue: token, name, details, and the quick actions.
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import { toTelUri } from '@mediarca/shared/utils/phoneUtils';
import { kitStyles } from '@/components/kit';
import { tap } from '@/lib/haptics';
import { colors, radius, shadow, space, type } from '@/theme';

export interface QueueRowData {
  id: string;
  token: number;
  name: string;
  /** "Walk-in · 34y" */
  tag?: string | null;
  /** "Morning · Reason" */
  meta?: string;
  phone?: string | null;
  arrived?: boolean;
}

export function QueueRow({
  item,
  showArrival = true,
  onToggleArrived,
  start,
  onStart,
  starting = false,
  onMore,
  muted = false,
}: {
  item: QueueRowData;
  showArrival?: boolean;
  onToggleArrived?: () => void;
  /** 'start' shows Start consultation; 'away' says the doctor is away. */
  start?: 'start' | 'away' | null;
  onStart?: () => void;
  starting?: boolean;
  onMore?: () => void;
  /** Done or cancelled rows: no actions, softer look. */
  muted?: boolean;
}) {
  return (
    <View style={[styles.card, muted && styles.mutedCard]}>
      <View style={styles.top}>
        <View style={[styles.token, item.arrived && !muted && styles.tokenArrived]}>
          <Text style={[styles.tokenText, item.arrived && !muted && { color: colors.primary }]}>#{item.token}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={type.headline} numberOfLines={2}>
            {item.name}
          </Text>
          {item.tag || item.meta ? (
            <Text style={type.footnote} numberOfLines={1}>
              {[item.tag, item.meta].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
        </View>
        {item.phone ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Call ${item.name}`}
            hitSlop={8}
            onPress={() => Linking.openURL(toTelUri(item.phone!))}
            style={({ pressed }) => [styles.round, pressed && kitStyles.pressed]}
          >
            <Ionicons name="call" size={16} color={colors.primary} />
          </Pressable>
        ) : null}
        {onMore ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="More"
            hitSlop={8}
            onPress={onMore}
            style={({ pressed }) => [styles.round, pressed && kitStyles.pressed]}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.ink} />
          </Pressable>
        ) : null}
      </View>

      {!muted && (showArrival || start) ? (
        <View style={styles.actions}>
          {showArrival && onToggleArrived ? (
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: Boolean(item.arrived) }}
              onPress={() => {
                tap();
                onToggleArrived();
              }}
              style={({ pressed }) => [styles.arrived, item.arrived && styles.arrivedOn, pressed && kitStyles.pressed]}
            >
              <Ionicons name={item.arrived ? 'checkmark-circle' : 'ellipse-outline'} size={17} color={item.arrived ? colors.primary : colors.muted} />
              <Text style={[styles.arrivedText, item.arrived && { color: colors.primary }]}>{item.arrived ? 'Arrived' : 'Mark arrived'}</Text>
            </Pressable>
          ) : (
            <View />
          )}
          {start === 'start' && onStart ? (
            <Pressable
              accessibilityRole="button"
              disabled={starting}
              onPress={onStart}
              style={({ pressed }) => [styles.call, pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }]}
            >
              {starting ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="play" size={13} color={colors.primary} />}
              <Text style={styles.callText} numberOfLines={1}>
                Start
              </Text>
            </Pressable>
          ) : start === 'away' ? (
            <Text style={type.footnote}>Doctor away</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0, gap: 2 },
  card: { backgroundColor: colors.card, borderRadius: radius.tile + 2, padding: space.md + 2, gap: space.md, ...shadow.card },
  mutedCard: { opacity: 0.7 },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  token: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' },
  tokenArrived: { backgroundColor: colors.primaryTint },
  tokenText: { fontSize: 16, fontWeight: '600', color: colors.ink },
  round: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  arrived: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: colors.canvas },
  arrivedOn: { backgroundColor: colors.primaryTint },
  arrivedText: { fontSize: 14, color: colors.ink },
  // Soft on rows: the one big Start lives on the Next card at the top.
  call: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 36, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: colors.primarySoft, flexShrink: 1 },
  callText: { fontSize: 14, fontWeight: '600', color: colors.primary },
});
