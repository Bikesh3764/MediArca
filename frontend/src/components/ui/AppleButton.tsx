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
      // Action Blue (#0066cc) full-pill
      variantClass = 'bg-[#0066cc] text-white hover:bg-[#0071e3] shadow-sm rounded-full';
      break;
    case 'secondary':
      // Apple secondary pill with subtle border
      variantClass = 'bg-white text-[#0066cc] border border-[#0066cc]/40 hover:border-[#0066cc] hover:bg-[#0066cc]/5 rounded-full';
      break;
    case 'secondary-dark':
    case 'glass':
      // Apple translucent glass pill for dark backgrounds
      variantClass = 'bg-white/10 text-white border border-white/30 hover:bg-white/20 hover:border-white backdrop-blur-md rounded-full shadow-sm';
      break;
    case 'ghost':
      // Apple pearl capsule button
      variantClass = 'bg-[#fafafc] text-[#1d1d1f] border border-[#e0e0e0] hover:bg-white hover:border-[#cccccc] rounded-full';
      break;
    case 'dark':
      // Dark utility button
      variantClass = 'bg-[#1d1d1f] text-white hover:bg-[#333333] rounded-[8px]';
      break;
    case 'icon':
      variantClass = 'bg-[#d2d2d7]/50 hover:bg-[#d2d2d7]/80 text-[#1d1d1f] rounded-full p-2';
      break;
  }

  let sizeClass = '';
  switch (size) {
    case 'sm':
      sizeClass = variant === 'dark' ? 'px-3 py-1.5 text-[13px]' : 'px-4 py-1.5 text-[14px]';
      break;
    case 'md':
      sizeClass = variant === 'dark' ? 'px-4 py-2 text-[14px]' : 'px-[22px] py-[11px] text-[15px]';
      break;
    case 'lg':
      sizeClass = 'px-7 py-3.5 text-[17px]';
      break;
  }

  return (
    <button className={cn(baseClass, variantClass, sizeClass, className)} {...props}>
      {children}
    </button>
  );
};
