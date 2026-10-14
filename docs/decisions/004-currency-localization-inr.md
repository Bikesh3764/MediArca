# Architecture Decision Record 004: Currency and Regional Localization (INR & +91)

## Status
Accepted and Implemented

## Context
MediArca was created for the Indian healthcare ecosystem. During early development, UI templates and legacy views contained:
- Accidental dollar signs (`$`) in the Admin inspection views and financial totals.
- Unrestricted international phone formats that allowed arbitrary phone digits, breaking SMS/OTP integrations and clinic tele-calling.
- Inconsistent date math that evaluated dates against UTC rather than Indian Standard Time (IST / Asia/Kolkata), causing appointments booked after 06:30 PM IST (00:00 UTC next day) to shift dates or validate incorrectly.

## Decision
1. **Currency Invariant**:
   - The Indian Rupee symbol (`₹`) is enforced across ALL user portals (Patient, Doctor, Clinic, Receptionist, Admin).
   - Under no circumstances should the dollar sign (`$`) or other foreign currency symbols be used in user-facing views or API schemas.
2. **Phone Number Format Lock**:
   - All mobile numbers must adhere to the 10-digit Indian telecommunications format starting with `6`, `7`, `8`, or `9`.
   - Stored canonically in E.164 format: `+91XXXXXXXXXX`.
   - UI inputs render a static, non-editable `+91` country code badge, allowing users to simply type their 10-digit mobile number.
3. **IST Timezone & Calendar Arithmetic**:
   - All date operations (e.g. `getLocalDateString()`, `isValidDobDate()`, `getIndianTimeMinutes()`) calculate offsets based on `UTC+05:30`.
   - Protects against cross-day shift errors during late-evening clinic hours.

## Consequences
### Positive
- Culturally aligned and natural for Indian patients and doctors.
- Clean integration with Indian SMS/telephony gateways.
- Eliminates timezone boundary discrepancies.

### Negative / Trade-offs
- International phone numbers outside India are not supported in this version.
