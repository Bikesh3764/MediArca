/**
 * Scroll Utility Functions
 *
 * Implements core scroll management logic for FIX-020:
 * - Multi-root scroll resets covering window, documentElement, body, and custom containers.
 * - Manual browser scrollRestoration configuration.
 */

export const executeScrollReset = (containerSelector?: string): void => {
  if (typeof window === 'undefined') return;

  // 1. Primary window scroll reset
  try {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  } catch {
    window.scrollTo(0, 0);
  }

  // 2. DOM document element resets
  if (document.documentElement) {
    document.documentElement.scrollTop = 0;
    document.documentElement.scrollLeft = 0;
  }
  if (document.body) {
    document.body.scrollTop = 0;
    document.body.scrollLeft = 0;
  }

  // 3. Main layout container reset if present
  const mainEl = document.querySelector('main');
  if (mainEl && mainEl.scrollTop > 0) {
    mainEl.scrollTop = 0;
  }

  // 4. Custom container if specified
  if (containerSelector) {
    const customEl = document.querySelector(containerSelector);
    if (customEl && customEl.scrollTop > 0) {
      customEl.scrollTop = 0;
    }
  }
};

export const setManualScrollRestoration = (): void => {
  if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
    try {
      window.history.scrollRestoration = 'manual';
    } catch {
      // Ignore environments where property cannot be set
    }
  }
};
