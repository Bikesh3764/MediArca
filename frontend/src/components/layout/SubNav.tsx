import React from 'react';

interface SubNavProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export const SubNav: React.FC<SubNavProps> = ({ title, subtitle, children }) => {
  return (
    <div className="sticky top-14 z-40 bg-white/85 backdrop-blur-xl backdrop-saturate-150 border-b border-[#e5e5ea] min-h-[48px] sm:h-[52px] py-1.5 sm:py-0 flex items-center transition-all">
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2.5 sm:gap-3 min-w-0">
          <h1 className="text-[17px] sm:text-[19px] font-semibold text-[#1d1d1f] tracking-[-0.02em] truncate">
            {title}
          </h1>
          {subtitle && (
            <span className="text-[13px] text-[#86868b] hidden sm:inline font-normal truncate">
              {subtitle}
            </span>
          )}
        </div>
        {children && <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">{children}</div>}
      </div>
    </div>
  );
};
