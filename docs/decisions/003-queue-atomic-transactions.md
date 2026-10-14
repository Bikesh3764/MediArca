# Architecture Decision Record 003: Queue Atomic Concurrency and Consultation Locking

## Status
Accepted and Implemented

## Context
In high-throughput clinic environments, multiple front-desk receptionists and doctors operate on the queue concurrently:
1. Multiple receptionists might attempt to confirm `PENDING_APPROVAL` appointments for the same doctor and shift at the exact same second.
2. A doctor might rapidly click "Call Patient" on two different appointments, or a doctor and a receptionist might simultaneously call a patient into the cabin.
3. A doctor affiliated with two different clinics could inadvertently have active consultations opened in both facilities simultaneously.
4. Non-transactional updates resulted in duplicate sequential token numbers (e.g., two patients assigned Token #3) or two simultaneous `IN_CONSULTATION` visits.

## Decision
1. **Mandatory Prisma Transactions**:
   All state transitions for appointments are wrapped in an atomic database transaction using `prisma.$transaction(async (tx) => { ... })`.
2. **Single Active Consultation Invariant**:
   Inside `executeCallPatientTransaction` and `executeReceptionistInConsultationTransaction`:
   - Query the database with `tx.appointment.findFirst` for any existing appointment with `status: 'IN_CONSULTATION'` for the given doctor.
   - If an active consultation exists, the request is immediately rejected with HTTP 400 (`Doctor already has an active consultation in progress`).
   - If no conflict exists, the target appointment is updated to `status: 'IN_CONSULTATION'`.
3. **Atomic Sequential Token Assignment**:
   When confirming an appointment (`approveAppointment`):
   - Count the total confirmed appointments for that doctor, date, and shift window inside the transaction.
   - Assign `nextQueueNumber = confirmedCount + 1`.
   - Update appointment status to `WAITING` and set `queueNumber: nextQueueNumber`.
4. **Consultation Hold Support**:
   - Implemented `holdConsultation` allowing a doctor to safely return an `IN_CONSULTATION` patient to `WAITING` (preserving their original token number) when tests, vitals, or dressing are pending.

## Consequences
### Positive
- Strict mathematical guarantee that no doctor has more than one patient in a consultation cabin at any time.
- Zero duplicate token numbers under concurrent receptionist load.
- Race conditions eliminated completely.

### Negative / Trade-offs
- Slight lock overhead during peak concurrent submissions, mitigated by bounded query scopes and database indexing on `[doctorId, appointmentDate, status]`.
