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
          className={`h-8 px-3 rounded-full border text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer select-none ${
            value && value !== 'All'
              ? 'bg-[#0088e8]/10 border-[#0088e8]/30 text-[#0088e8] font-semibold'
              : 'border-[#e5e5ea] bg-[#f5f5f7] text-[#48484a] hover:bg-[#ebebee]'
          }`}
          title="Filter by Medical Specialty"
        >
          <Stethoscope className="w-3.5 h-3.5 text-[#0088e8] flex-shrink-0" />
          <span className="truncate max-w-[130px] sm:max-w-[170px]">
            {value === 'All' ? 'All Specialties' : value}
          </span>
          {counts && counts[value] !== undefined && (
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                value && value !== 'All' ? 'bg-[#0088e8]/20 text-[#0088e8]' : 'bg-[#e5e5ea] text-[#86868b]'
              }`}
            >
              {counts[value]}
            </span>
          )}
          <ChevronDown
            className={`w-3 h-3 text-[#86868b] transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>
      ) : (
        /* Form Mode for Signup & Profile */
        <div>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="w-full h-11 px-3.5 rounded-xl border border-[#e0e0e0] text-[14px] bg-white text-[#1d1d1f] hover:border-[#0088e8]/50 focus:outline-none focus:border-[#0088e8] focus:ring-2 focus:ring-[#0088e8]/20 transition-all flex items-center justify-between text-left cursor-pointer"
          >
            <span className="truncate">{displayLabel}</span>
            <ChevronDown
              className={`w-4 h-4 text-[#86868b] flex-shrink-0 transition-transform duration-200 ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* If 'Other' is selected in Form mode, render write-in custom text field */}
          {allowOther && value === 'Other' && (
            <div className="mt-2.5">
              <label className="block text-[11px] font-medium text-[#48484a] mb-1">
                Specify Your Medical Specialty *
              </label>
              <div className="relative">
                <Edit3 className="w-3.5 h-3.5 text-[#86868b] absolute left-3 top-3.5 pointer-events-none" />
                <input
                  type="text"
                  required
                  value={customValue}
                  onChange={(e) => onCustomChange?.(e.target.value)}
                  placeholder="e.g. Trichology, Diabetology, Pediatric Cardiology"
                  className="w-full h-10 pl-9 pr-3.5 rounded-xl border border-[#0088e8]/40 bg-[#f8fbff] text-[13px] text-[#1d1d1f] placeholder-[#86868b] focus:outline-none focus:border-[#0088e8] focus:ring-2 focus:ring-[#0088e8]/20 transition-all"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={`absolute z-50 mt-1.5 w-72 sm:w-80 bg-white rounded-2xl border border-[#e5e5ea] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 ${
            variant === 'pill' ? 'left-0 sm:left-auto right-auto' : 'left-0 right-0 w-full'
          }`}
        >
          {/* Search Header */}
          <div className="p-2.5 border-b border-[#f0f0f0] bg-[#fafafc]">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-[#86868b] absolute left-3 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search 30+ specialties..."
                className="w-full h-8 pl-8 pr-7 bg-white text-xs text-[#1d1d1f] placeholder-[#86868b] rounded-lg border border-[#e5e5ea] focus:outline-none focus:border-[#0088e8] focus:ring-1 focus:ring-[#0088e8] transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 text-[#86868b] hover:text-[#1d1d1f] p-0.5 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Specialty Options List */}
          <div className="max-h-64 overflow-y-auto p-1.5 scrollbar-thin scrollbar-thumb-gray-200">
            {/* 'All Specialties' Option for Filters */}
            {includeAll && !searchQuery && (
              <button
                type="button"
                onClick={() => handleSelect('All')}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                  value === 'All' || !value
                    ? 'bg-[#0088e8]/10 text-[#0088e8] font-semibold'
                    : 'text-[#1d1d1f] hover:bg-[#f5f5f7]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>All Specialties</span>
                  {counts && counts['All'] !== undefined && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-[#e5e5ea] text-[#86868b]">
                      {counts['All']}
                    </span>
                  )}
                </div>
                {(value === 'All' || !value) && <Check className="w-3.5 h-3.5 text-[#0088e8]" />}
              </button>
            )}

            {filteredItems.length === 0 ? (
              <div className="py-6 px-3 text-center">
                <p className="text-xs text-[#86868b]">No specialty matching &ldquo;{searchQuery}&rdquo;</p>
                {allowOther && (
                  <button
                    type="button"
                    onClick={() => {
                      onChange('Other');
                      onCustomChange?.(searchQuery);
                      setIsOpen(false);
                      setSearchQuery('');
                    }}
                    className="mt-2 text-xs font-semibold text-[#0088e8] hover:underline cursor-pointer"
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
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                      selected
                        ? 'bg-[#0088e8]/10 text-[#0088e8] font-semibold'
                        : 'text-[#1d1d1f] hover:bg-[#f5f5f7]'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="truncate">{item}</span>
                      {count !== undefined && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-[#e5e5ea] text-[#86868b]">
                          {count}
                        </span>
                      )}
                    </div>
                    {selected && <Check className="w-3.5 h-3.5 text-[#0088e8] flex-shrink-0 ml-2" />}
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
