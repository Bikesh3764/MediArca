import React, { lazy } from 'react';

/**
 * Resilient lazy loader for Vite code-split pages.
 *
 * - Stale files: when a new deployment changed the file names while the user had an older
 *   version open, the import fails; we reload the page once to fetch the latest bundle
 *   instead of crashing into an error screen.
 * - No spinner flash: once a page's code is downloaded (opened before, or `preload()`ed),
 *   it renders straight away. React.lazy alone suspends on every first render and React then
 *   holds the loading spinner for at least 300 ms, which blanked the screen on each page switch.
 */
export type PreloadableComponent<T extends React.ComponentType<any>> = React.FC<React.ComponentProps<T>> & {
  /** Downloads the page's code ahead of time so opening it shows no loading spinner. */
  preload: () => void;
};

const STALE_FLAG = 'mediarca_stale_chunk_refreshed';

const isChunkError = (error: any): boolean => {
  const msg = (error?.message || String(error) || '').toLowerCase();
  return (
    msg.includes('dynamically imported module') ||
    msg.includes('loading chunk') ||
    msg.includes('failed to fetch dynamically imported') ||
    msg.includes('failed to load module script') ||
    msg.includes('importing a module script failed') ||
    error?.name === 'ChunkLoadError'
  );
};

const readFlag = (): boolean => {
  try {
    return window.sessionStorage.getItem(STALE_FLAG) === 'true';
  } catch {
    return false;
  }
};

const writeFlag = (on: boolean): void => {
  try {
    if (on) window.sessionStorage.setItem(STALE_FLAG, 'true');
    else window.sessionStorage.removeItem(STALE_FLAG);
  } catch {
    /* storage blocked */
  }
};

export function lazyWithRetry<T extends React.ComponentType<any>>(
  componentImport: () => Promise<{ default: T } | { [key: string]: any }>
): PreloadableComponent<T> {
  let loaded: T | null = null;
  let pending: Promise<{ default: T }> | null = null;

  // One shared download; a failed one is forgotten so the next try starts fresh.
  const load = (): Promise<{ default: T }> => {
    if (!pending) {
      pending = componentImport().then(
        (module) => {
          const mod = ('default' in module ? module : { default: module }) as { default: T };
          loaded = mod.default;
          return mod;
        },
        (error) => {
          pending = null;
          throw error;
        }
      );
    }
    return pending;
  };

  const LazyPage = lazy(async () => {
    const pageHasBeenRefreshed = readFlag();
    try {
      const mod = await load();
      writeFlag(false);
      return mod;
    } catch (error: any) {
      if (isChunkError(error) && !pageHasBeenRefreshed) {
        // Reload once to get the latest index.html bundle
        writeFlag(true);
        try {
          const url = new URL(window.location.href);
          url.searchParams.set('_v', Date.now().toString());
          window.location.replace(url.toString());
        } catch {
          window.location.reload();
        }
        // Never resolves: the page is reloading
        return new Promise<{ default: T }>(() => {});
      }
      // Already reloaded, or not a file error: let the ErrorBoundary show it
      throw error;
    }
  });

  const Page = ((props: React.ComponentProps<T>) =>
    loaded
      ? React.createElement(loaded, props)
      : React.createElement(LazyPage as React.ComponentType<any>, props)) as PreloadableComponent<T>;

  Page.preload = () => {
    load().catch(() => {
      // Opening the page later retries (and handles stale files) as usual
    });
  };
  return Page;
}
