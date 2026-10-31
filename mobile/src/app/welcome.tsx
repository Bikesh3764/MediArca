import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { IconName } from '@/components/kit';
import { Button } from '@/components/ui';
import { colors, radius, shadow, space, type } from '@/theme';

function QuickLink({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.quick, pressed && { opacity: 0.6 }]}>
      <View style={styles.quickIcon}>
        <Ionicons name={icon} size={22} color={colors.primary} />
      </View>
      <Text style={styles.quickText}>{label}</Text>
    </Pressable>
  );
}

export default function Welcome() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.hero}>
        <View style={styles.logoWrap}>
          <Image source={require('../../assets/icon.png')} style={styles.logo} accessibilityIgnoresInvertColors />
        </View>
        <Text style={styles.brand}>MediArca</Text>
        <Text style={styles.tagline}>Book a doctor. Skip the wait.</Text>

        <View style={styles.quickRow}>
          <QuickLink icon="search" label="Find doctors" onPress={() => router.push('/find')} />
          <QuickLink icon="ticket-outline" label="Track walk-in" onPress={() => router.push('/track')} />
        </View>
      </View>

      <View style={styles.actions}>
        <Button label="Sign in" onPress={() => router.push('/login?role=PATIENT')} />
        <Button label="Create account" variant="secondary" onPress={() => router.push('/signup?role=PATIENT')} />
        <View style={styles.staff}>
          <Text style={type.footnote}>For clinics</Text>
          <View style={styles.staffRow}>
            {(['DOCTOR', 'CLINIC', 'RECEPTIONIST'] as const).map((role) => (
              <Pressable key={role} accessibilityRole="link" hitSlop={8} onPress={() => router.push(`/login?role=${role}`)}>
                <Text style={styles.staffLink}>{role === 'DOCTOR' ? 'Doctor' : role === 'CLINIC' ? 'Clinic' : 'Receptionist'}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  logoWrap: { borderRadius: 28, ...shadow.raised },
  logo: { width: 96, height: 96, borderRadius: 24 },
  brand: { ...type.largeTitle, fontSize: 38, marginTop: space.xl },
  tagline: { fontSize: 19, color: colors.muted, marginTop: space.sm },
  quickRow: { flexDirection: 'row', gap: space.md, marginTop: space.xxl },
  quick: { width: 132, alignItems: 'center', gap: space.sm, paddingVertical: space.lg, borderRadius: radius.card, backgroundColor: colors.card, ...shadow.card },
  quickIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  quickText: { fontSize: 15, color: colors.ink },
  actions: { paddingHorizontal: space.xl, paddingBottom: space.lg, gap: space.md },
  staff: { alignItems: 'center', gap: 6, marginTop: space.md },
  staffRow: { flexDirection: 'row', gap: space.xl },
  staffLink: { fontSize: 15, color: colors.primary },
});
