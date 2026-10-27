/**
 * Booking transactions wait in line behind a lock on the doctor's row, so a rush of bookings
 * for one doctor queues up. Prisma's defaults (2 s to get a database connection, 5 s to finish)
 * made 23 of 400 simultaneous bookings fail with a 500 in the stress test (FIX-049).
 */
// Together they stay under the 15 s the website waits for an answer (safeFetch DEFAULT_REQUEST_TIMEOUT_MS).
export const BOOKING_TX_OPTIONS = { maxWait: 6_000, timeout: 8_000 };

/** The database was too busy to run the booking (Prisma P2028): ask the user to retry, not a 500. */
export const isBookingBusyError = (err: any): boolean => err?.code === 'P2028';

export const BOOKING_BUSY_MESSAGE = 'Many people are booking right now. Please try again in a moment.';
