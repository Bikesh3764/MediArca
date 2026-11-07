import { useEffect, useState } from 'react';
import { Text } from '@/components/AppText';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '@mediarca/shared/api';
import { OtpField } from '@/components/OtpField';
import { Button, Card, LinkText, Notice, Screen, Title } from '@/components/ui';
import { homeFor, useAuth } from '@/context/AuthContext';
import { parseRole } from '@/lib/roles';
import { type } from '@/theme';

export default function Verify() {
  const params = useLocalSearchParams<{ email: string; role?: string; cooldown?: string; next?: string }>();
  const email = String(params.email || '');
  const role = parseRole(params.role);
  // `next`: the booking a new patient started before signing up
  const next = params.next?.startsWith('/') ? params.next : undefined;
  const { verifyOtp } = useAuth();

  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [alreadyVerified, setAlreadyVerified] = useState(false);
  const [countdown, setCountdown] = useState(() => Number(params.cooldown) || 60);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const isAlready = (err: any) => err?.isAlreadyVerified || String(err?.message || '').toLowerCase().includes('already verified');

  const submit = async () => {
    if (otp.length !== 6) {
      setError('Enter the 6-digit code.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const user = await verifyOtp(email, otp, role);
      router.replace(user.role === 'PATIENT' && next ? (next as never) : homeFor(user));
    } catch (err: any) {
      if (isAlready(err)) setAlreadyVerified(true);
      else setError(err?.message || 'Wrong code. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    setError(null);
    setInfo(null);
    try {
      await api.resendEmailOtp(email, role);
      setInfo('New code sent.');
      setCountdown(60);
    } catch (err: any) {
      if (isAlready(err)) setAlreadyVerified(true);
      else if (err?.cooldownSeconds) setCountdown(Number(err.cooldownSeconds));
      else setError(err?.message || 'Couldn’t send a new code.');
    }
  };

  if (alreadyVerified) {
    return (
      <Screen back="/welcome">
        <Title subtitle={email}>Email already verified</Title>
        <Button label="Sign in" onPress={() => router.replace({ pathname: '/login', params: { role, email, ...(next ? { next } : {}) } })} />
      </Screen>
    );
  }

  return (
    <Screen back="/welcome">
      <Title subtitle={`We sent a 6-digit code to ${email}. Not there? Check spam.`}>Verify email</Title>
      <Notice tone="error" message={error} />
      <Notice tone="success" message={info} />
      <Card>
        <OtpField value={otp} onChange={setOtp} />
        <Button label="Verify" onPress={submit} loading={submitting} disabled={otp.length !== 6} />
        {countdown > 0 ? (
          <Text style={[type.caption, { textAlign: 'center' }]}>Resend in {countdown}s</Text>
        ) : (
          <LinkText label="Resend code" onPress={resend} />
        )}
      </Card>
      <LinkText
        label="Wrong email? Change it"
        onPress={() =>
          router.canGoBack() ? router.back() : router.replace({ pathname: '/signup', params: { role, ...(next ? { next } : {}) } })
        }
      />
    </Screen>
  );
}
