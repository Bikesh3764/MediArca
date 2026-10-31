// Find doctors and clinics: search, specialty tiles, filters, results.
// Same data and filters as frontend/src/pages/Patient/DoctorDiscovery.tsx.
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { type ClinicProfile, type Doctor, api } from '@mediarca/shared/api';
import { INDIAN_STATES, getCitiesForState } from '@mediarca/shared/utils/indiaStates';
import { ClinicCard, DoctorCard } from '@/components/booking';
import { EmptyState, OptionList, PillButton, PlaceholderCard, SearchBar, Sheet } from '@/components/kit';
import { Button, Segmented, SelectField } from '@/components/ui';
import { SPECIALTY_TILES } from '@/lib/booking';
import { tap } from '@/lib/haptics';
import { colors, radius, shadow, space, type } from '@/theme';

type Section = 'doctors' | 'clinics';
type DoctorFilters = { state: string; city: string; minExp: string; sortBy: string };
const NO_FILTERS: DoctorFilters = { state: 'All', city: 'All', minExp: '0', sortBy: 'experience' };
const PAGE_SIZE = 20;

const matches = (value: string | undefined | null, q: string) => Boolean(value && value.toLowerCase().includes(q));

export function Discover({ header }: { header?: React.ReactNode }) {
  const [section, setSection] = useState<Section>('doctors');
  const [query, setQuery] = useState('');
  const [specialty, setSpecialty] = useState('All');
  const [filters, setFilters] = useState<DoctorFilters>(NO_FILTERS);
  const [clinicPlace, setClinicPlace] = useState({ state: 'All', city: 'All' });
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const requestId = useRef(0);

  const [clinics, setClinics] = useState<ClinicProfile[]>([]);
  const [clinicsLoaded, setClinicsLoaded] = useState(false);
  const [clinicsFailed, setClinicsFailed] = useState(false);

  const loadDoctors = useCallback(
    async (targetPage: number) => {
      const id = ++requestId.current;
      if (targetPage === 1) setSearching(true);
      else setLoadingMore(true);
      try {
        const res = await api.getDoctorsPaginated({
          search: query.trim() || undefined,
          specialty: specialty !== 'All' ? specialty : undefined,
          minExp: Number(filters.minExp) || undefined,
          sortBy: filters.sortBy,
          state: filters.state,
          city: filters.city,
          page: targetPage,
          limit: PAGE_SIZE,
        });
        if (id !== requestId.current) return; // a newer search started
        setDoctors((prev) => (targetPage === 1 ? res.data : [...prev, ...res.data.filter((d) => !prev.some((p) => p.id === d.id))]));
        setTotal(res.pagination.total || res.count);
        setPage(targetPage);
        setHasNext(Boolean(res.pagination.hasNextPage));
        setFailed(false);
      } catch {
        if (id === requestId.current && targetPage === 1) setFailed(true);
      } finally {
        if (id === requestId.current) {
          setSearching(false);
          setLoadingMore(false);
          setLoaded(true);
        }
      }
    },
    [query, specialty, filters]
  );

  // Search as you type (short pause so each key doesn't hit the server)
  useEffect(() => {
    const timer = setTimeout(() => loadDoctors(1), query ? 300 : 0);
    return () => clearTimeout(timer);
  }, [loadDoctors, query]);

  const loadClinics = useCallback(async () => {
    try {
      const data = await api.getPublicClinics();
      setClinics(Array.isArray(data) ? data : []);
      setClinicsFailed(false);
    } catch {
      setClinicsFailed(true);
    } finally {
      setClinicsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (section === 'clinics' && !clinicsLoaded) {
      queueMicrotask(() => {
        loadClinics();
      });
    }
  }, [section, clinicsLoaded, loadClinics]);

  const filteredClinics = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clinics.filter((c) => {
      if (clinicPlace.state !== 'All') {
        const s = clinicPlace.state.toLowerCase();
        if (c.state?.toLowerCase() !== s && !matches(c.address, s)) return false;
      }
      if (clinicPlace.city !== 'All') {
        const ct = clinicPlace.city.toLowerCase();
        if (c.city?.toLowerCase() !== ct && !matches(c.address, ct)) return false;
      }
      if (q && !matches(c.clinicName, q) && !matches(c.address, q) && !matches(c.city, q) && !matches(c.state, q)) return false;
      return true;
    });
  }, [clinics, clinicPlace, query]);

  const doctorFilterCount =
    (filters.state !== 'All' ? 1 : 0) + (filters.city !== 'All' ? 1 : 0) + (filters.minExp !== '0' ? 1 : 0) + (filters.sortBy !== 'experience' ? 1 : 0);
  const clinicFilterCount = (clinicPlace.state !== 'All' ? 1 : 0) + (clinicPlace.city !== 'All' ? 1 : 0);
  const filterCount = section === 'doctors' ? doctorFilterCount : clinicFilterCount;

  const onRefresh = async () => {
    setRefreshing(true);
    await (section === 'doctors' ? loadDoctors(1) : loadClinics());
    setRefreshing(false);
  };

  const resetAll = () => {
    setQuery('');
    setSpecialty('All');
    setFilters(NO_FILTERS);
    setClinicPlace({ state: 'All', city: 'All' });
  };

  const isDoctors = section === 'doctors';
  const countLabel = isDoctors
    ? loaded
      ? total === 1
        ? '1 doctor'
        : `${total} doctors`
      : ' '
    : clinicsLoaded
      ? filteredClinics.length === 1
        ? '1 clinic'
        : `${filteredClinics.length} clinics`
      : ' ';

  const listHeader = (
    <View style={styles.header}>
      {header}
      <SearchBar value={query} onChangeText={setQuery} placeholder={isDoctors ? 'Doctor, specialty or city' : 'Clinic or city'} />
      <Segmented
        options={[
          { value: 'doctors', label: 'Doctors' },
          { value: 'clinics', label: 'Clinics' },
        ]}
        value={section}
        onChange={(s) => {
          tap();
          setSection(s);
        }}
      />
      {isDoctors ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tiles} style={styles.tilesScroll}>
          {SPECIALTY_TILES.map((t) => {
            const selected = specialty === t.value;
            return (
              <Pressable
                key={t.value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={t.label}
                onPress={() => {
                  tap();
                  setSpecialty(selected && t.value !== 'All' ? 'All' : t.value);
                }}
                style={({ pressed }) => [styles.tile, selected && styles.tileSelected, pressed && { transform: [{ scale: 0.96 }] }]}
              >
                <View style={[styles.tileIcon, selected && { backgroundColor: colors.primary }]}>
                  <MaterialCommunityIcons name={t.icon} size={26} color={selected ? colors.white : colors.primary} />
                </View>
                <Text style={[styles.tileText, selected && { color: colors.primary }]} numberOfLines={1}>
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
      <View style={styles.countRow}>
        <View style={styles.countLeft}>
          <Text style={type.caption}>{countLabel}</Text>
          {searching && loaded ? <ActivityIndicator size="small" color={colors.muted} /> : null}
        </View>
        <PillButton
          label={filterCount ? `Filters · ${filterCount}` : 'Filters'}
          icon="options-outline"
          active={filterCount > 0}
          onPress={() => setFiltersOpen(true)}
        />
      </View>
    </View>
  );

  const hasAnyFilter = Boolean(query || specialty !== 'All' || filterCount);

  const emptyDoctors = !loaded ? (
    <View style={styles.placeholders}>
      <PlaceholderCard height={128} />
      <PlaceholderCard height={128} />
      <PlaceholderCard height={128} />
    </View>
  ) : failed ? (
    <EmptyState icon="cloud-offline-outline" title="Couldn’t load doctors" message="Check your connection and try again." actionLabel="Try again" onAction={() => loadDoctors(1)} />
  ) : (
    <EmptyState
      icon="search-outline"
      title="No doctors found"
      message={hasAnyFilter ? 'Try another search or filter.' : 'Doctors will show up here.'}
      actionLabel={hasAnyFilter ? 'Reset' : undefined}
      onAction={hasAnyFilter ? resetAll : undefined}
    />
  );

  const emptyClinics = !clinicsLoaded ? (
    <View style={styles.placeholders}>
      <PlaceholderCard height={96} />
      <PlaceholderCard height={96} />
    </View>
  ) : clinicsFailed ? (
    <EmptyState icon="cloud-offline-outline" title="Couldn’t load clinics" message="Check your connection and try again." actionLabel="Try again" onAction={loadClinics} />
  ) : (
    <EmptyState
      icon="business-outline"
      title="No clinics found"
      message={query || clinicFilterCount ? 'Try another search or place.' : 'Clinics will show up here.'}
    />
  );

  return (
    <>
      <FlatList<Doctor | ClinicProfile>
        data={isDoctors ? doctors : filteredClinics}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) =>
          isDoctors ? (
            <DoctorCard doctor={item as Doctor} onPress={() => router.push(`/doctors/${item.id}`)} />
          ) : (
            <ClinicCard clinic={item as ClinicProfile} onPress={() => router.push(`/clinics/${item.id}`)} />
          )
        }
        ListHeaderComponent={listHeader}
        ListEmptyComponent={isDoctors ? emptyDoctors : emptyClinics}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.more} color={colors.muted} /> : undefined}
        ItemSeparatorComponent={Gap}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (isDoctors && hasNext && !loadingMore && !searching) loadDoctors(page + 1);
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.muted} />}
      />

      <Sheet visible={filtersOpen} title="Filters" onClose={() => setFiltersOpen(false)}>
        {isDoctors ? (
          <>
            <Text style={styles.groupLabel}>Location</Text>
            <View style={styles.group}>
              <SelectField
                label="State"
                value={filters.state}
                options={['All', ...INDIAN_STATES]}
                onChange={(state) => setFilters((f) => ({ ...f, state, city: 'All' }))}
              />
              <SelectField
                label="City"
                value={filters.city}
                options={['All', ...(filters.state !== 'All' ? getCitiesForState(filters.state) : [])]}
                onChange={(city) => setFilters((f) => ({ ...f, city }))}
                disabled={filters.state === 'All'}
              />
            </View>
            <Text style={styles.groupLabel}>Experience</Text>
            <Segmented
              options={[
                { value: '0', label: 'Any' },
                { value: '5', label: '5+ yrs' },
                { value: '10', label: '10+ yrs' },
                { value: '15', label: '15+ yrs' },
              ]}
              value={filters.minExp}
              onChange={(minExp) => {
                tap();
                setFilters((f) => ({ ...f, minExp }));
              }}
            />
            <Text style={styles.groupLabel}>Sort</Text>
            <OptionList
              options={[
                { value: 'experience', label: 'Most experienced' },
                { value: 'fee_low', label: 'Lowest fee' },
                { value: 'fee_high', label: 'Highest fee' },
              ]}
              value={filters.sortBy}
              onChange={(sortBy) => setFilters((f) => ({ ...f, sortBy }))}
            />
          </>
        ) : (
          <>
            <Text style={styles.groupLabel}>Location</Text>
            <View style={styles.group}>
              <SelectField
                label="State"
                value={clinicPlace.state}
                options={['All', ...INDIAN_STATES]}
                onChange={(state) => setClinicPlace({ state, city: 'All' })}
              />
              <SelectField
                label="City"
                value={clinicPlace.city}
                options={['All', ...(clinicPlace.state !== 'All' ? getCitiesForState(clinicPlace.state) : [])]}
                onChange={(city) => setClinicPlace((p) => ({ ...p, city }))}
                disabled={clinicPlace.state === 'All'}
              />
            </View>
          </>
        )}
        {filterCount ? (
          <View style={styles.reset}>
            <Button
              label="Reset"
              variant="secondary"
              onPress={() => (isDoctors ? setFilters(NO_FILTERS) : setClinicPlace({ state: 'All', city: 'All' }))}
            />
          </View>
        ) : null}
      </Sheet>
    </>
  );
}

const Gap = () => <View style={{ height: space.md }} />;

const styles = StyleSheet.create({
  list: { paddingHorizontal: space.lg + 4, paddingTop: space.sm, paddingBottom: space.xxl * 2 },
  header: { gap: space.md, marginBottom: space.md },
  tilesScroll: { marginHorizontal: -(space.lg + 4) },
  tiles: { paddingHorizontal: space.lg + 4, paddingVertical: 6, gap: space.sm },
  tile: { width: 72, alignItems: 'center', gap: 8 },
  tileSelected: {},
  tileIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', ...shadow.card },
  tileText: { fontSize: 13, color: colors.secondaryInk },
  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  countLeft: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  placeholders: { gap: space.md },
  more: { marginVertical: space.lg },
  groupLabel: { ...type.caption, marginLeft: space.xs, marginTop: space.sm },
  group: { backgroundColor: colors.card, borderRadius: radius.card, padding: space.lg, gap: space.md, ...shadow.card },
  reset: { marginTop: space.lg },
});
