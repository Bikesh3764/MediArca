// "Continue with Google" for Patient, Doctor and Clinic (receptionists use their password).
// Hidden in Expo Go and the browser preview, where Google sign-in can't run.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import { homeFor, type Role, useAuth } from '@/context/AuthContext';
import { getGoogleIdToken, googleAvailable } from '@/lib/google';
import { ROLE_LABEL } from '@/lib/roles';
import { colors, radius, space } from '@/theme';

const GOOGLE_ROLES: Role[] = ['PATIENT', 'DOCTOR', 'CLINIC'];

export function GoogleButton({ role, next, onError }: { role: Role; next?: string; onError: (message: string | null) => void }) {
  const { loginWithGoogle, logout } = useAuth();
  const [busy, setBusy] = useState(false);

  if (!googleAvailable || !GOOGLE_ROLES.includes(role)) return null;

  const signIn = async () => {
    onError(null);
    setBusy(true);
    try {
      const idToken = await getGoogleIdToken();
      if (!idToken) return;
      const user = await loginWithGoogle(idToken, role);
      if (user.role !== role) {
        logout();
        onError(`This isn’t a ${ROLE_LABEL[role].toLowerCase()} account.`);
        return;
      }
      if (user.role === 'PATIENT' && next?.startsWith('/')) router.replace(next as never);
      else router.replace(homeFor(user));
    } catch (err: any) {
      onError(err?.message || 'Couldn’t sign in with Google. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <View style={styles.or}>
        <View style={styles.line} />
        <Text style={styles.orText}>or</Text>
        <View style={styles.line} />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ busy }}
        disabled={busy}
        onPress={signIn}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        {busy ? (
          <ActivityIndicator color={colors.ink} />
        ) : (
          <View style={styles.inner}>
            <Ionicons name="logo-google" size={18} color={colors.ink} />
            <Text style={styles.label}>Continue with Google</Text>
          </View>
        )}
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  or: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline },
  orText: { fontSize: 13, color: colors.muted },
  button: { height: 52, borderRadius: radius.pill, backgroundColor: colors.fill, alignItems: 'center', justifyContent: 'center' },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.85 },
  inner: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  label: { fontSize: 17, fontWeight: '600', color: colors.ink },
});
