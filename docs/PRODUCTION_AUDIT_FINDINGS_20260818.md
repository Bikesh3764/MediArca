# MediArca production audit findings

Audit scope: authoritative `/home/ubuntu/MediArca` source, live Supabase project `pkvwnsigucncdwrjtggs`, GitHub Pages deployment, and manual browser workflows.

## Confirmed previously by hands-on audit

1. The live admin password login returned `Database error querying schema` HTTP 500 because the seeded `auth.users` row had NULL token fields. The live NULL-field repair and non-blocking auth profile trigger were applied; the same request then returned normal `invalid_credentials` HTTP 400 rather than HTTP 500.
2. The separate marketing deployment at `https://mediarca.in/clinic` and `/receptionist` returned 404 pages. Those routes are outside the linked GitHub source repository.
3. The README advertised hosted demo passwords that did not match the current live Supabase credentials; the README was updated to describe seeded identities without passwords.

## New code-review candidates requiring reproduction/fix

1. `issueReceptionWalkinToken` calls the live RPC only when Supabase is connected but otherwise continues with a local token fallback, which violates authoritative server-only mutation behavior.
2. `updatePatientStage` only calls its live RPC when connected and otherwise commits the stage locally; it also lacks a frontend role guard.
3. `generateSignedCheckInToken` falls back to `Math.random()` when Web Crypto is unavailable, which is not acceptable for a single-use medical check-in credential.
4. `addClinicalDocument` accepts arbitrary `docData.downloadUrl` values and fabricates metadata when no real File/Blob is present, allowing a fake/local document record into the patient vault.
5. `parseAmbientClinicalNote` fabricates diagnoses, exam findings, advice, and medication interpretation from keywords despite the product contract stating extraction-only clinical drafting.
6. `getQueueOptimizationRecommendations` returns hardcoded no-show probabilities, a hardcoded token number, and hardcoded delay assumptions rather than measured data.
7. `getHospitalAnalytics` maps `averageWaitTimeMins` into `avgConsultDurationMins`, which is semantically incorrect; the fallback also presents local/stale metrics without clearly marking them as unavailable.
8. Supabase `onAuthStateChange` awaits a large handler that performs additional Supabase queries and `getSession()` inside the auth callback, which risks callback deadlock/race behavior; this needs a deferred, non-blocking session handler.
9. Several mutation methods locally persist clinical state after cloud calls but do not always reconcile the authoritative returned record, so a successful server-side normalization can diverge from the UI state.

## Verification still required

The candidates above must be checked against the UI call sites, live RPC contracts/RLS, adversarial inputs, mobile/responsive behavior, keyboard/accessibility behavior, deployment caching, and the full regression suite after fixes.
