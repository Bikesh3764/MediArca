import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ALL_SPECIALTIES } from '../../services/api';
import { Search, ChevronDown, Check, X, Stethoscope, Edit3 } from 'lucide-react';

export interface SearchableSpecialtySelectProps {
  value: string;
  onChange: (value: string) => void;
  customValue?: string;
  onCustomChange?: (custom: string) => void;
  variant?: 'form' | 'pill';
  includeAll?: boolean;
  allowOther?: boolean;
  counts?: Record<string, number>;
  placeholder?: string;
  className?: string;
  id?: string;
}

export const SearchableSpecialtySelect: React.FC<SearchableSpecialtySelectProps> = ({
  value,
  onChange,
  customValue = '',
  onCustomChange,
  variant = 'form',
  includeAll = false,
  allowOther = false,
  counts,
  placeholder = 'Select specialty...',
  className = '',
  id,
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
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Build the items list
  const availableItems = useMemo(() => {
    const items = [...ALL_SPECIALTIES];
    if (!allowOther) {
      const otherIndex = items.indexOf('Other');
      if (otherIndex !== -1) items.splice(otherIndex, 1);
    }
    return items;
  }, [allowOther]);

  // Filter items by search query
  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return availableItems;
    return availableItems.filter((item) => item.toLowerCase().includes(query));
  }, [availableItems, searchQuery]);

  const handleSelect = (item: string) => {
    onChange(item);
    setIsOpen(false);
    setSearchQuery('');
  };

  const isSelected = (item: string) => value.toLowerCase() === item.toLowerCase();

  // Selected label text
  const displayLabel = useMemo(() => {
    if (includeAll && (value === 'All' || !value)) {
      return 'All Specialties';
    }
    if (value === 'Other' && customValue.trim()) {
      return `Other: ${customValue.trim()}`;
    }
    return value || placeholder;
  }, [value, customValue, includeAll, placeholder]);

  return (
    <div ref={containerRef} className={`relative ${className}`} id={id}>
      {variant === 'pill' ? (
        /* Pill Mode for Filter Toolbars */
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`h-9 px-3.5 rounded-full border text-[13px] font-medium transition-all duration-150 flex items-center gap-1.5 cursor-pointer select-none focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[#0066cc]/15 ${
            value && value !== 'All'
              ? 'bg-[#0066cc]/10 border-[#0066cc]/30 text-[#0066cc] font-semibold'
              : 'border-[#e5e5ea] bg-[#f5f5f7] text-[#48484a] hover:bg-[#ededf0]'
          }`}
          title="Filter by Medical Specialty"
        >
          <Stethoscope className="w-3.5 h-3.5 text-[#0066cc] flex-shrink-0" />
          <span className="truncate max-w-[130px] sm:max-w-[170px]">
            {value === 'All' ? 'All Specialties' : value}
          </span>
          {counts && counts[value] !== undefined && (
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                value && value !== 'All' ? 'bg-[#0066cc]/15 text-[#0066cc]' : 'bg-[#e5e5ea] text-[#86868b]'
              }`}
            >
              {counts[value]}
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 text-[#86868b] transition-transform duration-150 ${
              isOpen ? 'rotate-180 text-[#0066cc]' : ''
            }`}
          />
        </button>
      ) : (
        /* Form Mode for Signup & Profile */
        <div>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className={`w-full h-11 px-3.5 rounded-xl border text-[14px] bg-white text-[#1d1d1f] transition-all duration-150 flex items-center justify-between text-left cursor-pointer select-none focus:outline-none ${
              isOpen
                ? 'border-[#0066cc] ring-[3px] ring-[#0066cc]/15'
                : 'border-[#d2d2d7]/80 hover:border-[#86868b]/60 focus:border-[#0066cc] focus:ring-[3px] focus:ring-[#0066cc]/15'
            }`}
          >
            <span className={`truncate ${!value ? 'text-[#86868b]' : 'font-medium text-[#1d1d1f]'}`}>
              {displayLabel}
            </span>
            <ChevronDown
              className={`w-4 h-4 text-[#86868b] flex-shrink-0 transition-transform duration-150 ${
                isOpen ? 'rotate-180 text-[#0066cc]' : ''
              }`}
            />
          </button>

          {/* If 'Other' is selected in Form mode, render write-in custom text field */}
          {allowOther && value === 'Other' && (
            <div className="mt-2.5 space-y-1.5">
              <label className="block text-[13px] font-medium text-[#48484a]">
                Specify Your Medical Specialty *
              </label>
              <div className="relative flex items-center">
                <Edit3 className="w-4 h-4 text-[#86868b] absolute left-3.5 pointer-events-none" />
                <input
                  type="text"
                  required
                  value={customValue}
                  onChange={(e) => onCustomChange?.(e.target.value)}
                  placeholder="e.g. Trichology, Diabetology, Pediatric Cardiology"
                  className="w-full h-11 pl-10 pr-3.5 rounded-xl border border-[#d2d2d7]/80 bg-white text-[14px] text-[#1d1d1f] placeholder:text-[#86868b] hover:border-[#86868b]/60 focus:outline-none focus:border-[#0066cc] focus:ring-[3px] focus:ring-[#0066cc]/15 transition-all duration-150"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={`absolute z-50 mt-2 w-72 sm:w-80 max-w-[calc(100vw-24px)] bg-white/95 backdrop-blur-xl rounded-[20px] border border-[#e5e5ea] shadow-[0_10px_32px_-4px_rgba(0,0,0,0.08),0_2px_6px_-1px_rgba(0,0,0,0.04)] p-2 animate-in fade-in zoom-in-95 duration-150 space-y-1.5 ${
            variant === 'pill' ? 'left-0 right-auto' : 'left-0 right-0 w-full'
          }`}
        >
          {/* Search Header */}
          <div className="relative mb-1">
            <Search className="w-3.5 h-3.5 text-[#86868b] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search specialties..."
              className="w-full h-9 pl-8 pr-7 bg-[#f5f5f7] border border-transparent text-[13px] text-[#1d1d1f] placeholder:text-[#86868b] rounded-xl focus:bg-white focus:border-[#0066cc] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/15 transition-all duration-150"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#e5e5ea]/60 transition-colors cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Specialty Options List */}
          <div className="max-h-60 overflow-y-auto overscroll-contain space-y-0.5 scrollbar-thin">
            {/* 'All Specialties' Option for Filters */}
            {includeAll && !searchQuery && (
              <button
                type="button"
                onClick={() => handleSelect('All')}
                className={`w-full h-9 text-left px-3 rounded-xl text-[13px] flex items-center justify-between gap-2 transition-colors duration-150 cursor-pointer ${
                  value === 'All' || !value
                    ? 'bg-[#0066cc]/10 text-[#0066cc] font-semibold'
                    : 'text-[#1d1d1f] hover:bg-[#f5f5f7] font-normal'
                }`}
              >
                <span className="truncate">All Specialties</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {counts && counts['All'] !== undefined && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-[#f5f5f7] border border-[#e5e5ea] text-[#48484a]">
                      {counts['All']}
                    </span>
                  )}
                  {(value === 'All' || !value) && <Check className="w-3.5 h-3.5 text-[#0066cc]" />}
                </div>
              </button>
            )}

            {filteredItems.length === 0 ? (
              <div className="py-5 px-3 text-center">
                <p className="text-[13px] text-[#86868b]">No specialty matching &ldquo;{searchQuery}&rdquo;</p>
                {allowOther && (
                  <button
                    type="button"
                    onClick={() => {
                      onChange('Other');
                      onCustomChange?.(searchQuery);
                      setIsOpen(false);
                      setSearchQuery('');
                    }}
                    className="mt-2 text-[13px] font-semibold text-[#0066cc] hover:underline cursor-pointer"
                  >
                    Use &ldquo;{searchQuery}&rdquo; as custom specialty
                  </button>
                )}
              </div>
            ) : (
              filteredItems.map((item) => {
                const selected = isSelected(item);
                const count = counts?.[item];
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => handleSelect(item)}
                    className={`w-full h-9 text-left px-3 rounded-xl text-[13px] flex items-center justify-between gap-2 transition-colors duration-150 cursor-pointer ${
                      selected
                        ? 'bg-[#0066cc]/10 text-[#0066cc] font-semibold'
                        : 'text-[#1d1d1f] hover:bg-[#f5f5f7] font-normal'
                    }`}
                  >
                    <span className="truncate">{item}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {count !== undefined && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-[#f5f5f7] border border-[#e5e5ea] text-[#48484a]">
                          {count}
                        </span>
                      )}
                      {selected && <Check className="w-3.5 h-3.5 text-[#0066cc]" />}
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
