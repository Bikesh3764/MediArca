// Password change, delete account and sign out, for every account type.
// Same rules as frontend/src/components/auth/ChangePasswordCard.tsx and DeleteAccountCard.tsx.
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '@mediarca/shared/api';
import { Sheet } from '@/components/kit';
import { Button, Card, Field, Notice } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { success } from '@/lib/haptics';
import { space, type } from '@/theme';

const WHAT_GOES: Record<string, string> = {
  PATIENT: 'Your profile and visit history are removed.',
  DOCTOR: 'Your profile, shifts and visit history are removed.',
  CLINIC: 'Your clinic, its front desk logins and doctor links are removed.',
  RECEPTIONIST: 'Your front desk login is removed.',
  ADMIN: 'Your admin login is removed.',
};

export function ChangePasswordCard() {
  const { changePassword } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setError(null);
    setDone(false);
    if (!current) return setError('Enter your current password.');
    if (next.length < 8) return setError('New password must be at least 8 characters.');
    if (next !== confirm) return setError('The new passwords don’t match.');
    setSaving(true);
    try {
      await changePassword(current, next);
      setCurrent('');
      setNext('');
      setConfirm('');
      setDone(true);
      success();
    } catch (err: any) {
      setError(err?.message || 'Could not change the password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <Text style={type.headline}>Password</Text>
      <Notice tone="error" message={error} />
      <Notice tone="success" message={done ? 'Password changed.' : null} />
      <Field label="Current password" value={current} onChangeText={setCurrent} secure autoComplete="current-password" maxLength={128} />
      <Field label="New password" value={next} onChangeText={setNext} secure autoComplete="new-password" placeholder="Min. 8 characters" maxLength={128} />
      <Field label="Confirm new password" value={confirm} onChangeText={setConfirm} secure autoComplete="new-password" maxLength={128} />
      <Button label="Change password" variant="secondary" onPress={submit} loading={saving} />
    </Card>
  );
}

export function SignOutAndDelete() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!user) return null;

  const signOut = () => {
    logout();
    router.replace('/welcome');
  };

  const finish = () => {
    setOpen(false);
    signOut();
  };

  const remove = async () => {
    if (busy) return;
    if (!password) return setError('Enter your password.');
    setBusy(true);
    setError(null);
    try {
      await api.deleteAccount(password);
      finish();
    } catch (err: any) {
      // A retry after a slow first try that already went through: the account is gone
      if (err?.status === 404) return finish();
      setError(err?.message || 'Could not delete the account. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.stack}>
      <Button label="Sign out" variant="secondary" onPress={signOut} />
      <Button label="Delete account" variant="plain" destructive onPress={() => setOpen(true)} />

      <Sheet
        visible={open}
        title="Delete account"
        doneLabel="Close"
        onClose={() => {
          if (busy) return;
          setOpen(false);
          setPassword('');
          setError(null);
        }}
      >
        <Card>
          <Text style={type.heading}>Delete account?</Text>
          <Text style={type.caption}>{WHAT_GOES[user.role] || WHAT_GOES.PATIENT} This can’t be undone.</Text>
          <Notice tone="error" message={error} />
          <Field label="Password" value={password} onChangeText={setPassword} secure autoComplete="current-password" maxLength={128} />
          <Button label="Delete account" onPress={remove} loading={busy} variant="secondary" destructive />
        </Card>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.sm, marginTop: space.sm },
});
