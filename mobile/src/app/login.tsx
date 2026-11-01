import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { GoogleButton } from '@/components/GoogleButton';
import { Button, Card, Field, LinkText, Notice, Screen, Segmented, Title } from '@/components/ui';
import { homeFor, type Role, useAuth } from '@/context/AuthContext';
import { parseRole, ROLE_LABEL, SIGNUP_ROLES } from '@/lib/roles';

export default function Login() {
  // `next`: where to return after a patient signs in (e.g. the booking they started)
  const params = useLocalSearchParams<{ role?: string; email?: string; notice?: string; next?: string }>();
  const [role, setRole] = useState<Role>(parseRole(params.role));
  const [email, setEmail] = useState(params.email ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { login, logout } = useAuth();

  const submit = async () => {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const user = await login({ email: email.trim(), password, role });
      if (user.role !== role) {
        logout();
        setError(`This isn’t a ${ROLE_LABEL[role].toLowerCase()} account.`);
        return;
      }
      if (user.role === 'PATIENT' && params.next?.startsWith('/')) {
        // Sign-in screen is swapped for the booking screen, so Back still returns to the doctor
        router.replace(params.next as never);
        return;
      }
      router.replace(homeFor(user));
    } catch (err: any) {
      if (err?.requiresVerification) {
        router.push({
          pathname: '/verify',
          params: { email: err.email || email.trim(), role, cooldown: String(err.cooldownSeconds ?? '') },
        });
        return;
      }
      setError(err?.message || 'Couldn’t sign in. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const isPatientOrDoctor = role === 'PATIENT' || role === 'DOCTOR';

  return (
    <Screen back="/welcome">
      <Title subtitle={isPatientOrDoctor ? undefined : ROLE_LABEL[role]}>Sign in</Title>
      {isPatientOrDoctor ? (
        <Segmented
          options={[
            { value: 'PATIENT', label: 'Patient' },
            { value: 'DOCTOR', label: 'Doctor' },
          ]}
          value={role}
          onChange={(r) => {
            setRole(r);
            setError(null);
          }}
        />
      ) : null}
      <Notice tone="success" message={params.notice} />
      <Card>
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          placeholder="you@example.com"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secure
          autoComplete="current-password"
          textContentType="password"
          onSubmitEditing={submit}
          returnKeyType="go"
        />
        <Notice tone="error" message={error} />
        <Button label="Sign in" onPress={submit} loading={submitting} />
        <GoogleButton role={role} next={params.next} onError={setError} />
        <LinkText
          label="Forgot password?"
          onPress={() => router.push({ pathname: '/forgot-password', params: { role, email: email.trim() } })}
        />
      </Card>
      {SIGNUP_ROLES.includes(role) ? (
        <LinkText label="Create account" onPress={() => router.push(`/signup?role=${role}`)} />
      ) : null}
    </Screen>
  );
}
