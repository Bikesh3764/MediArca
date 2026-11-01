// Doctor's clinics: requests from clinics, my clinics (leave one), requests sent, and Join a clinic.
// Same calls as frontend/src/pages/Doctor/dashboard/AffiliationsTab.tsx and state.tsx
// (getDoctorAffiliations, getPublicClinics, addDoctorClinic, respondToClinicAffiliation, removeDoctorClinic).
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import { MoreText } from '@/components/MoreText';
import { type ClinicProfile, type DoctorAffiliationClinic, type DoctorAffiliationsData, api } from '@mediarca/shared/api';
import { formatClinicAddress } from '@mediarca/shared/utils/address';
import { ActionMenu, type MenuAction } from '@/components/ActionMenu';
import { Chip, ClinicImage, EmptyState, IconButton, kitStyles, PlaceholderCard, SearchBar, SectionTitle, Sheet } from '@/components/kit';
import { Button, Notice, Screen, Title } from '@/components/ui';
import { confirmAction } from '@/lib/confirm';
import { success } from '@/lib/haptics';
import { colors, radius, shadow, space, type } from '@/theme';

const rupees = (n?: number | null) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
const place = (c: { address?: string | null; city?: string | null; state?: string | null }) => formatClinicAddress(c as any, { withState: false }) || c.city || '';

export default function DoctorClinics() {
  const [aff, setAff] = useState<DoctorAffiliationsData | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [joining, setJoining] = useState(false);
  const [menu, setMenu] = useState<{ title: string; actions: MenuAction[] } | null>(null);

  const load = useCallback(async () => {
    try {
      setAff(await api.getDoctorAffiliations());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const run = async (key: string, job: () => Promise<any>, done: string) => {
    setBusy(key);
    setMessage(null);
    try {
      const res = await job();
      success();
      setMessage({ tone: 'success', text: res?.message || done });
      await load();
    } catch (err: any) {
      setMessage({ tone: 'error', text: err?.message || 'Couldn’t save. Try again.' });
    } finally {
      setBusy(null);
    }
  };

  const respond = (c: DoctorAffiliationClinic, action: 'ACCEPT' | 'REJECT') =>
    run(`${action}-${c.affiliationId}`, () => api.respondToClinicAffiliation(c.affiliationId, action), action === 'ACCEPT' ? 'Clinic added.' : 'Request declined.');

  const leave = async (c: DoctorAffiliationClinic) => {
    const ok = await confirmAction({ title: 'Leave clinic?', message: `Leave ${c.clinicName}? Patients can’t book you there after this.`, confirmLabel: 'Leave' });
    if (ok) run(`leave-${c.clinicId}`, () => api.removeDoctorClinic(c.clinicId), `Left ${c.clinicName}.`);
  };

  const openMenu = (c: DoctorAffiliationClinic) =>
    setMenu({
      title: c.clinicName,
      actions: [
        { label: 'Shifts and leave', onPress: () => router.navigate('/doctor/shifts') },
        { label: 'Leave clinic', destructive: true, onPress: () => leave(c) },
      ],
    });

  const requests = aff?.incomingRequests || [];
  const sent = aff?.outgoingRequests || [];
  const clinics = aff?.clinics || [];

  return (
    <Screen edges={['top']} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.header}>
        <Title>Clinics</Title>
        <IconButton icon="add" label="Join a clinic" onPress={() => setJoining(true)} />
      </View>
      <Notice tone={message?.tone || 'info'} message={message?.text} stamp={message} />

      {!aff ? (
        failed ? (
          <EmptyState icon="cloud-offline-outline" title="Couldn’t load" message="Check your connection." actionLabel="Try again" onAction={load} />
        ) : (
          <PlaceholderCard height={140} />
        )
      ) : (
        <>
          {requests.length ? (
            <>
              <SectionTitle title="Requests" right={<Chip tone="primary" label={String(requests.length)} />} />
              {requests.map((c) => (
                <View key={c.affiliationId} style={styles.card}>
                  <ClinicHead c={c} />
                  <View style={styles.pair}>
                    <View style={styles.flex}>
                      <Button label="Accept" icon="checkmark" onPress={() => respond(c, 'ACCEPT')} loading={busy === `ACCEPT-${c.affiliationId}`} disabled={Boolean(busy)} />
                    </View>
                    <View style={styles.flex}>
                      <Button label="Decline" variant="secondary" destructive onPress={() => respond(c, 'REJECT')} loading={busy === `REJECT-${c.affiliationId}`} disabled={Boolean(busy)} />
                    </View>
                  </View>
                </View>
              ))}
            </>
          ) : null}

          {sent.length ? (
            <>
              <SectionTitle title="Waiting for approval" />
              <View style={styles.group}>
                {sent.map((c, i) => (
                  <View key={c.affiliationId} style={[styles.row, i > 0 && styles.divider]}>
                    <View style={styles.flex}>
                      <Text style={type.headline} numberOfLines={1}>
                        {c.clinicName}
                      </Text>
                      <MoreText style={type.footnote}>{place(c)}</MoreText>
                    </View>
                    <Chip label="Waiting" />
                  </View>
                ))}
              </View>
            </>
          ) : null}

          <SectionTitle title="My clinics" />
          {clinics.length === 0 ? (
            <EmptyState icon="business-outline" title="No clinics yet" message="Join a clinic to get bookings." actionLabel="Join a clinic" onAction={() => setJoining(true)} />
          ) : (
            clinics.map((c) => (
              <View key={c.clinicId} style={styles.card}>
                <View style={styles.headRow}>
                  <View style={styles.flex}>
                    <ClinicHead c={c} />
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`More for ${c.clinicName}`}
                    hitSlop={8}
                    onPress={() => openMenu(c)}
                    style={({ pressed }) => [styles.round, pressed && kitStyles.pressed]}
                  >
                    <Ionicons name="ellipsis-horizontal" size={18} color={colors.ink} />
                  </Pressable>
                </View>
                <View style={styles.strip}>
                  <Figure label="Fee" value={rupees(c.consultationFee)} />
                  <Figure label="Bookings" value={String(c.bookingCount || 0)} />
                  <Figure label="Revenue" value={rupees(c.revenue)} />
                </View>
              </View>
            ))
          )}
        </>
      )}

      <JoinSheet visible={joining} aff={aff} onClose={() => setJoining(false)} onJoined={(text) => {
        setMessage({ tone: 'success', text });
        load();
      }} />
      <ActionMenu title={menu?.title} actions={menu?.actions || null} onClose={() => setMenu(null)} />
    </Screen>
  );
}

function ClinicHead({ c }: { c: DoctorAffiliationClinic }) {
  return (
    <View style={styles.headRow}>
      <ClinicImage size={44} />
      <View style={styles.flex}>
        <Text style={type.headline} numberOfLines={1}>
          {c.clinicName}
        </Text>
        <MoreText style={type.footnote}>{place(c)}</MoreText>
      </View>
    </View>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.figure}>
      <Text style={styles.figureValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={type.footnote}>{label}</Text>
    </View>
  );
}

/** Search verified clinics and send a join request. */
function JoinSheet({ visible, aff, onClose, onJoined }: { visible: boolean; aff: DoctorAffiliationsData | null; onClose: () => void; onJoined: (message: string) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ClinicProfile[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [wasOpen, setWasOpen] = useState(false);
  if (visible !== wasOpen) {
    setWasOpen(visible);
    if (visible) {
      setQuery('');
      setResults(null);
      setError(null);
    }
  }

  // Search as you type (short pause first)
  useEffect(() => {
    if (!visible) return;
    let live = true;
    const t = setTimeout(() => {
      api
        .getPublicClinics({ search: query.trim() || undefined, limit: 50 })
        .then((list) => live && setResults(list))
        .catch(() => live && setResults([]));
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [query, visible]);

  const joined = new Set((aff?.clinics || []).map((c) => c.clinicId));
  const waiting = new Set((aff?.outgoingRequests || []).map((c) => c.clinicId));
  const invited = new Set((aff?.incomingRequests || []).map((c) => c.clinicId));

  const join = async (c: ClinicProfile) => {
    setBusy(c.id);
    setError(null);
    try {
      const res = await api.addDoctorClinic({ clinicId: c.id });
      success();
      onJoined(res?.message || 'Request sent to the clinic.');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Couldn’t join the clinic. Try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet visible={visible} title="Join a clinic" doneLabel="Close" onClose={() => !busy && onClose()}>
      <SearchBar value={query} onChangeText={setQuery} placeholder="Clinic name or city" />
      <Notice tone="error" message={error} />
      {!results ? (
        <PlaceholderCard height={120} />
      ) : results.length === 0 ? (
        <EmptyState icon="business-outline" title="No clinics found" message="Try another name or city." />
      ) : (
        <View style={styles.group}>
          {results.map((c, i) => {
            const state = joined.has(c.id) ? 'Joined' : waiting.has(c.id) ? 'Waiting' : invited.has(c.id) ? 'Invited' : null;
            return (
              <View key={c.id} style={[styles.row, i > 0 && styles.divider]}>
                <ClinicImage uri={c.avatarUrl} size={40} />
                <View style={styles.flex}>
                  <Text style={type.headline} numberOfLines={1}>
                    {c.clinicName}
                  </Text>
                  <MoreText style={type.footnote}>{place(c)}</MoreText>
                </View>
                {state ? (
                  <Chip label={state} tone={state === 'Joined' ? 'success' : 'neutral'} />
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Join ${c.clinicName}`}
                    disabled={Boolean(busy)}
                    onPress={() => join(c)}
                    style={({ pressed }) => [styles.joinButton, pressed && kitStyles.pressed, Boolean(busy) && { opacity: 0.5 }]}
                  >
                    <Text style={styles.joinText}>{busy === c.id ? '…' : 'Join'}</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      )}
      {invited.size ? <Text style={[type.footnote, styles.center]}>Invited: accept it on the Clinics screen.</Text> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0, gap: 2 },
  center: { textAlign: 'center' },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  card: { backgroundColor: colors.card, borderRadius: radius.card, padding: space.lg, gap: space.md, ...shadow.card },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  pair: { flexDirection: 'row', gap: space.sm },
  group: { backgroundColor: colors.card, borderRadius: radius.card, overflow: 'hidden', ...shadow.card },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  round: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' },
  strip: { flexDirection: 'row', backgroundColor: colors.canvas, borderRadius: radius.tile, paddingVertical: space.sm },
  figure: { flex: 1, alignItems: 'center', gap: 2 },
  figureValue: { fontSize: 17, fontWeight: '600', color: colors.ink },
  joinButton: { height: 32, minWidth: 64, paddingHorizontal: space.md, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  joinText: { color: colors.white, fontSize: 15, fontWeight: '600' },
});
