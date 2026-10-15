# MediArca Frontend — Scoped Agent Rules

## 1. Frontend Charter & Technologies
The MediArca frontend is an ultra-fast, mobile-first web application built with React 19, TypeScript, Vite, and Tailwind CSS, adhering strictly to the Apple Human Interface Guidelines documented in `DESIGN.md`.

- **Framework**: React 19 + TypeScript
- **Bundler**: Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Design System**: Apple HIG (`DESIGN.md`)
- **Key Modules**:
  - `src/components/queue/LiveQueueTicket.tsx` — Real-time queue pass, cabin presence sync, and receptionist contact card.
  - `src/pages/Patient/` — Doctor discovery, profile, and appointment booking with receptionist coordination.
  - `src/pages/Doctor/` — Doctor dashboard, queue console, consultation view, and shift schedule management.
  - `src/pages/Clinic/` — Clinic dashboard, clinic profile & facility settings, doctor onboarding, and receptionist provisioning.
  - `src/pages/Receptionist/` — Desk dashboard, walk-in creation, check-in, and fee collection.
  - `src/pages/Admin/` — Admin verification dashboard and platform statistics.
  - `src/services/api.ts` — HTTP client with caching, error normalization, and non-JSON body resilience.

---

## 2. Strict Frontend Invariants

1. **Apple HIG Design System Consistency (`DESIGN.md`)**:
   - **Primary Action Blue**: `#0066cc` (hover `#0071e3`, active `active:scale-[0.98]`). Never use `#0088e8`, `#2563eb`, or random shades of blue.
   - **Backgrounds**: Canvas `#f5f5f7`, cards pure white `#ffffff`.
   - **Borders**: `#e5e5ea` (subtle separation) or `#d2d2d7` (inputs).
   - **Typography**: `#1d1d1f` (primary headings/text), `#86868b` (labels/subtitles).
   - **Geometry**: `rounded-2xl` for content cards, `rounded-full` for action buttons, badges, and filter pills.
2. **Receptionist Payment & Contact Accessibility**:
   - Live queue tickets and booking confirmation screens MUST display the receptionist's name and direct contact phone number.
   - Always provide a direct phone link (`tel:+91...`) so patients can call the receptionist to coordinate payment (UPI over call) or ask queue questions.
3. **Currency Invariant**:
   - Always display fees in Indian Rupee (`₹`). Never use `$`.
4. **Phone Formatting**:
   - Render static `+91` country code badges for mobile number inputs. Validate for exactly 10 Indian digits.
5. **API Response Resilience**:
   - `frontend/src/services/api.ts` must inspect `Content-Type` before calling `.json()` to gracefully handle reverse proxy HTML errors (502 Bad Gateway / 504 Gateway Timeout) without throwing unhandled `SyntaxError`.
6. **Linter & Build Hygiene**:
   - Maintain 0 errors on `npm run lint`.
   - Avoid synchronous `setState` calls inside `useEffect` that trigger cascading renders or compiler bailouts.
   - Use React Router `<Link>` or `useNavigate()` instead of raw hash anchor tags (`<a href="#...">`).

---

## 3. Verification & Build Commands

```bash
# Run Biome / ESLint quality checks (must pass with 0 errors)
npm run lint

# Compile TypeScript and create production bundle with Vite
npm run build
```
