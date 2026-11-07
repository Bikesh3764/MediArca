import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { IconName } from '@/components/kit';
import { Button } from '@/components/ui';
import { FadeIn } from '@/lib/motion';
import { colors, radius, shadow, space, type } from '@/theme';

const STAFF: { role: string; label: string; icon: IconName }[] = [
  { role: 'DOCTOR', label: 'Doctor', icon: 'medkit-outline' },
  { role: 'CLINIC', label: 'Clinic', icon: 'business-outline' },
  { role: 'RECEPTIONIST', label: 'Receptionist', icon: 'people-outline' },
];

function QuickLink({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.quick, pressed && styles.pressed]}>
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

        <FadeIn delay={120} style={styles.quickRow}>
          <QuickLink icon="search" label="Find doctors" onPress={() => router.push('/find')} />
          <QuickLink icon="ticket-outline" label="Track walk-in" onPress={() => router.push('/track')} />
        </FadeIn>
      </View>

      <FadeIn delay={220} style={styles.actions}>
        <Button label="Sign in" onPress={() => router.push('/login?role=PATIENT')} />
        <Button label="Create account" variant="secondary" onPress={() => router.push('/signup?role=PATIENT')} />
        <View style={styles.staff}>
          <Text style={type.footnote}>For clinics</Text>
          <View style={styles.staffRow}>
            {STAFF.map((s) => (
              <Pressable
                key={s.role}
                accessibilityRole="button"
                onPress={() => router.push(`/login?role=${s.role}`)}
                style={({ pressed }) => [styles.staffChip, pressed && styles.pressed]}
              >
                <View style={styles.staffIcon}>
                  <Ionicons name={s.icon} size={20} color={colors.primary} />
                </View>
                <Text style={styles.staffLink} numberOfLines={1} adjustsFontSizeToFit>
                  {s.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </FadeIn>
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
  actions: { paddingHorizontal: space.xl, paddingBottom: space.xl + space.sm, gap: space.md },
  staff: { alignSelf: 'stretch', alignItems: 'center', gap: space.sm, marginTop: space.md },
  staffRow: { alignSelf: 'stretch', flexDirection: 'row', gap: space.sm },
  staffChip: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: space.md, borderRadius: radius.tile + 2, backgroundColor: colors.card, ...shadow.card },
  staffIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  staffLink: { fontSize: 14, color: colors.ink },
  pressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },
});
