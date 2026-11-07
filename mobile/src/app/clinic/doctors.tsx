// Doctors at the clinic: join requests to accept, invites sent, the doctor list, and Invite.
// Same calls as frontend/src/pages/Clinic/dashboard/DoctorsSection.tsx + InviteDoctorModal.tsx.
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Linking, Pressable, RefreshControl, Share, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import { type ClinicDoctorStat, type Doctor, api, formatDoctorDegrees } from '@mediarca/shared/api';
import { toTelUri } from '@mediarca/shared/utils/phoneUtils';
import { ActionMenu, type MenuAction } from '@/components/ActionMenu';
import { Avatar, CabinBadge, Chip, EmptyState, IconButton, kitStyles, PlaceholderCard, SearchBar, SectionTitle, Sheet } from '@/components/kit';
import { Button, Card, Field, Notice, Screen, Title } from '@/components/ui';
import { useClinic } from '@/context/ClinicContext';
import { doctorName } from '@/lib/booking';
import { doctorBookingUrl } from '@/lib/site';
import { confirmAction } from '@/lib/confirm';
import { success } from '@/lib/haptics';
import { colors, radius, shadow, space, type } from '@/theme';

const rupees = (n?: number | null) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;

export default function ClinicDoctors() {
  const { data, failed, reload } = useClinic();
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [inviting, setInviting] = useState(false);
  const [menu, setMenu] = useState<{ title: string; actions: MenuAction[] } | null>(null);

  const onRefresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  const run = async (key: string, job: () => Promise<any>, done: string) => {
    setBusy(key);
    setMessage(null);
    try {
      const res = await job();
      success();
      setMessage({ tone: 'success', text: res?.message || done });
      await reload();
    } catch (err: any) {
      setMessage({ tone: 'error', text: err?.message || 'Couldn’t save. Try again.' });
    } finally {
      setBusy(null);
    }
  };

  const respond = (doc: ClinicDoctorStat, action: 'ACCEPT' | 'REJECT') =>
    run(`${action}-${doc.affiliationId}`, () => api.respondToDoctorAffiliation(doc.affiliationId, action), action === 'ACCEPT' ? 'Doctor added.' : 'Request declined.');

  const cancelInvite = async (doc: ClinicDoctorStat) => {
    const ok = await confirmAction({ title: 'Cancel invite?', message: `Cancel the invite to ${doctorName(doc.fullName)}?`, confirmLabel: 'Cancel invite' });
    if (ok) run(`cancel-${doc.doctorId}`, () => api.removeDoctorFromClinic(doc.doctorId), 'Invite cancelled.');
  };

  const remove = async (doc: ClinicDoctorStat) => {
    const name = doctorName(doc.fullName);
    const ok = await confirmAction({ title: 'Remove doctor?', message: `Remove ${name} from your clinic? Past records stay.`, confirmLabel: 'Remove' });
    if (ok) run(`remove-${doc.doctorId}`, () => api.removeDoctorFromClinic(doc.doctorId), `${name} removed.`);
  };

  const openMenu = (doc: ClinicDoctorStat) => {
    const actions: MenuAction[] = [];
    actions.push({ label: 'View booking page', onPress: () => router.push({ pathname: '/doctors/[id]', params: { id: doc.doctorId } }) });
    actions.push({
      label: 'Share booking link',
      onPress: () => {
        Share.share({ message: `Book a visit with ${doctorName(doc.fullName)} on MediArca: ${doctorBookingUrl(doc.doctorId)}` }).catch(() => {});
      },
    });
    if (doc.phone) actions.push({ label: 'Call', onPress: () => Linking.openURL(toTelUri(doc.phone!)) });
    actions.push({ label: 'Remove from clinic', destructive: true, onPress: () => remove(doc) });
    setMenu({ title: doctorName(doc.fullName), actions });
  };

  const requests = data?.incomingRequests || [];
  const invites = data?.outgoingRequests || [];
  const doctors = data?.doctors || [];

  return (
    <Screen edges={['top']} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.header}>
        <Title>Doctors</Title>
        <IconButton icon="person-add" label="Invite doctor" onPress={() => setInviting(true)} />
      </View>
      <Notice tone={message?.tone || 'info'} message={message?.text} stamp={message} />

      {!data ? (
        failed ? (
          <EmptyState icon="cloud-offline-outline" title="Couldn’t load" message="Check your connection." actionLabel="Try again" onAction={reload} />
        ) : (
          <PlaceholderCard height={140} />
        )
      ) : (
        <>
          {requests.length ? (
            <>
              <SectionTitle title="Requests" right={<Chip tone="primary" label={String(requests.length)} />} />
              {requests.map((doc) => (
                <View key={doc.affiliationId || doc.doctorId} style={styles.card}>
                  <DoctorHead doc={doc} />
                  <View style={styles.pair}>
                    <View style={styles.flex}>
                      <Button label="Accept" icon="checkmark" onPress={() => respond(doc, 'ACCEPT')} loading={busy === `ACCEPT-${doc.affiliationId}`} disabled={Boolean(busy)} />
                    </View>
                    <View style={styles.flex}>
                      <Button label="Decline" variant="secondary" destructive onPress={() => respond(doc, 'REJECT')} loading={busy === `REJECT-${doc.affiliationId}`} disabled={Boolean(busy)} />
                    </View>
                  </View>
                </View>
              ))}
            </>
          ) : null}

          {invites.length ? (
            <>
              <SectionTitle title="Invites sent" />
              <View style={styles.group}>
                {invites.map((doc, i) => (
                  <View key={doc.affiliationId || doc.doctorId} style={[styles.row, i > 0 && styles.divider]}>
                    <View style={styles.flex}>
                      <Text style={type.headline} numberOfLines={1}>
                        {doctorName(doc.fullName)}
                      </Text>
                      <Text style={type.footnote} numberOfLines={1}>
                        {doc.specialty}
                      </Text>
                    </View>
                    <Chip label="Waiting" />
                    <Pressable accessibilityRole="button" hitSlop={8} disabled={Boolean(busy)} onPress={() => cancelInvite(doc)}>
                      <Text style={styles.cancel}>Cancel</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {requests.length || invites.length ? <SectionTitle title="At your clinic" /> : null}
          {doctors.length === 0 ? (
            <EmptyState icon="medkit-outline" title="No doctors yet" message="Add doctors to start taking bookings." actionLabel="Invite doctor" onAction={() => setInviting(true)} />
          ) : (
            doctors.map((doc) => (
              <View key={doc.doctorId} style={styles.card}>
                <View style={styles.headRow}>
                  <DoctorHead doc={doc} live />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="More"
                    hitSlop={8}
                    onPress={() => openMenu(doc)}
                    style={({ pressed }) => [styles.round, pressed && kitStyles.pressed]}
                  >
                    <Ionicons name="ellipsis-horizontal" size={18} color={colors.ink} />
                  </Pressable>
                </View>
                <View style={styles.strip}>
                  <Figure label="Fee" value={rupees(doc.consultationFee)} />
                  <Figure label="Bookings" value={String(doc.bookingCount || 0)} />
                  <Figure label="Fees" value={rupees(doc.revenue)} />
                </View>
              </View>
            ))
          )}
        </>
      )}

      <InviteSheet visible={inviting} onClose={() => setInviting(false)} onDone={(text) => {
        setMessage({ tone: 'success', text });
        reload();
      }} />
      <ActionMenu title={menu?.title} actions={menu?.actions || null} onClose={() => setMenu(null)} />
    </Screen>
  );
}

/** `live`: also show In cabin / Stepped out / Away (doctors at the clinic). */
function DoctorHead({ doc, live = false }: { doc: ClinicDoctorStat; live?: boolean }) {
  const degrees = formatDoctorDegrees(doc.qualifications);
  const meta = [degrees, doc.experienceYears ? `${doc.experienceYears} yrs` : ''].filter(Boolean).join(' · ');
  return (
    <View style={styles.doctorHead}>
      <Avatar uri={doc.avatarUrl} name={doc.fullName} size={48} />
      <View style={styles.flex}>
        <Text style={type.headline} numberOfLines={1}>
          {doctorName(doc.fullName)}
        </Text>
        <Text style={[type.footnote, { color: colors.primary }]} numberOfLines={1}>
          {doc.specialty}
        </Text>
        {meta ? (
          <Text style={type.footnote} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
        {live && doc.cabinStatus ? (
          <View style={styles.live}>
            <CabinBadge status={doc.cabinStatus} expectedReturnTime={doc.expectedReturnTime} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.figure}>
      <Text style={styles.figureValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={type.footnote}>{label}</Text>
    </View>
  );
}

/** Invite by email, or pick from verified doctors on MediArca. */
function InviteSheet({ visible, onClose, onDone }: { visible: boolean; onClose: () => void; onDone: (message: string) => void }) {
  const { data } = useClinic();
  const [email, setEmail] = useState('');
  const [query, setQuery] = useState('');
  const [catalog, setCatalog] = useState<Doctor[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCatalog = useCallback(async () => {
    try {
      const docs = await api.getDoctors({ limit: 50 });
      setCatalog(docs.filter((d: any) => d.isVerified));
    } catch {
      setCatalog([]);
    }
  }, []);

  // Fresh form and doctor list each time it opens
  const [wasOpen, setWasOpen] = useState(false);
  if (visible !== wasOpen) {
    setWasOpen(visible);
    if (visible) {
      setEmail('');
      setQuery('');
      setError(null);
      setCatalog(null);
      queueMicrotask(loadCatalog);
    }
  }

  const invite = async (key: string, body: { doctorEmail?: string; doctorId?: string }) => {
    if (busy) return;
    setBusy(key);
    setError(null);
    try {
      const res = await api.addDoctorToClinic(body);
      success();
      onDone(res?.message || 'Doctor invited.');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Couldn’t invite. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (catalog || []).filter((d) => {
      if (!q) return true;
      return [d.user?.fullName, d.specialty, d.user?.email].some((v) => (v || '').toLowerCase().includes(q));
    });
  }, [catalog, query]);

  const stateOf = (id: string) => {
    if (data?.doctors.some((d) => d.doctorId === id)) return 'Added';
    if (data?.outgoingRequests?.some((d) => d.doctorId === id)) return 'Invited';
    if (data?.incomingRequests?.some((d) => d.doctorId === id)) return 'Accept';
    return 'Add';
  };

  return (
    <Sheet visible={visible} title="Invite doctor" doneLabel="Close" onClose={() => !busy && onClose()}>
      <View style={styles.stack}>
        <Card>
          <Field label="Doctor’s email" value={email} onChangeText={setEmail} placeholder="doctor@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" maxLength={120} />
          <Button
            label="Send invite"
            onPress={() => (email.trim() ? invite('email', { doctorEmail: email.trim() }) : setError('Enter the doctor’s email.'))}
            loading={busy === 'email'}
            disabled={Boolean(busy)}
          />
        </Card>
        <Notice tone="error" message={error} />

        <SectionTitle title="Or pick a doctor" />
        <SearchBar value={query} onChangeText={setQuery} placeholder="Name or specialty" />
        {catalog === null ? (
          <PlaceholderCard height={120} />
        ) : list.length === 0 ? (
          <Text style={[type.caption, styles.center]}>No doctors found.</Text>
        ) : (
          <View style={styles.group}>
            {list.map((d, i) => {
              const s = stateOf(d.id);
              const done = s === 'Added' || s === 'Invited';
              return (
                <View key={d.id} style={[styles.row, i > 0 && styles.divider]}>
                  <Avatar uri={d.user?.avatarUrl} name={d.user?.fullName} size={40} />
                  <View style={styles.flex}>
                    <Text style={type.headline} numberOfLines={1}>
                      {doctorName(d.user?.fullName)}
                    </Text>
                    <Text style={type.footnote} numberOfLines={1}>
                      {d.specialty}
                    </Text>
                  </View>
                  {done ? (
                    <Chip label={s} tone={s === 'Added' ? 'success' : 'neutral'} />
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      disabled={Boolean(busy)}
                      onPress={() => invite(d.id, { doctorEmail: d.user?.email || undefined, doctorId: d.id })}
                      style={({ pressed }) => [styles.add, pressed && kitStyles.pressed]}
                    >
                      <Text style={styles.addText}>{busy === d.id ? '…' : s}</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0, gap: 2 },
  stack: { gap: space.md },
  center: { textAlign: 'center', paddingVertical: space.lg },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  card: { backgroundColor: colors.card, borderRadius: radius.card, padding: space.lg, gap: space.md, ...shadow.card },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  doctorHead: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, minWidth: 0 },
  pair: { flexDirection: 'row', gap: space.sm },
  group: { backgroundColor: colors.card, borderRadius: radius.card, overflow: 'hidden', ...shadow.card },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  cancel: { fontSize: 15, color: colors.danger },
  round: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' },
  strip: { flexDirection: 'row', backgroundColor: colors.canvas, borderRadius: radius.tile, paddingVertical: space.md },
  figure: { flex: 1, alignItems: 'center', gap: 2 },
  live: { flexDirection: 'row', marginTop: 4 },
  figureValue: { fontSize: 16, fontWeight: '600', color: colors.ink },
  add: { height: 32, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  addText: { fontSize: 14, fontWeight: '600', color: colors.white },
});
