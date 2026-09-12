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
      className={`bg-white rounded-[20px] border border-[#e5e5ea] p-6 shadow-sm ${
        hoverEffect ? 'transition-all duration-200 hover:border-[#0088e8]/40 hover:shadow-apple-card' : ''
      } ${className}`}
      {...props}
    >
      {(title || subtitle) && (
        <div className="mb-4">
          {title && <h3 className="text-base font-semibold text-[#1d1d1f] tracking-tight">{title}</h3>}
          {subtitle && <p className="text-xs text-[#86868b] mt-0.5">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
};
