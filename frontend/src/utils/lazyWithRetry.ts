import React, { lazy } from 'react';

/**
 * Resilient lazy loader for Vite code-split components.
 * Automatically catches stale-chunk dynamic import failures (caused when a new deployment
 * updates chunk hashes while the user has an older version open) and reloads the page once
 * to transparently fetch the latest application bundle without crashing into an error screen.
 */
export function lazyWithRetry<T extends React.ComponentType<any>>(
  componentImport: () => Promise<{ default: T } | { [key: string]: any }>
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    const pageHasBeenRefreshed = Boolean(
      window.sessionStorage.getItem('mediarca_stale_chunk_refreshed') === 'true'
    );

    try {
      const module = await componentImport();
      // Reset flag on successful load
      window.sessionStorage.removeItem('mediarca_stale_chunk_refreshed');
      if ('default' in module) {
        return module as { default: T };
      }
      return { default: module as unknown as T };
    } catch (error: any) {
      const msg = (error?.message || String(error) || '').toLowerCase();
      const isChunkError =
        msg.includes('dynamically imported module') ||
        msg.includes('loading chunk') ||
        msg.includes('failed to fetch dynamically imported') ||
        msg.includes('failed to load module script') ||
        msg.includes('importing a module script failed') ||
        error?.name === 'ChunkLoadError';

      if (isChunkError && !pageHasBeenRefreshed) {
        // Mark that we are refreshing once to get the latest index.html bundle
        window.sessionStorage.setItem('mediarca_stale_chunk_refreshed', 'true');
        try {
          const url = new URL(window.location.href);
          url.searchParams.set('_v', Date.now().toString());
          window.location.replace(url.toString());
        } catch {
          window.location.reload();
        }
        // Return an unresolving promise while the page reloads
        return new Promise<{ default: T }>(() => {});
      }

      // If already reloaded or not a chunk error, bubble up to ErrorBoundary
      throw error;
    }
  });
}
