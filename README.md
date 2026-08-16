# MediArca 🏥
> **Modern Healthcare Appointments, Live Queue Radar & Clinical EMR Systems**

![MediArca Platform](https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=1200&h=400&fit=crop&q=80)

MediArca is a high-performance clinical healthcare platform engineered to eliminate hospital OPD waiting room congestion. It provides real-time live queue telemetry, automated consultation timers, digital check-in passes with QR codes, multi-portal role isolation (Patient, Doctor, Medical Board Admin), and full cloud PostgreSQL persistence via Supabase.

---

## ✨ Key Features

- 🏥 **Accredited Doctor Directory**: Search specialists across Cardiology, Dermatology, Orthopedics, Neurology, Pediatrics, and General Medicine with verified-only public views.
- ⚡ **Live Queue Radar (HUD)**: Real-time queue telemetry with token position, estimated wait times, and horizontal progression sequence.
- 🔊 **Web Audio Synthesizer**: Dual-tone hospital room chimes (*Ding-Dong*) for audible patient callouts over waiting room speakers.
- 📱 **Single-Use Check-In Passes**: High-entropy 128-bit CSPRNG QR passes with 24-hour TTL and server-authoritative replay protection.
- 🏢 **Central Hospital Reception Desk**: Front-desk kiosk for walk-in patient registration, demographic capture, queue transfers, and token printing.
- 🗄️ **Private Clinical Document Vault**: Isolated user bucket storage with RLS, durable path storage, and on-demand 1-hour time-limited signed URLs.
- 📝 **Statutory Digital Consent Ledger**: Immutable audit tracking for statutory healthcare policies and telemedicine agreements.
- 📹 **Encrypted Telemedicine Suite**: WebRTC-compatible video room infrastructure with live browser network latency & media diagnostics.
- 🤖 **Clinical Note Draft Assistant**: Ambient clinical dictation structuring with extraction-only protection (no fabricated findings or autonomous drugs).
- 📺 **Hospital OPD Fullscreen TV Mode**: High-contrast waiting room monitor mode (`/tv-display`) for mounting on clinic monitors.
- 🩺 **Doctor Practice Console**: Queue controller (*Call Next Patient, Pause Queue, Test Chime*) with itemized prescription & diagnostic lab order logging.
- 🛡️ **Medical Board Admin Desk**: Audits medical council licenses (`NMC-XXXXX`), reviews registrations, and issues certified **Mediarca Doctor IDs**.
- ☁️ **Full Supabase Cloud RLS**: 19 RLS-protected tables, 24 atomic SECURITY DEFINER stored procedures, and immutable audit logging.

---

## 🧪 Automated Regression Testing

Run the automated test suite to verify all stored procedure contracts, RLS predicates, and frontend state engines:

```bash
node tests/test_audit_suite.js
```

---

## 🎨 Design System & Aesthetics (Anti-AI Clichés)

- **Palette**: Warm clinical bone (`#fbfbf9`), surgical teal (`#0f766e`), medical blue (`#0284c7`), and dark slate text (`#18181b`).
- **Typography**: Clean hierarchy with *Plus Jakarta Sans* and *JetBrains Mono*.
- **Containers**: Crisp 1px borders with subtle alpha (`#e4e4e7`) and zero multi-nested cards.

---

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/Bikesh3764/MediArca.git
cd MediArca
```

### 2. Run Locally
Serve the application using any static file server:

```bash
# Python 3
python -m http.server 8080

# Or Node.js http-server
npx http-server . -p 8080 -c-1
```

Open [http://localhost:8080](http://localhost:8080) in your browser.

---

## ☁️ Cloud Database Setup (Supabase PostgreSQL)

1. Create a project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** in Supabase.
3. Paste the contents of [`supabase_schema.sql`](supabase_schema.sql) and click **Run**.
4. Configure your Supabase project URL and anon/publishable key in `js/supabase_client.js`.

---

## 🔑 Test Accounts & Demo Credentials

| Role | Email | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **Patient** | `sarah@mediarca.health` | `patient123` | Active tickets, Document Vault & Prescriptions |
| **Receptionist** | `reception@mediarca.health` | `reception123` | Walk-in registration, QR check-in & transfers |
| **Verified Doctor** | `thorne@mediarca.health` | `doc123` | Dr. Aris Thorne (Cardiology Practice Console) |
| **Pending Doctor** | `vance@mediarca.health` | `doc123` | Dr. Elena Vance (Pending Accreditation) |
| **Admin** | `bikeshray3764@gmail.com` | `admin3764` | Dr. Bikesh Ray (Medical Board Admin Desk & Analytics) |
| **Admin (Alt)** | `admin@mediarca.health` | `admin2026` | Medical Board Desk & Compliance Analytics |

---

## 📄 License
MIT License &copy; 2026 MediArca Health Systems.
