import React from 'react';
import { Search, X } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void;
  variant?: 'default' | 'pill';
  error?: boolean;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  className = '',
  onClear,
  variant = 'default',
  error = false,
  value,
  ...props
}) => {
  const hasValue = value !== undefined && String(value).length > 0;

  return (
    <div className={cn('relative flex items-center w-full', className)}>
      <div className="absolute left-3.5 pointer-events-none text-[#86868b]">
        <Search className="w-4 h-4" />
      </div>
      <input
        type="text"
        value={value}
        className={cn(
          'w-full h-11 pl-10 pr-9 bg-white text-[#1d1d1f] placeholder:text-[#86868b] text-[14px] border border-[#d2d2d7]/80 hover:border-[#86868b]/60 focus:border-[#0066cc] focus:ring-[3px] focus:ring-[#0066cc]/15 focus:outline-none transition-all duration-150 disabled:bg-[#f5f5f7] disabled:text-[#86868b] disabled:cursor-not-allowed',
          variant === 'pill' ? 'rounded-full' : 'rounded-xl',
          error && 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/15'
        )}
        {...props}
      />
      {onClear && hasValue && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className="absolute right-3 p-1 rounded-full text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
