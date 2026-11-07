import React from 'react';

/** First load of a page: grey shapes of the layout instead of a spinner. Never used for background refreshes. */
export const PagePlaceholder: React.FC<{ narrow?: boolean }> = ({ narrow = false }) => (
  <div className="min-h-screen bg-[#f5f5f7] pb-24 md:pb-16" aria-busy="true" aria-label="Loading">
    <div className={`${narrow ? 'max-w-2xl' : 'max-w-6xl'} mx-auto px-3 sm:px-6 pt-5 sm:pt-8 space-y-5 ma-fade-up`}>
      <div className="bg-white rounded-2xl border border-[#e5e5ea] p-5 sm:p-6 flex items-center gap-4">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#f0f0f2] shrink-0" />
        <div className="flex-1 space-y-3">
          <div className="h-4 w-3/5 max-w-xs rounded-full bg-[#f0f0f2]" />
          <div className="h-3 w-2/5 max-w-[12rem] rounded-full bg-[#f0f0f2]" />
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-[#e5e5ea] h-32" />
      <div className="bg-white rounded-2xl border border-[#e5e5ea] h-44" />
    </div>
  </div>
);
