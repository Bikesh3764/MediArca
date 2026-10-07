/**
 * Safe API Client Engine with Bounded Timeouts and Conservative Retry Policy
 *
 * Implements FIX-019 from MASTER_FIX_PLAN.md:
 * - Bounded request timeouts (default 15s, file uploads 30s)
 * - Safe, conservative retries for idempotent read (GET/HEAD) operations only
 * - Strict ZERO automatic retries for mutations (POST, PUT, PATCH, DELETE) to prevent duplicate operations
 * - Transparent retry on transient platform failures (502, 503, 504, network drops, timeouts) with backoff & jitter
 * - Immediate fail-fast for client errors (400, 401, 403, 404, 409, 422, 429) and server bugs (500)
 */

export class ApiTimeoutError extends Error {
  public readonly isTimeout = true;
  public readonly status = 408;

  constructor(message = 'Request timed out. Please check your connection and try again.') {
    super(message);
    this.name = 'ApiTimeoutError';
    Object.setPrototypeOf(this, ApiTimeoutError.prototype);
  }
}

export const DEFAULT_REQUEST_TIMEOUT_MS = 15000; // 15 seconds: optimal for Render cold-starts & mobile networks
export const DEFAULT_MAX_RETRIES = 1; // 1 retry (2 total attempts) for safe GET requests
export const RETRYABLE_STATUS_CODES = [502, 503, 504] as const;
export const NON_RETRYABLE_STATUS_CODES = [400, 401, 403, 404, 409, 422, 429, 500] as const;

export interface SafeFetchOptions extends RequestInit {
  timeoutMs?: number;
  maxRetries?: number;
  retryOnTransient?: boolean;
}

export function isSafeToRetryMethod(method?: string): boolean {
  if (!method) return true; // Default method in fetch is GET
  const normalized = method.trim().toUpperCase();
  return normalized === 'GET' || normalized === 'HEAD';
}

export function isRetryableStatusCode(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}

export function isRetryableError(err: any): boolean {
  if (!err) return false;
  if (err.isTimeout || err.name === 'ApiTimeoutError' || err.name === 'TimeoutError') {
    return true;
  }
  if (err.name === 'AbortError') {
    return true;
  }
  if (err.name === 'TypeError') {
    return true;
  }
  return false;
}

export function getRetryDelayMs(attempt: number, baseDelay = 300): number {
  const exponential = baseDelay * Math.pow(1.5, attempt);
  const jitter = Math.floor(Math.random() * 100);
  return Math.min(exponential + jitter, 2000);
}

export async function safeFetch(
  input: RequestInfo | URL,
  options: SafeFetchOptions = {}
): Promise<Response> {
  const {
    timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
    maxRetries = DEFAULT_MAX_RETRIES,
    retryOnTransient = true,
    ...fetchInit
  } = options;

  const method = fetchInit.method ? fetchInit.method.toUpperCase() : 'GET';
  const isSafeMethod = isSafeToRetryMethod(method);

  // CRITICAL MUTATION SAFETY (FIX-019):
  // Non-idempotent mutations (POST, PUT, PATCH, DELETE) MUST NEVER receive automatic retries.
  const effectiveMaxRetries = isSafeMethod && retryOnTransient ? Math.max(0, maxRetries) : 0;

  let attempt = 0;

  while (true) {
    attempt++;
    let timeoutId: any = null;
    let isTimedOut = false;
    const controller = new AbortController();

    if (fetchInit.signal) {
      if (fetchInit.signal.aborted) {
        controller.abort(fetchInit.signal.reason);
      } else {
        fetchInit.signal.addEventListener(
          'abort',
          () => {
            controller.abort(fetchInit.signal?.reason);
          },
          { once: true }
        );
      }
    }

    if (timeoutMs > 0 && timeoutMs < Infinity) {
      timeoutId = setTimeout(() => {
        isTimedOut = true;
        controller.abort(new ApiTimeoutError(`Request timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    }

    try {
      const response = await fetch(input, {
        ...fetchInit,
        signal: controller.signal,
      });

      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      // Check if response is a transient platform status (502, 503, 504) on safe idempotent read
      if (isSafeMethod && isRetryableStatusCode(response.status) && attempt <= effectiveMaxRetries) {
        const delay = getRetryDelayMs(attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      return response;
    } catch (err: any) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      // If caller explicitly aborted this request before timeout, rethrow immediately
      if (fetchInit.signal?.aborted && !isTimedOut) {
        throw err;
      }

      const isTimeout =
        isTimedOut ||
        err?.isTimeout ||
        err?.name === 'ApiTimeoutError' ||
        (err?.name === 'AbortError' && isTimedOut);

      const normalizedError = isTimeout
        ? new ApiTimeoutError(`Request timed out after ${timeoutMs}ms`)
        : err;

      const canRetry = isSafeMethod && isRetryableError(normalizedError) && attempt <= effectiveMaxRetries;

      if (canRetry) {
        const delay = getRetryDelayMs(attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      throw normalizedError;
    }
  }
}
