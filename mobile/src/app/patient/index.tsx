import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Discover } from '@/components/Discover';
import { IconButton } from '@/components/kit';
import { useAuth } from '@/context/AuthContext';
import { colors, space, type } from '@/theme';

export default function PatientHome() {
  const { user } = useAuth();
  const firstName = (user?.fullName || '').trim().split(/\s+/)[0];
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Discover
        header={
          <View style={styles.titleRow}>
            <View style={styles.titleBlock}>
              {firstName ? <Text style={type.caption}>Hi, {firstName}</Text> : null}
              <Text style={type.largeTitle}>Find a doctor</Text>
            </View>
            <IconButton icon="qr-code-outline" label="Scan to check in" onPress={() => router.push('/scan')} style={styles.scan} />
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: space.sm },
  titleBlock: { gap: 2 },
  scan: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, marginBottom: 2 },
});
