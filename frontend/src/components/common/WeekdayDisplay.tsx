import React from 'react';
import {
  ALL_WEEKDAYS,
  WEEKDAY_NAMES,
  WEEKDAY_SINGLE_LETTERS,
  formatWeekdaySummary,
  getDayOfWeekCode,
} from '../../services/api';

interface WeekdayDisplayProps {
  days?: string[];
  isOnLeaveToday?: boolean;
  showSummary?: boolean;
  showTodayBadge?: boolean;
  className?: string;
}

export const WeekdayDisplay: React.FC<WeekdayDisplayProps> = ({
  days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
  isOnLeaveToday = false,
  showSummary = true,
  showTodayBadge = true,
  className = '',
}) => {
  const todayCode = getDayOfWeekCode();
  const sitsToday = days.includes(todayCode);

  return (
    <div className={`space-y-1.5 ${className}`}>
      {(showSummary || showTodayBadge) && (
        <div className="flex items-center justify-between text-xs px-0.5">
          {showSummary && (
            <span className="font-semibold text-[#1d1d1f] tracking-tight">
              {formatWeekdaySummary(days)}
            </span>
          )}
          {showTodayBadge && (
            isOnLeaveToday ? (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200">
                Leave
              </span>
            ) : sitsToday ? (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Today
              </span>
            ) : (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#f5f5f7] text-[#86868b] border border-[#e5e5ea]">
                Off
              </span>
            )
          )}
        </div>
      )}

      {/* Apple 7-day dot strip */}
      <div className="flex items-center justify-between gap-1 bg-[#f5f5f7] p-1.5 rounded-xl border border-[#e5e5ea]/60">
        {ALL_WEEKDAYS.map((d) => {
          const isSitting = days.includes(d);
          const isToday = todayCode === d;
          return (
            <span
              key={d}
              title={`${WEEKDAY_NAMES[d]}: ${isSitting ? 'Practicing' : 'Off'}`}
              className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold transition-all ${
                isSitting
                  ? 'bg-[#1d1d1f] text-white shadow-xs'
                  : 'bg-transparent text-[#86868b]/60'
              } ${isToday ? 'ring-2 ring-[#0066cc] ring-offset-1 ring-offset-[#f5f5f7]' : ''}`}
            >
              {WEEKDAY_SINGLE_LETTERS[d]}
            </span>
          );
        })}
      </div>
    </div>
  );
};
