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
1. **Prisma Composite Constraint & Email-Only Uniqueness**:
   We transitioned from global `email` uniqueness to composite role-scoped uniqueness. Account uniqueness is strictly scoped to `(email, role)`; mobile number uniqueness is NOT required or enforced, permitting shared phone numbers for family members. OTP verification is strictly on email:
   ```prisma
   @@unique([email, role])
   ```
2. **Role-Scoped Authentication & Registration**:
   - The login and signup endpoints require `role` as part of their payload (or infer it strictly from portal context: `/patient/login`, `/doctor/login`, `/clinic/login`, `/receptionist/login`, `/admin/login`).
   - Authentication queries `findFirst({ where: { email, role } })`.
3. **Email-Only OTP Verification & Phone Validation**:
   - OTP verification is conducted exclusively via Email (6-digit numeric OTP sent via nodemailer).
   - Phone numbers are collected during registration and profile update and validated for the Indian standard (`+91` 10-digit mobile), but require no phone OTP or verification. Multiple accounts or family members may share a phone number.
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
