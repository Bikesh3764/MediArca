// Basic building blocks in the MediArca look (DESIGN.md): pill buttons, 44pt fields, white cards.
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  type RefreshControlProps,
  ScrollView,
  StyleSheet,
  type TextInputProps,
  View,
  type ViewStyle,
} from 'react-native';
import { Text, TextInput } from '@/components/AppText';
import { type Edge, SafeAreaView } from 'react-native-safe-area-context';
import { NavBar } from '@/components/kit';
import { FadeIn, nativeDriver, smoothLayout, usePressScale } from '@/lib/motion';
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
        <FadeIn style={styles.flex}>
          {scroll ? (
            <ScrollView contentContainerStyle={styles.scrollBody} keyboardShouldPersistTaps="handled" refreshControl={refreshControl}>
              {children}
            </ScrollView>
          ) : (
            <View style={[styles.flex, styles.scrollBody]}>{children}</View>
          )}
        </FadeIn>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** Large title. `eyebrow` is a small grey line above it, e.g. today's date on home screens. */
export function Title({ children, subtitle, eyebrow }: { children: React.ReactNode; subtitle?: string; eyebrow?: string }) {
  return (
    <View style={styles.titleBlock}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text> : null}
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

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({ label, onPress, variant = 'primary', loading, disabled, icon, destructive }: ButtonProps) {
  const isDisabled = disabled || loading;
  const [pressed, setPressed] = useState(false);
  const press = usePressScale(0.97);
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={onPress}
      onPressIn={() => {
        setPressed(true);
        press.handlers.onPressIn();
      }}
      onPressOut={() => {
        setPressed(false);
        press.handlers.onPressOut();
      }}
      disabled={isDisabled}
      style={[
        styles.button,
        variant === 'primary' && { backgroundColor: pressed ? colors.primaryPressed : colors.primary },
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'plain' && styles.buttonPlain,
        isDisabled && { opacity: 0.6 },
        press.style,
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
    </AnimatedPressable>
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
      <View style={[styles.fieldBox, input.multiline && styles.fieldBoxMulti, focused && styles.fieldFocused]}>
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

/** Errors and "saved" messages fade away on their own after a few seconds; info notes stay. */
const NOTICE_MS = { error: 6000, success: 4000 } as const;

export function Notice({
  tone,
  message,
  stamp,
  persist,
}: {
  tone: 'error' | 'info' | 'success';
  message?: string | null;
  /** The message object it came from: a new object shows the note again even with the same text. */
  stamp?: object | null;
  /** Keep it on screen (account status notes). */
  persist?: boolean;
}) {
  const [shownFor, setShownFor] = useState<{ message?: string | null; stamp?: object | null }>({ message, stamp });
  const [hidden, setHidden] = useState(false);
  if (shownFor.message !== message || shownFor.stamp !== stamp) {
    setShownFor({ message, stamp });
    setHidden(false);
  }
  const ms = tone === 'info' || persist ? 0 : NOTICE_MS[tone];
  useEffect(() => {
    if (!message || !ms) return;
    const timer = setTimeout(() => {
      smoothLayout();
      setHidden(true);
    }, ms);
    return () => clearTimeout(timer);
  }, [message, stamp, ms]);
  if (!message || hidden) return null;
  const tones = {
    error: { backgroundColor: colors.dangerSoft, color: colors.danger, icon: 'alert-circle' as const },
    info: { backgroundColor: colors.primarySoft, color: colors.primary, icon: 'information-circle' as const },
    success: { backgroundColor: colors.successSoft, color: colors.success, icon: 'checkmark-circle' as const },
  }[tone];
  return (
    <FadeIn key={message}>
      <View accessibilityRole="alert" style={[styles.notice, { backgroundColor: tones.backgroundColor }]}>
        <Ionicons name={tones.icon} size={18} color={tones.color} />
        <Text style={[styles.noticeText, { color: tone === 'info' ? colors.ink : tones.color }]}>{message}</Text>
      </View>
    </FadeIn>
  );
}

/** Pill track for choosing one option (e.g. Patient / Doctor). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  /** `dot` shows a small coloured dot on the chosen option (e.g. green for In cabin). */
  options: { value: T; label: string; dot?: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  // White thumb slides to the chosen option
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const [width, setWidth] = useState(0);
  const slide = useState(() => new Animated.Value(index))[0];
  useEffect(() => {
    Animated.spring(slide, { toValue: index, speed: 22, bounciness: 4, useNativeDriver: nativeDriver }).start();
  }, [index, slide]);
  const itemWidth = width ? (width - 6) / options.length : 0;
  return (
    <View style={styles.segTrack} accessibilityRole="tablist" onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {itemWidth ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.segThumb,
            { width: itemWidth, transform: [{ translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [0, itemWidth] }) }] },
          ]}
        />
      ) : null}
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={[styles.segItem, active && !itemWidth && styles.segActive]}
          >
            {active && o.dot ? <View style={[styles.segDot, { backgroundColor: o.dot }]} /> : null}
            <Text style={[styles.segText, active && styles.segTextActive]} numberOfLines={1}>
              {o.label}
            </Text>
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
        style={[styles.fieldBox, styles.selectBox, disabled && { opacity: 0.5 }]}
      >
        <Text style={[styles.input, styles.selectValue, !value && { color: colors.placeholder }]} numberOfLines={1}>{value || placeholder}</Text>
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
  titleBlock: { marginTop: space.xl, marginBottom: space.xs, gap: 6, flexShrink: 1 },
  subtitle: { fontSize: 17, color: colors.muted, lineHeight: 23 },
  eyebrow: { fontSize: 13, fontWeight: '600', color: colors.muted, letterSpacing: 0.3, marginBottom: -4 },
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
  fieldBoxMulti: { height: undefined, minHeight: 96, alignItems: 'flex-start', paddingVertical: space.md },
  fieldFocused: { borderColor: colors.primary, backgroundColor: colors.card },
  input: { flex: 1, minWidth: 0, fontSize: 17, color: colors.ink, paddingVertical: 0, outlineStyle: 'none' } as never,
  selectValue: { lineHeight: 52 },
  selectBox: { paddingHorizontal: space.md + 2 },
  prefix: { fontSize: 17, color: colors.muted, marginRight: space.sm },
  showText: { color: colors.primary, fontSize: 15, paddingLeft: space.sm },
  chevron: { marginLeft: space.xs },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, borderRadius: radius.tile, paddingVertical: space.md, paddingHorizontal: space.md + 2 },
  noticeText: { flex: 1, fontSize: 15, lineHeight: 20 },
  segTrack: { flexDirection: 'row', backgroundColor: colors.fill, borderRadius: radius.pill, padding: 3 },
  segItem: { flex: 1, flexDirection: 'row', gap: 6, height: 34, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  segDot: { width: 7, height: 7, borderRadius: 4 },
  segThumb: { position: 'absolute', top: 3, bottom: 3, left: 3, borderRadius: radius.pill, backgroundColor: colors.card, boxShadow: '0px 1px 4px rgba(0,0,0,0.12)' },
  segActive: { backgroundColor: colors.card, boxShadow: '0px 1px 4px rgba(0,0,0,0.12)' },
  segText: { fontSize: 15, color: colors.secondaryInk },
  segTextActive: { color: colors.ink, fontWeight: '600' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space.lg + 4, paddingTop: space.lg },
  done: { color: colors.primary, fontSize: 17, fontWeight: '600' },
  sheetSearch: { paddingHorizontal: space.lg + 4, paddingVertical: space.lg },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: space.lg + 4, paddingVertical: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
});
