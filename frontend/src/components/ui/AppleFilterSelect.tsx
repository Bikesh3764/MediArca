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
        <label className="block text-[13px] font-medium text-[#48484a] mb-1.5 select-none">
          {label}
        </label>
      )}
      {/* Trigger Button */}
      {variant === 'bar' || variant === 'searchbar' ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={`h-full w-full flex items-center justify-between gap-1.5 px-3 py-1 text-[13px] sm:text-[14px] font-medium transition-all duration-150 select-none rounded-full focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[#0066cc]/15 ${
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
            className={`w-4 h-4 shrink-0 text-[#86868b] transition-transform duration-150 ${
              isOpen ? 'rotate-180 text-[#0066cc]' : ''
            }`}
          />
        </button>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={`w-full h-11 px-3.5 rounded-xl border transition-all duration-150 flex items-center justify-between gap-2 text-[14px] select-none focus:outline-none ${
            disabled
              ? 'bg-[#f5f5f7] border-[#e5e5ea] text-[#86868b] opacity-60 cursor-not-allowed'
              : `bg-white cursor-pointer ${
                  isOpen
                    ? 'border-[#0066cc] ring-[3px] ring-[#0066cc]/15 text-[#1d1d1f]'
                    : 'border-[#d2d2d7]/80 hover:border-[#86868b]/60 text-[#1d1d1f]'
                }`
          }`}
        >
          <div className="flex items-center gap-2 min-w-0 truncate">
            {icon}
            <span className="truncate font-medium">{displayLabel}</span>
          </div>
          <ChevronDown
            className={`w-4 h-4 shrink-0 text-[#86868b] transition-transform duration-150 ${
              isOpen ? 'rotate-180 text-[#0066cc]' : ''
            }`}
          />
        </button>
      )}

      {/* Floating Popover Menu */}
      {isOpen && (
        <div className="absolute top-full mt-2 left-0 z-50 min-w-[240px] max-w-[320px] w-auto bg-white/95 backdrop-blur-xl rounded-[20px] border border-[#e5e5ea] shadow-[0_10px_32px_-4px_rgba(0,0,0,0.08),0_2px_6px_-1px_rgba(0,0,0,0.04)] p-2 animate-in fade-in zoom-in-95 duration-150 space-y-1.5">
          {/* Quick Search */}
          {searchable && options.length > 5 && (
            <div className="relative mb-1">
              <Search className="w-3.5 h-3.5 text-[#86868b] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full h-9 pl-8 pr-7 rounded-xl bg-[#f5f5f7] border border-transparent text-[13px] text-[#1d1d1f] placeholder:text-[#86868b] focus:bg-white focus:border-[#0066cc] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/15 transition-all duration-150"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#e5e5ea]/60 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {/* List */}
          <div className="max-h-60 overflow-y-auto overscroll-contain space-y-0.5 scrollbar-thin">
            {/* "All" option if search query empty or matches */}
            {(!searchQuery || allLabel.toLowerCase().includes(searchQuery.toLowerCase())) && (
              <button
                type="button"
                onClick={() => handleSelect('All')}
                className={`w-full h-9 px-3 rounded-xl text-[13px] flex items-center justify-between gap-2 transition-colors duration-150 cursor-pointer text-left ${
                  value === 'All'
                    ? 'bg-[#0066cc]/10 text-[#0066cc] font-semibold'
                    : 'text-[#1d1d1f] hover:bg-[#f5f5f7] font-normal'
                }`}
              >
                <span className="truncate">{allLabel}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {allCount !== undefined && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#f5f5f7] border border-[#e5e5ea] text-[#48484a]">
                      {allCount}
                    </span>
                  )}
                  {value === 'All' && <Check className="w-3.5 h-3.5 text-[#0066cc]" />}
                </div>
              </button>
            )}

            {filteredOptions.length === 0 && searchQuery ? (
              <div className="p-3 text-center text-[13px] text-[#86868b]">
                No matching options
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = value.toLowerCase() === opt.value.toLowerCase();
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full h-9 px-3 rounded-xl text-[13px] flex items-center justify-between gap-2 transition-colors duration-150 cursor-pointer text-left ${
                      isSelected
                        ? 'bg-[#0066cc]/10 text-[#0066cc] font-semibold'
                        : 'text-[#1d1d1f] hover:bg-[#f5f5f7] font-normal'
                    }`}
                  >
                    <span className="truncate">{opt.label}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {opt.count !== undefined && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                            opt.count > 0
                              ? 'bg-[#f5f5f7] border-[#e5e5ea] text-[#48484a]'
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
