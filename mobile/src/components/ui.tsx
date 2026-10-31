// Basic building blocks in the MediArca look (DESIGN.md): pill buttons, 44pt fields, white cards.
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  type RefreshControlProps,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
} from 'react-native';
import { type Edge, SafeAreaView } from 'react-native-safe-area-context';
import { NavBar } from '@/components/kit';
import { colors, radius, shadow, space, type } from '@/theme';

export function Screen({
  children,
  scroll = true,
  edges = ['top', 'bottom'],
  refreshControl,
  back,
}: {
  children: React.ReactNode;
  /** Show a back chevron; the value is where to go when there is no history. */
  back?: string;
  scroll?: boolean;
  /** Tab screens pass ['top']: the tab bar already covers the bottom. */
  edges?: Edge[];
  refreshControl?: React.ReactElement<RefreshControlProps>;
}) {
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      {back ? <NavBar fallback={back} /> : null}
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView contentContainerStyle={styles.scrollBody} keyboardShouldPersistTaps="handled" refreshControl={refreshControl}>
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.flex, styles.scrollBody]}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Title({ children, subtitle }: { children: React.ReactNode; subtitle?: string }) {
  return (
    <View style={styles.titleBlock}>
      <Text style={type.largeTitle}>{children}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'plain';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  /** Red text for destructive actions (Cancel appointment, Delete account). */
  destructive?: boolean;
};

export function Button({ label, onPress, variant = 'primary', loading, disabled, icon, destructive }: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && { backgroundColor: pressed ? colors.primaryPressed : colors.primary },
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'plain' && styles.buttonPlain,
        pressed && { transform: [{ scale: 0.98 }] },
        isDisabled && { opacity: 0.6 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.white : colors.primary} />
      ) : (
        <View style={styles.buttonInner}>
          {icon ? <Ionicons name={icon} size={18} color={variant === 'primary' ? colors.white : destructive ? colors.danger : colors.primary} /> : null}
          <Text
            style={[styles.buttonText, variant !== 'primary' && { color: destructive ? colors.danger : colors.primary }]}
            numberOfLines={1}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export function LinkText({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} hitSlop={8} style={styles.link}>
      <Text style={styles.linkText}>{label}</Text>
    </Pressable>
  );
}

type FieldProps = TextInputProps & { label: string; secure?: boolean; prefix?: string };

export function Field({ label, secure, prefix, style, ...input }: FieldProps) {
  const [hidden, setHidden] = useState(true);
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.fieldBox, focused && styles.fieldFocused]}>
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <TextInput
          placeholderTextColor={colors.placeholder}
          secureTextEntry={secure && hidden}
          autoCapitalize={secure ? 'none' : input.autoCapitalize}
          accessibilityLabel={label}
          style={[styles.input, style]}
          {...input}
          onFocus={(e) => {
            setFocused(true);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            input.onBlur?.(e);
          }}
        />
        {secure ? (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={8} accessibilityRole="button">
            <Text style={styles.showText}>{hidden ? 'Show' : 'Hide'}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function Notice({ tone, message }: { tone: 'error' | 'info' | 'success'; message?: string | null }) {
  if (!message) return null;
  const tones = {
    error: { backgroundColor: colors.dangerSoft, color: colors.danger, icon: 'alert-circle' as const },
    info: { backgroundColor: colors.primarySoft, color: colors.primary, icon: 'information-circle' as const },
    success: { backgroundColor: colors.successSoft, color: colors.success, icon: 'checkmark-circle' as const },
  }[tone];
  return (
    <View accessibilityRole="alert" style={[styles.notice, { backgroundColor: tones.backgroundColor }]}>
      <Ionicons name={tones.icon} size={18} color={tones.color} />
      <Text style={[styles.noticeText, { color: tone === 'info' ? colors.ink : tones.color }]}>{message}</Text>
    </View>
  );
}

/** Pill track for choosing one option (e.g. Patient / Doctor). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segTrack} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={[styles.segItem, active && styles.segActive]}
          >
            <Text style={[styles.segText, active && styles.segTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Tap to open a searchable list (states, cities, specialties). */
export function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder = 'Choose',
  disabled,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
  }, [options, query]);

  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[styles.fieldBox, disabled && { opacity: 0.5 }]}
      >
        <Text style={[styles.input, styles.selectValue, !value && { color: colors.placeholder }]}>{value || placeholder}</Text>
        <Ionicons name="chevron-down" size={16} color={colors.muted} style={styles.chevron} />
      </Pressable>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.screen}>
          <View style={styles.sheetHeader}>
            <Text style={type.heading}>{label}</Text>
            <Pressable accessibilityRole="button" hitSlop={10} onPress={() => setOpen(false)}>
              <Text style={styles.done}>Done</Text>
            </Pressable>
          </View>
          <View style={styles.sheetSearch}>
            <View style={styles.fieldBox}>
              <TextInput
                placeholder="Search"
                placeholderTextColor={colors.placeholder}
                value={query}
                onChangeText={setQuery}
                style={styles.input}
                autoFocus
              />
            </View>
          </View>
          <FlatList
            data={filtered as string[]}
            keyExtractor={(item) => item}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onChange(item);
                  setQuery('');
                  setOpen(false);
                }}
                style={({ pressed }) => [styles.option, pressed && { backgroundColor: colors.canvas }]}
              >
                <Text style={[type.body, item === value && { color: colors.primary }]}>{item}</Text>
                {item === value ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

export function Loading() {
  return (
    <View style={[styles.screen, styles.center]}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

export const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.canvas },
  center: { alignItems: 'center', justifyContent: 'center' },
  scrollBody: { paddingHorizontal: space.lg + 4, paddingTop: space.sm, paddingBottom: space.xxl * 1.5, gap: space.lg },
  card: { backgroundColor: colors.card, borderRadius: radius.card, padding: space.lg + 4, gap: space.lg, ...shadow.card },
  titleBlock: { marginTop: space.xl, marginBottom: space.xs, gap: 6 },
  subtitle: { fontSize: 17, color: colors.muted, lineHeight: 23 },
  button: { height: 52, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  buttonSecondary: { backgroundColor: colors.primarySoft },
  buttonPlain: { backgroundColor: 'transparent' },
  buttonText: { color: colors.white, fontSize: 17, fontWeight: '600', letterSpacing: -0.2 },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  link: { alignSelf: 'center', paddingVertical: space.sm },
  linkText: { color: colors.primary, fontSize: 16 },
  fieldBlock: { gap: 8 },
  fieldLabel: { fontSize: 13, color: colors.muted, marginLeft: 4 },
  fieldBox: { flexDirection: 'row', alignItems: 'center', height: 52, borderRadius: radius.tile, borderWidth: 1.5, borderColor: 'transparent', backgroundColor: colors.canvas, paddingHorizontal: space.lg },
  fieldFocused: { borderColor: colors.primary, backgroundColor: colors.card },
  input: { flex: 1, fontSize: 17, color: colors.ink, paddingVertical: 0, outlineStyle: 'none' } as never,
  selectValue: { lineHeight: 52 },
  prefix: { fontSize: 17, color: colors.muted, marginRight: space.sm },
  showText: { color: colors.primary, fontSize: 15, paddingLeft: space.sm },
  chevron: { marginLeft: space.xs },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, borderRadius: radius.tile, paddingVertical: space.md, paddingHorizontal: space.md + 2 },
  noticeText: { flex: 1, fontSize: 15, lineHeight: 20 },
  segTrack: { flexDirection: 'row', backgroundColor: colors.fill, borderRadius: radius.pill, padding: 3 },
  segItem: { flex: 1, height: 34, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  segActive: { backgroundColor: colors.card, boxShadow: '0px 1px 4px rgba(0,0,0,0.12)' },
  segText: { fontSize: 15, color: colors.secondaryInk },
  segTextActive: { color: colors.ink, fontWeight: '600' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space.lg + 4, paddingTop: space.lg },
  done: { color: colors.primary, fontSize: 17, fontWeight: '600' },
  sheetSearch: { paddingHorizontal: space.lg + 4, paddingVertical: space.lg },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: space.lg + 4, paddingVertical: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
});
