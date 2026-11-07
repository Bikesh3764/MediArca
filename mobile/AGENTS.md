# MediArca Mobile App

The MediArca app for Patient, Doctor, Clinic and Receptionist (Admin is website-only — never add admin screens). Root rules in `../AGENTS.md` apply here too (₹, +91, IST, no payment gateways, minimal copy, `DESIGN.md` colours, font weights 400/600 only). Plan and progress: `../docs/mobile-roadmap.md` — read it first.

- Server calls, data types and helpers come from `@mediarca/shared` (`../shared/src`). Never copy them into the app; if logic is missing, add it to `shared/` so the website gets it too.
- `src/lib/platform.ts` is the only place that configures the shared code for the phone.
- Text: import `Text` and `TextInput` from `@/components/AppText` (Inter font), never from `react-native`.
- Tokens: `src/theme`; building blocks: `src/components/ui.tsx` (buttons, fields, cards) and `src/components/kit.tsx` (avatar, chips, search, sheet, empty state, bottom bar). Reuse these instead of styling from scratch.
- Look: large titles, white rounded cards with soft shadows (`shadow` in `src/theme`, no borders), filled fields, 52pt pill buttons, soft blue tints, no vibration (`src/lib/haptics.ts` is a no-op by the owner's choice); on/off settings use `Toggle` from `kit.tsx`, never React Native's `Switch`. Short copy, same words as the website.
- Errors and "saved" messages go next to the button that caused them (or in the bottom bar), never off-screen.
- Queue tickets use `components/QueuePass.tsx`; check-in is camera only (`app/scan.tsx`).
- Push alerts: `src/lib/push.ts`; Google sign-in: `src/lib/google.ts` + `components/GoogleButton.tsx`. Both only run in our own build (`src/lib/nativeBuild.ts`), never in Expo Go or the browser, and load their native module lazily. Android Google sign-in needs no config plugin (no Firebase mode); don't add `@react-native-google-signin/google-signin` to `app.json` plugins without its options.
- Doctor and front desk queues reuse `components/QueueRow`, `InCabinCard`, `CabinControl` (In cabin / Stepped out / Away slider; front desk picks the doctor here), `ShiftChips` (shift filter), `CodeCard` (⋯ → Show code), `DoctorBar` (walk-in doctor), `MoveSheet`, `WalkinForm`, `ActionMenu`; rows show no reason, no shift and no walk-in code (`lib/queueGroups.ts`); no print slips; tab bars use `components/tabs.tsx`. Pick-from-a-short-list actions use `ActionMenu`, not alerts.
- Clinic tabs share `context/ClinicContext.tsx`; QR codes are drawn on the phone with `components/QrCode.tsx` (never an outside QR service — the check-in code is private). Website links live in `src/lib/site.ts`.
- Background refresh uses `src/lib/usePolling.ts` and keeps the list on screen (no spinners after the first load).
- Notifications: `context/NotificationContext.tsx` (one provider in `app/_layout.tsx`) + `components/NotificationBell.tsx` on each home screen. Photos: `components/PhotoPicker.tsx`. PDFs and printing: `src/lib/print.ts` (escape every value with `escapeHtml`); Excel files: `src/lib/excel.ts`. Long addresses: `components/MoreText.tsx`. Date ranges: `components/RangeCalendar.tsx`. Animations: `src/lib/motion.tsx` (FadeIn, usePressScale, smoothLayout; built-in Animated, no extra library). Polling setters wrap results in `keepIfSame` (`src/lib/usePolling.ts`) so unchanged refreshes don't redraw. Leave UI: `components/LeaveTools.tsx`. Don't open a `Sheet` from inside another `Sheet`; show the form inline instead.

---

This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
