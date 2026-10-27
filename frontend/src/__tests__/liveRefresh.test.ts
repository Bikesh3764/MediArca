import { describe, expect, it } from 'vitest';
import type { Appointment } from '../services/api';
import { isEventForDoctors, needsInstantQueueRefresh, NEAR_TURN_PATIENTS } from '../utils/liveRefresh';

// FIX-053: only visits that can change soon refresh the moment a queue moves
const TODAY = '2026-10-27';
const visit = (over: Partial<Appointment> & { away?: number; turn?: boolean }): Appointment => {
  const { away, turn, ...rest } = over;
  return {
    id: 'a1',
    doctorId: 'doc1',
    appointmentDate: TODAY,
    status: 'WAITING',
    queueNumber: 10,
    liveQueue: away === undefined ? undefined : { currentServingQueueNumber: 1, patientsAway: away, estimatedWaitMinutes: away * 5, isYourTurn: Boolean(turn) },
    ...rest,
  } as Appointment;
};

describe('needsInstantQueueRefresh', () => {
  it('refreshes a token close to its turn', () => {
    expect(needsInstantQueueRefresh([visit({ away: NEAR_TURN_PATIENTS })], 'doc1', TODAY)).toBe(true);
    expect(needsInstantQueueRefresh([visit({ away: 0 })], 'doc1', TODAY)).toBe(true);
  });

  it('skips a token far back in line (the 60s poll covers it)', () => {
    expect(needsInstantQueueRefresh([visit({ away: NEAR_TURN_PATIENTS + 1 })], 'doc1', TODAY)).toBe(false);
    expect(needsInstantQueueRefresh([visit({ away: 30 })], 'doc1', TODAY)).toBe(false);
  });

  it('always refreshes when it is your turn, or the visit is pending or in the cabin', () => {
    expect(needsInstantQueueRefresh([visit({ away: 30, turn: true })], 'doc1', TODAY)).toBe(true);
    expect(needsInstantQueueRefresh([visit({ away: 30, status: 'PENDING_APPROVAL' })], 'doc1', TODAY)).toBe(true);
    expect(needsInstantQueueRefresh([visit({ away: 0, status: 'IN_CONSULTATION' })], 'doc1', TODAY)).toBe(true);
  });

  it('refreshes when the live position is unknown', () => {
    expect(needsInstantQueueRefresh([visit({})], 'doc1', TODAY)).toBe(true);
  });

  it('ignores other doctors and other days', () => {
    expect(needsInstantQueueRefresh([visit({ away: 1 })], 'doc2', TODAY)).toBe(false);
    expect(needsInstantQueueRefresh([visit({ away: 1, appointmentDate: '2026-10-28' })], 'doc1', TODAY)).toBe(false);
  });

  it('an event without a doctor counts for every doctor', () => {
    expect(needsInstantQueueRefresh([visit({ away: 1, doctorId: 'docX' })], undefined, TODAY)).toBe(true);
  });

  it('one close visit among several is enough', () => {
    expect(needsInstantQueueRefresh([visit({ away: 20 }), visit({ id: 'a2', away: 2 })], 'doc1', TODAY)).toBe(true);
  });
});

describe('isEventForDoctors', () => {
  it('matches only the listed doctors', () => {
    expect(isEventForDoctors('doc1', ['doc1', 'doc2'])).toBe(true);
    expect(isEventForDoctors('doc3', ['doc1', 'doc2'])).toBe(false);
  });

  it('treats a missing doctor id or an unknown list as a match', () => {
    expect(isEventForDoctors(undefined, ['doc1'])).toBe(true);
    expect(isEventForDoctors('doc1', undefined)).toBe(true);
    expect(isEventForDoctors('doc1', [undefined])).toBe(true);
  });
});
