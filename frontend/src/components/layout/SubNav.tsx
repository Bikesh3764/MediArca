import React from 'react';

interface SubNavProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export const SubNav: React.FC<SubNavProps> = ({ title, subtitle, children }) => {
  return (
    <div className="sticky top-11 z-40 bg-[#f5f5f7]/85 backdrop-blur-xl saturate-180 border-b border-[#e0e0e0]/80 h-[52px] flex items-center transition-all">
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="text-[19px] sm:text-[21px] font-semibold text-[#1d1d1f] tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <span className="text-xs text-[#7a7a7a] hidden sm:inline font-normal">
              {subtitle}
            </span>
          )}
        </div>
        {children && <div className="flex items-center gap-2 sm:gap-3">{children}</div>}
      </div>
    </div>
  );
};
