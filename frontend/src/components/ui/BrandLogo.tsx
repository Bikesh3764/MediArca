import React from 'react';
import mediarcaLogo from '../../assets/mediarca-logo.png';
import mediarcaIcon from '../../assets/mediarca-icon.png';

export interface BrandLogoProps {
  variant?: 'full' | 'icon';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  imgClassName?: string;
  /** onDark: icon + white wordmark for the black global nav (DESIGN.md global-nav) */
  theme?: 'light' | 'dark' | 'onDark';
  alt?: string;
}

const SIZE_MAP = {
  xs: { full: 'h-5', icon: 'w-5 h-5' },
  sm: { full: 'h-6', icon: 'w-6 h-6' },
  md: { full: 'h-8', icon: 'w-8 h-8' },
  lg: { full: 'h-10', icon: 'w-10 h-10' },
  xl: { full: 'h-14', icon: 'w-14 h-14' },
};

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'full',
  size = 'md',
  className = '',
  imgClassName = '',
  theme = 'light',
  alt = 'MediArca Healthcare',
}) => {
  const imgSrc = variant === 'icon' ? mediarcaIcon : mediarcaLogo;
  const sizeClasses = SIZE_MAP[size] || SIZE_MAP.md;
  const dimensionClass = variant === 'icon' ? sizeClasses.icon : sizeClasses.full;

  if (theme === 'onDark') {
    const iconSize = { xs: 'w-4 h-4', sm: 'w-5 h-5', md: 'w-6 h-6', lg: 'w-7 h-7', xl: 'w-9 h-9' }[size] || 'w-6 h-6';
    const textSize = { xs: 'text-[13px]', sm: 'text-[15px]', md: 'text-[17px]', lg: 'text-[21px]', xl: 'text-[28px]' }[size] || 'text-[17px]';
    return (
      <div className={`inline-flex items-center gap-1.5 ${className}`} aria-label={alt}>
        <img src={mediarcaIcon} alt="" className={`${iconSize} object-contain select-none`} loading="eager" />
        <span className={`${textSize} font-semibold tracking-tight leading-none text-white`}>
          Medi<span className="text-[#2997ff]">Arca</span>
        </span>
      </div>
    );
  }

  if (theme === 'dark') {
    return (
      <div
        className={`inline-flex items-center justify-center bg-white rounded-xl px-2 py-0.5  ${className}`}
      >
        <img
          src={imgSrc}
          alt={alt}
          className={`${dimensionClass} object-contain select-none ${imgClassName}`}
          loading="eager"
        />
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center ${className}`}>
      <img
        src={imgSrc}
        alt={alt}
        className={`${dimensionClass} object-contain select-none ${imgClassName}`}
        loading="eager"
      />
    </div>
  );
};
