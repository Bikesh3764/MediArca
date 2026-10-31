// Receptionists sign in with a temporary password from their clinic and must set their own.
import { useState } from 'react';
import { Redirect, router } from 'expo-router';
import { api } from '@mediarca/shared/api';
import { Button, Card, Field, LinkText, Notice, Screen, Title } from '@/components/ui';
import { homeFor, useAuth } from '@/context/AuthContext';

export default function ChangePassword() {
  const { user, saveSession, logout } = useAuth();
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!user) return <Redirect href="/welcome" />;

  const submit = async () => {
    setError(null);
    if (!current) return setError('Enter the temporary password.');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('Passwords don’t match.');
    setSubmitting(true);
    try {
      const res = await api.changeReceptionistPassword({ currentPassword: current, newPassword: password });
      const updated = res?.user || res?.data || (await api.getMe());
      const next = { ...updated, mustChangePassword: false };
      saveSession(res?.token, next);
      router.replace(homeFor(next));
    } catch (err: any) {
      setError(err?.message || 'Couldn’t save password. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <Title subtitle="Replace the temporary password from your clinic.">Set password</Title>
      <Notice tone="error" message={error} />
      <Card>
        <Field label="Temporary password" value={current} onChangeText={setCurrent} secure autoComplete="current-password" />
        <Field label="New password" value={password} onChangeText={setPassword} secure autoComplete="new-password" placeholder="Min. 8 characters" />
        <Field label="Confirm password" value={confirm} onChangeText={setConfirm} secure autoComplete="new-password" />
        <Button label="Save" onPress={submit} loading={submitting} />
      </Card>
      <LinkText
        label="Sign out"
        onPress={() => {
          logout();
          router.replace('/welcome');
        }}
      />
    </Screen>
  );
}
