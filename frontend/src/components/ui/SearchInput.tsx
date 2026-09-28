import React from 'react';
import { Search } from 'lucide-react';

interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void;
}

export const SearchInput: React.FC<SearchInputProps> = ({ className = '', ...props }) => {
  return (
    <div className={`relative flex items-center w-full ${className}`}>
      <div className="absolute left-4 pointer-events-none text-[#86868b]">
        <Search className="w-4 h-4" />
      </div>
      <input
        type="text"
        className="w-full h-11 pl-11 pr-4 bg-white text-[#1d1d1f] placeholder-[#86868b] text-[14px] rounded-full border border-[#e5e5ea] focus:border-[#0088e8] focus:ring-2 focus:ring-[#0088e8]/20 focus:outline-none transition-all duration-200"
        {...props}
      />
    </div>
  );
};
