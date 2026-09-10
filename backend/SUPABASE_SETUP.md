# MediArca — Live Supabase PostgreSQL Connection Guide

This guide walks you through connecting your live Supabase cloud database in less than 2 minutes.

---

### Step 1: Create a Free Database on Supabase
1. Visit [supabase.com](https://supabase.com) and click **Start your project** (Free plan).
2. Enter a project name (e.g. `mediarca-db`) and choose a strong database password.
3. Choose a region closest to your users (e.g. `South Asia (Mumbai)` or `East US`).

---

### Step 2: Copy your PostgreSQL Connection String
1. Inside your Supabase Project Dashboard, click the **Settings (gear icon)** at the bottom of the left sidebar.
2. Click **Database**.
3. Scroll down to **Connection String** → select **URI** (or Transaction Pooler).
4. Copy the URI string. It will look like this:
   ```
   postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
   ```
   *(Replace `[YOUR-PASSWORD]` with the database password you chose in Step 1).*

---

### Step 3: Update MediArca Configuration

1. Open `backend/.env` and update `DATABASE_URL`:
   ```env
   DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres"
   ```

2. Open `backend/prisma/schema.prisma` and change the datasource provider from `sqlite` to `postgresql`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

3. Run the following command in the `backend/` folder:
   ```bash
   npx prisma db push
   npx ts-node-dev prisma/seed.ts
   ```

### That's it!
All your tables, relationships, verified doctors, demo accounts, and queue mechanisms are now running live on Supabase PostgreSQL!
