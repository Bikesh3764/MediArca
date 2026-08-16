# MediArca 🏥
> **Modern Healthcare Appointments, Live Queue Radar & Clinical EMR Systems**

![MediArca Platform](https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=1200&h=400&fit=crop&q=80)

MediArca is a high-performance clinical healthcare platform engineered to eliminate hospital OPD waiting room congestion. It provides real-time live queue telemetry, automated consultation timers, digital check-in passes with QR codes, multi-portal role isolation (Patient, Doctor, Medical Board Admin), and full cloud PostgreSQL persistence via Supabase.

---

## ✨ Key Features

- 🏥 **Accredited Doctor Directory**: Search specialists across Cardiology, Dermatology, Orthopedics, Neurology, Pediatrics, and General Medicine.
- ⚡ **Live Queue Radar (HUD)**: Real-time queue telemetry with token position, estimated wait times, and horizontal progression sequence.
- 🔊 **Web Audio Synthesizer**: Dual-tone hospital room chimes (*Ding-Dong*) for audible patient callouts over waiting room speakers.
- 📱 **Digital OPD Passes**: Simulated SVG check-in QR codes with printable token slips.
- 📺 **Hospital OPD Fullscreen TV Mode**: High-contrast waiting room monitor mode (`/tv-display`) for mounting on clinic monitors.
- 🩺 **Doctor Practice Console**: Queue controller (*Call Next Patient, Pause Queue, Test Chime*) with embedded clinical diagnosis & prescription logging.
- 🛡️ **Medical Board Admin Desk**: Audits medical council licenses (`NMC-XXXXX`) and issues certified **Mediarca Doctor IDs** (`MED-DOC-XXXX`).
- ☁️ **Supabase Cloud PostgreSQL & WebSockets**: Persistent storage with Realtime pub/sub synchronization.

---

## 🎨 Design System & Aesthetics (Anti-AI Clichés)

- **Palette**: Warm clinical bone (`#fbfbf9`), surgical teal (`#0f766e`), medical blue (`#0284c7`), and dark slate text (`#18181b`).
- **Typography**: Clean hierarchy with *Plus Jakarta Sans* and *JetBrains Mono*.
- **Containers**: Crisp 1px borders with subtle alpha (`#e4e4e7`) and zero multi-nested cards.

---

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/MediArca.git
cd MediArca
```

### 2. Run Locally
Serve the application using any static file server:

```bash
# Python 3
python -m http.server 8080

# Or Node.js
npx serve .
```

Open [http://localhost:8080](http://localhost:8080) in your browser.

---

## ☁️ Cloud Database Setup (Supabase PostgreSQL)

1. Create a project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** in Supabase.
3. Paste the contents of `supabase_schema.sql` and click **Run**.
4. Configure your Supabase project URL and anon/publishable key in `js/supabase_client.js`.

---

## 🔑 Test Accounts & Demo Credentials

| Role | Email | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **Patient** | `sarah@mediarca.health` | `patient123` | Active tickets & Prescriptions |
| **Verified Doctor** | `thorne@mediarca.health` | `doc123` | Dr. Aris Thorne (Cardiology Console) |
| **Pending Doctor** | `vance@mediarca.health` | `doc123` | Dr. Elena Vance (Pending Review) |
| **Admin** | `admin@mediarca.health` | `admin2026` | Medical Board Verification Desk |

---

## 📄 License
MIT License &copy; 2026 MediArca Health Systems.
