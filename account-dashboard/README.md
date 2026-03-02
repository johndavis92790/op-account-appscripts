# OP Account Dashboard

A dark-themed, mobile-responsive CSM dashboard for ObservePoint accounts. Pulls data from Google Sheets via Firestore sync.

## Tech Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Database**: Firebase Firestore (synced from Google Sheets every 5 min)
- **Auth**: Firebase Auth (Google sign-in, restricted to john.davis@observepoint.com)
- **Hosting**: Firebase Hosting
- **Rich Text Editor**: TipTap
- **Backend**: Google Cloud Run Functions (for GitHub issue creation)

## Setup Guide

### 1. Install Firebase CLI

```bash
npm install -g firebase-tools
firebase login
```

### 2. Create Firebase Project

```bash
# Go to https://console.firebase.google.com
# Click "Add project"
# Name it: op-account-dashboard (or similar)
# Enable Google Analytics if desired
# Wait for project creation
```

### 3. Enable Firebase Services

In the Firebase Console:

1. **Authentication** → Get Started → Enable "Google" sign-in provider
   - Add `john.davis@observepoint.com` as an authorized domain owner
2. **Firestore Database** → Create Database → Start in production mode → Choose `us-central1`
3. **Hosting** → Get Started

### 4. Get Firebase Config

1. Go to Project Settings (gear icon) → General
2. Under "Your apps", click the web icon (`</>`) to add a web app
3. Register app name: "OP Account Dashboard"
4. Copy the Firebase config object

### 5. Configure the App

```bash
cd account-dashboard

# Copy the env example
cp .env.example .env

# Edit .env with your Firebase config values from step 4
```

### 6. Link Firebase Project

```bash
firebase init
# Select: Firestore, Hosting
# Use existing project → select your project
# Accept defaults for Firestore rules/indexes
# Public directory: dist
# Single-page app: Yes
# Don't overwrite index.html
```

### 7. Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules
```

### 8. Configure Apps Script Sync

In your Google Sheets Apps Script editor:

1. Go to **Project Settings** → **Script Properties**
2. Add property: `FIREBASE_PROJECT_ID` = your Firebase project ID
3. Add OAuth scope to `appsscript.json`:
   ```json
   "oauthScopes": [
     "https://www.googleapis.com/auth/spreadsheets",
     "https://www.googleapis.com/auth/gmail.readonly",
     "https://www.googleapis.com/auth/calendar.readonly",
     "https://www.googleapis.com/auth/script.external_request",
     "https://www.googleapis.com/auth/datastore"
   ]
   ```
4. From the menu: **OP Account Tools** → **Firestore Sync** → **Set Firebase Project ID**
5. Run **Sync to Firestore Now** to do the initial sync
6. Run **Setup Auto-Sync (5 min)** to enable automatic syncing

### 9. Enable Firestore API

Make sure the Firestore API is enabled in your GCP project:
- Go to https://console.cloud.google.com/apis/library/firestore.googleapis.com
- Select your project and click "Enable"

### 10. Build & Deploy

```bash
npm run build
firebase deploy --only hosting
```

### 11. (Optional) Cloud Function for GitHub Task Creation

If you want manual tasks created in the webapp to also create GitHub issues, set up a Cloud Run Function. Otherwise, manual tasks will be stored in Firestore only.

## Development

```bash
npm run dev
# Opens at http://localhost:5173
```

## Architecture

```
Google Sheets (source of truth)
       │
       ▼  (every 5 min via Apps Script)
   Firestore ◄──── Webapp (notes editing writes here)
       │                    │
       ▼                    ▼
  React Dashboard    Cloud Functions
                    (GitHub issue creation)
```

### Data Flow

1. **Sheet → Firestore**: Apps Script `syncToFirestore()` runs every 5 minutes, reads Account Data Raw + resolves reference IDs to full data from underlying tables, writes to Firestore
2. **Firestore → Webapp**: React app uses `onSnapshot` for real-time updates
3. **Webapp → Firestore → Sheet**: Notes edited in webapp write to Firestore with `source: 'webapp'`, next sync cycle picks them up and writes back to Notes Storage sheet
4. **Webapp → Cloud Function → GitHub**: Manual task creation calls Cloud Function which creates GitHub issue, returns ID to store in Firestore
