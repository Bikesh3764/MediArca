// Patient Home: today's token at the top (like a boarding pass in Wallet). Tap opens the full pass.
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import { type Appointment, api, getLocalDateString } from '@mediarca/shared/api';
import { FadeIn } from '@/lib/motion';
import { doctorName } from '@/lib/booking';
import { keepIfSame, usePolling } from '@/lib/usePolling';
import { colors, radius, shadow, space } from '@/theme';
import { passFromAppointment, queueLine } from '@/components/QueuePass';

const SHOWN = new Set(['PENDING_APPROVAL', 'WAITING', 'IN_CONSULTATION']);


export function TodayVisit() {
  const [visits, setVisits] = useState<Appointment[] | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.getPatientAppointments({ status: 'active' });
      setVisits(keepIfSame<Appointment[] | null>(Array.isArray(data) ? data : []));
    } catch {
      // Home still works without it
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );
  usePolling(load, 20000, true);

  const today = getLocalDateString();
  const visit = (visits || []).filter((a) => a.appointmentDate === today && SHOWN.has(a.status)).sort((a, b) => (a.queueNumber || 99) - (b.queueNumber || 99))[0];
  if (!visit) return null;
  const pass = passFromAppointment(visit);

  return (
    <FadeIn>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Today's token ${pass.token}. Open queue pass`}
        onPress={() => router.push(`/visit/${visit.id}`)}
        style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: 0.98 }], opacity: 0.95 }]}
      >
        <View style={styles.flex}>
          <Text style={styles.label}>Today</Text>
          <Text style={styles.doctor} numberOfLines={1}>
            {doctorName(pass.doctor.name)}
          </Text>
          <Text style={styles.line} numberOfLines={1}>
            {queueLine(visit)}
          </Text>
        </View>
        <View style={styles.tokenBox}>
          <Text style={styles.tokenLabel}>{pass.estimated ? 'Est. token' : 'Token'}</Text>
          <Text style={styles.token}>#{pass.token}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.8)" />
      </Pressable>
    </FadeIn>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.primary, borderRadius: radius.card, padding: space.lg, ...shadow.raised },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  label: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.75)' },
  doctor: { fontSize: 17, fontWeight: '600', color: colors.white },
  line: { fontSize: 14, color: 'rgba(255,255,255,0.9)' },
  tokenBox: { alignItems: 'flex-end' },
  tokenLabel: { fontSize: 11, color: 'rgba(255,255,255,0.75)' },
  token: { fontSize: 34, lineHeight: 38, fontWeight: '600', color: colors.white, letterSpacing: -1 },
});
