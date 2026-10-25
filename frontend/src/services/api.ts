// API client and shared helpers, split by area into ./api/. Import from this file.
export * from './api/config';
export * from './api/schedule';
export * from './api/types';
export * from './api/http';
export * from './api/demoData';
import { authApi } from './api/client/auth';
import { doctorsApi } from './api/client/doctors';
import { appointmentsApi } from './api/client/appointments';
import { consultationApi } from './api/client/consultation';
import { adminApi } from './api/client/admin';
import { clinicApi } from './api/client/clinic';
import { receptionistApi } from './api/client/receptionist';
import { notificationsApi } from './api/client/notifications';
import { reportsApi } from './api/client/reports';

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

/** One object with every API call, combined from the per-area clients. */
export const api = {
  ...authApi,
  ...doctorsApi,
  ...appointmentsApi,
  ...consultationApi,
  ...adminApi,
  ...clinicApi,
  ...receptionistApi,
  ...notificationsApi,
  ...reportsApi,
};
