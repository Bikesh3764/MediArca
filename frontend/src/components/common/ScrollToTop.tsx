import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { executeScrollReset, setManualScrollRestoration } from '../../utils/scrollUtils';

/**
 * ScrollToTop
 *
 * Implements FIX-020 from MASTER_FIX_PLAN.md:
 * - Automatically and reliably resets scroll position to the top on page-level route changes.
 * - Compatible with React Router HashRouter (#/route).
 * - Compatible with route-level lazy loading (FIX-011) and dynamic chunk loading.
 * - Resets all possible scroll roots: window, document.documentElement, document.body, and main container.
 * - Uses immediate reset + dual requestAnimationFrame safety guards for asynchronous layout rendering.
 * - Avoids disruptive re-scrolling on in-page query/filter changes (tracks pathname changes).
 * - Cleanly manages browser scrollRestoration mode.
 */

export interface ScrollToTopProps {
  /** Optional custom container selector to reset in addition to window */
  containerSelector?: string;
  /** Whether to scroll on POP (back/forward) navigation. Defaults to true for SPAs with dynamic DOM */
  scrollOnPop?: boolean;
}

export const ScrollToTop: React.FC<ScrollToTopProps> = ({
  containerSelector,
  scrollOnPop = true,
}) => {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  const prevPathnameRef = useRef<string>(pathname);

  useEffect(() => {
    // Set manual scroll restoration to prevent browser from abruptly jumping
    // to previous scroll positions during asynchronous component rendering.
    setManualScrollRestoration();
  }, []);

  useEffect(() => {
    const isPathChange = prevPathnameRef.current !== pathname;
    prevPathnameRef.current = pathname;

    // Reset scroll on page-level pathname change, or when user explicitly navigates (PUSH)
    // or when navigating back/forward (POP)
    const shouldScroll = isPathChange || navigationType === 'PUSH' || (navigationType === 'POP' && scrollOnPop);

    if (shouldScroll) {
      // Immediate execution
      executeScrollReset(containerSelector);

      // Frame-buffered execution for lazy-loaded Suspense chunks that commit DOM in subsequent frames
      let rafId2: number | null = null;
      const rafId1 = requestAnimationFrame(() => {
        executeScrollReset(containerSelector);
        rafId2 = requestAnimationFrame(() => {
          executeScrollReset(containerSelector);
        });
      });

      return () => {
        cancelAnimationFrame(rafId1);
        if (rafId2 !== null) {
          cancelAnimationFrame(rafId2);
        }
      };
    }
  }, [pathname, navigationType, containerSelector, scrollOnPop]);

  return null;
};

export default ScrollToTop;
