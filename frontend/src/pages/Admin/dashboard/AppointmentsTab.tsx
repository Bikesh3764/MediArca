import React from 'react';
import { UtilityCard } from '../../../components/ui/UtilityCard';
import { Calendar, X, Building2, Filter, Search, Eye, RotateCcw, ChevronDown } from 'lucide-react';
import { EmptyState } from '../../../components/common/EmptyState';
import { useAdminDashboard } from './state';
export const AppointmentsTab: React.FC = () => {
  const {
    appointments,
    bookingDateFilter,
    setBookingDateFilter,
    bookingCustomDate,
    setBookingCustomDate,
    bookingClinicFilter,
    setBookingClinicFilter,
    bookingStatusFilter,
    setBookingStatusFilter,
    bookingSearchQuery,
    setBookingSearchQuery,
    bookingViewMode,
    setBookingViewMode,
    setSelectedAppointment,
    todayStr,
    tomorrowStr,
    resolveClinic,
    formatDisplayDate,
    getDateBadge,
    renderAppointmentStatusBadge,
    handleResetBookingFilters,
    isAnyBookingFilterActive,
    clinicFilterOptions,
    filteredAppointments,
    appointmentsByDate,
    appointmentsByClinic,
  } = useAdminDashboard();
  return (
<div className="space-y-5">
                <UtilityCard>
                  {/* Header & View Mode Switcher */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[#e5e5ea]">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-[20px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">Platform Bookings & Queue Oversight</h3>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f]">
                          {filteredAppointments.length} of {appointments.length} Total
                        </span>
                        {appointments.length >= 250 && (
                          <span className="text-[11px] text-[#86868b] hidden sm:inline">
                            (Loaded 250 most recent records)
                          </span>
                        )}
                      </div>
                      <p className="text-[13px] text-[#86868b] mt-1 leading-relaxed">
                        All bookings by date and clinic.
                      </p>
                    </div>

                    {/* View Mode Segmented Controls */}
                    <div className="inline-flex items-center p-1 bg-[#e8e8ed]/70 rounded-full border border-[#e5e5ea] self-start lg:self-auto">
                      <button
                        type="button"
                        onClick={() => setBookingViewMode('table')}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-normal flex items-center gap-1.5 transition-all cursor-pointer ${
                          bookingViewMode === 'table'
                            ? 'bg-white text-[#1d1d1f]  font-semibold'
                            : 'text-[#86868b] hover:text-[#1d1d1f]'
                        }`}
                        title="View flat table of all matching bookings"
                      >
                        <span>All Records</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setBookingViewMode('by-date')}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-normal flex items-center gap-1.5 transition-all cursor-pointer ${
                          bookingViewMode === 'by-date'
                            ? 'bg-white text-[#1d1d1f]  font-semibold'
                            : 'text-[#86868b] hover:text-[#1d1d1f]'
                        }`}
                        title="Group bookings chronologically by date"
                      >
                        <span>By Date</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setBookingViewMode('by-clinic')}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-normal flex items-center gap-1.5 transition-all cursor-pointer ${
                          bookingViewMode === 'by-clinic'
                            ? 'bg-white text-[#1d1d1f]  font-semibold'
                            : 'text-[#86868b] hover:text-[#1d1d1f]'
                        }`}
                        title="Group bookings by clinic facility"
                      >
                        <span>By Clinic</span>
                      </button>
                    </div>
                  </div>

                  {/* Summary Metric Counters Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3 my-5">
                    <div className="p-3 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-center">
                      <span className="text-xs font-normal text-[#86868b] block">Total Shown</span>
                      <strong className="text-lg font-semibold text-[#1d1d1f] mt-0.5 block">{filteredAppointments.length}</strong>
                    </div>

                    <div className="p-3 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-center">
                      <span className="text-xs font-normal text-[#86868b] block">Today's Visits</span>
                      <strong className="text-lg font-semibold text-[#0066cc] mt-0.5 block">
                        {filteredAppointments.filter((a) => a.appointmentDate === todayStr).length}
                      </strong>
                    </div>

                    <div className="p-3 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-center">
                      <span className="text-xs font-normal text-[#86868b] block">Waiting</span>
                      <strong className="text-lg font-semibold text-[#1d1d1f] mt-0.5 block">
                        {filteredAppointments.filter((a) => (a.status || '').toUpperCase() === 'WAITING').length}
                      </strong>
                    </div>

                    <div className="p-3 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-center">
                      <span className="text-xs font-normal text-[#86868b] block">In Cabin</span>
                      <strong className="text-lg font-semibold text-[#0066cc] mt-0.5 block">
                        {filteredAppointments.filter((a) => (a.status || '').toUpperCase() === 'IN_CONSULTATION').length}
                      </strong>
                    </div>

                    <div className="p-3 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-center">
                      <span className="text-xs font-normal text-[#86868b] block">Completed</span>
                      <strong className="text-lg font-semibold text-[#1d1d1f] mt-0.5 block">
                        {filteredAppointments.filter((a) => (a.status || '').toUpperCase() === 'COMPLETED').length}
                      </strong>
                    </div>

                    <div className="p-3 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-center">
                      <span className="text-xs font-normal text-[#86868b] block">Cancelled/Off</span>
                      <strong className="text-lg font-semibold text-danger mt-0.5 block">
                        {filteredAppointments.filter((a) => ['CANCELLED', 'EXPIRED'].includes((a.status || '').toUpperCase())).length}
                      </strong>
                    </div>
                  </div>

                  {/* Interactive Filter Control Panel (Date, Clinic, Status, Search) */}
                  <div className="p-4 rounded-2xl bg-[#f5f5f7]/60 border border-[#e5e5ea] space-y-3.5">
                    <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
                      {/* Search Bar */}
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 text-[#86868b] absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={bookingSearchQuery}
                          onChange={(e) => setBookingSearchQuery(e.target.value)}
                          placeholder="Search patient, practitioner, clinic, token #..."
                          className="w-full h-11 pl-10 pr-8 rounded-xl bg-white border border-[#d2d2d7] text-base sm:text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6]  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-150"
                        />
                        {bookingSearchQuery && (
                          <button aria-label="Close"
                            type="button"
                            onClick={() => setBookingSearchQuery('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#86868b] hover:text-[#1d1d1f]"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Clinic Filter Selector */}
                      <div className="flex items-center gap-2">
                        <div className="relative min-w-[200px]">
                          <select
                            value={bookingClinicFilter}
                            onChange={(e) => setBookingClinicFilter(e.target.value)}
                            aria-label="Filter bookings by clinic facility"
                            className="w-full h-11 appearance-none pl-9 pr-8 rounded-xl bg-white border border-[#d2d2d7] text-base sm:text-sm text-[#1d1d1f] font-normal  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 cursor-pointer transition-all duration-150"
                          >
                            <option value="ALL">All Clinics ({appointments.length})</option>
                            {clinicFilterOptions.map((c) => (
                              <option key={c.id} value={c.name}>
                                {c.name} ({c.count})
                              </option>
                            ))}
                          </select>
                          <Building2 className="w-4 h-4 text-[#86868b] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <ChevronDown className="w-4 h-4 text-[#86868b] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>

                        {/* Status Filter Selector */}
                        <div className="relative min-w-[150px]">
                          <select
                            value={bookingStatusFilter}
                            onChange={(e) => setBookingStatusFilter(e.target.value)}
                            aria-label="Filter bookings by consultation status"
                            className="w-full h-11 appearance-none pl-9 pr-8 rounded-xl bg-white border border-[#d2d2d7] text-base sm:text-sm text-[#1d1d1f] font-normal  focus:outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 cursor-pointer transition-all duration-150"
                          >
                            <option value="ALL">All Statuses</option>
                            <option value="WAITING">Waiting</option>
                            <option value="IN_CONSULTATION">In Consultation</option>
                            <option value="COMPLETED">Completed</option>
                            <option value="CANCELLED">Cancelled</option>
                            <option value="EXPIRED">Expired</option>
                            <option value="PENDING_APPROVAL">Pending Approval</option>
                          </select>
                          <Filter className="w-4 h-4 text-[#86868b] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <ChevronDown className="w-4 h-4 text-[#86868b] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </div>
                    </div>

                    {/* Date Quick Filter Segmented Control + Custom Date Picker */}
                    <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-[#e5e5ea]">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex items-center p-1 bg-white rounded-full border border-[#e5e5ea]">
                          <button
                            type="button"
                            onClick={() => {
                              setBookingDateFilter('ALL');
                              setBookingCustomDate('');
                            }}
                            className={`h-8 px-3 rounded-full text-xs transition-all cursor-pointer ${
                              bookingDateFilter === 'ALL'
                                ? 'bg-[#f5f5f7] text-[#1d1d1f] font-semibold  border border-black/5'
                                : 'text-[#86868b] hover:text-[#1d1d1f] font-normal'
                            }`}
                          >
                            All Dates
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setBookingDateFilter('TODAY');
                              setBookingCustomDate('');
                            }}
                            className={`h-8 px-3 rounded-full text-xs transition-all cursor-pointer ${
                              bookingDateFilter === 'TODAY'
                                ? 'bg-[#f5f5f7] text-[#1d1d1f] font-semibold  border border-black/5'
                                : 'text-[#86868b] hover:text-[#1d1d1f] font-normal'
                            }`}
                          >
                            Today ({appointments.filter((a) => a.appointmentDate === todayStr).length})
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setBookingDateFilter('TOMORROW');
                              setBookingCustomDate('');
                            }}
                            className={`h-8 px-3 rounded-full text-xs transition-all cursor-pointer ${
                              bookingDateFilter === 'TOMORROW'
                                ? 'bg-[#f5f5f7] text-[#1d1d1f] font-semibold  border border-black/5'
                                : 'text-[#86868b] hover:text-[#1d1d1f] font-normal'
                            }`}
                          >
                            Tomorrow ({appointments.filter((a) => a.appointmentDate === tomorrowStr).length})
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setBookingDateFilter('PAST');
                              setBookingCustomDate('');
                            }}
                            className={`h-8 px-3 rounded-full text-xs transition-all cursor-pointer ${
                              bookingDateFilter === 'PAST'
                                ? 'bg-[#f5f5f7] text-[#1d1d1f] font-semibold  border border-black/5'
                                : 'text-[#86868b] hover:text-[#1d1d1f] font-normal'
                            }`}
                          >
                            Past History
                          </button>
                        </div>

                        {/* Custom Date Input */}
                        <div className="inline-flex items-center gap-1.5 h-10 px-3 rounded-full bg-white border border-[#e5e5ea]">
                          <Calendar className="w-3.5 h-3.5 text-[#86868b]" />
                          <input
                            type="date"
                            value={bookingCustomDate}
                            onChange={(e) => {
                              const val = e.target.value;
                              setBookingCustomDate(val);
                              setBookingDateFilter(val ? 'CUSTOM' : 'ALL');
                            }}
                            className={`text-base sm:text-xs bg-transparent focus:outline-none cursor-pointer ${
                              bookingDateFilter === 'CUSTOM'
                                ? 'text-[#0066cc] font-semibold'
                                : 'text-[#1d1d1f] font-normal'
                            }`}
                          />
                        </div>
                      </div>

                      {/* Reset Filters CTA */}
                      {isAnyBookingFilterActive && (
                        <button
                          type="button"
                          onClick={handleResetBookingFilters}
                          className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full text-xs font-semibold text-danger bg-danger-soft hover:bg-danger-soft border border-danger-line transition-all cursor-pointer active:scale-95"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Reset Filters</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Empty State */}
                  {filteredAppointments.length === 0 && (
                    <EmptyState
                      icon={Calendar}
                      title="No Bookings Found"
                      description={`No appointments match your active date (${bookingDateFilter !== 'ALL' ? bookingDateFilter : 'selected'}), clinic, or search filter.`}
                      actionText="Clear All Filters"
                      onAction={handleResetBookingFilters}
                    />
                  )}

                  {/* MODE 1: ALL RECORDS FLAT TABLE */}
                  {bookingViewMode === 'table' && filteredAppointments.length > 0 && (
                    <div className="overflow-x-auto mt-5">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-[#e5e5ea] text-[#86868b] font-semibold">
                          <tr>
                            <th className="py-3 px-3">Date</th>
                            <th className="py-3 px-3">Queue Token</th>
                            <th className="py-3 px-3">Patient</th>
                            <th className="py-3 px-3">Practitioner</th>
                            <th className="py-3 px-3">Clinic / Facility</th>
                            <th className="py-3 px-3">Status</th>
                            <th className="py-3 px-3">Est. Time</th>
                            <th className="py-3 px-3 text-right">Details</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f0f0f0]">
                          {filteredAppointments.map((appt) => {
                            const clinicInfo = resolveClinic(appt);
                            return (
                              <tr key={appt.id} className="hover:bg-[#f5f5f7]/60 transition-colors">
                                <td className="py-3 px-3">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-semibold text-[#1d1d1f]">{appt.appointmentDate}</span>
                                    {getDateBadge(appt.appointmentDate)}
                                  </div>
                                </td>
                                <td className="py-3 px-3 font-bold text-[#0066cc]">Queue #{appt.queueNumber}</td>
                                <td className="py-3 px-3">
                                  <div>
                                    <span className="font-normal text-[#1d1d1f]">
                                      {appt.patient?.user?.fullName || appt.patientName || 'Unknown Patient'}
                                    </span>
                                    {appt.isForOther && appt.patientName && (
                                      <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[11px] font-normal bg-[#f5f5f7] text-[#86868b] border border-[#e5e5ea]">
                                        Family
                                      </span>
                                    )}
                                    <span className="text-[11px] text-[#86868b] block mt-0.5">
                                      {appt.patientPhone || appt.patient?.user?.phone || appt.patient?.user?.email || 'Walk-in'}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-3 px-3">
                                  <div>
                                    <span className="font-normal text-[#1d1d1f]">{appt.doctor?.user?.fullName || 'Practitioner'}</span>
                                    <span className="text-[11px] text-[#0066cc] block mt-0.5">
                                      {appt.doctor?.specialty || 'Specialist'}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-3 px-3">
                                  <div className="flex items-start gap-1.5">
                                    <Building2 className="w-3.5 h-3.5 text-[#0066cc] shrink-0 mt-0.5" />
                                    <div>
                                      <span className="font-normal text-[#1d1d1f]">{clinicInfo.name}</span>
                                      {clinicInfo.city && (
                                        <span className="text-[11px] text-[#86868b] block mt-0.5">
                                          {clinicInfo.city}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 px-3">{renderAppointmentStatusBadge(appt.status)}</td>
                                <td className="py-3 px-3 text-[#86868b] font-normal">{appt.estimatedTime || 'N/A'}</td>
                                <td className="py-3 px-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedAppointment(appt)}
                                    className="p-1.5 rounded-full hover:bg-white text-[#0066cc] hover:text-[#0055b3] border border-transparent hover:border-[#e5e5ea] transition-all cursor-pointer"
                                    title="Inspect Booking Details"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* MODE 2: GROUPED BY DATE */}
                  {bookingViewMode === 'by-date' && filteredAppointments.length > 0 && (
                    <div className="space-y-6 mt-6">
                      {appointmentsByDate.map(([dateStr, items]) => {
                        const waitingCount = items.filter((i) => (i.status || '').toUpperCase() === 'WAITING').length;
                        const completedCount = items.filter((i) => (i.status || '').toUpperCase() === 'COMPLETED').length;

                        return (
                          <div
                            key={dateStr}
                            className="bg-white rounded-2xl border border-[#e5e5ea] overflow-hidden "
                          >
                            {/* Date Group Header */}
                            <div className="px-4 py-3.5 bg-[#f5f5f7]/60 border-b border-[#e5e5ea] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-semibold text-[#1d1d1f]">{formatDisplayDate(dateStr)}</h4>
                                  {getDateBadge(dateStr)}
                                  <span className="text-xs text-[#86868b]">({dateStr})</span>
                                </div>
                                <p className="text-[11px] text-[#86868b] mt-0.5">
                                  {items.length} booking{items.length !== 1 ? 's' : ''} scheduled • {waitingCount} waiting • {completedCount} completed
                                </p>
                              </div>

                              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white border border-[#e5e5ea] text-[#1d1d1f] self-start sm:self-center">
                                {items.length} Token{items.length !== 1 ? 's' : ''}
                              </span>
                            </div>

                            {/* Date Appointments Table */}
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs">
                                <thead className="border-b border-[#f0f0f2] text-[#86868b] font-semibold bg-[#fafafa]">
                                  <tr>
                                    <th className="py-2.5 px-3">Token #</th>
                                    <th className="py-2.5 px-3">Patient</th>
                                    <th className="py-2.5 px-3">Practitioner</th>
                                    <th className="py-2.5 px-3">Clinic Facility</th>
                                    <th className="py-2.5 px-3">Status</th>
                                    <th className="py-2.5 px-3">Est. Time</th>
                                    <th className="py-2.5 px-3 text-right">Details</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-[#f0f0f0]">
                                  {items.map((appt) => {
                                    const clinicInfo = resolveClinic(appt);
                                    return (
                                      <tr key={appt.id} className="hover:bg-[#f5f5f7]/60 transition-colors">
                                        <td className="py-3 px-3 font-bold text-[#0066cc]">Queue #{appt.queueNumber}</td>
                                        <td className="py-3 px-3">
                                          <div>
                                            <span className="font-normal text-[#1d1d1f]">
                                              {appt.patient?.user?.fullName || appt.patientName || 'Unknown Patient'}
                                            </span>
                                            {appt.isForOther && appt.patientName && (
                                              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[11px] font-normal bg-[#f5f5f7] text-[#86868b] border border-[#e5e5ea]">
                                                Family
                                              </span>
                                            )}
                                            <span className="text-[11px] text-[#86868b] block mt-0.5">
                                              {appt.patientPhone || appt.patient?.user?.phone || appt.patient?.user?.email || 'Walk-in'}
                                            </span>
                                          </div>
                                        </td>
                                        <td className="py-3 px-3">
                                          <div>
                                            <span className="font-normal text-[#1d1d1f]">{appt.doctor?.user?.fullName || 'Practitioner'}</span>
                                            <span className="text-[11px] text-[#0066cc] block mt-0.5">
                                              {appt.doctor?.specialty || 'Specialist'}
                                            </span>
                                          </div>
                                        </td>
                                        <td className="py-3 px-3">
                                          <div className="flex items-start gap-1.5">
                                            <Building2 className="w-3.5 h-3.5 text-[#0066cc] shrink-0 mt-0.5" />
                                            <div>
                                              <span className="font-normal text-[#1d1d1f]">{clinicInfo.name}</span>
                                              {clinicInfo.city && (
                                                <span className="text-[11px] text-[#86868b] block mt-0.5">
                                                  {clinicInfo.city}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </td>
                                        <td className="py-3 px-3">{renderAppointmentStatusBadge(appt.status)}</td>
                                        <td className="py-3 px-3 text-[#86868b] font-normal">{appt.estimatedTime || 'N/A'}</td>
                                        <td className="py-3 px-3 text-right">
                                          <button
                                            type="button"
                                            onClick={() => setSelectedAppointment(appt)}
                                            className="p-1.5 rounded-full hover:bg-white text-[#0066cc] hover:text-[#0055b3] border border-transparent hover:border-[#e5e5ea] transition-all cursor-pointer"
                                            title="Inspect Booking Details"
                                          >
                                            <Eye className="w-4 h-4" />
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* MODE 3: GROUPED BY CLINIC */}
                  {bookingViewMode === 'by-clinic' && filteredAppointments.length > 0 && (
                    <div className="space-y-6 mt-6">
                      {appointmentsByClinic.map(({ clinicInfo, items }) => {
                        const doctorsInClinic = Array.from(new Set(items.map((i) => i.doctor?.user?.fullName).filter(Boolean)));
                        const waitingCount = items.filter((i) => (i.status || '').toUpperCase() === 'WAITING').length;
                        const completedCount = items.filter((i) => (i.status || '').toUpperCase() === 'COMPLETED').length;

                        return (
                          <div
                            key={clinicInfo.name}
                            className="bg-white rounded-2xl border border-[#e5e5ea] overflow-hidden "
                          >
                            {/* Clinic Group Header */}
                            <div className="px-4 py-3.5 bg-[#f5f5f7]/60 border-b border-[#e5e5ea] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-semibold text-[#1d1d1f]">{clinicInfo.name}</h4>
                                  {clinicInfo.city && (
                                    <span className="px-2 py-0.5 rounded-full text-[11px] font-normal bg-white border border-[#e5e5ea] text-[#86868b]">
                                      {clinicInfo.city}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-[#86868b] mt-0.5">
                                  {items.length} total booking{items.length !== 1 ? 's' : ''} • {doctorsInClinic.length} doctor{doctorsInClinic.length !== 1 ? 's' : ''} ({doctorsInClinic.slice(0, 3).join(', ')}{doctorsInClinic.length > 3 ? '...' : ''})
                                </p>
                              </div>

                              <div className="flex items-center gap-2 self-start sm:self-center">
                                <span className="px-2.5 py-1 rounded-full text-[11px] font-normal bg-white text-[#1d1d1f] border border-[#e5e5ea]">
                                  {waitingCount} Waiting
                                </span>
                                <span className="px-2.5 py-1 rounded-full text-[11px] font-normal bg-[#0066cc]/10 text-[#0066cc] border border-[#0066cc]/20">
                                  {completedCount} Completed
                                </span>
                              </div>
                            </div>

                            {/* Clinic Appointments Table */}
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs">
                                <thead className="border-b border-[#f0f0f2] text-[#86868b] font-semibold bg-[#fafafa]">
                                  <tr>
                                    <th className="py-2.5 px-3">Date</th>
                                    <th className="py-2.5 px-3">Token #</th>
                                    <th className="py-2.5 px-3">Patient</th>
                                    <th className="py-2.5 px-3">Practitioner</th>
                                    <th className="py-2.5 px-3">Status</th>
                                    <th className="py-2.5 px-3">Est. Time</th>
                                    <th className="py-2.5 px-3 text-right">Details</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-[#f0f0f0]">
                                  {items.map((appt) => (
                                    <tr key={appt.id} className="hover:bg-[#f5f5f7]/60 transition-colors">
                                      <td className="py-3 px-3">
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-semibold text-[#1d1d1f]">{appt.appointmentDate}</span>
                                          {getDateBadge(appt.appointmentDate)}
                                        </div>
                                      </td>
                                      <td className="py-3 px-3 font-bold text-[#0066cc]">Queue #{appt.queueNumber}</td>
                                      <td className="py-3 px-3">
                                        <div>
                                          <span className="font-normal text-[#1d1d1f]">
                                            {appt.patient?.user?.fullName || appt.patientName || 'Unknown Patient'}
                                          </span>
                                          {appt.isForOther && appt.patientName && (
                                            <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[11px] font-normal bg-[#f5f5f7] text-[#86868b] border border-[#e5e5ea]">
                                              Family
                                            </span>
                                          )}
                                          <span className="text-[11px] text-[#86868b] block mt-0.5">
                                            {appt.patientPhone || appt.patient?.user?.phone || appt.patient?.user?.email || 'Walk-in'}
                                          </span>
                                        </div>
                                      </td>
                                      <td className="py-3 px-3">
                                        <div>
                                          <span className="font-normal text-[#1d1d1f]">{appt.doctor?.user?.fullName || 'Practitioner'}</span>
                                          <span className="text-[11px] text-[#0066cc] block mt-0.5">
                                            {appt.doctor?.specialty || 'Specialist'}
                                          </span>
                                        </div>
                                      </td>
                                      <td className="py-3 px-3">{renderAppointmentStatusBadge(appt.status)}</td>
                                      <td className="py-3 px-3 text-[#86868b] font-normal">{appt.estimatedTime || 'N/A'}</td>
                                      <td className="py-3 px-3 text-right">
                                        <button
                                          type="button"
                                          onClick={() => setSelectedAppointment(appt)}
                                          className="p-1.5 rounded-full hover:bg-white text-[#0066cc] hover:text-[#0055b3] border border-transparent hover:border-[#e5e5ea] transition-all cursor-pointer"
                                          title="Inspect Booking Details"
                                        >
                                          <Eye className="w-4 h-4" />
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </UtilityCard>
              </div>
  );
};
