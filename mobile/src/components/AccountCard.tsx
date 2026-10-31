import { Text } from 'react-native';
import { router } from 'expo-router';
import { formatDisplayPhone } from '@mediarca/shared/utils/phoneUtils';
import { Button, Card } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { ROLE_LABEL } from '@/lib/roles';
import { type } from '@/theme';

export function AccountCard() {
  const { user, logout } = useAuth();
  if (!user) return null;
  return (
    <Card>
      <Text style={type.heading}>{user.fullName}</Text>
      <Text style={type.caption}>{ROLE_LABEL[user.role]}</Text>
      <Text style={type.body}>{user.email}</Text>
      {user.phone ? <Text style={type.body}>{formatDisplayPhone(user.phone)}</Text> : null}
      <Button
        label="Sign out"
        variant="secondary"
        onPress={() => {
          logout();
          router.replace('/welcome');
        }}
      />
    </Card>
  );
}
