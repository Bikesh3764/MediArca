import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Text } from '@/components/AppText';
import { GoogleButton } from '@/components/GoogleButton';
import { Button, Card, Field, LinkText, Notice, Screen, Segmented, Title } from '@/components/ui';
import { homeFor, type Role, useAuth } from '@/context/AuthContext';
import { parseRole, ROLE_LABEL, SIGNUP_ROLES } from '@/lib/roles';
import { space, type } from '@/theme';

// Same demo accounts as the website's sign-in pages
const DEMO: { role: Role; label: string; email: string; password: string }[] = [
  { role: 'PATIENT', label: 'Demo Patient', email: 'john.doe@gmail.com', password: 'patient123' },
  { role: 'DOCTOR', label: 'Demo Doctor', email: 'dr.sarah@mediarca.com', password: 'doctor123' },
  { role: 'CLINIC', label: 'Try demo clinic', email: 'clinic@mediarca.com', password: 'clinic123' },
  { role: 'RECEPTIONIST', label: 'Try demo desk', email: 'receptionist@mediarca.com', password: 'receptionist123' },
];

export default function Login() {
  // `next`: where to return after a patient signs in (e.g. the booking they started)
  const params = useLocalSearchParams<{ role?: string; email?: string; notice?: string; next?: string }>();
  const [role, setRole] = useState<Role>(parseRole(params.role));
  const [email, setEmail] = useState(params.email ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { login, logout } = useAuth();

  const submit = () => {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    signIn(email.trim(), password, role);
  };

  const signIn = async (email: string, password: string, role: Role) => {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const user = await login({ email, password, role });
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
          params: { email: err.email || email, role, cooldown: String(err.cooldownSeconds ?? '') },
        });
        return;
      }
      setError(err?.message || 'Couldn’t sign in. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const isPatientOrDoctor = role === 'PATIENT' || role === 'DOCTOR';
  const demos = DEMO.filter((d) => (isPatientOrDoctor ? d.role === 'PATIENT' || d.role === 'DOCTOR' : d.role === role));

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
      {demos.length ? (
        <View style={styles.demo}>
          <Text style={type.footnote}>Try a demo</Text>
          <View style={styles.demoRow}>
            {demos.map((d) => (
              <View key={d.role} style={styles.flex}>
                <Button
                  label={d.label}
                  variant="secondary"
                  disabled={submitting}
                  onPress={() => {
                    setRole(d.role);
                    setEmail(d.email);
                    setPassword(d.password);
                    signIn(d.email, d.password, d.role);
                  }}
                />
              </View>
            ))}
          </View>
        </View>
      ) : null}
      {SIGNUP_ROLES.includes(role) ? (
        <LinkText label="Create account" onPress={() => router.push(`/signup?role=${role}`)} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  demo: { gap: space.sm },
  demoRow: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
});
