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
    'inline-flex items-center justify-center font-normal select-none transition-all duration-150 ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066cc]/40 focus-visible:ring-offset-2 disabled:opacity-40 disabled:pointer-events-none cursor-pointer';

  let variantClass = '';
  switch (variant) {
    case 'primary':
      // Apple Action Blue (#0066cc) with dual ambient glow shadow per Emil Kowalski craft
      variantClass =
        'bg-[#0066cc] hover:bg-[#0071e3] text-white shadow-[0_1px_2px_rgba(0,0,0,0.06),0_2px_8px_rgba(0,102,204,0.18)] hover:shadow-[0_2px_4px_rgba(0,0,0,0.08),0_4px_16px_rgba(0,102,204,0.24)] rounded-full font-medium';
      break;
    case 'secondary':
      // Apple secondary pill per DESIGN.md & Impeccable contrast
      variantClass =
        'bg-white text-[#1d1d1f] border border-[#e5e5ea] hover:bg-[#fafafc] hover:border-[#d2d2d7] shadow-2xs rounded-full font-medium';
      break;
    case 'secondary-dark':
    case 'glass':
      // Apple translucent glass pill for dark backgrounds with high contrast white text
      variantClass =
        'bg-white/12 text-white border border-white/30 hover:bg-white/20 hover:border-white backdrop-blur-md rounded-full shadow-2xs font-medium';
      break;
    case 'ghost':
      // Apple Pearl/Parchment Button capsule per DESIGN.md
      variantClass =
        'bg-[#fafafc] text-[#1d1d1f] border border-[#e5e5ea] hover:bg-white hover:border-[#d2d2d7] rounded-full font-medium';
      break;
    case 'dark':
      // Dark utility button (SF Pro Text 14px / 400)
      variantClass =
        'bg-[#1d1d1f] text-white hover:bg-[#333333] shadow-[0_1px_3px_rgba(0,0,0,0.12)] rounded-[8px] font-medium';
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
