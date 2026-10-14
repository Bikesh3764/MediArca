# Architecture Decision Record 002: Role-Scoped Account Uniqueness and Phone Lifecycle

## Status
Accepted and Implemented

## Context
In a healthcare ecosystem, users frequently operate across multiple roles. For example:
- A medical doctor may also need to book an appointment for their child as a patient.
- A clinic receptionist or clinic administrator might also be a patient at another healthcare facility.
- A developer or QA engineer tests both practitioner and patient flows using a single email account.

Initially, a global unique constraint on `User.email` (`@unique`) caused `409 Conflict` errors whenever an existing doctor or receptionist attempted to sign up or log into the patient portal with their email. Furthermore, abandoned or unverified accounts locked phone numbers, preventing legitimate users from verifying them.

## Decision
1. **Prisma Composite Constraint**:
   We transitioned from global `email` uniqueness to composite role-scoped uniqueness:
   ```prisma
   @@unique([email, role])
   ```
2. **Role-Scoped Authentication & Registration**:
   - The login and signup endpoints require `role` as part of their payload (or infer it strictly from portal context: `/patient/login`, `/doctor/login`, `/clinic/login`, `/receptionist/login`, `/admin/login`).
   - Authentication queries `findFirst({ where: { email, role } })`.
3. **Unverified Account Phone Release**:
   - Unverified accounts (`isEmailVerified: false`) do not permanently claim phone numbers.
   - When a verified user registers with a phone number previously entered by an unverified stale account, `verifyEmailOtp` releases the unverified account's phone rather than throwing a duplicate phone collision.
4. **Strict Phone Number Normalization**:
   - All phone numbers are sanitized and formatted to the canonical Indian E.164 standard: `+91XXXXXXXXXX` (10 digits after +91 prefix).

## Consequences
### Positive
- Doctors and staff can seamlessly use MediArca as patients with their primary email address.
- Zero credential collisions between different portals.
- Resilient phone number lifecycle: Unverified abandonments do not block real patients.

### Negative / Trade-offs
- Password resets must specify the target role or prompt the user if multiple accounts exist for the same email.
- Authentication tokens must always encode the specific `role` within the JWT payload.
