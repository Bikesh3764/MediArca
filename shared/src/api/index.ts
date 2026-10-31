// The full API client, split by area into this folder.
export * from './config';
export * from './schedule';
export * from './types';
export * from './http';
export * from './demoData';
import { authApi } from './client/auth';
import { doctorsApi } from './client/doctors';
import { appointmentsApi } from './client/appointments';
import { consultationApi } from './client/consultation';
import { adminApi } from './client/admin';
import { clinicApi } from './client/clinic';
import { receptionistApi } from './client/receptionist';
import { notificationsApi } from './client/notifications';
import { reportsApi } from './client/reports';

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
