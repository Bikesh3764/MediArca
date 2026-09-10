import React from 'react';

interface UtilityCardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverEffect?: boolean;
  children: React.ReactNode;
}

export const UtilityCard: React.FC<UtilityCardProps> = ({
  hoverEffect = false,
  className = '',
  children,
  ...props
}) => {
  return (
    <div
      className={`bg-white rounded-[18px] border border-[#e0e0e0]/80 p-6 ${
        hoverEffect ? 'transition-all duration-200 hover:border-[#0066cc]/40 hover:shadow-apple-card' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
