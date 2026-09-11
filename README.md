# MediArca — Clinical Healthcare Platform

MediArca is a production-grade healthcare platform built with Apple Human Interface Guidelines (`DESIGN.md`). It solves the #1 real-world clinic pain point: **patients never knowing when they will actually be seen**. 

Instead of rigid, ambiguous appointment slots, MediArca introduces transparent **Doctor Checking Hours** (e.g., 09:00 AM – 01:00 PM), guaranteed sequential **Queue Tokens** (Queue #1, Queue #2, ...), an **Apple Wallet-Style Live Queue Pass** with radar tracking, and a **Doctor Queue Console** with digital prescriptions.

---

## 🌐 Live Production Deployments

- **Frontend (GitHub Pages)**: [https://bikesh3764.github.io/MediArca/](https://bikesh3764.github.io/MediArca/)
- **Backend API (Render Web Service)**: [https://mediarca-mdwk.onrender.com](https://mediarca-mdwk.onrender.com)
- **Backend Health Check**: [https://mediarca-mdwk.onrender.com/healthz](https://mediarca-mdwk.onrender.com/healthz)

---

## 🔑 Google OAuth 2.0 Integration

MediArca is integrated with Google Identity Services (`@react-oauth/google` on the frontend and `google-auth-library` on the backend).

- For a complete step-by-step tutorial on creating your Google Cloud OAuth Client ID, authorized origins, and environment variables, see **[GOOGLE_AUTH_SETUP.md](./GOOGLE_AUTH_SETUP.md)**.
- If a Google Client ID is not yet configured, the system provides a seamless **1-Click Test Simulation Mode** so the full Google Sign-In authentication flow, profile provisioning, and dashboard navigation can be evaluated instantly.

---

## Architecture & Tech Stack

- **Frontend**: React 19, Vite, TypeScript, Tailwind CSS, Lucide Icons, React Router v7, `@react-oauth/google`.
- **Backend**: Node.js, Express, TypeScript, Multer (Document Vault), JWT, Bcrypt, `google-auth-library`.
- **Database**: Prisma ORM (PostgreSQL via Supabase).
- **Design System**: Apple Human Interface Guidelines (`DESIGN.md`):
  - Action Blue (`#0066cc`) full pill buttons (`rounded-full`, `active:scale-95`).
  - 44px true-black global nav with responsive mobile drawer, 52px frosted-glass sub-nav with backdrop blur.
  - Parchment (`#f5f5f7`) and pure white (`#ffffff`) alternating gallery rhythm.
  - Crash-resistant Error Boundary architecture with graceful recovery.
  - SF Pro / Inter typography with negative tracking on headlines.

---

## Demo Accounts

For instant 1-click evaluation, the login screen includes quick login buttons:

| Role | Email | Password | What You Can Test |
| :--- | :--- | :--- | :--- |
| **Patient** | `john.doe@gmail.com` | `patient123` | Search doctors, check live queue previews, book without upfront payment, inspect Live Queue Pass with radar tracker, upload medical records, view prescriptions. |
| **Doctor** | `dr.sarah@mediarca.com` | `doctor123` | Doctor console, view waiting queue, call next patient into cabin, record patient vitals, issue digital prescriptions, configure checking shift hours. |
| **Admin** | `admin@mediarca.com` | `admin123` | Practitioner verification portal, approve/suspend doctors, audit platform appointments and metrics. |

---

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
