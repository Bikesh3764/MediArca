import React from 'react';

export interface EmptyStateProps {
  icon?: React.ElementType;
  title: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
  secondaryText?: string;
  onSecondary?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionText,
  onAction,
  secondaryText,
  onSecondary,
  className = '',
}) => {
  return (
    <div
      className={`relative overflow-clip bg-white rounded-[28px] border border-[#e5e5ea] p-8 sm:p-12 text-center max-w-md mx-auto select-none ${className}`}
    >
      <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-48 rounded-full bg-[radial-gradient(closest-side,rgba(0,102,204,0.08),transparent)]" />
      {Icon && (
        <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-primary-soft text-primary ring-8 ring-primary-soft/40 flex items-center justify-center mx-auto mb-5">
          <Icon className="w-6 h-6 sm:w-7 sm:h-7 stroke-[1.8]" />
        </div>
      )}
      <h3 className="relative text-lg font-semibold text-[#1d1d1f] tracking-tight leading-snug">
        {title}
      </h3>
      {description && (
        <p className="relative text-sm text-[#86868b] mt-1.5 leading-relaxed max-w-xs mx-auto">
          {description}
        </p>
      )}
      {(actionText || secondaryText) && (
        <div className="relative mt-6 flex flex-wrap items-center justify-center gap-2.5">
          {secondaryText && onSecondary && (
            <button
              type="button"
              onClick={onSecondary}
              className="h-11 px-5 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] active:scale-[0.98] text-[#1d1d1f] text-xs sm:text-sm font-normal transition-all duration-150 border border-[#e5e5ea] cursor-pointer"
            >
              {secondaryText}
            </button>
          )}
          {actionText && onAction && (
            <button
              type="button"
              onClick={onAction}
              className="h-11 px-6 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-xs sm:text-sm font-normal transition-all duration-150  cursor-pointer"
            >
              {actionText}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
