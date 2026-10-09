import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';

export interface AppleFilterOption {
  label: string;
  value: string;
  count?: number;
}

export interface AppleFilterSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: AppleFilterOption[];
  placeholder?: string;
  allLabel?: string;
  allCount?: number;
  searchable?: boolean;
  disabled?: boolean;
  variant?: 'bar' | 'form' | 'searchbar';
  className?: string;
  icon?: React.ReactNode;
}

export const AppleFilterSelect: React.FC<AppleFilterSelectProps> = ({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select option',
  allLabel = 'All',
  allCount,
  searchable = true,
  disabled = false,
  variant = 'bar',
  className = '',
  icon,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      if (searchable) {
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, searchable]);

  // Filter options by search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase().trim();
    return options.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [options, searchQuery]);

  // Selected item label
  const selectedOption = useMemo(() => {
    if (value === 'All') {
      return { label: allLabel, value: 'All', count: allCount };
    }
    return options.find((o) => o.value.toLowerCase() === value.toLowerCase());
  }, [value, allLabel, allCount, options]);

  const displayLabel = useMemo(() => {
    if (!selectedOption) return placeholder;
    if (selectedOption.count !== undefined && selectedOption.count > 0) {
      return `${selectedOption.label} (${selectedOption.count})`;
    }
    return selectedOption.label;
  }, [selectedOption, placeholder]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-xs font-medium text-[#86868b] mb-1.5 select-none">
          {label}
        </label>
      )}
      {/* Trigger Button */}
      {variant === 'bar' || variant === 'searchbar' ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={`h-full w-full flex items-center justify-between gap-1.5 px-2.5 py-1 text-xs sm:text-sm font-medium transition-all select-none rounded-full ${
            disabled
              ? 'opacity-50 cursor-not-allowed text-[#86868b]'
              : 'cursor-pointer ' +
                (value && value !== 'All'
                  ? 'text-[#0066cc] font-semibold'
                  : 'text-[#1d1d1f] hover:text-[#0066cc]')
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0 truncate">
            {icon}
            <span className="truncate">{displayLabel}</span>
          </div>
          <ChevronDown
            className={`w-3.5 h-3.5 shrink-0 text-[#86868b] transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-[#0066cc]' : ''
            }`}
          />
        </button>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={`w-full h-10 px-3.5 rounded-xl border transition-all flex items-center justify-between gap-2 text-xs sm:text-sm select-none ${
            disabled
              ? 'bg-[#f5f5f7]/50 border-[#e5e5ea] text-[#86868b] opacity-60 cursor-not-allowed'
              : `bg-[#f5f5f7] hover:bg-[#ebebed] cursor-pointer ${
                  isOpen
                    ? 'bg-white border-[#0066cc] ring-2 ring-[#0066cc]/20'
                    : 'border-[#e0e0e0] text-[#1d1d1f]'
                }`
          }`}
        >
          <div className="flex items-center gap-2 min-w-0 truncate">
            {icon}
            <span className="truncate font-medium">{displayLabel}</span>
          </div>
          <ChevronDown
            className={`w-3.5 h-3.5 shrink-0 text-[#86868b] transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-[#0066cc]' : ''
            }`}
          />
        </button>
      )}

      {/* Floating Popover Menu */}
      {isOpen && (
        <div className="absolute top-full mt-2 left-0 z-50 min-w-[220px] max-w-[300px] w-auto bg-white/95 backdrop-blur-xl rounded-[20px] border border-[#e5e5ea] shadow-xl p-2 animate-fadeIn space-y-1.5">
          {/* Quick Search */}
          {searchable && options.length > 5 && (
            <div className="relative mb-1">
              <Search className="w-3.5 h-3.5 text-[#86868b] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full h-8 pl-8 pr-7 rounded-xl bg-[#f5f5f7] text-xs text-[#1d1d1f] placeholder-[#86868b] focus:outline-none focus:ring-1 focus:ring-[#0066cc]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#86868b] hover:text-[#1d1d1f]"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {/* List */}
          <div className="max-h-56 overflow-y-auto overscroll-contain space-y-0.5 scrollbar-thin">
            {/* "All" option if search query empty or matches */}
            {(!searchQuery || allLabel.toLowerCase().includes(searchQuery.toLowerCase())) && (
              <button
                type="button"
                onClick={() => handleSelect('All')}
                className={`w-full px-3 py-2 rounded-xl text-xs sm:text-[13px] flex items-center justify-between gap-2 transition-colors cursor-pointer text-left ${
                  value === 'All'
                    ? 'bg-[#0066cc]/10 text-[#0066cc] font-semibold'
                    : 'text-[#1d1d1f] hover:bg-[#f5f5f7]'
                }`}
              >
                <span className="truncate">{allLabel}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {allCount !== undefined && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f]">
                      {allCount}
                    </span>
                  )}
                  {value === 'All' && <Check className="w-3.5 h-3.5 text-[#0066cc]" />}
                </div>
              </button>
            )}

            {filteredOptions.length === 0 && searchQuery ? (
              <div className="p-3 text-center text-xs text-[#86868b]">
                No matching locations
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = value.toLowerCase() === opt.value.toLowerCase();
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full px-3 py-2 rounded-xl text-xs sm:text-[13px] flex items-center justify-between gap-2 transition-colors cursor-pointer text-left ${
                      isSelected
                        ? 'bg-[#0066cc]/10 text-[#0066cc] font-semibold'
                        : 'text-[#1d1d1f] hover:bg-[#f5f5f7]'
                    }`}
                  >
                    <span className="truncate">{opt.label}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {opt.count !== undefined && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            opt.count > 0
                              ? 'bg-[#f5f5f7] border-[#e0e0e0] text-[#1d1d1f]'
                              : 'bg-transparent border-transparent text-[#86868b]'
                          }`}
                        >
                          {opt.count}
                        </span>
                      )}
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#0066cc]" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
