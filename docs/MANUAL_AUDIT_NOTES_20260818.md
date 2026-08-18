# Manual Audit Notes — 18 August 2026

## Public homepage

The live public site at https://mediarca.in/ loads successfully. The homepage presents links for Home, About Us, FAQ, Blog, Terms, Privacy, Login, and Get Started. The footer exposes Patient Portal, Doctor Login, Clinic Portal, and Receptionist Portal links. The homepage also displays doctor discovery, appointments, records, AI report analysis, live queue, and download/demo sections.

## Expanded navigation

The More menu opens and reveals How it Works, Terms & Services, and Privacy Policy. The menu is visible in the page viewport and the links are present in the accessible browser element list. No immediate navigation or rendering error has been observed during these first manual checks.

## Get Started and patient entry

The live `/get-started` page loads and presents patient and doctor cards. The patient card links to `/patient`. The live patient page is currently a **waitlist registration** page rather than an account login/portal: it asks for full name, Gmail address, optional feedback, and excitement level. The form controls render visibly and the submit action is present. This is a product-state observation to validate against the intended README/user journey; it means an ordinary patient cannot access the authenticated patient portal from this entry point without another route or deployed application.

## Doctor portal entry

The live `/doctor` page loads with separate Sign In and Sign Up states. Sign In exposes email and password inputs. Sign Up exposes full name, Doctor UID, email, password, and password confirmation fields, plus a verification-link notice. The registration form is rendered as a usable first-party page and requires a Doctor UID before account creation.

## Independently reproduced issue: clinic portal route

The doctor registration form’s empty submit action shows field-level validation for full name, Doctor UID, email, and password without sending a request. The live `/clinic` route is a genuine **404 Page Not Found** despite the homepage footer advertising a Clinic Portal link. This is a user-facing production bug and must be fixed in the deployed website, not only in the repository’s static audits.

## Independently reproduced issue: receptionist portal route

The live `/receptionist` route also returns a genuine **404 Page Not Found**, although it is advertised in the homepage footer and sitemap-style navigation. The About page at `/about` loads successfully with mission, team, and feature content.

## FAQ interaction

The live `/faq` page loads successfully. Clicking the first question expands its answer inline and changes the control from `+` to `−`; the accordion interaction works in the browser.

## Blog journey

The live `/blog` page loads with category filters, search, featured and latest articles, and visible article cards. Clicking the `Write an Article` link did not navigate away from `/blog` in the browser; the link remained present and no authoring page opened. This is a likely broken or intentionally disabled authoring flow that requires code/deployment inspection.

## Repository deployment manual check

The repository’s GitHub Pages deployment at https://bikesh3764.github.io/MediArca/ loads the static clinical OPD application with six verified doctors, specialty filters, live radar actions, and Book OPD Token buttons. Clicking the first visible unauthenticated `Book OPD Token` action left the page on the directory with no visible booking modal or login prompt. This is an independently observed candidate defect and requires a second inspection of the live DOM/state before fixing.

## Booking click follow-up

The unauthenticated Book OPD Token click did execute enough code to populate `#bookingModal` with a doctor appointment form, but the modal remained `opacity: 0`, `visibility: hidden`, and without the `active` class. No login prompt or toast was visible. The next step is source inspection to determine whether this is an intentional auth guard or a user-facing no-op; if unauthenticated users are expected to book, the flow needs a visible sign-in/register recovery path.

## Booking handler/runtime discrepancy

Browser inspection confirms the deployed `openBookingModal` function contains the repository’s guest guard (`switchView('auth-patient')` plus an informational toast), yet after the click the active section remained `view-home` and no toast was visible. This suggests either the annotated click targeted a non-action element or a runtime event-binding issue; a direct handler invocation and event-listener inspection are required before classifying it as a product defect.

## Patient authentication recovery

Direct invocation of the deployed booking handler correctly switches to `view-auth-patient` and shows the toast `Please sign in or create an account to book an appointment.` The patient authentication view renders Sign In, Create Account, email/password fields, and Google sign-in. The earlier annotated click no-op was therefore a browser targeting artifact rather than a confirmed application defect.

## Patient registration

The deployed patient auth view exposes full name, email, password, phone, age, gender, and blood group controls plus Google sign-in. Submitting the empty form triggers native required-field validation on the first missing required input without sending a request. No issue was reproduced in this validation path.

## Queue Radar invalid lookup

The live Queue Radar view loads with an ID/booking search input, a no-active-tokens state, and a Book Next Available Token action. Submitting `INVALID-LOOKUP-000` leaves the radar view intact and shows the clear message `No booking or doctor found matching your search.` The not-found recovery works.

## Hospital TV display

The live Hospital TV view renders a dark queue board with doctor identity, live telemetry status, idle queue state, Sound Room Chime, and Exit TV View controls. The displayed clock advanced from approximately 2:47:31 PM to 2:47:41 PM during manual observation, confirming the live clock updates in place.

## Physician onboarding

The deployed Physician Registration & Credentialing view renders required fields for full name, professional email, password, specialty, medical council registration, experience, qualifications, and affiliation, with fee and clinical summary fields. Empty submission triggers native required-field validation without sending data. No issue was reproduced in this validation path.

## Doctor invalid login

Submitting non-existent test credentials on the deployed doctor sign-in form returns `Invalid login credentials` in the page and a visible warning toast. The form remains available for correction, so this negative path behaves correctly.

## Scope clarification

The linked GitHub repository README identifies the owned app as a static Supabase clinical system with Patient, Doctor, Receptionist, and Medical Board Admin roles, served locally from the repository root or via the GitHub Pages deployment. The marketing site at https://mediarca.in/ is a separate Next-style public site and its `/clinic` and `/receptionist` 404s are outside this repository’s source tree. The repository README lists demo accounts for manual role testing; the remaining audit will use only those documented test accounts, not personal credentials.

## Independently reproduced issue: live admin authentication

Using the repository-documented test account `admin@mediarca.health` / `admin2026` on the deployed GitHub Pages app, the Medical Board login returns `Database error querying schema`. Directly calling the deployed Supabase Auth client reproduces the exact response: `AuthRetryableFetchError`, HTTP status `500`, with no session. This is a live backend/auth failure, not a test-suite assertion.

## Live password-login comparison

The documented patient account `sarah@mediarca.health` also fails to enter the portal. The UI shows `Invalid login credentials`, and a direct Auth call returns `AuthApiError` code `invalid_credentials` with HTTP 400. This is distinct from the admin account’s HTTP 500 schema error; the README demo passwords are not reliable credentials for the current live project, so the admin 500 requires separate backend diagnosis rather than assuming all accounts are broken.

## Root cause and live fix

Supabase investigation found the seeded admin Auth row had NULL `confirmation_token`, `email_change`, `email_change_token_new`, and `recovery_token` fields. Supabase Auth is known to return the exact `Database error querying schema` HTTP 500 when it scans NULL token fields as strings. I normalized those fields live and installed a hardened non-blocking profile-sync trigger. The same admin sign-in request now returns a normal HTTP 400 `invalid_credentials` response instead of HTTP 500, proving the database-schema failure is fixed; the documented password itself does not match the current live account.
