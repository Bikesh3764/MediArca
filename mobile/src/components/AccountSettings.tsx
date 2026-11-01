// Settings list, password change, sign out and delete account, for every account type.
// Same rules as frontend/src/components/auth/ChangePasswordCard.tsx and DeleteAccountCard.tsx.
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import { api } from '@mediarca/shared/api';
import { ListGroup, ListRow, Sheet } from '@/components/kit';
import { Button, Card, Field, Notice } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { success } from '@/lib/haptics';
import { colors, space, type } from '@/theme';

const WHAT_GOES: Record<string, string> = {
  PATIENT: 'Your profile and visit history are removed.',
  DOCTOR: 'Your profile, shifts and visit history are removed.',
  CLINIC: 'Your clinic, its front desk logins and doctor links are removed.',
  RECEPTIONIST: 'Your front desk login is removed.',
  ADMIN: 'Your admin login is removed.',
};

/** Current / new / confirm password form (shown inside the Change password sheet). */
function ChangePasswordForm() {
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
      <Notice tone="error" message={error} />
      <Notice tone="success" message={done ? 'Password changed.' : null} />
      <Field label="Current password" value={current} onChangeText={setCurrent} secure autoComplete="current-password" maxLength={128} />
      <Field label="New password" value={next} onChangeText={setNext} secure autoComplete="new-password" placeholder="Min. 8 characters" maxLength={128} />
      <Field label="Confirm new password" value={confirm} onChangeText={setConfirm} secure autoComplete="new-password" maxLength={128} />
      <Button label="Change password" onPress={submit} loading={saving} />
    </Card>
  );
}

/**
 * Bottom of every Account page: a settings list (`rows` from the page, then Change password),
 * Sign out, and a small Delete account link.
 */
export function AccountActions({ rows = [] }: { rows?: React.ReactElement[] }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
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
      <ListGroup>
        {rows}
        <ListRow icon="key" tint={colors.tabInactive} label="Change password" onPress={() => setPasswordOpen(true)} />
      </ListGroup>
      <ListGroup>
        <ListRow icon="log-out-outline" destructive label="Sign out" onPress={signOut} />
      </ListGroup>
      <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setOpen(true)} style={styles.deleteLink}>
        <Text style={styles.deleteText}>Delete account</Text>
      </Pressable>

      <Sheet visible={passwordOpen} title="Change password" doneLabel="Close" onClose={() => setPasswordOpen(false)}>
        <ChangePasswordForm />
      </Sheet>

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
  stack: { gap: space.lg, marginTop: space.sm },
  deleteLink: { alignSelf: 'center', paddingVertical: space.sm },
  deleteText: { fontSize: 15, color: colors.danger },
});
