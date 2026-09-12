import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface AppleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'secondary-dark' | 'glass' | 'ghost' | 'dark' | 'icon';
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
  let baseClass =
    'inline-flex items-center justify-center font-normal transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer';

  let variantClass = '';
  switch (variant) {
    case 'primary':
      // MediArca Brand Gradient (Cyan to Emerald) full-pill
      variantClass = 'bg-gradient-to-r from-[#0088e8] to-[#10b981] hover:from-[#0284c7] hover:to-[#059669] text-white shadow-xs hover:shadow rounded-full font-medium';
      break;
    case 'secondary':
      // MediArca secondary pill with Brand Cyan outline
      variantClass = 'bg-white text-[#0088e8] border border-[#0088e8]/35 hover:border-[#0088e8] hover:bg-[#0088e8]/5 rounded-full font-medium';
      break;
    case 'secondary-dark':
    case 'glass':
      // Apple translucent glass pill for dark backgrounds with high contrast white text
      variantClass = 'bg-white/12 text-white border border-white/30 hover:bg-white/22 hover:border-white backdrop-blur-md rounded-full shadow-sm font-medium';
      break;
    case 'ghost':
      // Apple soft parchment/pearl capsule button with dark text
      variantClass = 'bg-[#f5f5f7] text-[#1d1d1f] border border-[#e5e5ea] hover:bg-white hover:border-[#d2d2d7] rounded-full font-medium';
      break;
    case 'dark':
      // Dark utility button (SF Pro Text 14px / 400)
      variantClass = 'bg-[#1d1d1f] text-white hover:bg-[#333333] rounded-[8px] font-medium';
      break;
    case 'icon':
      variantClass = 'bg-[#d2d2d7]/40 hover:bg-[#d2d2d7]/70 text-[#1d1d1f] rounded-full p-2';
      break;
  }

  let sizeClass = '';
  switch (size) {
    case 'sm':
      sizeClass = variant === 'dark' ? 'px-3 py-1.5 text-[12px]' : 'px-4 py-1.5 text-[13px]';
      break;
    case 'md':
      sizeClass = variant === 'dark' ? 'px-4 py-2 text-[14px]' : 'px-[22px] py-[10px] text-[14px] sm:text-[15px]';
      break;
    case 'lg':
      sizeClass = 'px-7 py-3.5 text-[16px] sm:text-[17px]';
      break;
  }

  return (
    <button className={cn(baseClass, variantClass, sizeClass, className)} {...props}>
      {children}
    </button>
  );
};
