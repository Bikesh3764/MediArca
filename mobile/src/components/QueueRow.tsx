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
  /** "Walk-in · 34y", "Family · 8y" */
  tag?: string | null;
  /** "Morning · Reason" */
  meta?: string;
  phone?: string | null;
  arrived?: boolean;
  /** Walk-in tracking code, shown so staff can read it out again. */
  code?: string | null;
}

export function QueueRow({
  item,
  showArrival = true,
  onToggleArrived,
  call,
  onCall,
  calling = false,
  onMore,
  muted = false,
}: {
  item: QueueRowData;
  showArrival?: boolean;
  onToggleArrived?: () => void;
  /** 'call' shows the Call button; 'away' says the doctor is away. */
  call?: 'call' | 'away' | null;
  onCall?: () => void;
  calling?: boolean;
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
          <Text style={type.headline} numberOfLines={1}>
            {item.name}
          </Text>
          {item.tag || item.meta ? (
            <Text style={type.footnote} numberOfLines={1}>
              {[item.tag, item.meta].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
          {item.code && !muted ? (
            <View style={styles.code} accessibilityLabel={`Tracking code ${item.code}`}>
              <Ionicons name="key-outline" size={12} color={colors.primary} />
              <Text style={styles.codeText} selectable>
                {item.code}
              </Text>
            </View>
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

      {!muted && (showArrival || call) ? (
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
          {call === 'call' && onCall ? (
            <Pressable
              accessibilityRole="button"
              disabled={calling}
              onPress={onCall}
              style={({ pressed }) => [styles.call, pressed && { backgroundColor: colors.primaryPressed, transform: [{ scale: 0.98 }] }]}
            >
              {calling ? <ActivityIndicator size="small" color={colors.white} /> : <Ionicons name="play" size={13} color={colors.white} />}
              <Text style={styles.callText}>Call in</Text>
            </Pressable>
          ) : call === 'away' ? (
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
  code: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.primarySoft },
  codeText: { fontSize: 12, fontWeight: '600', letterSpacing: 1.5, color: colors.primary },
  arrived: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.canvas },
  arrivedOn: { backgroundColor: colors.primaryTint },
  arrivedText: { fontSize: 14, color: colors.ink },
  call: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: colors.primary },
  callText: { fontSize: 15, fontWeight: '600', color: colors.white },
});
