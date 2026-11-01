// Front desk staff: add a receptionist (and hand over their login), choose their doctors, remove.
// Same calls and checks as frontend/src/pages/Clinic/dashboard/StaffSection.tsx, AddStaffModal.tsx,
// EditStaffModal.tsx and CredentialsModal.tsx.
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Linking, Pressable, RefreshControl, Share, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import { type ClinicReceptionistItem, api } from '@mediarca/shared/api';
import { formatDisplayPhone, formatIndianPhone, isValidIndianPhone, toTelUri } from '@mediarca/shared/utils/phoneUtils';
import { CheckList } from '@/components/CheckList';
import { Avatar, Chip, EmptyState, IconButton, InfoRow, kitStyles, PlaceholderCard, SectionTitle, Sheet } from '@/components/kit';
import { Button, Card, Field, Notice, Screen, Title } from '@/components/ui';
import { useClinic } from '@/context/ClinicContext';
import { doctorName } from '@/lib/booking';
import { confirmAction } from '@/lib/confirm';
import { success } from '@/lib/haptics';
import { receptionistLoginUrl } from '@/lib/site';
import { colors, radius, shadow, space, type } from '@/theme';

export default function ClinicStaff() {
  const { data, failed, reload } = useClinic();
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ClinicReceptionistItem | null>(null);

  const onRefresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  const remove = async (rec: ClinicReceptionistItem) => {
    const ok = await confirmAction({ title: 'Remove receptionist?', message: `Remove ${rec.fullName}? They won’t be able to sign in.`, confirmLabel: 'Remove' });
    if (!ok) return;
    setMessage(null);
    try {
      await api.removeClinicReceptionist(rec.id);
      success();
      setMessage({ tone: 'success', text: `${rec.fullName} removed.` });
      reload();
    } catch (err: any) {
      setMessage({ tone: 'error', text: err?.message || 'Couldn’t remove. Try again.' });
    }
  };

  const staff = data?.receptionists || [];

  return (
    <Screen edges={['top']} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.header}>
        <Title>Staff</Title>
        <IconButton icon="person-add" label="Add receptionist" onPress={() => setAdding(true)} />
      </View>
      <Notice tone={message?.tone || 'info'} message={message?.text} stamp={message} />

      {!data ? (
        failed ? (
          <EmptyState icon="cloud-offline-outline" title="Couldn’t load" message="Check your connection." actionLabel="Try again" onAction={reload} />
        ) : (
          <PlaceholderCard height={120} />
        )
      ) : staff.length === 0 ? (
        <EmptyState icon="people-outline" title="No receptionists yet" message="Add one to run the front desk." actionLabel="Add receptionist" onAction={() => setAdding(true)} />
      ) : (
        staff.map((rec) => (
          <View key={rec.id} style={styles.card}>
            <View style={styles.top}>
              <Avatar name={rec.fullName} size={44} />
              <View style={styles.flex}>
                <Text style={type.headline} numberOfLines={1}>
                  {rec.fullName}
                </Text>
                <Text style={type.footnote} numberOfLines={1}>
                  {rec.email}
                </Text>
                {rec.phone ? <Text style={type.footnote}>{formatDisplayPhone(rec.phone)}</Text> : null}
              </View>
              {rec.phone ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Call ${rec.fullName}`}
                  hitSlop={8}
                  onPress={() => Linking.openURL(toTelUri(rec.phone!))}
                  style={({ pressed }) => [styles.round, pressed && kitStyles.pressed]}
                >
                  <Ionicons name="call" size={16} color={colors.primary} />
                </Pressable>
              ) : null}
            </View>
            <View style={styles.chips}>
              {rec.doctors?.length ? rec.doctors.map((d) => <Chip key={d.id} tone="primary" label={doctorName(d.fullName)} />) : <Chip label="No doctors" />}
            </View>
            <View style={styles.links}>
              <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setEditing(rec)}>
                <Text style={styles.link}>Doctors</Text>
              </Pressable>
              <Pressable accessibilityRole="button" hitSlop={8} onPress={() => remove(rec)}>
                <Text style={[styles.link, { color: colors.danger }]}>Remove</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}

      <AddStaffSheet visible={adding} onClose={() => setAdding(false)} onAdded={reload} />
      <EditDoctorsSheet
        rec={editing}
        onClose={() => setEditing(null)}
        onSaved={(text) => {
          setMessage({ tone: 'success', text });
          reload();
        }}
      />
    </Screen>
  );
}

const useDoctorOptions = () => {
  const { data } = useClinic();
  return (data?.doctors || []).map((d) => ({ value: d.doctorId, label: doctorName(d.fullName), note: d.specialty }));
};

function AddStaffSheet({ visible, onClose, onAdded }: { visible: boolean; onClose: () => void; onAdded: () => void }) {
  const { data } = useClinic();
  const doctors = useDoctorOptions();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [doctorIds, setDoctorIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ name: string; email: string; password: string } | null>(null);

  const [wasOpen, setWasOpen] = useState(false);
  if (visible !== wasOpen) {
    setWasOpen(visible);
    if (visible) {
      setName('');
      setEmail('');
      setPassword('');
      setPhone('');
      setDoctorIds([]);
      setError(null);
      setCreated(null);
    }
  }

  const add = async () => {
    if (busy) return;
    if (!name.trim() || !email.trim() || !password.trim()) return setError('Enter name, email and password.');
    if (password.trim().length < 8) return setError('Password must be at least 8 characters.');
    if (phone.trim() && !isValidIndianPhone(phone.trim())) return setError('Enter a valid 10-digit mobile number.');
    setBusy(true);
    setError(null);
    try {
      await api.addClinicReceptionist({
        fullName: name.trim(),
        email: email.trim(),
        password: password.trim(),
        phone: phone.trim() ? formatIndianPhone(phone.trim()) : undefined,
        doctorIds,
      });
      success();
      setCreated({ name: name.trim(), email: email.trim(), password: password.trim() });
      onAdded();
    } catch (err: any) {
      setError(err?.message || 'Couldn’t add receptionist. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const shareLogin = () => {
    if (!created) return;
    Share.share({
      message: `MediArca receptionist login\nClinic: ${data?.clinic?.clinicName || 'Clinic'}\nName: ${created.name}\nEmail: ${created.email}\nPassword: ${created.password}\nSign in: MediArca app or ${receptionistLoginUrl}`,
    }).catch(() => {});
  };

  return (
    <Sheet visible={visible} title={created ? 'Login ready' : 'Add receptionist'} doneLabel={created ? 'Done' : 'Close'} onClose={() => !busy && onClose()}>
      {created ? (
        <View style={styles.stack}>
          <View style={styles.doneIcon}>
            <Ionicons name="checkmark" size={30} color={colors.white} />
          </View>
          <Text style={[type.caption, styles.centerText]}>Share this login. On first sign-in they get a code by email and set their own password.</Text>
          <View style={styles.group}>
            <InfoRow first label="Name" value={created.name} />
            <InfoRow label="Email" value={created.email} />
            <InfoRow label="Password" value={created.password} />
          </View>
          <Button label="Share login" icon="share-outline" onPress={shareLogin} />
          <Button label="Done" variant="plain" onPress={onClose} />
        </View>
      ) : (
        <View style={styles.stack}>
          <Card>
            <Field label="Full name" value={name} onChangeText={setName} autoComplete="name" maxLength={100} />
            <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="off" maxLength={120} />
            <Field label="Mobile" prefix="+91" value={phone} onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 10))} keyboardType="phone-pad" placeholder="Optional" />
            <Field label="Temporary password" value={password} onChangeText={setPassword} secure autoComplete="off" placeholder="At least 8 characters" maxLength={128} />
          </Card>
          {doctors.length ? (
            <>
              <SectionTitle title="Doctors" />
              <CheckList options={doctors} value={doctorIds} onChange={setDoctorIds} />
            </>
          ) : null}
          <Notice tone="error" message={error} />
          <Button label="Add receptionist" onPress={add} loading={busy} />
        </View>
      )}
    </Sheet>
  );
}

function EditDoctorsSheet({ rec, onClose, onSaved }: { rec: ClinicReceptionistItem | null; onClose: () => void; onSaved: (message: string) => void }) {
  const doctors = useDoctorOptions();
  const [ids, setIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [seen, setSeen] = useState<string | null>(null);
  if ((rec?.id || null) !== seen) {
    setSeen(rec?.id || null);
    if (rec) {
      setIds(rec.doctorIds || rec.doctors?.map((d) => d.id) || []);
      setError(null);
    }
  }

  const save = async () => {
    if (!rec || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.updateClinicReceptionistDoctors(rec.id, ids);
      success();
      onSaved(res?.message || 'Saved.');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Couldn’t save. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={Boolean(rec)} title={rec?.fullName || 'Doctors'} doneLabel="Close" onClose={() => !busy && onClose()}>
      <View style={styles.stack}>
        {doctors.length ? <CheckList options={doctors} value={ids} onChange={setIds} /> : <Text style={[type.caption, styles.centerText]}>Add doctors first.</Text>}
        <Notice tone="error" message={error} />
        <Button label="Save" onPress={save} loading={busy} disabled={!doctors.length} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0, gap: 2 },
  stack: { gap: space.md },
  centerText: { textAlign: 'center' },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  card: { backgroundColor: colors.card, borderRadius: radius.card, padding: space.lg, gap: space.md, ...shadow.card },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  round: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  links: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.sm },
  link: { fontSize: 15, color: colors.primary },
  group: { backgroundColor: colors.card, borderRadius: radius.tile, paddingHorizontal: space.lg },
  doneIcon: { alignSelf: 'center', width: 60, height: 60, borderRadius: 30, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: space.md },
});
