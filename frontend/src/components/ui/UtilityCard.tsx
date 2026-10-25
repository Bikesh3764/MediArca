import React from 'react';

interface UtilityCardProps extends React.HTMLAttributes<HTMLDivElement> {
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
      className={`bg-white rounded-2xl border border-[#e5e5ea] p-5 sm:p-6  ${
        hoverEffect ? 'transition-all duration-200 hover:border-[#0066cc]/40 ' : ''
      } ${className}`}
      {...props}
    >
      {(title || subtitle) && (
        <div className="mb-5">
          {title && <h3 className="text-[17px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">{title}</h3>}
          {subtitle && <p className="text-[13px] text-[#86868b] mt-1 leading-relaxed">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
};
