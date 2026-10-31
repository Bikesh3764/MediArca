// Pieces of the find-and-book flow: doctor/clinic cards, date strip, shifts, token preview.
import { Ionicons } from '@expo/vector-icons';
import { type ComponentProps, useEffect, useRef } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  type ClinicProfile,
  type Doctor,
  type DoctorSlot,
  type QueuePreview,
  type SlotStatusResult,
  WEEKDAY_SINGLE_LETTERS,
  cleanSlotName,
  format12Hour,
  formatDisplayDate,
  formatDoctorDegrees,
  getDayOfWeekCode,
  getLocalDateString,
} from '@mediarca/shared/api';
import { formatClinicAddress } from '@mediarca/shared/utils/address';
import { Avatar, CabinBadge, Chip, ClinicImage, PressableCard } from '@/components/kit';
import { doctorName } from '@/lib/booking';
import { tap } from '@/lib/haptics';
import { colors, radius, space, type } from '@/theme';

/* ---------- Discovery cards ---------- */

export function DoctorCard({
  doctor,
  clinicId,
  onPress,
  hideClinic = false,
}: {
  doctor: Doctor;
  clinicId?: string;
  onPress: () => void;
  /** On a clinic's own page the clinic line is redundant. */
  hideClinic?: boolean;
}) {
  const clinic = (clinicId && doctor.clinics?.find((c) => c.clinicId === clinicId)) || doctor.clinics?.[0];
  const fee = clinic?.consultationFee ?? doctor.consultationFee;
  return (
    <PressableCard onPress={onPress} label={doctorName(doctor.user?.fullName)}>
      <View style={styles.row}>
        <Avatar uri={doctor.user?.avatarUrl} name={doctor.user?.fullName} size={64} />
        <View style={styles.flex}>
          <View style={styles.nameRow}>
            <Text style={[type.headline, styles.shrink]} numberOfLines={1}>
              {doctorName(doctor.user?.fullName)}
            </Text>
            {doctor.isVerified ? <Ionicons name="checkmark-circle" size={15} color={colors.primary} /> : null}
          </View>
          <Text style={styles.specialty} numberOfLines={1}>
            {doctor.specialty}
          </Text>
          <Text style={type.footnote} numberOfLines={1}>
            {formatDoctorDegrees(doctor.qualifications)}
            {doctor.experienceYears ? ` · ${doctor.experienceYears} yrs` : ''}
          </Text>
        </View>
        <View style={styles.feeBox}>
          <Text style={styles.fee}>₹{fee}</Text>
        </View>
      </View>
      <View style={styles.cardFooter}>
        {hideClinic ? (
          <View style={styles.flex} />
        ) : clinic ? (
          <View style={[styles.metaRow, styles.flex]}>
            <Ionicons name="location" size={13} color={colors.placeholder} />
            <Text style={[type.footnote, styles.shrink]} numberOfLines={1}>
              {clinic.clinic.clinicName}
              {clinic.clinic.city ? ` · ${clinic.clinic.city}` : ''}
              {doctor.clinics && doctor.clinics.length > 1 ? ` +${doctor.clinics.length - 1}` : ''}
            </Text>
          </View>
        ) : (
          <Text style={[type.caption, styles.flex]}>No clinic yet</Text>
        )}
        <CabinBadge status={doctor.cabinStatus} expectedReturnTime={doctor.expectedReturnTime} />
      </View>
    </PressableCard>
  );
}

export function ClinicCard({ clinic, onPress }: { clinic: ClinicProfile; onPress: () => void }) {
  const count = clinic._count?.doctors ?? clinic.doctors?.length;
  return (
    <PressableCard onPress={onPress} label={clinic.clinicName}>
      <View style={styles.row}>
        <ClinicImage uri={clinic.avatarUrl} size={60} />
        <View style={styles.flex}>
          <Text style={type.headline} numberOfLines={1}>
            {clinic.clinicName}
          </Text>
          <Text style={type.caption} numberOfLines={2}>
            {formatClinicAddress(clinic) || 'Clinic'}
          </Text>
          {count ? <Text style={styles.specialty}>{count === 1 ? '1 doctor' : `${count} doctors`}</Text> : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.placeholder} />
      </View>
    </PressableCard>
  );
}

/* ---------- Clinic choice ---------- */

export function ClinicChoice({
  doctor,
  clinics,
  selectedId,
  onSelect,
}: {
  doctor: Doctor;
  clinics: NonNullable<Doctor['clinics']>;
  selectedId: string | null;
  onSelect: (clinicId: string) => void;
}) {
  const single = clinics.length === 1;
  return (
    <View style={styles.stack}>
      {clinics.map((c) => {
        const selected = single || c.clinicId === selectedId;
        return (
          <Pressable
            key={c.clinicId}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            disabled={single}
            onPress={() => {
              tap();
              onSelect(c.clinicId);
            }}
            style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.optionPressed]}
          >
            <ClinicImage uri={c.clinic.avatarUrl} size={44} />
            <View style={styles.flex}>
              <View style={styles.nameRow}>
                <Text style={[styles.optionTitle, styles.shrink]} numberOfLines={1}>
                  {c.clinic.clinicName}
                </Text>
                {c.hasReceptionist === false ? <Chip label="Closed" /> : null}
              </View>
              <Text style={type.caption} numberOfLines={1}>
                {formatClinicAddress(c.clinic, { withState: false })}
              </Text>
            </View>
            <View style={styles.feeBox}>
              <Text style={styles.optionFee}>₹{c.consultationFee ?? doctor.consultationFee}</Text>
              {!single ? (
                <Ionicons
                  name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                  size={22}
                  color={selected ? colors.primary : colors.border}
                />
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ---------- Date strip ---------- */

const DAY_WIDTH = 52;

export function DateStrip({
  dates,
  value,
  onChange,
  workingDays,
}: {
  dates: string[];
  value: string;
  onChange: (date: string) => void;
  workingDays: Set<string> | null;
}) {
  const list = useRef<FlatList<string>>(null);
  const today = getLocalDateString();
  const index = Math.max(0, dates.indexOf(value));

  useEffect(() => {
    // Keep the chosen day in view (e.g. after coming back with a date set)
    if (index > 3) list.current?.scrollToIndex({ index: Math.max(0, index - 2), animated: false });
    // Only on first show
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <FlatList
      ref={list}
      horizontal
      data={dates}
      keyExtractor={(d) => d}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.dateList}
      getItemLayout={(_, i) => ({ length: DAY_WIDTH, offset: DAY_WIDTH * i, index: i })}
      initialNumToRender={10}
      renderItem={({ item }) => {
        const selected = item === value;
        const code = getDayOfWeekCode(item);
        const off = workingDays ? !workingDays.has(code) : false;
        const dayNum = Number(item.slice(8, 10));
        const showMonth = dayNum === 1 || item === dates[0];
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={formatDisplayDate(item)}
            accessibilityState={{ selected }}
            onPress={() => {
              tap();
              onChange(item);
            }}
            style={styles.day}
          >
            <Text style={[styles.dayLetter, item === today && { color: colors.primary }]}>
              {showMonth ? MONTHS[Number(item.slice(5, 7)) - 1] : WEEKDAY_SINGLE_LETTERS[code]}
            </Text>
            <View style={[styles.dayDisc, selected && styles.dayDiscSelected]}>
              <Text
                style={[
                  styles.dayNum,
                  off && !selected && { color: colors.placeholder },
                  item === today && !selected && { color: colors.primary },
                  selected && { color: colors.white },
                ]}
              >
                {dayNum}
              </Text>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* ---------- Shifts ---------- */

type ShiftItem = { slot: DoctorSlot } & Partial<SlotStatusResult>;

export function ShiftList({
  items,
  selectedId,
  onSelect,
}: {
  items: ShiftItem[];
  selectedId: string | null;
  onSelect: (slotId: string) => void;
}) {
  if (items.length === 0) return <Text style={type.caption}>No shifts set yet.</Text>;
  return (
    <View style={styles.stack}>
      {items.map((item) => {
        const s = item.slot;
        const leave = Boolean(item.isOnLeave);
        const dayOff = Boolean(item.isDayOff);
        const passed = Boolean(item.isPassed && !leave && !dayOff);
        const full = Boolean(item.isFull);
        const blocked = leave || dayOff || passed || full;
        const selected = s.id === selectedId && !blocked;
        const status = leave ? (
          <Chip label="On leave" tone="warning" />
        ) : dayOff ? (
          <Chip label="Day off" />
        ) : passed ? (
          <Chip label="Ended" />
        ) : full ? (
          <Chip label="Full" tone="danger" />
        ) : selected ? (
          <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
        ) : (
          <Chip label="Available" tone="primary" />
        );
        return (
          <Pressable
            key={s.id}
            accessibilityRole="button"
            accessibilityState={{ selected, disabled: blocked }}
            disabled={blocked}
            onPress={() => {
              tap();
              onSelect(s.id);
            }}
            style={({ pressed }) => [
              styles.option,
              selected && styles.optionSelected,
              blocked && { opacity: 0.55 },
              pressed && styles.optionPressed,
            ]}
          >
            <View style={styles.shiftIcon}>
              <Ionicons name={shiftIcon(s.startTime)} size={18} color={colors.primary} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.optionTitle}>{cleanSlotName(s.name)}</Text>
              <Text style={type.caption}>
                {format12Hour(s.startTime)} – {format12Hour(s.endTime)}
              </Text>
            </View>
            {status}
          </Pressable>
        );
      })}
    </View>
  );
}

const shiftIcon = (start: string): ComponentProps<typeof Ionicons>['name'] => {
  const hour = Number(start.split(':')[0]);
  if (hour < 12) return 'sunny-outline';
  if (hour < 17) return 'partly-sunny-outline';
  return 'moon-outline';
};

/* ---------- Token preview ---------- */

export function TokenTile({ preview, blocked }: { preview: QueuePreview; blocked: boolean }) {
  const token = Math.max(1, preview.nextQueueNumber || 1);
  return (
    <View style={styles.token}>
      <View style={styles.tokenTop}>
        <View>
          <Text style={styles.tokenLabel}>Token</Text>
          <Text style={styles.tokenNumber}>{blocked ? '—' : `#${token}`}</Text>
        </View>
        <View style={styles.tokenRight}>
          <Text style={styles.tokenLabel}>Est. time</Text>
          <Text style={styles.tokenTime}>{blocked ? '—' : preview.estimatedTime}</Text>
        </View>
      </View>
      <View style={styles.tokenFooter}>
        <Text style={type.caption}>{cleanSlotName(preview.checkingWindow)}</Text>
        <Text style={type.caption}>
          {blocked ? 'Pick another' : preview.patientsAhead === 0 ? 'You’d be next' : `${preview.patientsAhead} ahead`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  stack: { gap: space.sm },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  specialty: { fontSize: 15, color: colors.primary, marginTop: 2, marginBottom: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  feeBox: { alignItems: 'flex-end', gap: 2 },
  fee: { fontSize: 18, fontWeight: '600', color: colors.ink, letterSpacing: -0.3 },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.md,
    paddingTop: space.md - 2,
    paddingHorizontal: space.md,
    paddingBottom: space.md - 2,
    borderRadius: radius.field,
    backgroundColor: colors.canvas,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.tile,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: 'transparent',
    boxShadow: '0px 1px 2px rgba(0,0,0,0.04), 0px 4px 14px rgba(0,0,0,0.04)',
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: '#f7fbff' },
  optionPressed: { transform: [{ scale: 0.985 }] },
  optionTitle: { fontSize: 16, fontWeight: '600', color: colors.ink },
  optionFee: { fontSize: 15, fontWeight: '600', color: colors.ink },
  shiftIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  dateList: { paddingHorizontal: space.lg - 4 },
  day: { width: DAY_WIDTH, alignItems: 'center', gap: 6 },
  dayLetter: { fontSize: 12, color: colors.muted },
  dayDisc: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  dayDiscSelected: { backgroundColor: colors.primary },
  dayNum: { fontSize: 18, color: colors.ink },
  token: { borderRadius: radius.card, backgroundColor: colors.primaryTint, padding: space.lg },
  tokenTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  tokenRight: { alignItems: 'flex-end' },
  tokenLabel: { fontSize: 12, color: colors.muted },
  tokenNumber: { fontSize: 36, fontWeight: '600', letterSpacing: -0.8, color: colors.primary },
  tokenTime: { fontSize: 20, fontWeight: '600', color: colors.ink, marginBottom: 4 },
  tokenFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: space.md,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,102,204,0.18)',
  },
});
