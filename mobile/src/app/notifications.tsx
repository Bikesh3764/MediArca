// Notifications list for every account type. Unread ones are marked read once the list has been
// open a moment; they keep their blue look until you leave. Tap one to go to what it is about.
// Same rules as frontend/src/components/notifications (NotificationList, notificationLinks).
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import { type AppNotification, api, formatDisplayDate, getLocalDateString, tidyTimes } from '@mediarca/shared/api';
import { EmptyState, type IconName, PlaceholderCard, SectionTitle } from '@/components/kit';
import { Screen, Title } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import { yesterday } from '@/lib/dates';
import { colors, radius, shadow, space, type } from '@/theme';

const SEEN_AFTER_MS = 1200;

/** Icon and colour by kind, so the list is easy to scan. */
const lookOf = (n: AppNotification): { icon: IconName; color: string; soft: string } => {
  const title = (n.title || '').toLowerCase();
  if (/cancel|declin|reject|expired/.test(title)) return { icon: 'close-circle', color: colors.danger, soft: colors.dangerSoft };
  if (title.includes('leave') || title.includes('stepped out')) return { icon: 'cafe', color: colors.warning, soft: colors.warningSoft };
  if (n.type === 'QUEUE' || title.includes('turn')) return { icon: 'walk', color: colors.success, soft: colors.successSoft };
  if (n.type === 'CABIN_STATUS') return { icon: 'medkit', color: colors.success, soft: colors.successSoft };
  if (n.type === 'CLINICAL' || title.includes('confirmed')) return { icon: 'checkmark-circle', color: colors.success, soft: colors.successSoft };
  if (n.type === 'APPOINTMENT') return { icon: 'calendar', color: colors.primary, soft: colors.primarySoft };
  return { icon: 'notifications', color: colors.primary, soft: colors.primarySoft };
};

/** Old messages named the shift ("Sat, 7 Nov (Morning Shift)"); the date says enough. */
const cleanMessage = (m: string) => tidyTimes(m).replace(/\s*\([A-Za-z ]*Shift\)/g, '');

/**
 * Repeats in the same group (Today, Yesterday, Earlier) become one row with a count: the doctor going in and out many times,
 * or the same "Doctor on leave" message sent more than once. The newest one is shown.
 */
const collapse = (items: AppNotification[]): { n: AppNotification; ids: string[] }[] => {
  const out: { n: AppNotification; ids: string[]; key: string }[] = [];
  for (const n of items) {
    const who = (n.message || '').split(/ (?:is now|will be|stepped out)/)[0];
    const key = n.type === 'CABIN_STATUS' ? `cabin|${who}` : `same|${n.title}|${n.message}`;
    const hit = out.find((x) => x.key === key);
    if (hit) hit.ids.push(n.id);
    else out.push({ n, ids: [n.id], key });
  }
  return out;
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

  const open = async (n: AppNotification, ids: string[]) => {
    markRead(ids);
    if (user?.role === 'PATIENT') {
      // Open the visit it is about: the one active visit whose doctor the message names
      try {
        const visits = await api.getPatientAppointments({ status: 'active' });
        const text = `${n.title} ${n.message}`.toLowerCase();
        const hits = (Array.isArray(visits) ? visits : []).filter((a) => {
          const name = (a.doctor?.user?.fullName || '').replace(/^dr\.?\s*/i, '').toLowerCase();
          return name && text.includes(name);
        });
        if (hits.length === 1) return router.push({ pathname: '/visit/[id]', params: { id: hits[0].id } });
      } catch {
        // fall back to the list
      }
    }
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
              {collapse(g.items).map(({ n, ids }, i) => {
                const isNew = ids.some((id) => fresh.has(id)) || !n.isRead;
                const look = lookOf(n);
                return (
                  <Pressable
                    key={n.id}
                    accessibilityRole="button"
                    onPress={() => open(n, ids)}
                    style={({ pressed }) => [styles.row, i > 0 && styles.divider, isNew && styles.rowNew, pressed && { backgroundColor: colors.canvas }]}
                  >
                    <View style={[styles.icon, { backgroundColor: isNew ? look.color : look.soft }]}>
                      <Ionicons name={look.icon} size={16} color={isNew ? colors.white : look.color} />
                    </View>
                    <View style={styles.flex}>
                      <View style={styles.topLine}>
                        <Text style={[type.headline, styles.flex]} numberOfLines={1}>
                          {n.title}
                        </Text>
                        <Text style={type.footnote}>{timeLabel(n.createdAt)}</Text>
                      </View>
                      <Text style={type.caption} numberOfLines={3}>
                        {cleanMessage(n.message)}
                      </Text>
                      {ids.length > 1 ? <Text style={type.footnote}>+{ids.length - 1} earlier</Text> : null}
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
