import { useEffect, useRef } from 'react';
import { API_BASE_URL } from '../services/api';

/**
 * Live updates from the backend (Server-Sent Events over fetch, so the login
 * token travels in the Authorization header, never in the URL).
 *
 * One shared stream per tab, opened while at least one screen is listening and
 * the tab is visible. Events only say "doctor X's queue changed" or "you have a
 * notification"; screens react by re-fetching silently. Polling stays on as backup.
 */
export type LiveEventType = 'queue' | 'notification' | 'reconnect';
export interface LiveEventData {
  doctorId?: string;
}
type Handler = (data: LiveEventData) => void;

const handlers = new Map<LiveEventType, Set<Handler>>();
let controller: AbortController | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryDelay = 2000;
let hasConnectedOnce = false;

const listenerCount = () => {
  let n = 0;
  for (const set of handlers.values()) n += set.size;
  return n;
};

const emit = (type: LiveEventType, data: LiveEventData) => {
  handlers.get(type)?.forEach((h) => {
    try {
      h(data);
    } catch (err) {
      console.warn('Live event handler failed:', err);
    }
  });
};

const disconnect = () => {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  controller?.abort();
  controller = null;
};

const scheduleReconnect = () => {
  if (retryTimer || listenerCount() === 0) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    connect();
  }, retryDelay);
  retryDelay = Math.min(retryDelay * 2, 30000);
};

const parseBlock = (block: string) => {
  let event = 'message';
  let data = '';
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) data += line.slice(5).trim();
  }
  if (event === 'ready') {
    retryDelay = 2000;
    // After a dropped connection, refresh once in case we missed events
    if (hasConnectedOnce) emit('reconnect', {});
    hasConnectedOnce = true;
    return;
  }
  if (event !== 'queue' && event !== 'notification') return;
  let parsed: LiveEventData = {};
  try {
    parsed = data ? JSON.parse(data) : {};
  } catch {
    /* ignore malformed payloads */
  }
  emit(event, parsed);
};

const connect = async () => {
  if (controller || typeof window === 'undefined') return;
  if (document.hidden || listenerCount() === 0) return;
  const token = localStorage.getItem('mediarca_token');
  if (!token) return;

  const ctrl = new AbortController();
  controller = ctrl;
  try {
    const res = await fetch(`${API_BASE_URL}/events`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
      signal: ctrl.signal,
      cache: 'no-store',
    });
    if (!res.ok || !res.body) throw new Error(`Live stream unavailable (${res.status})`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx = buffer.indexOf('\n\n');
      while (idx !== -1) {
        parseBlock(buffer.slice(0, idx));
        buffer = buffer.slice(idx + 2);
        idx = buffer.indexOf('\n\n');
      }
    }
  } catch {
    /* network drop or abort; reconnect below unless we stopped on purpose */
  }
  if (controller === ctrl) {
    controller = null;
    if (!ctrl.signal.aborted) scheduleReconnect();
  }
};

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) disconnect();
    else connect();
  });
}

export const subscribeLiveEvent = (type: LiveEventType, handler: Handler): (() => void) => {
  if (!handlers.has(type)) handlers.set(type, new Set());
  handlers.get(type)!.add(handler);
  connect();
  return () => {
    handlers.get(type)?.delete(handler);
    if (listenerCount() === 0) disconnect();
  };
};

/**
 * React hook: run `handler` when a live event arrives (and once after a reconnect).
 * Calls are coalesced so a burst of changes triggers a single refresh.
 */
export function useLiveEvent(
  type: Exclude<LiveEventType, 'reconnect'>,
  handler: Handler,
  enabled: boolean = true
): void {
  const saved = useRef(handler);
  useEffect(() => {
    saved.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pending: LiveEventData = {};
    const fire = (data: LiveEventData) => {
      // Keep the doctorId only if every event in the burst is for the same doctor
      pending = timer && pending.doctorId !== data.doctorId ? {} : data;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        saved.current(pending);
      }, 400);
    };
    const offMain = subscribeLiveEvent(type, fire);
    const offReconnect = subscribeLiveEvent('reconnect', fire);
    return () => {
      if (timer) clearTimeout(timer);
      offMain();
      offReconnect();
    };
  }, [type, enabled]);
}
