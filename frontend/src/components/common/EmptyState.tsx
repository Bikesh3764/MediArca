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
      className={`bg-white rounded-2xl border border-[#e5e5ea] p-8 sm:p-12 text-center max-w-md mx-auto  select-none ${className}`}
    >
      {Icon && (
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] flex items-center justify-center mx-auto mb-4 text-[#86868b]">
          <Icon className="w-6 h-6 stroke-[1.8]" />
        </div>
      )}
      <h3 className="text-[17px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">
        {title}
      </h3>
      {description && (
        <p className="text-[13px] text-[#86868b] mt-1.5 leading-relaxed max-w-xs mx-auto">
          {description}
        </p>
      )}
      {(actionText || secondaryText) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          {secondaryText && onSecondary && (
            <button
              type="button"
              onClick={onSecondary}
              className="h-10 px-5 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] active:scale-[0.98] text-[#1d1d1f] text-xs sm:text-sm font-normal transition-all duration-150 border border-[#e5e5ea] cursor-pointer"
            >
              {secondaryText}
            </button>
          )}
          {actionText && onAction && (
            <button
              type="button"
              onClick={onAction}
              className="h-10 px-5 rounded-full bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white text-xs sm:text-sm font-normal transition-all duration-150  cursor-pointer"
            >
              {actionText}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
