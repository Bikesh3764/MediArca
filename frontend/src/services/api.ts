// API client. The code lives in shared/src/api (used by the website and the mobile app);
// ./platform plugs in the browser first. Import from this file.
import './platform';
export * from '@mediarca/shared/api';

import {
  safeFetch,
  ApiTimeoutError,
  DEFAULT_REQUEST_TIMEOUT_MS,
  DEFAULT_MAX_RETRIES,
  RETRYABLE_STATUS_CODES,
  NON_RETRYABLE_STATUS_CODES,
  isSafeToRetryMethod,
  isRetryableStatusCode,
  isRetryableError,
} from './safeFetch';

export {
  safeFetch,
  ApiTimeoutError,
  DEFAULT_REQUEST_TIMEOUT_MS,
  DEFAULT_MAX_RETRIES,
  RETRYABLE_STATUS_CODES,
  NON_RETRYABLE_STATUS_CODES,
  isSafeToRetryMethod,
  isRetryableStatusCode,
  isRetryableError,
};
export type { SafeFetchOptions } from './safeFetch';
