# Infrastructure & the 2026-10-26 Region Move

## Current production setup (Singapore)
| Piece | Where | Name / URL |
|-------|-------|-----------|
| Backend API | Render, **Singapore**, free plan, Docker (`backend/Dockerfile`) | `mediarca-api-sg` → https://mediarca-api-sg.onrender.com |
| Database | Supabase, **Singapore** (`ap-southeast-1`), free plan | project `MediArca-SG` (`vcwtndzjtqwxexiehpbr`) |
| Frontend | GitHub Pages (auto on push to `main`) | https://bikesh3764.github.io/MediArca/ |
| Frontend | Cloudflare Pages project `mediarca` (manual upload) | https://mediarca.in, https://mediarca.pages.dev |
| File uploads | Cloudflare R2 bucket `mediarca-vault` | public URL in `R2_PUBLIC_URL` |
| Keep-alive | Cloudflare Worker `mediarca-keepalive` (cron every 5 min) + GitHub Actions `keep-alive.yml` (every 10 min) | pings `/healthz` |

The backend connects with a dedicated database login named `prisma` (Supabase's recommended setup for Prisma), which owns the tables and bypasses row-level security. Connection strings use the Supabase pooler host `aws-0-ap-southeast-1.pooler.supabase.com` (port 6543 for `DATABASE_URL`, 5432 for `DIRECT_URL`). Secrets live only in Render's environment settings.

## Why we moved
Measured on 2026-10-25: the old backend was on Render in **Oregon (USA)** (the service had been created there despite `render.yaml` saying Singapore) and the database was in **Seoul**. Each request went India → USA, and each database query USA → Seoul. `/api/doctors` took 1.9–2.6 seconds for 3 KB. Render can't change an existing service's region, and Supabase can't change a project's region, so both were recreated in Singapore.

## What was done
1. Created Supabase project `MediArca-SG` in Singapore and a `prisma` login.
2. Created the schema to match `backend/prisma/migrations` exactly and recorded the first five migrations in `_prisma_migrations` (same checksums), so Render's `prisma migrate deploy` applies only newer ones. (The old database had drifted from the migration files, e.g. timestamp columns with time zones; the new one matches them.)
3. Copied every row server-to-server (no data passed through anyone's laptop) and verified counts and content checksums matched. Leftover tables `Prescription`, `MedicalRecord` and the `staging_test` schema were deliberately not copied.
4. Created Render service `mediarca-api-sg` in Singapore with the same settings, a fresh `JWT_SECRET` (everyone signs in again once) and no Redis (single instance; in-memory rate limiting).
5. Pointed GitHub Pages, Cloudflare Pages and the keep-alive job at the new URL.

## Old resources (kept as backup)
- Render service `MediArca` (`srv-dahph4142hec739ummi0`, Oregon, https://mediarca-mdwk.onrender.com).
- Supabase project `MediArca-3` (`gibgtnzhecexgwximtpi`, Seoul).

Both can be deleted from their dashboards once the new setup has run cleanly for about a week. Anything written to the old database after the copy (2026-10-26 ~00:20 IST) is not in the new one.

## Free-plan sleep
Render's free plan stops the server after 15 minutes without traffic; the next request then waits ~30 seconds. Two pingers prevent this: a Cloudflare Worker (`mediarca-keepalive`, every 5 minutes, reliable) and the older GitHub Actions job (every 10 minutes, often delayed). Opening the worker's URL in a browser shows the backend's current health.

Render gives each workspace 750 free hours a month and one always-awake service uses about 744, so **only one free service may stay awake**. Delete the old Oregon service (`MediArca`) once you're happy with the new one; nothing pings it any more, so until then it sleeps and uses very little.

## If you ever move again
Recreate in the new region, copy the data the same way, update `DATABASE_URL`/`DIRECT_URL` on Render, and update the API URL in `frontend/src/services/api.ts`, `frontend/src/App.tsx`, `.github/workflows/deploy-pages.yml` and `.github/workflows/keep-alive.yml`, then rebuild and upload the Cloudflare Pages site.
