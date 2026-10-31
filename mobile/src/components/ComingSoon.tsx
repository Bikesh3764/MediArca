// Placeholder for screens built in later phases (docs/mobile-roadmap.md).
import { Text } from 'react-native';
import { Card } from '@/components/ui';
import { type } from '@/theme';

export function ComingSoon({ title }: { title: string }) {
  return (
    <Card>
      <Text style={type.heading}>{title}</Text>
      <Text style={type.caption}>Coming soon. Use the website for now.</Text>
    </Card>
  );
}
