// Notifications list for every account type. Unread ones are marked read once the list has been
// open a moment; they keep their blue look until you leave. Tap one to go to what it is about.
// Same rules as frontend/src/components/notifications (NotificationList, notificationLinks).
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import { type AppNotification, formatDisplayDate, getLocalDateString } from '@mediarca/shared/api';
import { EmptyState, type IconName, PlaceholderCard, SectionTitle } from '@/components/kit';
import { Screen, Title } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import { yesterday } from '@/lib/dates';
import { colors, radius, shadow, space, type } from '@/theme';

const SEEN_AFTER_MS = 1200;

const iconFor = (n: AppNotification): IconName => {
  if (n.type === 'CABIN_STATUS') return 'medkit';
  if (n.type === 'CLINICAL') return 'checkmark-circle';
  if (n.type === 'QUEUE') return 'time';
  if (n.type === 'APPOINTMENT') return 'calendar';
  return 'notifications';
};

/** Where a notification takes you in the app. */
const linkFor = (role: string | undefined, n: AppNotification): string | null => {
  const title = (n.title || '').toLowerCase();
  switch (role) {
    case 'PATIENT':
      return '/patient/visits';
    case 'DOCTOR':
      return /invite|request|joined|clinic/.test(title) ? '/doctor/clinics' : '/doctor';
    case 'CLINIC':
      return title.includes('receptionist') ? '/clinic/staff' : '/clinic/doctors';
    case 'RECEPTIONIST':
      return title.includes('request') ? '/receptionist/requests' : '/receptionist';
    default:
      return null;
  }
};

const timeLabel = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  const day = getLocalDateString(date);
  if (day === getLocalDateString()) return `${Math.floor(diff / 3600)} h ago`;
  if (day === yesterday()) return 'Yesterday';
  return formatDisplayDate(day);
};

const groupOf = (iso: string) => {
  const day = getLocalDateString(new Date(iso));
  if (day === getLocalDateString()) return 'Today';
  if (day === yesterday()) return 'Yesterday';
  return 'Earlier';
};

export default function Notifications() {
  const { user } = useAuth();
  const { notifications, unreadCount, failed, reload, markRead, markAllRead } = useNotifications();
  const [refreshing, setRefreshing] = useState(false);
  // Unread when the screen opened: they stay blue until you leave
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const unreadIds = (notifications || []).filter((n) => !n.isRead).map((n) => n.id);
  const unreadKey = unreadIds.join(',');
  useFocusEffect(
    useCallback(() => {
      if (!unreadKey) return undefined;
      const ids = unreadKey.split(',');
      setFresh((prev) => new Set([...prev, ...ids]));
      const t = setTimeout(() => markRead(ids), SEEN_AFTER_MS);
      return () => clearTimeout(t);
    }, [unreadKey, markRead])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  const open = (n: AppNotification) => {
    markRead([n.id]);
    const link = linkFor(user?.role, n);
    if (link) router.navigate(link as never);
  };

  const groups: { title: string; items: AppNotification[] }[] = [];
  for (const n of notifications || []) {
    const title = groupOf(n.createdAt);
    const g = groups.find((x) => x.title === title);
    if (g) g.items.push(n);
    else groups.push({ title, items: [n] });
  }

  return (
    <Screen back="/" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.header}>
        <Title>Notifications</Title>
        {unreadCount > 0 ? (
          <Pressable accessibilityRole="button" hitSlop={8} onPress={markAllRead} style={styles.markAll}>
            <Text style={styles.link}>Mark all read</Text>
          </Pressable>
        ) : null}
      </View>

      {!notifications ? (
        failed ? (
          <EmptyState icon="cloud-offline-outline" title="Couldn’t load" message="Check your connection." actionLabel="Try again" onAction={reload} />
        ) : (
          <>
            <PlaceholderCard height={72} />
            <PlaceholderCard height={72} />
          </>
        )
      ) : notifications.length === 0 ? (
        <EmptyState icon="notifications-outline" title="No notifications" message="Updates show up here." />
      ) : (
        groups.map((g) => (
          <View key={g.title} style={styles.section}>
            <SectionTitle title={g.title} />
            <View style={styles.group}>
              {g.items.map((n, i) => {
                const isNew = !n.isRead || fresh.has(n.id);
                return (
                  <Pressable
                    key={n.id}
                    accessibilityRole="button"
                    onPress={() => open(n)}
                    style={({ pressed }) => [styles.row, i > 0 && styles.divider, isNew && styles.rowNew, pressed && { backgroundColor: colors.canvas }]}
                  >
                    <View style={[styles.icon, isNew && { backgroundColor: colors.primary }]}>
                      <Ionicons name={iconFor(n)} size={16} color={isNew ? colors.white : colors.primary} />
                    </View>
                    <View style={styles.flex}>
                      <View style={styles.topLine}>
                        <Text style={[type.headline, styles.flex]} numberOfLines={1}>
                          {n.title}
                        </Text>
                        <Text style={type.footnote}>{timeLabel(n.createdAt)}</Text>
                      </View>
                      <Text style={type.caption} numberOfLines={3}>
                        {n.message}
                      </Text>
                    </View>
                    {isNew ? <View style={styles.dot} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  markAll: { paddingBottom: space.sm },
  link: { fontSize: 15, color: colors.primary },
  section: { gap: space.sm },
  group: { backgroundColor: colors.card, borderRadius: radius.card, overflow: 'hidden', ...shadow.card },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  rowNew: { backgroundColor: colors.primarySoft },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  icon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  topLine: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 8 },
});
