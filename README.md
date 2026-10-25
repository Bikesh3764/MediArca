# MediArca — Clinical Healthcare Platform

MediArca is a production-grade healthcare platform built with Apple Human Interface Guidelines (`DESIGN.md`). It solves the #1 real-world clinic pain point: **patients never knowing when they will actually be seen**. 

Instead of rigid, ambiguous appointment slots, MediArca introduces transparent **Doctor Checking Hours** (e.g., 09:00 AM – 01:00 PM), guaranteed sequential **Queue Tokens** (Queue #1, Queue #2, ...), an **Apple Wallet-Style Live Queue Pass** with radar tracking, and a **Doctor Queue Console** with live cabin presence synchronization and atomic consultation calling.

---

## 🌐 Live Production Deployments

- **Frontend (GitHub Pages)**: [https://bikesh3764.github.io/MediArca/](https://bikesh3764.github.io/MediArca/)
- **Backend API (Render Web Service)**: [https://mediarca-api-sg.onrender.com](https://mediarca-api-sg.onrender.com)
- **Region**: API and database run in Singapore (see `docs/operations/database-region-move.md`).
- **Backend Health Check**: [https://mediarca-api-sg.onrender.com/healthz](https://mediarca-api-sg.onrender.com/healthz)

---

## 🔑 Google OAuth 2.0 Integration

MediArca is integrated with Google Identity Services (`@react-oauth/google` on the frontend and `google-auth-library` on the backend).

- Configured seamlessly via standard environment variables (`GOOGLE_CLIENT_ID` in `backend/.env` and `VITE_GOOGLE_CLIENT_ID` in `frontend/.env`).
- If a Google Client ID is not configured, the Google button is hidden and email sign-in is used.

---

## Architecture & Tech Stack

- **Frontend**: React 19, Vite, TypeScript, Tailwind CSS, Lucide Icons, React Router v7, `@react-oauth/google`.
- **Backend**: Node.js, Express 5, TypeScript, Prisma ORM 6, JWT, Bcrypt, `google-auth-library`.
- **Database**: Prisma ORM (PostgreSQL via Supabase).
- **Design System**: Apple Human Interface Guidelines (`DESIGN.md`):
  - Action Blue (`#0066cc`) full pill buttons (`rounded-full`, `active:scale-95`).
  - 44px true-black global nav with responsive mobile drawer, 52px frosted-glass sub-nav with backdrop blur.
  - Parchment (`#f5f5f7`) and pure white (`#ffffff`) alternating gallery rhythm.
  - Crash-resistant Error Boundary architecture with graceful recovery.
  - SF Pro / Inter typography with negative tracking on headlines.

---

## Demo Accounts

For instant 1-click evaluation, the login screens across portals include pre-configured demo credentials:

| Role | Email | Password | What You Can Test |
| :--- | :--- | :--- | :--- |
| **Patient** | `john.doe@gmail.com` | `patient123` | Search doctors/clinics, book without upfront payment, inspect Live Queue Pass with live cabin presence, call receptionist directly to coordinate UPI/desk payment, self-check-in via QR. |
| **Doctor** | `dr.sarah@mediarca.com` | `doctor123` | Doctor console, view waiting queue, call patient into cabin (atomic concurrency), toggle cabin presence, configure weekly checking shift hours and fees. |
| **Clinic** | `apex.health@mediarca.com` | `clinic123` | Clinic operations dashboard, invite/onboard affiliated doctors, provision front-desk receptionists with temporary credentials, download entrance QR standee. |
| **Receptionist** | `priya.desk@mediarca.com` | `reception123` | Front-desk management, walk-in patient token creation, arrival check-in, record consultation fees as PAID, approve pending online requests into live queue. |
| **Admin** | `admin@mediarca.com` | `admin123` | Practitioner and clinic verification queues, platform telemetry metrics, contact inquiries management. |

---

> On the live site, demo accounts can run the full queue flow but can't be renamed, change passwords or delete staff, so the demo keeps working for everyone. The Admin demo account exists only in locally seeded databases.

## Quick Start (Running Locally)

Both servers are pre-configured:

### 1. Backend Server
```bash
cd backend
npm install
npm run build
node dist/server.js
# Backend runs at http://localhost:5000 (Health check: http://localhost:5000/api/health)
```

### 2. Frontend Application
```bash
cd frontend
npm install
npm run dev
# Open in browser: http://localhost:5173
```

---

## Production Deployment to Supabase

To deploy the database to Supabase PostgreSQL:
1. Create a project at [supabase.com](https://supabase.com).
2. Copy your PostgreSQL connection URI from Supabase settings.
3. In `backend/prisma/schema.prisma`, change:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
4. In `backend/.env`, set:
   ```env
   DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@[YOUR-HOST]:5432/postgres"
   ```
5. Run `npx prisma db push` and `npx prisma db seed`. Your entire schema and data will deploy to Supabase instantly!
