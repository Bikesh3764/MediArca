import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface UtilityCardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverEffect?: boolean;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}

export const UtilityCard: React.FC<UtilityCardProps> = ({
  hoverEffect = false,
  title,
  subtitle,
  className = '',
  children,
  ...props
}) => {
  return (
    <div
      className={cn(
        'bg-white rounded-[20px] border border-[#e5e5ea] p-5 sm:p-6 shadow-[0_2px_10px_0_rgba(0,0,0,0.02)] transition-all duration-200',
        hoverEffect && 'hover:border-[#d2d2d7] hover:shadow-[0_6px_20px_-4px_rgba(0,0,0,0.05)]',
        className
      )}
      {...props}
    >
      {(title || subtitle) && (
        <div className="mb-4">
          {title && (
            <h3 className="text-[15px] sm:text-[16px] font-semibold text-[#1d1d1f] tracking-[-0.015em] leading-snug">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="text-[13px] text-[#86868b] mt-0.5 leading-relaxed">{subtitle}</p>
          )}
        </div>
      )}
      {children}
    </div>
  );
};
