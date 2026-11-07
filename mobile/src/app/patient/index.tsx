import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Discover } from '@/components/Discover';
import { IconButton } from '@/components/kit';
import { NotificationBell } from '@/components/NotificationBell';
import { TodayVisit } from '@/components/TodayVisit';
import { useAuth } from '@/context/AuthContext';
import { colors, space, type } from '@/theme';

export default function PatientHome() {
  const { user } = useAuth();
  const firstName = (user?.fullName || '').trim().split(/\s+/)[0];
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Discover
        header={(section) => (
          <>
          <View style={styles.titleRow}>
            <View style={styles.titleBlock}>
              {firstName ? <Text style={type.caption}>Hi, {firstName}</Text> : null}
              <Text style={type.largeTitle}>{section === 'clinics' ? 'Find a clinic' : 'Find a doctor'}</Text>
            </View>
            <View style={styles.actions}>
              <NotificationBell />
              <IconButton icon="qr-code-outline" label="Scan to check in" onPress={() => router.push('/scan')} />
            </View>
          </View>
          <TodayVisit />
          </>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: space.sm },
  titleBlock: { gap: 2 },
  actions: { flexDirection: 'row', gap: space.sm },
});
