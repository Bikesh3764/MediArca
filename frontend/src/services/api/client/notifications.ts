import { safeFetch } from '../../safeFetch';
import { API_BASE_URL } from '../config';
import { getHeaders, handleResponse } from '../http';

let inFlightNotificationsPromise: Promise<{ notifications: any[]; unreadCount: number }> | null = null;
let lastNotificationsFetchTime = 0;
let cachedNotificationsData: { notifications: any[]; unreadCount: number } | null = null;

export const notificationsApi = {
  // Notifications (BUG-13) with in-flight deduplication and caching
  async getNotifications(): Promise<{ notifications: any[]; unreadCount: number }> {
    const now = Date.now();
    if (cachedNotificationsData && now - lastNotificationsFetchTime < 3000) {
      return cachedNotificationsData;
    }
    if (inFlightNotificationsPromise) {
      return inFlightNotificationsPromise;
    }

    const promise = (async (): Promise<{ notifications: any[]; unreadCount: number }> => {
      try {
        const res = await safeFetch(`${API_BASE_URL}/notifications`, { headers: getHeaders() });
        const data = (await handleResponse(res)) as { notifications: any[]; unreadCount: number };
        cachedNotificationsData = data;
        lastNotificationsFetchTime = Date.now();
        return data;
      } finally {
        inFlightNotificationsPromise = null;
      }
    })();

    inFlightNotificationsPromise = promise;
    return promise;
  },

  async markNotificationRead(id: string): Promise<any> {
    cachedNotificationsData = null;
    lastNotificationsFetchTime = 0;
    const res = await safeFetch(`${API_BASE_URL}/notifications/${id}/read`, {
      method: 'PATCH',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async markAllNotificationsRead(): Promise<any> {
    cachedNotificationsData = null;
    lastNotificationsFetchTime = 0;
    const res = await safeFetch(`${API_BASE_URL}/notifications/read-all`, {
      method: 'PATCH',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },
};
