import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Printer,
  Download,
  Calendar,
  Filter,
  Users,
  Building2,
  DollarSign,
  CheckCircle2,
  Clock,
  Ban,
  FileText,
  Loader2,
  ChevronDown,
} from 'lucide-react';
import { BrandLogo } from '../ui/BrandLogo';
import { api, ClinicalReportData } from '../../services/api';

export type ReportRole = 'CLINIC' | 'DOCTOR' | 'RECEPTIONIST';

interface ClinicalReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: ReportRole;
  // Optional list of available doctors or clinics for dropdown filtering
  availableDoctors?: Array<{ doctorId?: string; id?: string; fullName?: string; name?: string; specialty?: string }>;
  availableClinics?: Array<{ clinicId?: string; id?: string; clinicName?: string; name?: string; city?: string }>;
  initialDoctorId?: string;
  initialClinicId?: string;
  clinicName?: string;
  doctorName?: string;
}

export const ClinicalReportModal: React.FC<ClinicalReportModalProps> = ({
  isOpen,
  onClose,
  role,
  availableDoctors = [],
  availableClinics = [],
  initialDoctorId,
  initialClinicId,
  clinicName,
  doctorName,
}) => {
  // Preset date helper
  const getDatesForPreset = (preset: '1_MONTH' | 'THIS_MONTH' | '7_DAYS') => {
    const now = new Date();
    const endStr = now.toISOString().split('T')[0];

    if (preset === '1_MONTH') {
      const start = new Date();
      start.setDate(now.getDate() - 30);
      return { start: start.toISOString().split('T')[0], end: endStr };
    }
    if (preset === 'THIS_MONTH') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: start.toISOString().split('T')[0], end: endStr };
    }
    // 7_DAYS
    const start = new Date();
    start.setDate(now.getDate() - 7);
    return { start: start.toISOString().split('T')[0], end: endStr };
  };

  const [datePreset, setDatePreset] = useState<'1_MONTH' | 'THIS_MONTH' | '7_DAYS' | 'CUSTOM'>('1_MONTH');
  const [startDate, setStartDate] = useState(() => getDatesForPreset('1_MONTH').start);
  const [endDate, setEndDate] = useState(() => getDatesForPreset('1_MONTH').end);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(initialDoctorId || 'all');
  const [selectedClinicId, setSelectedClinicId] = useState<string>(initialClinicId || 'all');
  const [shiftFilter, setShiftFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const [reportData, setReportData] = useState<ClinicalReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let data: ClinicalReportData;
      if (role === 'CLINIC') {
        data = await api.getClinicReport({
          startDate,
          endDate,
          doctorId: selectedDoctorId !== 'all' ? selectedDoctorId : undefined,
        });
      } else if (role === 'DOCTOR') {
        data = await api.getDoctorReport({
          startDate,
          endDate,
          clinicId: selectedClinicId !== 'all' ? selectedClinicId : undefined,
        });
      } else {
        data = await api.getReceptionistReport({
          startDate,
          endDate,
          doctorId: selectedDoctorId !== 'all' ? selectedDoctorId : undefined,
        });
      }
      setReportData(data);
    } catch (err: any) {
      console.error('Failed to load report:', err);
      setError(err.message || 'Failed to generate report for selected criteria.');
    } finally {
      setLoading(false);
    }
  }, [role, startDate, endDate, selectedDoctorId, selectedClinicId]);

  useEffect(() => {
    if (isOpen) {
      fetchReport();
    }
  }, [isOpen, fetchReport]);

  const handlePresetChange = (preset: '1_MONTH' | 'THIS_MONTH' | '7_DAYS' | 'CUSTOM') => {
    setDatePreset(preset);
    if (preset !== 'CUSTOM') {
      const { start, end } = getDatesForPreset(preset);
      setStartDate(start);
      setEndDate(end);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Export as CSV
  const handleExportCsv = () => {
    if (!reportData || !reportData.appointments.length) return;

    const headers = [
      'Token Number',
      'Date',
      'Shift',
      'Patient Name',
      'Patient Phone',
      'Practitioner',
      'Specialty',
      'Facility',
      'Status',
      'Fee (INR)',
      'Earned Revenue (INR)',
    ];

    const rows = filteredAppointments.map((appt) => [
      `#${appt.queueNumber}`,
      appt.appointmentDate,
      appt.checkingWindow,
      `"${appt.patientName.replace(/"/g, '""')}"`,
      `"${appt.patientPhone}"`,
      `"${(appt.doctorName || doctorName || 'Doctor').replace(/"/g, '""')}"`,
      `"${(appt.specialty || '').replace(/"/g, '""')}"`,
      `"${(appt.clinicName || clinicName || 'Clinic').replace(/"/g, '""')}"`,
      appt.status,
      appt.fee,
      appt.earnedRevenue,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `MediArca_Report_${role}_${startDate}_to_${endDate}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Client-side filtering for shift and status
  const filteredAppointments = useMemo(() => {
    if (!reportData) return [];
    return reportData.appointments.filter((appt) => {
      if (shiftFilter !== 'ALL' && appt.checkingWindow !== shiftFilter) return false;
      if (statusFilter !== 'ALL' && appt.status !== statusFilter) return false;
      return true;
    });
  }, [reportData, shiftFilter, statusFilter]);

  // Dynamic available shifts from returned appointments
  const availableShifts = useMemo(() => {
    if (!reportData) return [];
    const set = new Set<string>();
    reportData.appointments.forEach((a) => {
      if (a.checkingWindow) set.add(a.checkingWindow);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [reportData]);

  // Filtered summary calculations
  const filteredSummary = useMemo(() => {
    if (!reportData) {
      return { total: 0, completed: 0, waiting: 0, cancelled: 0, revenue: 0 };
    }
    let completed = 0;
    let waiting = 0;
    let cancelled = 0;
    let revenue = 0;

    filteredAppointments.forEach((a) => {
      if (a.status === 'COMPLETED') completed++;
      else if (a.status === 'WAITING' || a.status === 'IN_CONSULTATION' || a.status === 'PENDING_APPROVAL') waiting++;
      else if (['CANCELLED', 'REJECTED', 'EXPIRED'].includes(a.status)) cancelled++;
      revenue += a.earnedRevenue;
    });

    return {
      total: filteredAppointments.length,
      completed,
      waiting,
      cancelled,
      revenue,
    };
  }, [reportData, filteredAppointments]);

  if (!isOpen) return null;

  const headerTitle =
    role === 'CLINIC'
      ? `${reportData?.facility?.name || clinicName || 'Clinic'} — Clinical & Revenue Audit`
      : role === 'DOCTOR'
      ? `${reportData?.doctor?.name || doctorName || 'Doctor'} — Practice & Revenue Audit`
      : `${reportData?.facility?.name || clinicName || 'Desk'} — Front Desk Audit Report`;

  const reportSubtitle = `Reporting Period: ${startDate} to ${endDate} (Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })})`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/40 backdrop-blur-xl animate-fadeIn">
      <div className="relative w-full max-w-5xl h-[94vh] flex flex-col bg-white rounded-[28px] border border-[#e5e5ea] shadow-[0_24px_64px_rgba(0,0,0,0.14),0_4px_16px_rgba(0,0,0,0.04)] overflow-hidden print:border-none print:shadow-none print:h-auto print:max-h-none print:p-0 print:m-0 print:overflow-visible">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0f0f2] bg-white shrink-0 print:border-b-2 print:border-[#1d1d1f] print:pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0066cc]/10 border border-[#0066cc]/20 flex items-center justify-center text-[#0066cc] print:hidden shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="hidden print:block mb-2">
                <BrandLogo variant="full" size="sm" />
              </div>
              <h2 className="text-[17px] sm:text-[20px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">
                {headerTitle}
              </h2>
              <p className="text-xs text-[#86868b] mt-0.5 print:text-[#1d1d1f]">
                {reportSubtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={loading || !reportData || reportData.appointments.length === 0}
              title="Download raw spreadsheet data (.csv)"
              className="h-9 px-3.5 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] text-xs font-medium text-[#1d1d1f] border border-[#e5e5ea] transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5 text-[#86868b]" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              disabled={loading || !reportData}
              title="Print or Save official PDF Report"
              className="h-9 px-4 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-xs font-semibold text-white transition-all duration-150 flex items-center gap-1.5 cursor-pointer shadow-[0_2px_8px_rgba(0,102,204,0.2)] disabled:opacity-40"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#86868b] hover:text-[#1d1d1f] flex items-center justify-center transition-all cursor-pointer ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Controls Strip (Hidden on Print) */}
        <div className="px-6 py-3.5 bg-[#f5f5f7]/70 border-b border-[#e5e5ea] print:hidden shrink-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Quick Period Presets */}
            <div className="inline-flex p-1 rounded-full bg-[#e8e8ed] border border-[#e5e5ea] text-xs font-medium">
              <button
                type="button"
                onClick={() => handlePresetChange('1_MONTH')}
                className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                  datePreset === '1_MONTH'
                    ? 'bg-white text-[#1d1d1f] font-semibold shadow-xs'
                    : 'text-[#86868b] hover:text-[#1d1d1f]'
                }`}
              >
                Previous 1 Month
              </button>
              <button
                type="button"
                onClick={() => handlePresetChange('THIS_MONTH')}
                className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                  datePreset === 'THIS_MONTH'
                    ? 'bg-white text-[#1d1d1f] font-semibold shadow-xs'
                    : 'text-[#86868b] hover:text-[#1d1d1f]'
                }`}
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => handlePresetChange('7_DAYS')}
                className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                  datePreset === '7_DAYS'
                    ? 'bg-white text-[#1d1d1f] font-semibold shadow-xs'
                    : 'text-[#86868b] hover:text-[#1d1d1f]'
                }`}
              >
                Last 7 Days
              </button>
              <button
                type="button"
                onClick={() => handlePresetChange('CUSTOM')}
                className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                  datePreset === 'CUSTOM'
                    ? 'bg-white text-[#1d1d1f] font-semibold shadow-xs'
                    : 'text-[#86868b] hover:text-[#1d1d1f]'
                }`}
              >
                Custom Range
              </button>
            </div>

            {/* Custom Date Pickers */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-[#86868b]">
                <Calendar className="w-3.5 h-3.5" />
                <span>From</span>
              </div>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setDatePreset('CUSTOM');
                  setStartDate(e.target.value);
                }}
                className="h-8 px-2.5 rounded-lg border border-[#d2d2d7] bg-white text-xs text-[#1d1d1f] focus:outline-none focus:border-[#0066cc]"
              />
              <span className="text-xs text-[#86868b]">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setDatePreset('CUSTOM');
                  setEndDate(e.target.value);
                }}
                className="h-8 px-2.5 rounded-lg border border-[#d2d2d7] bg-white text-xs text-[#1d1d1f] focus:outline-none focus:border-[#0066cc]"
              />
            </div>
          </div>

          {/* Categorized Dropdown Filters */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            {/* Doctor filter (Clinic / Receptionist) */}
            {(role === 'CLINIC' || role === 'RECEPTIONIST') && (
              <div className="relative">
                <select
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                  className="h-8 pl-3 pr-7 rounded-lg border border-[#d2d2d7] text-xs font-medium bg-white text-[#1d1d1f] appearance-none cursor-pointer focus:outline-none focus:border-[#0066cc]"
                >
                  <option value="all">All Affiliated Practitioners</option>
                  {availableDoctors.map((doc, idx) => {
                    const id = doc.doctorId || doc.id || `doc-${idx}`;
                    const name = doc.fullName || doc.name || 'Practitioner';
                    return (
                      <option key={id} value={id}>
                        {name} {doc.specialty ? `— ${doc.specialty}` : ''}
                      </option>
                    );
                  })}
                </select>
                <ChevronDown className="w-3 h-3 text-[#86868b] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}

            {/* Clinic filter (Doctor) */}
            {role === 'DOCTOR' && (
              <div className="relative">
                <select
                  value={selectedClinicId}
                  onChange={(e) => setSelectedClinicId(e.target.value)}
                  className="h-8 pl-3 pr-7 rounded-lg border border-[#d2d2d7] text-xs font-medium bg-white text-[#1d1d1f] appearance-none cursor-pointer focus:outline-none focus:border-[#0066cc]"
                >
                  <option value="all">All Affiliated Clinics</option>
                  {availableClinics.map((c, idx) => {
                    const id = c.clinicId || c.id || `clinic-${idx}`;
                    const name = c.clinicName || c.name || 'Clinic';
                    return (
                      <option key={id} value={id}>
                        {name} {c.city ? `(${c.city})` : ''}
                      </option>
                    );
                  })}
                </select>
                <ChevronDown className="w-3 h-3 text-[#86868b] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}

            {/* Shift Filter */}
            {availableShifts.length > 0 && (
              <div className="relative">
                <select
                  value={shiftFilter}
                  onChange={(e) => setShiftFilter(e.target.value)}
                  className="h-8 pl-3 pr-7 rounded-lg border border-[#d2d2d7] text-xs font-medium bg-white text-[#1d1d1f] appearance-none cursor-pointer focus:outline-none focus:border-[#0066cc]"
                >
                  <option value="ALL">All Shifts</option>
                  {availableShifts.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-[#86868b] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}

            {/* Status Filter */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-8 pl-3 pr-7 rounded-lg border border-[#d2d2d7] text-xs font-medium bg-white text-[#1d1d1f] appearance-none cursor-pointer focus:outline-none focus:border-[#0066cc]"
              >
                <option value="ALL">All Visit Statuses</option>
                <option value="COMPLETED">Completed Consultations</option>
                <option value="WAITING">Waiting Queue</option>
                <option value="IN_CONSULTATION">In Consultation</option>
                <option value="CANCELLED">Cancelled / Declined</option>
              </select>
              <ChevronDown className="w-3 h-3 text-[#86868b] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Regenerate CTA */}
            <button
              type="button"
              onClick={fetchReport}
              disabled={loading}
              className="h-8 px-3 rounded-lg bg-[#1d1d1f] hover:bg-[#333336] text-white text-xs font-medium transition-all cursor-pointer ml-auto flex items-center gap-1.5"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Filter className="w-3 h-3" />}
              <span>Apply Filters</span>
            </button>
          </div>
        </div>

        {/* Scrollable Report Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 print:overflow-visible print:p-0 print:space-y-5">
          {loading && !reportData ? (
            <div className="py-24 text-center">
              <Loader2 className="w-8 h-8 text-[#0066cc] animate-spin mx-auto mb-3" />
              <p className="text-sm font-semibold text-[#1d1d1f]">Compiling Clinical Audit Report...</p>
              <p className="text-xs text-[#86868b] mt-1">Analyzing appointments, consultations, and revenue</p>
            </div>
          ) : error ? (
            <div className="py-16 text-center">
              <p className="text-sm font-semibold text-rose-600">{error}</p>
              <button
                type="button"
                onClick={fetchReport}
                className="mt-3 h-8 px-4 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] text-xs font-medium text-[#1d1d1f] hover:bg-[#e8e8ed] cursor-pointer"
              >
                Try Again
              </button>
            </div>
          ) : (
            <>
              {/* 1. Summary Cards Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 print:grid-cols-4 print:gap-3">
                <div className="p-4 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] print:bg-white print:border print:border-[#d2d2d7]">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-[#86868b]">
                    <Users className="w-3.5 h-3.5 text-[#0066cc]" />
                    <span>Total Bookings</span>
                  </div>
                  <div className="text-2xl sm:text-3xl font-semibold text-[#1d1d1f] mt-1.5 tracking-tight">
                    {filteredSummary.total}
                  </div>
                  <div className="text-[11px] text-[#86868b] mt-0.5">
                    Appointments booked
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] print:bg-white print:border print:border-[#d2d2d7]">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-[#86868b]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Completed</span>
                  </div>
                  <div className="text-2xl sm:text-3xl font-semibold text-emerald-600 mt-1.5 tracking-tight">
                    {filteredSummary.completed}
                  </div>
                  <div className="text-[11px] text-[#86868b] mt-0.5">
                    {filteredSummary.total > 0
                      ? `${Math.round((filteredSummary.completed / filteredSummary.total) * 100)}% completion rate`
                      : '0% completion'}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] print:bg-white print:border print:border-[#d2d2d7]">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-[#86868b]">
                    <Ban className="w-3.5 h-3.5 text-rose-500" />
                    <span>Cancelled</span>
                  </div>
                  <div className="text-2xl sm:text-3xl font-semibold text-[#1d1d1f] mt-1.5 tracking-tight">
                    {filteredSummary.cancelled}
                  </div>
                  <div className="text-[11px] text-[#86868b] mt-0.5">
                    No-shows or cancelled
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] print:bg-white print:border print:border-[#d2d2d7]">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-[#86868b]">
                    <DollarSign className="w-3.5 h-3.5 text-[#0066cc]" />
                    <span>Total Revenue</span>
                  </div>
                  <div className="text-2xl sm:text-3xl font-semibold text-[#0066cc] mt-1.5 tracking-tight">
                    ₹{filteredSummary.revenue.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[11px] text-[#86868b] mt-0.5">
                    Completed & paid visits
                  </div>
                </div>
              </div>

              {/* 2. Categorized Breakdowns */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 print:grid-cols-2">
                {/* Doctor Breakdown (for Clinic / Receptionist) OR Clinic Breakdown (for Doctor) */}
                {reportData?.byDoctor && reportData.byDoctor.length > 0 && (
                  <div className="p-4 rounded-2xl bg-white border border-[#e5e5ea] shadow-xs">
                    <h3 className="text-xs font-semibold text-[#1d1d1f] tracking-tight uppercase mb-3 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-[#0066cc]" />
                      <span>Practitioner Breakdown</span>
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-[#e5e5ea] text-[#86868b] pb-2 font-medium">
                            <th className="pb-2">Doctor</th>
                            <th className="pb-2 text-center">Bookings</th>
                            <th className="pb-2 text-center">Completed</th>
                            <th className="pb-2 text-right">Revenue</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f0f0f2]">
                          {reportData.byDoctor.map((d) => (
                            <tr key={d.doctorId} className="hover:bg-[#f5f5f7]/60">
                              <td className="py-2.5">
                                <div className="font-semibold text-[#1d1d1f]">{d.doctorName}</div>
                                <div className="text-[11px] text-[#86868b]">{d.specialty}</div>
                              </td>
                              <td className="py-2.5 text-center font-medium text-[#1d1d1f]">{d.bookings}</td>
                              <td className="py-2.5 text-center text-emerald-600 font-medium">{d.completed}</td>
                              <td className="py-2.5 text-right font-semibold text-[#1d1d1f]">
                                ₹{d.revenue.toLocaleString('en-IN')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {reportData?.byClinic && reportData.byClinic.length > 0 && (
                  <div className="p-4 rounded-2xl bg-white border border-[#e5e5ea] shadow-xs">
                    <h3 className="text-xs font-semibold text-[#1d1d1f] tracking-tight uppercase mb-3 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-[#0066cc]" />
                      <span>Facility Breakdown</span>
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-[#e5e5ea] text-[#86868b] pb-2 font-medium">
                            <th className="pb-2">Clinic</th>
                            <th className="pb-2 text-center">Bookings</th>
                            <th className="pb-2 text-center">Completed</th>
                            <th className="pb-2 text-right">Revenue</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f0f0f2]">
                          {reportData.byClinic.map((c) => (
                            <tr key={c.clinicId} className="hover:bg-[#f5f5f7]/60">
                              <td className="py-2.5">
                                <div className="font-semibold text-[#1d1d1f]">{c.clinicName}</div>
                                <div className="text-[11px] text-[#86868b]">{c.city}</div>
                              </td>
                              <td className="py-2.5 text-center font-medium text-[#1d1d1f]">{c.bookings}</td>
                              <td className="py-2.5 text-center text-emerald-600 font-medium">{c.completed}</td>
                              <td className="py-2.5 text-right font-semibold text-[#1d1d1f]">
                                ₹{c.revenue.toLocaleString('en-IN')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Shift Breakdown */}
                {reportData?.byShift && reportData.byShift.length > 0 && (
                  <div className="p-4 rounded-2xl bg-white border border-[#e5e5ea] shadow-xs">
                    <h3 className="text-xs font-semibold text-[#1d1d1f] tracking-tight uppercase mb-3 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#0066cc]" />
                      <span>Shift Breakdown</span>
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-[#e5e5ea] text-[#86868b] pb-2 font-medium">
                            <th className="pb-2">Shift</th>
                            <th className="pb-2 text-center">Bookings</th>
                            <th className="pb-2 text-center">Completed</th>
                            <th className="pb-2 text-right">Revenue</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f0f0f2]">
                          {reportData.byShift.map((s) => (
                            <tr key={s.shiftName} className="hover:bg-[#f5f5f7]/60">
                              <td className="py-2.5 font-semibold text-[#1d1d1f]">{s.shiftName}</td>
                              <td className="py-2.5 text-center font-medium text-[#1d1d1f]">{s.bookings}</td>
                              <td className="py-2.5 text-center text-emerald-600 font-medium">{s.completed}</td>
                              <td className="py-2.5 text-right font-semibold text-[#1d1d1f]">
                                ₹{s.revenue.toLocaleString('en-IN')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Detailed Itemized Consultations Register */}
              <div className="p-4 rounded-2xl bg-white border border-[#e5e5ea] shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-[#1d1d1f] tracking-tight uppercase flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#0066cc]" />
                    <span>Itemized Consultation Register ({filteredAppointments.length} Visits)</span>
                  </h3>
                  <span className="text-[11px] text-[#86868b]">
                    Sorted by consultation date
                  </span>
                </div>

                {filteredAppointments.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#86868b]">
                    No appointments match the selected date range and filters.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#e5e5ea] text-[#86868b] pb-2.5 font-medium">
                          <th className="pb-2.5 pl-2">Token #</th>
                          <th className="pb-2.5">Date & Shift</th>
                          <th className="pb-2.5">Patient Details</th>
                          {role !== 'DOCTOR' && <th className="pb-2.5">Doctor</th>}
                          {role === 'DOCTOR' && <th className="pb-2.5">Facility</th>}
                          <th className="pb-2.5">Status</th>
                          <th className="pb-2.5 text-right pr-2">Fee / Revenue</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f0f0f2]">
                        {filteredAppointments.map((appt) => (
                          <tr key={appt.id} className="hover:bg-[#f5f5f7]/60">
                            <td className="py-3 pl-2 font-semibold text-[#0066cc]">
                              #{appt.queueNumber}
                            </td>
                            <td className="py-3">
                              <div className="font-semibold text-[#1d1d1f]">{appt.appointmentDate}</div>
                              <div className="text-[11px] text-[#86868b]">{appt.checkingWindow}</div>
                            </td>
                            <td className="py-3">
                              <div className="font-semibold text-[#1d1d1f]">{appt.patientName}</div>
                              <div className="text-[11px] text-[#86868b]">{appt.patientPhone}</div>
                            </td>
                            {role !== 'DOCTOR' && (
                              <td className="py-3">
                                <div className="font-medium text-[#1d1d1f]">{appt.doctorName}</div>
                                <div className="text-[11px] text-[#86868b]">{appt.specialty}</div>
                              </td>
                            )}
                            {role === 'DOCTOR' && (
                              <td className="py-3">
                                <div className="font-medium text-[#1d1d1f]">{appt.clinicName}</div>
                              </td>
                            )}
                            <td className="py-3">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                                  appt.status === 'COMPLETED'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : appt.status === 'IN_CONSULTATION'
                                    ? 'bg-[#0066cc]/10 text-[#0066cc]'
                                    : ['CANCELLED', 'REJECTED', 'EXPIRED'].includes(appt.status)
                                    ? 'bg-rose-50 text-rose-600 border border-rose-200'
                                    : 'bg-[#f5f5f7] text-[#1d1d1f] border border-[#e5e5ea]'
                                }`}
                              >
                                {appt.status === 'IN_CONSULTATION' ? 'In Cabin' : appt.status}
                              </span>
                            </td>
                            <td className="py-3 text-right pr-2">
                              <div className="font-semibold text-[#1d1d1f]">₹{appt.fee}</div>
                              <div className="text-[11px] text-[#86868b]">
                                {appt.earnedRevenue > 0 ? (
                                  <span className="text-emerald-600 font-medium">Earned ₹{appt.earnedRevenue}</span>
                                ) : (
                                  'Unpaid/Cancelled'
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Print Footer / Verification Seal (Visible on Print) */}
              <div className="hidden print:block pt-6 border-t-2 border-[#1d1d1f] mt-8 text-xs text-[#86868b] space-y-1">
                <div className="flex justify-between items-center text-[#1d1d1f] font-semibold">
                  <span>MediArca Outpatient Clinical Network</span>
                  <span>Computer-Generated Audit Statement</span>
                </div>
                <p>
                  This official document records all consultation bookings and isolated revenues during the reporting window. Verified by MediArca clinical timestamp service.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
