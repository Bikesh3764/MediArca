# MediArca — App Feature Specification

## Product Overview

MediArca is a simple, user-friendly healthcare platform where patients can discover doctors, view availability, book appointments, attend consultations, and access prescriptions and medical records.

The product should feel clean, trustworthy, fast, and easy to use. Avoid unnecessary features and avoid making the interface feel like a hospital management system.

---

# 1. User Roles

## Patient
Patients can:
- Create an account and log in
- Manage their profile
- Search and discover doctors
- View doctor profiles
- See available appointment slots
- Book appointments
- View upcoming and past appointments
- Reschedule or cancel appointments
- Attend video consultations when available
- View prescriptions
- View and upload medical documents/reports
- View their basic medical history
- Receive notifications
- Leave a rating/review after a completed appointment

## Doctor
Doctors can:
- Create an account and log in
- Manage their professional profile
- Set consultation fee
- Set available days and time slots
- View upcoming appointments
- View patient information relevant to the appointment
- Start/complete consultations
- Add consultation notes
- Add basic vitals
- Create digital prescriptions
- View patient medical documents that they are authorized to access
- Reschedule/cancel appointments when necessary
- Receive notifications

## Admin
Admin can:
- View and manage patients
- View and manage doctors
- Verify doctor profiles
- Approve/reject doctor verification
- Manage appointments
- Manage reported issues
- View basic platform statistics
- Manage specialties and basic platform settings

---

# 2. Patient App

## Patient Home Dashboard

The dashboard should immediately show:

- Greeting
- Search doctors
- Next upcoming appointment
- Quick action to book an appointment
- Recent prescription/report
- Recommended or recently viewed doctors
- Simple health summary

Primary actions:
- Book Appointment
- Find Doctor
- My Appointments
- Medical Records

Keep the home screen uncluttered.

---

# 3. Patient Profile

Profile should include:

- Full name
- Profile photo
- Date of birth
- Gender
- Phone number
- Email
- Blood group
- Allergies
- Existing medical conditions
- Current medications
- Emergency contact

Patients should be able to edit their information.

---

# 4. Doctor Discovery

Patients can search doctors by:

- Doctor name
- Specialty
- Location
- Availability

Useful filters:

- Specialty
- Consultation type
- Price
- Experience
- Rating
- Available today

Doctor cards should clearly show:

- Doctor name
- Specialty
- Experience
- Rating
- Consultation fee
- Next available slot
- Consultation type

---

# 5. Doctor Profile

Doctor profile should show:

- Profile photo
- Name
- Specialty
- Qualifications
- Experience
- Languages
- Clinic/hospital
- Consultation fee
- Rating
- About the doctor
- Areas of expertise
- Available appointment slots
- Online/in-clinic consultation options

Primary action:

**Book Appointment**

---

# 6. Appointment Booking

Simple booking flow:

1. Select doctor
2. Select consultation type
3. Select date
4. Select available time
5. Confirm patient
6. Add optional reason for visit
7. Confirm booking

Appointment confirmation should show:

- Doctor
- Date
- Time
- Consultation type
- Fee
- Appointment status

Prevent double-booking of the same appointment slot.

---

# 7. Appointment Management

Patients should have:

## Upcoming Appointments
- Doctor
- Date
- Time
- Appointment type
- Status
- View details
- Reschedule
- Cancel
- Join consultation when available

## Past Appointments
- Doctor
- Date
- Status
- Consultation summary
- Prescription if available

Appointment statuses:

- Pending
- Confirmed
- Rescheduled
- Cancelled
- Completed
- No-show

---

# 8. Video Consultation

For appointments that support online consultation:

- Join consultation
- Camera on/off
- Microphone mute/unmute
- End consultation

After consultation, the patient should be able to access:

- Consultation summary
- Prescription
- Follow-up information

---

# 9. Medical Records

Patients should have one simple place for their medical information.

Sections:

- Prescriptions
- Lab reports
- Medical documents
- Consultation history

Medical timeline should make it easy to understand what happened and when.

Patients can upload:

- PDF
- JPG
- PNG

Documents should have a simple category/title.

---

# 10. Digital Prescription

Doctors can create a digital prescription containing:

- Diagnosis/clinical impression
- Medicine name
- Dosage
- Frequency
- Duration
- Instructions
- Additional advice
- Follow-up date

Patients can:

- View prescription
- Download/share prescription when appropriate

---

# 11. Consultation

Doctor consultation screen should allow:

- Patient overview
- Reason for visit
- Symptoms/complaints
- Basic vitals
- Doctor notes
- Diagnosis/clinical impression
- Prescription
- Follow-up date

Doctor should be able to complete the consultation and save the record.

---

# 12. Patient Medical Information for Doctors

During an appointment, doctors should be able to see relevant patient information such as:

- Basic profile
- Allergies
- Existing conditions
- Current medications
- Previous consultation history
- Relevant uploaded reports
- Previous prescriptions

Sensitive records should only be visible according to authorization and access rules.

---

# 13. Doctor Availability

Doctors can manage:

- Working days
- Working hours
- Appointment duration
- Consultation fee
- Online availability
- In-clinic availability
- Unavailable dates/holidays

Patients should only see genuinely available slots.

---

# 14. Notifications

Notifications should cover only important events:

- Appointment booked
- Appointment confirmed
- Appointment reminder
- Appointment rescheduled
- Appointment cancelled
- Doctor has started/updated consultation
- New prescription available
- New report/document available
- Follow-up reminder

Use simple, understandable notification messages.

---

# 15. Reviews and Ratings

After a completed appointment:

- 1–5 star rating
- Optional short review

Only patients with a completed appointment should be able to review that doctor.

---

# 16. Admin

Admin dashboard should include:

- Total patients
- Total doctors
- Upcoming appointments
- Completed appointments
- Pending doctor verifications

Admin sections:

## Doctors
- View doctors
- Verify doctors
- Approve/reject verification
- Suspend doctor when required

## Patients
- View patients
- Manage account status

## Appointments
- View appointments
- Handle appointment issues

## Reports/Issues
- Review reported users/doctors/reviews

---

# 17. Authentication

Support:

- Email/phone login
- Password or OTP-based authentication
- Forgot password
- Logout

Use role-based access so patients, doctors, and admins only access features appropriate to their role.

---

# 18. Payments

For paid appointments:

- Show consultation fee before booking
- Payment confirmation
- Payment status
- Basic invoice/receipt
- Refund status when applicable

Keep payment screens simple.

---

# 19. UX Requirements

MediArca should be:

- Mobile-first
- Clean
- Minimal
- Fast
- Easy for first-time users
- Accessible
- Consistent
- Trustworthy

Important UX principles:

- Keep primary actions obvious
- Avoid unnecessary forms
- Avoid excessive dashboard cards
- Use simple language
- Show appointment status clearly
- Make booking possible in a few steps
- Keep medical information organized
- Use clear empty states and error messages

---

# 20. Core Navigation

## Patient

Home  
Doctors  
Appointments  
Records  
Profile

## Doctor

Dashboard  
Appointments  
Patients  
Consultations  
Profile

## Admin

Dashboard  
Doctors  
Patients  
Appointments  
Reports  
Settings

---

# 21. Important Product Rules

- A doctor cannot be double-booked for the same time slot.
- Patients cannot book unavailable slots.
- Cancelled appointments cannot be joined.
- Reviews are available only after completed appointments.
- Doctors should only see patient information they are authorized to access.
- Patients own and control access to their personal medical information.
- Every important medical-record access/update should be auditable.
- Doctor profiles should show verification status where applicable.

---

# 22. Features to Keep Out of the Initial Version

Do not add unnecessary complexity in the first version.

Avoid initially:

- Social feed
- Public health community
- Complex AI diagnosis
- Wearable integrations
- Pharmacy marketplace
- Insurance marketplace
- Ambulance marketplace
- Large hospital ERP features
- Excessive health analytics
- Complicated loyalty/reward systems

These can be considered later only if the product actually needs them.

---

# 23. Future-Ready Features

These should not be required for the first version but can be added later:

- Family member profiles
- Medicine reminders
- Lab test ordering
- Follow-up booking
- Clinic/hospital accounts
- ABHA/ABDM integration
- Health-data interoperability
- AI assistant for app navigation and record organization
- Advanced analytics
- Wearable integration

---

# 24. Overall Patient Journey

Patient signs up
→ completes profile
→ searches doctor
→ opens doctor profile
→ selects available slot
→ books appointment
→ receives confirmation
→ attends consultation
→ receives prescription/summary
→ views medical record
→ books follow-up when needed

---

# 25. Overall Doctor Journey

Doctor signs up
→ completes professional profile
→ gets verified
→ sets availability
→ receives appointment
→ opens patient information
→ conducts consultation
→ adds notes
→ creates prescription
→ completes appointment
→ patient receives consultation record

---

# 26. Product Goal

MediArca should make these three tasks extremely easy:

**For patients:** Find the right doctor and book an appointment quickly.

**For doctors:** Manage appointments and complete patient consultations easily.

**For both:** Keep important healthcare information organized in one secure place.

The product should prioritize simplicity and usability over adding every possible healthcare feature.
