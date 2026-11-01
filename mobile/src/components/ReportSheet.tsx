// Visits and revenue report for a clinic, a doctor or the front desk, shared as a PDF or Excel file, or printed.
// Same server calls and numbers as frontend/src/components/common/ClinicalReportModal.tsx.
// Shift and status filters work on the visits the server sent.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/AppText';
import { type ClinicalReportAppointment, type ClinicalReportData, api, formatDisplayDate, getLocalDateString, shiftLabel } from '@mediarca/shared/api';
import { formatDisplayPhone } from '@mediarca/shared/utils/phoneUtils';
import { PillButton, PlaceholderCard, SectionTitle, Sheet } from '@/components/kit';
import { RangeCalendar } from '@/components/RangeCalendar';
import { Button, Notice, Segmented } from '@/components/ui';
import { doctorName } from '@/lib/booking';
import { nextDays } from '@/lib/dates';
import { shareXlsx } from '@/lib/excel';
import { FadeIn, smoothLayout as smooth } from '@/lib/motion';
import { escapeHtml, pageHtml, printHtml, sharePdf } from '@/lib/print';
import { colors, radius, shadow, space, type } from '@/theme';

export type ReportRole = 'CLINIC' | 'DOCTOR' | 'RECEPTIONIST';
type Period = '1' | '7' | '30' | '90' | 'custom';
type StatusFilter = 'all' | 'confirmed' | 'done' | 'unpaid' | 'cancelled';
type Option = { id: string; label: string };

const STATUS: Record<string, string> = {
  COMPLETED: 'Done',
  WAITING: 'Waiting',
  IN_CONSULTATION: 'In cabin',
  PENDING_APPROVAL: 'Unpaid',
  CANCELLED: 'Cancelled',
  REJECTED: 'Declined',
  EXPIRED: 'Expired',
};
const statusLabel = (s: string) => STATUS[s] || s;
const STATUS_FILTERS: { value: StatusFilter; label: string; match: string[] }[] = [
  { value: 'all', label: 'Any status', match: [] },
  { value: 'confirmed', label: 'Confirmed', match: ['WAITING', 'IN_CONSULTATION'] },
  { value: 'done', label: 'Done', match: ['COMPLETED'] },
  { value: 'unpaid', label: 'Unpaid', match: ['PENDING_APPROVAL'] },
  { value: 'cancelled', label: 'Cancelled', match: ['CANCELLED', 'REJECTED', 'EXPIRED'] },
];
const CANCELLED = ['CANCELLED', 'REJECTED', 'EXPIRED'];
const shiftOf = (a: ClinicalReportAppointment) => shiftLabel(a);
const rupees = (n?: number | null) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
const startFor = (p: Exclude<Period, 'custom'>) => (p === '1' ? getLocalDateString() : nextDays(1, -Number(p))[0].value);
/** Oldest day the server reports on (90 days back). */
const oldest = () => nextDays(1, -90)[0].value;
/** Full date for paper ("2 Oct 2026"), never "Today". */
const paperDate = (ymd: string) => {
  const [y, m, d] = String(ymd).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return String(ymd);
  return new Date(Date.UTC(y, m - 1, d, 6, 30)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
};

/** Doctors (clinic, desk) or clinics (doctor) to filter by. */
async function loadOptions(role: ReportRole): Promise<Option[]> {
  if (role === 'DOCTOR') {
    const aff = await api.getDoctorAffiliations();
    return (aff.clinics || []).map((c) => ({ id: c.clinicId, label: c.clinicName }));
  }
  const doctors = role === 'CLINIC' ? (await api.getMyClinic()).doctors : (await api.getMyReceptionist()).doctors;
  return (doctors || []).map((d) => ({ id: d.doctorId, label: doctorName(d.fullName) }));
}

export function ReportSheet({ role, visible, onClose }: { role: ReportRole; visible: boolean; onClose: () => void }) {
  const [period, setPeriod] = useState<Period>('30');
  const [filter, setFilter] = useState('all');
  const [shift, setShift] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [options, setOptions] = useState<Option[]>([]);
  const [data, setData] = useState<ClinicalReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<'pdf' | 'excel' | 'print' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [from, setFrom] = useState(() => startFor('7'));
  const [to, setTo] = useState<string | null>(() => getLocalDateString());
  const [picking, setPicking] = useState(false);
  const custom = period === 'custom';
  const waiting = custom && !to;
  const startDate = custom ? from : startFor(period);
  const endDate = custom ? to || from : getLocalDateString();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const id = filter !== 'all' ? filter : undefined;
      const params = { startDate, endDate };
      const res =
        role === 'CLINIC'
          ? await api.getClinicReport({ ...params, doctorId: id })
          : role === 'DOCTOR'
            ? await api.getDoctorReport({ ...params, clinicId: id })
            : await api.getReceptionistReport({ ...params, doctorId: id });
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Couldn’t make the report. Try again.');
    } finally {
      setLoading(false);
    }
  }, [role, filter, startDate, endDate]);

  useEffect(() => {
    if (!visible || waiting) return;
    queueMicrotask(() => {
      load();
    });
  }, [visible, waiting, load]);

  // Start clean and fetch the filter choices once per opening
  const [wasOpen, setWasOpen] = useState(false);
  if (visible !== wasOpen) {
    setWasOpen(visible);
    if (visible) setData(null);
  }
  useEffect(() => {
    if (!visible) return;
    let live = true;
    loadOptions(role)
      .then((o) => live && setOptions(o))
      .catch(() => live && setOptions([]));
    return () => {
      live = false;
    };
  }, [visible, role]);

  // Shift and status filters: count again from the visits that match
  const shifts = useMemo(
    () => [...new Set((data?.appointments || []).map(shiftOf))].sort((a, b) => a.localeCompare(b, 'en', { numeric: true })),
    [data]
  );
  const activeShift = shifts.includes(shift) ? shift : 'all';
  const narrowed = activeShift !== 'all' || statusFilter !== 'all';
  const visits = useMemo(() => {
    const match = STATUS_FILTERS.find((f) => f.value === statusFilter)?.match || [];
    return (data?.appointments || []).filter(
      (a) => (activeShift === 'all' || shiftOf(a) === activeShift) && (!match.length || match.includes(a.status))
    );
  }, [data, activeShift, statusFilter]);
  const s =
    data && narrowed
      ? {
          totalBookings: visits.length,
          completedCount: visits.filter((a) => a.status === 'COMPLETED').length,
          cancelledCount: visits.filter((a) => CANCELLED.includes(a.status)).length,
          totalRevenue: visits.reduce((n, a) => n + (a.earnedRevenue || 0), 0),
        }
      : data?.summary;
  const name =
    role === 'DOCTOR' ? doctorName(data?.doctor?.name) || 'Doctor' : data?.facility?.name || (role === 'CLINIC' ? 'Clinic' : 'Front desk');
  const filterLabel = [
    options.find((o) => o.id === filter)?.label,
    activeShift !== 'all' ? activeShift : '',
    statusFilter !== 'all' ? STATUS_FILTERS.find((f) => f.value === statusFilter)?.label : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const breakdown = narrowed
    ? Object.values(
        visits.reduce<Record<string, { id: string; name: string; bookings: number; revenue: number }>>((acc, a) => {
          const id = (role === 'DOCTOR' ? a.clinicId : a.doctorId) || '-';
          if (!acc[id]) acc[id] = { id, name: (role === 'DOCTOR' ? a.clinicName : doctorName(a.doctorName)) || '—', bookings: 0, revenue: 0 };
          acc[id].bookings += 1;
          acc[id].revenue += a.earnedRevenue || 0;
          return acc;
        }, {})
      )
    : role === 'DOCTOR'
      ? (data?.byClinic || []).map((c) => ({ id: c.clinicId, name: c.clinicName, bookings: c.bookings, revenue: c.revenue }))
      : (data?.byDoctor || []).map((d) => ({ id: d.doctorId, name: doctorName(d.doctorName), bookings: d.bookings, revenue: d.revenue }));

  const html = () => {
    if (!data || !s) return '';
    const other = role === 'DOCTOR' ? 'Clinic' : 'Doctor';
    const otherOf = (a: ClinicalReportAppointment) => (role === 'DOCTOR' ? a.clinicName : doctorName(a.doctorName)) || '';
    const rows = visits
      .map(
        (a) => `<tr><td>#${escapeHtml(a.queueNumber)}</td><td>${escapeHtml(paperDate(a.appointmentDate))}</td><td>${escapeHtml(shiftOf(a))}</td>
<td>${escapeHtml(a.patientName)}<div class="muted">${escapeHtml(a.patientPhone ? formatDisplayPhone(a.patientPhone) : '')}</div></td>
<td>${escapeHtml(otherOf(a))}</td><td>${escapeHtml(statusLabel(a.status))}</td><td class="r">${escapeHtml(rupees(a.earnedRevenue))}</td></tr>`
      )
      .join('');
    const split = breakdown.length
      ? `<h2>By ${other.toLowerCase()}</h2><table><tr><th>${other}</th><th class="r">Visits</th><th class="r">Revenue</th></tr>${breakdown
          .map((b) => `<tr><td>${escapeHtml(b.name)}</td><td class="r">${b.bookings}</td><td class="r">${escapeHtml(rupees(b.revenue))}</td></tr>`)
          .join('')}</table>`
      : '';
    const made = paperDate(endDate);
    return pageHtml(
      `${name} report`,
      `<div class="brand">MediArca</div>
<h1>${escapeHtml(name)}${filterLabel ? ` · ${escapeHtml(filterLabel)}` : ''}</h1>
<div class="muted">${escapeHtml(paperDate(startDate))} – ${escapeHtml(paperDate(endDate))} · Made on ${escapeHtml(made)}</div>
<div class="tiles">
  <div class="tile"><b>${s.totalBookings}</b><span class="muted">Visits</span></div>
  <div class="tile"><b>${s.completedCount}</b><span class="muted">Done</span></div>
  <div class="tile"><b>${s.cancelledCount}</b><span class="muted">Cancelled</span></div>
  <div class="tile"><b>${escapeHtml(rupees(s.totalRevenue))}</b><span class="muted">Revenue</span></div>
</div>
${split}
<h2>Visits${data.truncated ? ` <span class="muted">(newest ${data.maxRows || data.appointments.length})</span>` : ''}</h2>
<table><tr><th>Token</th><th>Date</th><th>Shift</th><th>Patient</th><th>${other}</th><th>Status</th><th class="r">Revenue</th></tr>${rows}</table>`
    );
  };

  const excelRows = () => {
    const other = role === 'DOCTOR' ? 'Clinic' : 'Doctor';
    const total = visits.reduce((n, a) => n + Math.round(a.earnedRevenue || 0), 0);
    return [
      ['Token', 'Date', 'Shift', 'Patient', 'Mobile', other, 'Status', 'Fee (₹)', 'Revenue (₹)'],
      ...visits.map((a) => [
        a.queueNumber,
        paperDate(a.appointmentDate),
        shiftOf(a),
        a.patientName,
        a.patientPhone ? formatDisplayPhone(a.patientPhone) : '',
        (role === 'DOCTOR' ? a.clinicName : doctorName(a.doctorName)) || '',
        statusLabel(a.status),
        Math.round(a.fee || 0),
        Math.round(a.earnedRevenue || 0),
      ]),
      [],
      ['Total', '', '', '', '', '', `${visits.length} visits`, '', total],
    ];
  };

  const run = async (kind: 'pdf' | 'excel' | 'print') => {
    if (!data || busy) return;
    if (!visits.length) return setError(narrowed ? 'No visits match these filters.' : 'No visits in this period.');
    setBusy(kind);
    setError(null);
    try {
      if (kind === 'pdf') await sharePdf(html(), `${name} report`);
      else if (kind === 'excel') await shareXlsx(`${name} report ${startDate} to ${endDate}`, 'Visits', excelRows(), [8, 14, 12, 24, 16, 22, 12, 10, 12]);
      else await printHtml(html());
    } catch (err: any) {
      setError(err?.message || (kind === 'excel' ? 'Couldn’t make the Excel file. Try again.' : 'Couldn’t make the PDF. Try again.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet visible={visible} title="Report" doneLabel="Close" onClose={onClose}>
      <View style={styles.stack}>
        <Segmented
          options={[
            { value: '1', label: 'Today' },
            { value: '7', label: '7d' },
            { value: '30', label: '30d' },
            { value: '90', label: '90d' },
            { value: 'custom', label: 'Custom' },
          ]}
          value={period}
          onChange={(p) => {
            smooth();
            setPeriod(p);
            setPicking(p === 'custom');
          }}
        />
        {custom ? (
          <>
            <View style={styles.range}>
              <DateTile label="From" value={formatDisplayDate(from)} active={picking && Boolean(to)} onPress={() => { smooth(); setPicking(true); }} />
              <Ionicons name="arrow-forward" size={16} color={colors.muted} />
              <DateTile label="To" value={to ? formatDisplayDate(to) : 'Pick a day'} active={picking && Boolean(!to)} onPress={() => { smooth(); setPicking(true); }} />
            </View>
            {picking ? (
              <RangeCalendar
                start={from}
                end={to}
                min={oldest()}
                max={getLocalDateString()}
                onChange={(a, b) => {
                  setFrom(a);
                  setTo(b);
                  if (b) {
                    smooth();
                    setPicking(false);
                  }
                }}
              />
            ) : null}
          </>
        ) : null}
        {options.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills} style={styles.bleed}>
            <PillButton label={role === 'DOCTOR' ? 'All clinics' : 'All doctors'} active={filter === 'all'} onPress={() => setFilter('all')} />
            {options.map((o) => (
              <PillButton key={o.id} label={o.label} active={filter === o.id} onPress={() => setFilter(o.id)} />
            ))}
          </ScrollView>
        ) : null}
        {shifts.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills} style={styles.bleed}>
            <PillButton label="All shifts" active={activeShift === 'all'} onPress={() => setShift('all')} />
            {shifts.map((sh) => (
              <PillButton key={sh} label={sh} active={activeShift === sh} onPress={() => setShift(sh)} />
            ))}
          </ScrollView>
        ) : null}
        {data ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills} style={styles.bleed}>
            {STATUS_FILTERS.map((f) => (
              <PillButton key={f.value} label={f.label} active={statusFilter === f.value} onPress={() => setStatusFilter(f.value)} />
            ))}
          </ScrollView>
        ) : null}

        {!data || !s || waiting ? (
          loading ? (
            <PlaceholderCard height={150} />
          ) : null
        ) : (
          <FadeIn key={`${startDate}|${endDate}|${filter}|${activeShift}|${statusFilter}`} style={styles.stack}>
            <Text style={type.caption}>
              {formatDisplayDate(startDate)} – {formatDisplayDate(endDate)}
            </Text>
            <View style={styles.tiles}>
              <Tile label="Visits" value={String(s.totalBookings)} />
              <Tile label="Done" value={String(s.completedCount)} />
              <Tile label="Cancelled" value={String(s.cancelledCount)} />
            </View>
            <View style={styles.revenue}>
              <Text style={type.footnote}>Revenue</Text>
              <Text style={styles.revenueValue}>{rupees(s.totalRevenue)}</Text>
            </View>

            {breakdown.length > 1 ? (
              <>
                <SectionTitle title={role === 'DOCTOR' ? 'By clinic' : 'By doctor'} />
                <View style={styles.group}>
                  {breakdown.map((b, i) => (
                    <View key={b.id} style={[styles.row, i > 0 && styles.divider]}>
                      <Text style={[type.body, styles.flex]} numberOfLines={1}>
                        {b.name}
                      </Text>
                      <Text style={type.footnote}>{b.bookings} visits</Text>
                      <Text style={styles.money}>{rupees(b.revenue)}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}
          </FadeIn>
        )}

        <Notice tone="error" message={error} />
        <Button label="Share PDF" icon="share-outline" onPress={() => run('pdf')} loading={busy === 'pdf'} disabled={!data || loading || waiting} />
        <Button label="Share Excel" variant="secondary" icon="grid-outline" onPress={() => run('excel')} loading={busy === 'excel'} disabled={!data || loading || waiting} />
        <Button label="Print" variant="plain" icon="print-outline" onPress={() => run('print')} loading={busy === 'print'} disabled={!data || loading || waiting} />
      </View>
    </Sheet>
  );
}

function DateTile({ label, value, active, onPress }: { label: string; value: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.dateTile, active && styles.dateTileActive, pressed && { opacity: 0.7 }]}>
      <Text style={type.footnote}>{label}</Text>
      <Text style={styles.dateValue} numberOfLines={1}>
        {value}
      </Text>
    </Pressable>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={type.footnote}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  flex: { flex: 1, minWidth: 0 },
  bleed: { marginHorizontal: -space.lg, flexGrow: 0 },
  pills: { gap: space.sm, paddingHorizontal: space.lg },
  range: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dateTile: { flex: 1, backgroundColor: colors.card, borderRadius: radius.tile + 2, paddingVertical: space.sm + 2, paddingHorizontal: space.md, gap: 2, borderWidth: 1.5, borderColor: 'transparent', ...shadow.card },
  dateTileActive: { borderColor: colors.primary },
  dateValue: { fontSize: 16, fontWeight: '600', color: colors.ink },
  tiles: { flexDirection: 'row', gap: space.sm },
  tile: { flex: 1, backgroundColor: colors.card, borderRadius: radius.tile + 2, paddingVertical: space.md, paddingHorizontal: space.md, gap: 2, ...shadow.card },
  tileValue: { fontSize: 22, fontWeight: '600', letterSpacing: -0.4, color: colors.ink },
  revenue: { backgroundColor: colors.card, borderRadius: radius.tile + 2, padding: space.md, gap: 2, ...shadow.card },
  revenueValue: { fontSize: 28, fontWeight: '600', letterSpacing: -0.5, color: colors.ink },
  group: { backgroundColor: colors.card, borderRadius: radius.card, overflow: 'hidden', ...shadow.card },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  money: { fontSize: 15, fontWeight: '600', color: colors.ink, minWidth: 64, textAlign: 'right' },
});
