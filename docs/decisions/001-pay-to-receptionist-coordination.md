# Architecture Decision Record 001: Pay-to-Receptionist Coordination Architecture

## Status
Accepted and Implemented

## Context
Initial product designs considered integrating third-party automated payment gateways (e.g. Razorpay, Stripe) for booking appointments online. However, in physical Indian outpatient clinic practices:
1. Online payment gateway drop-offs and UPI failure rates are significant friction points for non-technical patients.
2. Clinics frequently have custom payment preferences (direct doctor UPI QR, clinic counter cash, or split doctor-facility settlements).
3. Automated upfront payments create massive overhead for cancellations, no-shows, doctor emergency leaves, and refund reconciliations.
4. Patients who walk in without internet access require equal access to queue tokens.

## Decision
We decided to adopt a **Zero-Upfront Payment & Receptionist Coordination Architecture**:
1. **Zero Upfront Gateway**: Online booking NEVER requires credit card, debit card, or upfront payment gateway checkout.
2. **Estimated Token Request**: When a patient books online, the system creates an appointment with `PENDING_APPROVAL` status and computes an `estimatedQueueNumber` (e.g. `Est. Token #4`).
3. **Receptionist Contact Accessibility**:
   - The backend resolves the active receptionist assigned to the doctor/clinic (`resolveReceptionistContact`) and includes their `receptionistName` and `receptionistPhone` in the API response.
   - The frontend immediately exposes a prominent, clickable Call action (`Call [Receptionist Name]: +91 XXXXX XXXXX`).
   - The patient can call the receptionist directly to pay online (e.g. via direct UPI transfer over phone) or pay at the desk upon arrival.
4. **Token Officialization**:
   - The receptionist verifies payment at the front desk or over call, records the payment as `PAID`, and confirms the ticket.
   - Confirmation transitions the ticket from `PENDING_APPROVAL` to `WAITING` and locks in the official, guaranteed `queueNumber`.
   - First-come, first-confirmed: If another patient arrives and pays earlier, their token is confirmed sequentially.

## Consequences
### Positive
- Zero gateway transaction processing fees (saving 2–3% per transaction).
- Zero automated refund dispute workflows or frozen funds.
- Patients have a direct human point of contact at the clinic.
- High reliability: System operates smoothly even during national payment gateway outages.

### Negative / Trade-offs
- Requires receptionist involvement to elevate `PENDING_APPROVAL` to `WAITING`.
- Unconfirmed requests must automatically expire if the shift window closes without confirmation (`status: EXPIRED`).
