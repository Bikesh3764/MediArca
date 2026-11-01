// Account tab for doctors and the front desk: who is signed in, password, sign out.
// Profile details are edited on the website for now.
import { StyleSheet, Text, View } from 'react-native';
import { formatDisplayPhone } from '@mediarca/shared/utils/phoneUtils';
import { ChangePasswordCard, SignOutAndDelete } from '@/components/AccountSettings';
import { Avatar, Chip } from '@/components/kit';
import { Screen, Title } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { doctorName } from '@/lib/booking';
import { ROLE_LABEL } from '@/lib/roles';
import { colors, radius, shadow, space, type } from '@/theme';

export function AccountScreen({ extra }: { extra?: string | null }) {
  const { user } = useAuth();
  if (!user) return null;
  const name = user.role === 'DOCTOR' ? doctorName(user.fullName) : user.fullName;
  return (
    <Screen edges={['top']}>
      <Title>Account</Title>
      <View style={styles.header}>
        <Avatar uri={user.avatarUrl} name={user.fullName} size={64} />
        <View style={styles.flex}>
          <Text style={type.heading} numberOfLines={1}>
            {name}
          </Text>
          <Text style={type.caption} numberOfLines={1}>
            {user.email}
          </Text>
          {user.phone ? <Text style={type.caption}>{formatDisplayPhone(user.phone)}</Text> : null}
          <View style={styles.chips}>
            <Chip tone="primary" label={ROLE_LABEL[user.role]} />
            {extra ? <Chip label={extra} /> : null}
          </View>
        </View>
      </View>
      <ChangePasswordCard />
      <SignOutAndDelete />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0, gap: 2 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.lg, backgroundColor: colors.card, borderRadius: radius.card, padding: space.lg, ...shadow.card },
  chips: { flexDirection: 'row', gap: space.sm, marginTop: space.sm, flexWrap: 'wrap' },
});
