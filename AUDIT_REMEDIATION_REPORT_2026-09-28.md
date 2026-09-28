# MediArca Audit Remediation Report — Re-audit Status

**Date:** 2026-09-28  
**Repository:** Bikesh3764/MediArca  
**Branch:** main  
**Current audited commit:** 7b562bc95add76773bcc3dbaf9563ff633d8ab83

## Status

The repository has made significant security progress, but the previous statement that **all Critical/High/Medium findings are resolved is no longer supported by the current source tree**.

This report is now aligned with the third security re-audit.

### Confirmed remaining priorities

| Priority | Remaining |
|---|---:|
| Critical | 0 |
| High | 8 |
| Medium | 12 |
| Low / Hardening | 2 |

## Highest-priority unresolved items

1. **Public medical-record storage:** clinical documents are still uploaded using permanent R2 public URLs, and the record controller redirects to those public URLs.
2. **JWT query-string transport:** protected record URLs can contain bearer tokens as `?token=`.
3. **Predictable walk-in credentials:** new walk-in patients can receive a predictable `walkin.<phone>@mediarca.local` identity with the fixed password `walkin123`.
4. **Doctor eligibility inconsistency:** receptionist walk-in booking/approval does not consistently re-check doctor verification/suspension.
5. **Stale receptionist assignments:** several operations check assignment existence but not assignment ACTIVE status.
6. **Broad doctor access to medical records:** record access is authorized by any historical appointment, including relationships that may only have been pending/rejected/cancelled.
7. **Queue capacity races:** check-then-insert capacity logic can still overfill under concurrent requests.
8. **Clinic schedule integrity:** clinic-specific doctor schedule updates do not require an active/accepted affiliation.

## Additional unresolved issues

Runtime schema DDL remains in application startup; authenticated responses can still serialize `passwordHash`; public queue preview does not fully enforce public doctor eligibility; queue scoping is inconsistent across clinics; receptionist walk-in appointment dates are not validated centrally; clinic suspension enforcement is inconsistent; generic receptionist cancellation does not reuse the active-receptionist guard; completed clinical notes can still be edited; receptionist action parsing has a lowercase ACCEPT bug; public verification checks are not always exact VERIFIED-state checks; CORS remains broader than the actual production allowlist; and JWTs remain in localStorage.

## What is confirmed fixed

The latest changes do correctly address the earlier findings around production JWT fail-closed behavior, client-controlled booking time, direct unverified doctor lookup, production demo fallback, receptionist account lifecycle, generic appointment medical-record exposure, file-signature validation, password minimums, DOB type handling, strict online appointment dates, schedule validation, consultation suspension checks, centralized appointment transitions, production error sanitization, and path traversal defense.

## Test/verification limitation

The repository claims 619 passing assertions and clean builds, but these were not independently reproduced against the current head in this audit. The existing verification script is primarily simulation/unit oriented and does not exercise the full Express + Prisma runtime path.

The latest GitHub Actions run for commit 7b562bc completed the frontend deployment successfully. The repository currently has no dedicated backend integration/security CI workflow.

## Required next phase

Treat the following as the next remediation phase before calling the repository fully hardened:

- private clinical-document storage with authenticated/signed access;
- removal of query-string JWT transport;
- secure walk-in identity/account creation;
- centralized receptionist/doctor/clinic authorization helpers;
- database-safe queue/capacity concurrency controls;
- removal of password hashes from all API responses;
- Prisma migration-based deployment;
- backend integration/security CI.
