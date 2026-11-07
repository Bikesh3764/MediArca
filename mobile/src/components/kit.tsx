// More building blocks in the Apple look: avatars, chips, search, sheets, empty states, bottom bar.
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Text, TextInput } from '@/components/AppText';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { getFileUrl } from '@mediarca/shared/api/config';
import { tidyTimes } from '@mediarca/shared/api';
import { tap } from '@/lib/haptics';
import { nativeDriver, usePressScale } from '@/lib/motion';
import { colors, radius, shadow, space, type } from '@/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** Apple-style on/off switch that looks the same on every phone (Android's own one fades into white cards). */
export function Toggle({
  value,
  onValueChange,
  disabled = false,
  accessibilityLabel,
}: {
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const [v] = useState(() => new Animated.Value(value ? 1 : 0));
  useEffect(() => {
    Animated.timing(v, { toValue: value ? 1 : 0, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: nativeDriver }).start();
  }, [value, v]);
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      hitSlop={8}
      onPress={() => onValueChange(!value)}
      style={[styles.toggle, disabled && { opacity: 0.5 }]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.toggleOn, { opacity: v }]} />
      <Animated.View style={[styles.toggleThumb, { transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [2, 22] }) }] }]} />
    </Pressable>
  );
}

const initialOf = (name?: string | null) =>
  (name || '').replace(/^Dr\.?\s*/i, '').trim().charAt(0).toUpperCase() || '?';

/** Profile photo with the first letter as a fallback. */
export function Avatar({
  uri,
  name,
  size = 52,
  shape = 'circle',
  ring = false,
}: {
  uri?: string | null;
  name?: string | null;
  size?: number;
  shape?: 'circle' | 'rounded';
  ring?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const r = shape === 'circle' ? size / 2 : Math.round(size * 0.26);
  const box = { width: size, height: size, borderRadius: r };
  return (
    <View style={[styles.avatar, box, ring && styles.avatarRing]}>
      {uri && !failed ? (
        <Image source={{ uri: getFileUrl(uri) }} style={box} onError={() => setFailed(true)} accessibilityIgnoresInvertColors />
      ) : (
        <Text style={[styles.avatarText, { fontSize: size * 0.4 }]}>{initialOf(name)}</Text>
      )}
    </View>
  );
}

/** Clinic photo, or a soft tile with a building icon. */
export function ClinicImage({ uri, size = 60 }: { uri?: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  const box = { width: size, height: size, borderRadius: Math.round(size * 0.26) };
  if (uri && !failed) {
    return <Image source={{ uri: getFileUrl(uri) }} style={[box, styles.clinicImage]} onError={() => setFailed(true)} accessibilityIgnoresInvertColors />;
  }
  return (
    <View style={[box, styles.clinicFallback]}>
      <Ionicons name="business" size={size * 0.42} color={colors.primary} />
    </View>
  );
}

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';
const TONES: Record<Tone, { bg: string; fg: string; dot: string }> = {
  neutral: { bg: colors.canvas, fg: colors.ink, dot: colors.border },
  primary: { bg: colors.primarySoft, fg: colors.primary, dot: colors.primary },
  success: { bg: colors.successSoft, fg: colors.success, dot: colors.success },
  warning: { bg: colors.warningSoft, fg: colors.warning, dot: colors.warning },
  danger: { bg: colors.dangerSoft, fg: colors.danger, dot: colors.danger },
};

export function Chip({ label, tone = 'neutral', dot = false }: { label: string; tone?: Tone; dot?: boolean }) {
  const t = TONES[tone];
  return (
    <View style={[styles.chip, { backgroundColor: t.bg }]}>
      {dot ? <View style={[styles.dot, { backgroundColor: t.dot }]} /> : null}
      <Text style={[styles.chipText, { color: t.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Whether the doctor is in the cabin right now (same wording as the website). */
export function CabinBadge({ status, expectedReturnTime }: { status?: string | null; expectedReturnTime?: string | null }) {
  const s = (status || 'IN_CABIN').toUpperCase();
  if (s === 'STEPPED_OUT') {
    const back = expectedReturnTime ? tidyTimes(expectedReturnTime.replace(/^~\s*/, '').trim()) : '';
    return <Chip dot tone="warning" label={back ? `Stepped out · Back ${back}` : 'Stepped out'} />;
  }
  if (s === 'NOT_IN_CABIN') return <Chip dot label="Not in cabin" />;
  return <Chip dot tone="primary" label="In cabin" />;
}

/** Round icon button (back, close, share). */
export function IconButton({
  icon,
  onPress,
  label,
  tone = 'light',
  style,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  tone?: 'light' | 'plain';
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, tone === 'light' && styles.iconButtonLight, pressed && styles.pressed, style]}
    >
      <Ionicons name={icon} size={20} color={colors.ink} />
    </Pressable>
  );
}

/** Back to the previous screen, or to a fallback when opened directly. */
export const goBack = (fallback: string) => {
  if (router.canGoBack()) router.back();
  else router.replace(fallback as never);
};

/** Navigation bar for pushed screens: back chevron and a centred title. */
export function NavBar({ title, fallback = '/' }: { title?: string; fallback?: string }) {
  return (
    <View style={styles.navBar}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={10} onPress={() => goBack(fallback)} style={styles.navBack}>
        <Ionicons name="chevron-back" size={26} color={colors.primary} />
      </Pressable>
      <Text style={styles.navTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.navBack} />
    </View>
  );
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search',
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={styles.search}>
      <Ionicons name="search" size={18} color={colors.muted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={styles.searchInput}
        returnKeyType="search"
        autoCorrect={false}
        accessibilityLabel={placeholder}
      />
      {value ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Clear" hitSlop={10} onPress={() => onChangeText('')}>
          <Ionicons name="close-circle" size={18} color={colors.placeholder} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Small pill button, e.g. "Filters". */
export function PillButton({
  label,
  icon,
  onPress,
  active = false,
}: {
  label: string;
  icon?: IconName;
  onPress: () => void;
  active?: boolean;
}) {
  const press = usePressScale(0.94);
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={() => {
        tap();
        onPress();
      }}
      {...press.handlers}
      style={[styles.pill, active && styles.pillActive, press.style]}
    >
      {icon ? <Ionicons name={icon} size={15} color={active ? colors.white : colors.ink} /> : null}
      <Text style={[styles.pillText, active && { color: colors.white }]}>{label}</Text>
    </AnimatedPressable>
  );
}

/** White rounded card that presses in slightly. */
export function PressableCard({
  onPress,
  children,
  style,
  label,
}: {
  onPress: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  label?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed, style]}
    >
      {children}
    </Pressable>
  );
}

export function SectionTitle({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={type.headline}>{title}</Text>
      {right}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={28} color={colors.primary} />
      </View>
      <Text style={[type.headline, styles.centerText]}>{title}</Text>
      {message ? <Text style={[type.caption, styles.centerText, { fontSize: 15 }]}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} style={({ pressed }) => [styles.emptyAction, pressed && styles.pressed]}>
          <Text style={styles.emptyActionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Grey card shown only on the very first load (no pulsing). */
export function PlaceholderCard({ height = 96 }: { height?: number }) {
  return <View style={[styles.placeholder, { height }]} />;
}

/** Action bar fixed to the bottom of a screen. */
export function BottomBar({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, space.md) }]}>{children}</View>;
}

/** Sheet that slides up for filters and pickers. */
export function Sheet({
  visible,
  title,
  onClose,
  children,
  doneLabel = 'Done',
  footer,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  doneLabel?: string;
  /** Stays at the bottom while the content scrolls (e.g. "Show 3 doctors"). */
  footer?: React.ReactNode;
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.sheet} edges={Platform.OS === 'ios' ? ['bottom'] : ['top', 'bottom']}>
        <View style={styles.sheetHeader}>
          <View style={styles.sheetSide} />
          <Text style={type.headline}>{title}</Text>
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={10} style={[styles.sheetSide, { alignItems: 'flex-end' }]}>
            <Text style={styles.sheetDone}>{doneLabel}</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
        {footer ? <View style={styles.sheetFooter}>{footer}</View> : null}
      </SafeAreaView>
    </Modal>
  );
}

/** Grouped list of options with a check on the chosen one (iOS settings style). */
export function OptionList<T extends string | number>({
  options,
  value,
  onChange,
}: {
  /** `detail` is a grey second line (e.g. shift times); `badge` a small chip on the right (e.g. Ended). */
  options: { value: T; label: string; detail?: string; badge?: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.group}>
      {options.map((o, i) => {
        const selected = o.value === value;
        if (o.detail || o.badge) {
          return (
            <Pressable
              key={String(o.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => {
                tap();
                onChange(o.value);
              }}
              style={({ pressed }) => [styles.groupRow, styles.groupRowTall, i > 0 && styles.groupDivider, pressed && { backgroundColor: colors.canvas }]}
            >
              <View style={styles.optionText}>
                <Text style={[type.body, selected && { color: colors.primary, fontWeight: '600' }]} numberOfLines={1}>
                  {o.label}
                </Text>
                {o.detail ? <Text style={type.footnote}>{o.detail}</Text> : null}
              </View>
              {o.badge ? <Chip label={o.badge} /> : null}
              {selected ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
            </Pressable>
          );
        }
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => {
              tap();
              onChange(o.value);
            }}
            style={({ pressed }) => [styles.groupRow, i > 0 && styles.groupDivider, pressed && { backgroundColor: colors.canvas }]}
          >
            <Text style={[type.body, selected && { color: colors.primary }]}>{o.label}</Text>
            {selected ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** White rounded group of ListRows with hairlines between them (iOS Settings style). */
export function ListGroup({ children }: { children: React.ReactNode }) {
  const rows = React.Children.toArray(children).filter(Boolean);
  if (!rows.length) return null;
  return (
    <View style={styles.group}>
      {rows.map((row, i) =>
        React.isValidElement<{ divider?: boolean }>(row) ? React.cloneElement(row, { key: row.key ?? i, divider: i > 0 }) : row
      )}
    </View>
  );
}

/** One tappable row: coloured icon tile, label, optional value and a chevron. */
export function ListRow({
  icon,
  tint = colors.primary,
  label,
  value,
  onPress,
  destructive = false,
  chevron = true,
  divider = false,
  disabled = false,
}: {
  icon: IconName;
  tint?: string;
  label: string;
  value?: string | null;
  onPress: () => void;
  destructive?: boolean;
  chevron?: boolean;
  /** Set by ListGroup. */
  divider?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [styles.listRow, pressed && { backgroundColor: colors.canvas }, disabled && { opacity: 0.5 }]}
    >
      <View style={[styles.listIcon, { backgroundColor: destructive ? colors.danger : tint }]}>
        <Ionicons name={icon} size={17} color={colors.white} />
      </View>
      <View style={[styles.listBody, divider && styles.listDivider]}>
        <Text style={[type.body, styles.flexText, destructive && { color: colors.danger }]} numberOfLines={1}>
          {label}
        </Text>
        {value ? (
          <Text style={[type.body, { color: colors.muted }]} numberOfLines={1}>
            {value}
          </Text>
        ) : null}
        {chevron && !destructive ? <Ionicons name="chevron-forward" size={18} color={colors.placeholder} /> : null}
      </View>
    </Pressable>
  );
}

/** Label on the left, value on the right, inside a grouped card. */
export function InfoRow({ label, value, first = false }: { label: string; value: React.ReactNode; first?: boolean }) {
  return (
    <View style={[styles.infoRow, !first && styles.groupDivider]}>
      <Text style={type.caption}>{label}</Text>
      {typeof value === 'string' ? (
        <Text style={[type.body, styles.infoValue]} numberOfLines={2}>
          {value}
        </Text>
      ) : (
        value
      )}
    </View>
  );
}

export const kitStyles = StyleSheet.create({
  pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
});

const styles = StyleSheet.create({
  toggle: { width: 51, height: 31, borderRadius: 16, backgroundColor: colors.hairline, justifyContent: 'center', overflow: 'hidden' },
  toggleOn: { backgroundColor: colors.primary, borderRadius: 16 },
  toggleThumb: { width: 27, height: 27, borderRadius: 14, backgroundColor: colors.white, boxShadow: '0px 2px 4px rgba(0,0,0,0.18)' },
  pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
  avatar: { backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarRing: { borderWidth: 4, borderColor: colors.white },
  avatarText: { color: colors.primary, fontWeight: '600' },
  clinicImage: { backgroundColor: colors.canvas },
  clinicFallback: { backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 10, height: 26 },
  chipText: { fontSize: 13 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  iconButtonLight: { backgroundColor: colors.card, marginBottom: 2, ...shadow.card },
  navBar: { flexDirection: 'row', alignItems: 'center', height: 44, paddingHorizontal: space.sm },
  navBack: { width: 44, height: 44, justifyContent: 'center' },
  navTitle: { ...type.headline, flex: 1, textAlign: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: space.sm, height: 44, borderRadius: radius.tile, backgroundColor: colors.fill, paddingHorizontal: space.md },
  searchInput: { flex: 1, fontSize: 17, color: colors.ink, paddingVertical: 0, outlineStyle: 'none' } as never,
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.fill },
  pillActive: { backgroundColor: colors.primary },
  pillText: { fontSize: 14, color: colors.ink },
  card: { backgroundColor: colors.card, borderRadius: radius.card, padding: space.lg, ...shadow.card },
  cardPressed: { transform: [{ scale: 0.98 }], opacity: 0.94 },
  sectionTitle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.md, marginBottom: -space.xs, paddingHorizontal: 4 },
  empty: { alignItems: 'center', gap: space.sm, paddingVertical: space.xxl * 1.5, paddingHorizontal: space.xl },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: space.sm },
  centerText: { textAlign: 'center' },
  emptyAction: { marginTop: space.md, height: 44, paddingHorizontal: space.xl, borderRadius: radius.pill, backgroundColor: colors.primary, justifyContent: 'center' },
  emptyActionText: { color: colors.white, fontSize: 16, fontWeight: '600' },
  placeholder: { borderRadius: radius.card, backgroundColor: colors.card, opacity: 0.7 },
  bottomBar: { backgroundColor: 'rgba(255,255,255,0.98)', paddingHorizontal: space.lg + 4, paddingTop: space.md, gap: space.sm, ...shadow.bar },
  sheet: { flex: 1, backgroundColor: colors.canvas },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, height: 56 },
  sheetSide: { width: 64 },
  sheetDone: { color: colors.primary, fontSize: 17, fontWeight: '600' },
  sheetBody: { padding: space.lg, paddingBottom: space.xxl, gap: space.md },
  sheetFooter: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.md, backgroundColor: colors.canvas },
  group: { backgroundColor: colors.card, borderRadius: radius.card, overflow: 'hidden', ...shadow.card },
  groupRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52, paddingHorizontal: space.lg },
  groupRowTall: { gap: space.md, paddingVertical: space.md - 2 },
  optionText: { flex: 1, minWidth: 0, gap: 2 },
  groupDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingLeft: space.lg },
  listIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  listBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 52, paddingRight: space.lg },
  listDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  flexText: { flex: 1 },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.lg, minHeight: 46, paddingVertical: space.sm },
  infoValue: { flexShrink: 1, textAlign: 'right' },
});
