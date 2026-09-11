# MediArca — Google OAuth 2.0 Integration & Setup Guide

This guide provides step-by-step instructions for generating and connecting your official **Google Cloud OAuth 2.0 Web Client ID** with the **MediArca** production system.

---

## Architecture Overview

1. **Frontend (`frontend/`)**: Uses `@react-oauth/google` with Google Identity Services (GSI).
   - Generates a Google credential token (JWT signed by Google).
   - If no Client ID is configured yet, the UI provides a 1-click test simulation mode so you can experience the exact same flow instantly.
2. **Backend (`backend/`)**: Uses `google-auth-library`.
   - The `/api/auth/google` endpoint receives the token, validates the signature and audience against your Google Client ID, extracts the verified user profile (name, email, avatar), and establishes a session.
   - Automatically provisions either a `PatientProfile` or `DoctorProfile` based on the user's role choice.

---

## Step 1: Create a Google Cloud Project

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Click the project dropdown in the top bar and select **New Project**.
3. Name your project (e.g., `MediArca Healthcare`) and click **Create**.
4. Make sure your newly created project is selected.

---

## Step 2: Configure OAuth Consent Screen

1. In the left navigation menu, go to **APIs & Services** > **OAuth consent screen**.
2. Under **User Type**, choose **External** and click **Create**.
3. Fill in the required application details:
   - **App name**: `MediArca`
   - **User support email**: Your email address
   - **App logo**: (Optional)
   - **Application home page**: `https://bikesh3764.github.io/MediArca/`
   - **Authorized domains**:
     - `github.io`
     - `onrender.com`
   - **Developer contact information**: Your email address
4. Click **Save and Continue**.
5. Under **Scopes**, click **Add or Remove Scopes**, select:
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
   - `openid`
6. Click **Update**, then **Save and Continue**.
7. In **Test users**, you can add your personal Gmail accounts to test while the app is in "Testing" mode.
8. Click **Save and Continue**, then return to the Dashboard.

> **Note for Production Release**: When you are ready for public release, click **Publish App** on the OAuth consent screen tab so any user with a Google account can sign in without needing to be in the test users list.

---

## Step 3: Create OAuth 2.0 Web Client ID

1. In the left menu, navigate to **APIs & Services** > **Credentials**.
2. Click **+ Create Credentials** at the top and select **OAuth client ID**.
3. Choose **Application type**: `Web application`.
4. Name it (e.g., `MediArca Web Client`).
5. Under **Authorized JavaScript origins**, click **+ Add URI** and add BOTH:
   - `http://localhost:5173` (for local frontend development)
   - `https://bikesh3764.github.io` (for GitHub Pages production frontend)
6. Under **Authorized redirect URIs**, click **+ Add URI** and add:
   - `http://localhost:5173`
   - `https://bikesh3764.github.io/MediArca/`
7. Click **Create**.
8. A modal will display your **Client ID** (e.g., `123456789012-abcdefghijklmnopqrstuvwxyz.apps.googleusercontent.com`) and **Client Secret**.
9. Copy your **Client ID**.

---

## Step 4: Add Client ID to Frontend & Backend

### 1. Local Development
- In `frontend/.env` (or create one from `frontend/.env.example`):
  ```env
  VITE_API_URL="http://localhost:5000/api"
  VITE_GOOGLE_CLIENT_ID="YOUR_CLIENT_ID.apps.googleusercontent.com"
  ```
- In `backend/.env`:
  ```env
  GOOGLE_CLIENT_ID="YOUR_CLIENT_ID.apps.googleusercontent.com"
  ```

### 2. GitHub Pages (Frontend Production)
Since Vite injects `VITE_*` variables at build time:
1. Go to your repository on GitHub: `https://github.com/Bikesh3764/MediArca`.
2. Navigate to **Settings** > **Secrets and variables** > **Actions**.
3. Under **Repository secrets** (or **Repository variables**), click **New repository secret**.
4. Name: `VITE_GOOGLE_CLIENT_ID`
5. Value: Your Google Client ID (`...apps.googleusercontent.com`).
6. Click **Add secret**.

*(The GitHub Actions workflow will automatically bundle this secret into the production static build).*

### 3. Render Web Service (Backend Production)
1. Go to your [Render Dashboard](https://dashboard.render.com/).
2. Select your `mediarca-api` service.
3. Click **Environment** in the left menu.
4. Click **Add Environment Variable**:
   - Key: `GOOGLE_CLIENT_ID`
   - Value: Your Google Client ID (`...apps.googleusercontent.com`).
5. Click **Save Changes** (Render will automatically redeploy with the new variable).

---

## Step 5: Verification Checklist

- [ ] Open `https://bikesh3764.github.io/MediArca/#/login`.
- [ ] The official Google "Continue with Google" button will display.
- [ ] Click the button and select your Google account.
- [ ] You will be logged in immediately, assigned a role, and redirected to `/doctors`.
- [ ] Your Google profile photo and name appear in the top navigation bar.
