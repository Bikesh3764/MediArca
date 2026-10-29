import React from 'react';

interface PageHeroProps {
  /** Small blue label above the title. */
  eyebrow?: string;
  title: React.ReactNode;
  /** Part of the title shown in the blue gradient, on its own line. */
  highlight?: React.ReactNode;
  subtitle?: React.ReactNode;
  align?: 'center' | 'left';
  /** Smaller band for task pages such as Track walk-in. */
  compact?: boolean;
  /** Buttons or chips under the subtitle. */
  children?: React.ReactNode;
}

/** Soft blue header band for public info pages, matching the home page. */
export const PageHero: React.FC<PageHeroProps> = ({ eyebrow, title, highlight, subtitle, align = 'center', compact = false, children }) => {
  const centered = align === 'center';
  return (
    <section className="relative overflow-clip bg-gradient-to-b from-[#e9f2fc] via-[#f1f6fc] to-[#f5f5f7]">
      <div className="pointer-events-none absolute -top-40 right-[-8%] w-[560px] h-[560px] rounded-full bg-[radial-gradient(closest-side,rgba(0,102,204,0.12),transparent)]" />
      <div className="pointer-events-none absolute -top-64 left-[-12%] w-[520px] h-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(41,151,255,0.10),transparent)]" />
      <div
        className={`relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 ${compact ? 'pt-9 pb-7 sm:pt-14 sm:pb-10' : 'pt-12 pb-10 sm:pt-20 sm:pb-14'} ${
          centered ? 'text-center' : ''
        }`}
      >
        <div className={centered ? 'max-w-3xl mx-auto' : 'max-w-3xl'}>
          {eyebrow && <p className="ma-fade-up text-sm font-semibold text-primary">{eyebrow}</p>}
          <h1 className={`ma-fade-up ma-delay-1 mt-2 font-display font-semibold tracking-tight text-[#1d1d1f] ${
              compact ? 'text-[30px] leading-[1.1] sm:text-[44px]' : 'text-[34px] leading-[1.08] sm:text-5xl lg:text-[56px]'
            }`}>
            {title}
            {highlight && (
              <>
                <br />
                <span className="bg-gradient-to-r from-[#0066cc] to-[#2997ff] bg-clip-text text-transparent">{highlight}</span>
              </>
            )}
          </h1>
          {subtitle && (
            <p
              className={`ma-fade-up ma-delay-2 mt-4 text-base sm:text-xl text-[#48484a] leading-relaxed ${
                centered ? 'max-w-2xl mx-auto' : 'max-w-2xl'
              }`}
            >
              {subtitle}
            </p>
          )}
          {children && (
            <div className={`ma-fade-up ma-delay-3 mt-7 flex flex-wrap gap-3 ${centered ? 'justify-center' : ''}`}>{children}</div>
          )}
        </div>
      </div>
    </section>
  );
};
