import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '@mediarca/shared/api';
import { OtpField } from '@/components/OtpField';
import { Button, Card, Field, Notice, Screen, Title } from '@/components/ui';
import { parseRole, ROLE_LABEL } from '@/lib/roles';

export default function ForgotPassword() {
  const params = useLocalSearchParams<{ role?: string; email?: string }>();
  const role = parseRole(params.role);
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState(params.email ?? '');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const sendCode = async () => {
    if (!email.trim()) {
      setError('Enter your email.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await api.requestPasswordReset(email.trim(), role);
      setStep('reset');
    } catch (err: any) {
      setError(err?.message || 'Couldn’t send the code.');
    } finally {
      setSubmitting(false);
    }
  };

  const reset = async () => {
    setError(null);
    if (otp.length !== 6) return setError('Enter the 6-digit code.');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('The passwords don’t match.');
    setSubmitting(true);
    try {
      await api.resetPassword({ email: email.trim(), role, otp, newPassword: password });
      router.replace({ pathname: '/login', params: { role, email: email.trim(), notice: 'Password changed. Sign in.' } });
    } catch (err: any) {
      setError(err?.message || 'Couldn’t reset the password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen back="/login">
      <Title subtitle={ROLE_LABEL[role]}>Reset password</Title>
      <Notice tone="error" message={error} />
      {step === 'email' ? (
        <Card>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            placeholder="you@example.com"
          />
          <Button label="Send code" onPress={sendCode} loading={submitting} />
        </Card>
      ) : (
        <>
          <Notice tone="info" message={`Code sent to ${email.trim()}`} />
          <Card>
            <OtpField value={otp} onChange={setOtp} />
            <Field label="New password" value={password} onChangeText={setPassword} secure autoComplete="new-password" placeholder="Min. 8 characters" />
            <Field label="Confirm password" value={confirm} onChangeText={setConfirm} secure autoComplete="new-password" />
            <Button label="Save password" onPress={reset} loading={submitting} />
          </Card>
        </>
      )}
    </Screen>
  );
}
