// Clinic page: photo, address, phone and the doctors who sit here.
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type ClinicProfile, type Doctor, api, getFileUrl } from '@mediarca/shared/api';
import { formatClinicAddress } from '@mediarca/shared/utils/address';
import { formatDisplayPhone, toTelUri } from '@mediarca/shared/utils/phoneUtils';
import { DoctorCard } from '@/components/booking';
import { EmptyState, IconButton, SectionTitle, goBack } from '@/components/kit';
import { Button, Loading } from '@/components/ui';
import { colors, space, type } from '@/theme';

export default function ClinicPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [clinic, setClinic] = useState<ClinicProfile | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'failed'>('loading');
  const [photoFailed, setPhotoFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .getPublicClinicById(id)
      .then((data) => {
        if (cancelled) return;
        setClinic(data);
        setState('ready');
      })
      .catch((err) => {
        if (!cancelled) setState((prev) => (prev === 'ready' ? prev : err?.status === 404 || err?.status === 400 ? 'missing' : 'failed'));
      })
      .finally(() => {
        if (!cancelled) setRefreshing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  if (state === 'loading') return <Loading />;

  if (!clinic) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + space.sm, paddingHorizontal: space.lg }]}>
        <IconButton icon="chevron-back" label="Back" onPress={() => goBack('/patient')} />
        {state === 'failed' ? (
          <EmptyState
            icon="cloud-offline-outline"
            title="Couldn’t load clinic"
            message="Check your connection and try again."
            actionLabel="Try again"
            onAction={() => {
              setState('loading');
              setAttempt((a) => a + 1);
            }}
          />
        ) : (
          <EmptyState icon="business-outline" title="Clinic not found" message="This clinic isn’t available." />
        )}
      </View>
    );
  }

  // Doctors listed with this clinic's own fee and booking status
  const doctors: Doctor[] = (clinic.doctors || []).map((cd) => ({
    ...cd.doctor,
    clinics: [
      {
        id: cd.id,
        clinicId: clinic.id,
        clinic,
        consultationFee: cd.consultationFee ?? cd.doctor.consultationFee,
        hasReceptionist: cd.hasReceptionist,
      },
    ],
  }));
  const hasPhoto = Boolean(clinic.avatarUrl) && !photoFailed;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              setAttempt((a) => a + 1);
            }}
            tintColor={colors.muted}
          />
        }
      >
        <View style={[styles.hero, { height: 220 + insets.top }]}>
          {hasPhoto ? (
            <Image source={{ uri: getFileUrl(clinic.avatarUrl!) }} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => setPhotoFailed(true)} />
          ) : (
            <View style={styles.heroFallback}>
              <Ionicons name="business" size={64} color={colors.primary} />
            </View>
          )}
        </View>
        <View style={[styles.backFloat, { top: insets.top + space.sm }]}>
          <IconButton icon="chevron-back" label="Back" onPress={() => goBack('/patient')} />
        </View>

        <View style={styles.sheet}>
          <Text style={styles.name}>{clinic.clinicName}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={16} color={colors.muted} />
            <Text style={[type.caption, styles.flex, { fontSize: 15 }]}>{formatClinicAddress(clinic) || 'Clinic'}</Text>
          </View>
          {clinic.phone ? (
            <View style={styles.call}>
              <Button icon="call-outline" variant="secondary" label={formatDisplayPhone(clinic.phone)} onPress={() => Linking.openURL(toTelUri(clinic.phone))} />
            </View>
          ) : null}

          <SectionTitle title="Doctors" right={<Text style={type.caption}>{doctors.length}</Text>} />
          {doctors.length === 0 ? (
            <EmptyState icon="people-outline" title="No doctors yet" message="Doctors at this clinic will show up here." />
          ) : (
            <View style={styles.list}>
              {doctors.map((d) => (
                <DoctorCard
                  key={d.id}
                  doctor={d}
                  clinicId={clinic.id}
                  hideClinic
                  onPress={() => router.push({ pathname: '/doctors/[id]', params: { id: d.id, clinicId: clinic.id } })}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  scroll: { paddingBottom: space.xxl * 2 },
  hero: { backgroundColor: colors.primaryTint, overflow: 'hidden' },
  heroFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: space.xl },
  backFloat: { position: 'absolute', left: space.lg },
  sheet: { marginTop: -24, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.canvas, padding: space.lg, paddingTop: space.xl, gap: space.md },
  name: { ...type.title, fontSize: 26 },
  metaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  call: { alignSelf: 'flex-start' },
  list: { gap: space.md },
});
