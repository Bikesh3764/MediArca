// Your bookings. Same data and rules as frontend/src/pages/Patient/MyAppointments.tsx.
// Background refresh is silent: the list stays on screen and updates in place.
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type Appointment, api, getLocalDateString } from '@mediarca/shared/api';
import { AppointmentCard } from '@/components/AppointmentCard';
import { EmptyState, IconButton, PlaceholderCard } from '@/components/kit';

import { Button, Segmented } from '@/components/ui';
import { tap } from '@/lib/haptics';
import { usePolling, keepIfSame } from '@/lib/usePolling';
import { colors, space, type } from '@/theme';

const PAST_PAGE = 10;

const isUpcoming = (a: Appointment, today: string) => {
  if (a.status !== 'WAITING' && a.status !== 'IN_CONSULTATION' && a.status !== 'PENDING_APPROVAL') return false;
  if (a.appointmentDate < today) return false;
  if (a.status === 'PENDING_APPROVAL' && a.appointmentDate === today && a.liveQueue?.isShiftPassed) return false;
  return true;
};

export default function Visits() {
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [active, setActive] = useState<Appointment[]>([]);
  const [activeLoaded, setActiveLoaded] = useState(false);
  const [activeFailed, setActiveFailed] = useState(false);
  const [past, setPast] = useState<Appointment[]>([]);
  const [pastLoaded, setPastLoaded] = useState(false);
  const [pastFailed, setPastFailed] = useState(false);
  const [pastPage, setPastPage] = useState(1);
  const [hasMorePast, setHasMorePast] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const pastRequested = useRef(false);

  const loadActive = useCallback(async () => {
    try {
      const data = await api.getPatientAppointments({ status: 'active' });
      setActive(keepIfSame(Array.isArray(data) ? data : []));
      setActiveFailed(false);
    } catch {
      setActiveFailed(true);
    } finally {
      setActiveLoaded(true);
    }
  }, []);

  const loadPast = useCallback(async () => {
    try {
      const data = await api.getPatientAppointments({ status: 'past', page: 1, limit: PAST_PAGE });
      const list = Array.isArray(data) ? data : [];
      setPast(list);
      setPastPage(1);
      setHasMorePast(list.length === PAST_PAGE);
      setPastFailed(false);
    } catch {
      setPastFailed(true);
    } finally {
      setPastLoaded(true);
    }
  }, []);

  // Refresh each time the tab is opened (quietly, keeping what's on screen)
  useFocusEffect(
    useCallback(() => {
      loadActive();
    }, [loadActive])
  );

  const today = getLocalDateString();
  const upcoming = useMemo(() => active.filter((a) => isUpcoming(a, today)), [active, today]);

  // Closer to your turn = refresh more often (same steps as the website)
  const pollMs = useMemo(() => {
    if (upcoming.length === 0) return 60000;
    const minAhead = Math.min(...upcoming.map((a) => a.liveQueue?.patientsAway ?? 99));
    if (minAhead <= 1 || upcoming.some((a) => a.status === 'IN_CONSULTATION' || a.liveQueue?.isYourTurn)) return 10000;
    if (minAhead <= 5) return 15000;
    return 60000;
  }, [upcoming]);
  usePolling(loadActive, pollMs, upcoming.length > 0);

  const switchTab = (next: 'upcoming' | 'past') => {
    tap();
    setTab(next);
    if (next === 'past' && !pastRequested.current) {
      pastRequested.current = true;
      loadPast();
    }
  };

  const loadMorePast = async () => {
    if (loadingMore || !hasMorePast) return;
    setLoadingMore(true);
    try {
      const data = await api.getPatientAppointments({ status: 'past', page: pastPage + 1, limit: PAST_PAGE });
      const list = Array.isArray(data) ? data : [];
      setPast((prev) => [...prev, ...list.filter((a) => !prev.some((p) => p.id === a.id))]);
      setPastPage((p) => p + 1);
      setHasMorePast(list.length === PAST_PAGE);
    } catch {
      // Keep what's shown; the button stays so they can try again
    } finally {
      setLoadingMore(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await (tab === 'upcoming' ? loadActive() : loadPast());
    setRefreshing(false);
  };

  const isUpcomingTab = tab === 'upcoming';
  const data = isUpcomingTab ? upcoming : past;
  const loaded = isUpcomingTab ? activeLoaded : pastLoaded;
  const failedNow = isUpcomingTab ? activeFailed : pastFailed;

  const empty = !loaded ? (
    <View style={styles.placeholders}>
      <PlaceholderCard height={210} />
      <PlaceholderCard height={210} />
    </View>
  ) : failedNow ? (
    <EmptyState
      icon="cloud-offline-outline"
      title={isUpcomingTab ? 'Couldn’t load appointments' : 'Couldn’t load past visits'}
      message="Check your connection and try again."
      actionLabel="Try again"
      onAction={isUpcomingTab ? loadActive : loadPast}
    />
  ) : isUpcomingTab ? (
    <EmptyState icon="calendar-outline" title="No upcoming appointments" message="Your bookings will show up here." actionLabel="Find a doctor" onAction={() => router.navigate('/patient')} />
  ) : (
    <EmptyState icon="time-outline" title="No past appointments" message="Past visits will show up here." />
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <FlatList
        data={data}
        keyExtractor={(a) => a.id}
        renderItem={({ item }) => <AppointmentCard appt={item} />}
        ItemSeparatorComponent={Gap}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text style={type.largeTitle}>Visits</Text>
              <IconButton icon="qr-code-outline" label="Scan to check in" onPress={() => router.push('/scan')} />
            </View>
            <Segmented
              options={[
                { value: 'upcoming', label: upcoming.length ? `Upcoming · ${upcoming.length}` : 'Upcoming' },
                { value: 'past', label: 'Past' },
              ]}
              value={tab}
              onChange={switchTab}
            />
          </View>
        }
        ListEmptyComponent={empty}
        ListFooterComponent={
          !isUpcomingTab && hasMorePast ? (
            <View style={styles.more}>
              {loadingMore ? <ActivityIndicator color={colors.muted} /> : <Button label="Show more" variant="secondary" onPress={loadMorePast} />}
            </View>
          ) : undefined
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.muted} />}
      />
    </SafeAreaView>
  );
}

const Gap = () => <View style={{ height: space.md }} />;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  list: { paddingHorizontal: space.lg + 4, paddingTop: space.sm, paddingBottom: space.xxl * 2 },
  header: { gap: space.md, marginTop: space.sm, marginBottom: space.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  placeholders: { gap: space.md },
  more: { marginTop: space.lg },
});
