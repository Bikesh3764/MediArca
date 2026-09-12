import React from 'react';
import mediarcaLogo from '../../assets/mediarca-logo.jpg';
import mediarcaIcon from '../../assets/mediarca-icon.jpg';

export interface BrandLogoProps {
  variant?: 'full' | 'icon';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  imgClassName?: string;
  theme?: 'light' | 'dark';
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

  if (theme === 'dark') {
    return (
      <div
        className={`inline-flex items-center justify-center bg-white rounded-xl px-2 py-0.5 shadow-xs ${className}`}
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
