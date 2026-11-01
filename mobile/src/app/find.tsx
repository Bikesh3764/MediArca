// Browse doctors and clinics without signing in (booking asks for sign-in).
import { StyleSheet } from 'react-native';
import { Text } from '@/components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Discover } from '@/components/Discover';
import { NavBar } from '@/components/kit';
import { colors, type } from '@/theme';

export default function Find() {
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <NavBar fallback="/welcome" />
      <Discover header={<Text style={type.largeTitle}>Find a doctor</Text>} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
});
