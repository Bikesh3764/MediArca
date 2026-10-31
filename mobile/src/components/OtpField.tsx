// 6-digit email code. One hidden input drives six boxes so paste and SMS-style autofill work.
import { type ComponentRef, useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius } from '@/theme';

export function OtpField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const digits = value.padEnd(6, ' ').slice(0, 6).split('');

  return (
    <Pressable onPress={() => input.current?.focus()} accessibilityLabel="6-digit code">
      <View style={styles.row}>
        {digits.map((d, i) => (
          <View key={i} style={[styles.box, i === Math.min(value.length, 5) && styles.boxActive]}>
            <Text style={styles.digit}>{d.trim()}</Text>
          </View>
        ))}
      </View>
      <TextInput
        ref={input}
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={6}
        autoFocus
        style={styles.hidden}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  box: { flex: 1, height: 52, borderRadius: radius.field, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  boxActive: { borderColor: colors.primary },
  digit: { fontSize: 22, fontWeight: '600', color: colors.ink },
  hidden: { position: 'absolute', opacity: 0, height: 1, width: 1 },
});
