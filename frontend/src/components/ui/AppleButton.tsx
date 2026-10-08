import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface AppleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | 'primary'
    | 'secondary'
    | 'ghost'
    | 'destructive'
    | 'icon'
    | 'secondary-dark'
    | 'glass'
    | 'dark';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const AppleButton: React.FC<AppleButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}) => {
  const baseClass =
    'inline-flex items-center justify-center gap-2 rounded-full font-sans font-medium tracking-[-0.01em] select-none transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066cc]/25 focus-visible:ring-offset-1 disabled:opacity-45 disabled:pointer-events-none cursor-pointer [&_svg]:shrink-0';

  let variantClass = '';
  switch (variant) {
    case 'primary':
      variantClass =
        'bg-[#0066cc] hover:bg-[#0071e3] text-white border border-transparent shadow-2xs';
      break;
    case 'secondary':
      variantClass =
        'bg-white hover:bg-[#f5f5f7] text-[#0066cc] border border-[#0066cc]/35 hover:border-[#0066cc]';
      break;
    case 'ghost':
      variantClass =
        'bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea] hover:border-[#d2d2d7]';
      break;
    case 'destructive':
      variantClass =
        'bg-rose-50 hover:bg-rose-100/80 text-rose-600 border border-rose-200/80 hover:border-rose-300';
      break;
    case 'icon':
      variantClass =
        'bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border border-[#e5e5ea] hover:border-[#d2d2d7] p-0';
      break;
    case 'secondary-dark':
    case 'glass':
      variantClass =
        'bg-white/12 hover:bg-white/20 text-white border border-white/25 hover:border-white/50 backdrop-blur-md shadow-2xs';
      break;
    case 'dark':
      variantClass =
        'bg-[#1d1d1f] hover:bg-[#333336] text-white border border-transparent shadow-2xs';
      break;
  }

  let sizeClass = '';
  if (variant === 'icon') {
    switch (size) {
      case 'sm':
        sizeClass = 'w-8 h-8 text-[12px] [&_svg]:w-3.5 [&_svg]:h-3.5';
        break;
      case 'md':
        sizeClass = 'w-10 h-10 text-[14px] [&_svg]:w-4 [&_svg]:h-4';
        break;
      case 'lg':
        sizeClass = 'w-12 h-12 text-[16px] [&_svg]:w-5 [&_svg]:h-5';
        break;
    }
  } else {
    switch (size) {
      case 'sm':
        sizeClass = 'h-8 px-3.5 text-[12px] [&_svg]:w-3.5 [&_svg]:h-3.5';
        break;
      case 'md':
        sizeClass = 'h-10 px-5 text-[13px] sm:text-[14px] [&_svg]:w-4 [&_svg]:h-4';
        break;
      case 'lg':
        sizeClass = 'h-12 px-6 text-[15px] [&_svg]:w-4 [&_svg]:h-4';
        break;
    }
  }

  return (
    <button className={cn(baseClass, variantClass, sizeClass, className)} {...props}>
      {children}
    </button>
  );
};
