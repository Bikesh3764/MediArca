import React from 'react';

interface SubNavProps {
  title: string;
  subtitle?: string;
  /** Match the page's content width so the title lines up with the content below it. */
  width?: '2xl' | '4xl' | '6xl' | '7xl' | 'wide';
  children?: React.ReactNode;
}

const WIDTH: Record<NonNullable<SubNavProps['width']>, string> = {
  '2xl': 'max-w-2xl px-4 sm:px-6',
  '4xl': 'max-w-4xl px-4 sm:px-6 lg:px-8',
  '6xl': 'max-w-6xl px-3 sm:px-6',
  '7xl': 'max-w-7xl px-4 sm:px-6',
  wide: 'max-w-[1840px] px-4 sm:px-6 lg:px-10 xl:px-14',
};

/** DESIGN.md sub-nav-frosted: sticky parchment bar under the global nav with the page title. */
export const SubNav: React.FC<SubNavProps> = ({ title, subtitle, width = '7xl', children }) => {
  return (
    <div className="sticky top-14 z-40 bg-[#f5f5f7]/85 backdrop-blur-xl backdrop-saturate-150 border-b border-[#e5e5ea] min-h-[52px] py-1.5 sm:py-0 flex items-center">
      <div className={`${WIDTH[width]} mx-auto w-full flex items-center justify-between gap-2`}>
        <div className="flex items-baseline gap-2 sm:gap-3 min-w-0">
          <h1 className="text-[19px] sm:text-[21px] font-semibold text-[#1d1d1f] tracking-tight truncate">{title}</h1>
          {subtitle && <span className="text-[13px] text-[#86868b] hidden sm:inline truncate">{subtitle}</span>}
        </div>
        {children && <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">{children}</div>}
      </div>
    </div>
  );
};
