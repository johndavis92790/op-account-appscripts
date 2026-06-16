# Firebase Functions Setup Guide

This guide walks you through setting up Firebase Functions to replace Google Apps Script.

## Overview

- **Codebase Created**: Complete Firebase Functions in `/functions/`
- **Migration Scripts**: Data export/import in `/migration/`
- **Your Tasks**: CLI setup, secrets, OAuth, deploy

---

## Phase 1: Firebase CLI Setup

### Step 1: Install Firebase CLI

```bash
npm install -g firebase-tools
firebase login
```

This will open a browser to authenticate with your Google account.

### Step 2: Initialize Project

```bash
cd /Users/johndavis/CascadeProjects/op-account-dashboard/functions
npm install
```

This installs all dependencies (firebase-functions, googleapis, csv-parse, zod, etc.).

### Step 3: Link to Firebase Project

```bash
firebase use --add
```

Select your Firebase project when prompted, or create a new one with:

```bash
firebase projects:create op-account-dashboard-prod
```

---

## Phase 2: Enable Required APIs

### Option A: Using gcloud CLI (if installed)

```bash
gcloud services enable gmail.googleapis.com
gcloud services enable calendar-json.googleapis.com
```

### Option B: Using Firebase Console

1. Go to https://console.cloud.google.com/apis/dashboard
2. Enable these APIs:
   - **Gmail API** (for email imports)
   - **Google Calendar API** (for calendar imports)
   - **Cloud Functions API** (should already be enabled)
   - **Cloud Scheduler API** (for scheduled functions)

---

## Phase 3: Set Up Secrets

### Step 1: Generate Webhook Secret

```bash
# Generate a random secret
openssl rand -hex 32

# Copy this value, then set it:
firebase functions:secrets:set WEBHOOK_SECRET
```

When prompted, paste the generated secret.

### Step 2: Set Up Gmail API OAuth (Option 2 - OAuth Flow)

Since we're using OAuth 2.0 (not service account), you need to:

#### A. Create OAuth 2.0 Credentials

1. Go to https://console.cloud.google.com/apis/credentials
2. Click **Create Credentials → OAuth client ID**
3. Select **Desktop app** as application type
4. Note the **Client ID** and **Client Secret**

#### B. Get Refresh Token

Run this helper script (created at `/scripts/get-gmail-refresh-token.js`):

```bash
cd /Users/johndavis/CascadeProjects/op-account-dashboard
node scripts/get-gmail-refresh-token.js
```

This script will:
1. Generate an authorization URL
2. Open your browser
3. Ask you to authorize access to Gmail
4. Exchange the code for a refresh token

#### C. Store Secrets

```bash
firebase functions:secrets:set GMAIL_CLIENT_ID
# Paste your OAuth client ID

firebase functions:secrets:set GMAIL_CLIENT_SECRET
# Paste your OAuth client secret

firebase functions:secrets:set GMAIL_REFRESH_TOKEN
# Paste the refresh token from the script
```

### Step 3: Store GitHub Token (Optional)

If you still need to create GitHub issues (legacy compatibility):

```bash
firebase functions:secrets:set GITHUB_TOKEN
# Paste your GitHub personal access token
```

---

## Phase 4: Configure Environment

Set configuration values:

```bash
firebase functions:config:set \
  import.domo_csv_search_query='subject:"Report - Master - Renewal Opportunities" has:attachment filename:csv newer_than:1d' \
  import.domains_internal='observepoint.com' \
  import.calendar_id='primary' \
  app.internal_domain='observepoint.com'
```

---

## Phase 5: Deploy Functions

### Deploy All Functions

```bash
cd /Users/johndavis/CascadeProjects/op-account-dashboard/functions
npm run build
firebase deploy --only functions
```

### Verify Deployment

```bash
firebase functions:list
```

You should see:
- `receiveMeetingRecap` (HTTPS)
- `createTaskFromWebhook` (HTTPS)
- `closeTaskFromWebhook` (HTTPS)
- `importDomoCSVs` (scheduled)
- `importGmailEmails` (scheduled)
- `importCalendarEvents` (scheduled)

---

## Phase 6: Export & Migrate Data

### Step 1: Export Google Sheets Data

```bash
cd /Users/johndavis/CascadeProjects/op-account-dashboard/migration

# Set up Google Cloud credentials
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/your/service-account-key.json

# Or if using the manual method:
# 1. Open each sheet in Google Sheets
# 2. File → Download → CSV
# 3. Save to /migration/exported-data/ with correct filenames

# Run the export script
node exportSheets.js
```

**Files to export:**
- `accounts.json` (from Account Data Raw sheet)
- `meeting-recaps.json` (from Webhook Meeting Recaps sheet)
- `contacts.json` (from Account Contacts sheet)
- `domain-mappings.json` (from Accounts to Email Domains Mapping sheet)
- `notes.json` (from Notes Storage sheet)

### Step 2: Migrate to Firestore

```bash
cd /Users/johndavis/CascadeProjects/op-account-dashboard/migration

# Set Firebase credentials
export FIREBASE_SERVICE_ACCOUNT_KEY=$(cat /path/to/firebase-service-account.json)

# Or create service-account-key.json in the migration folder

# Run migration
node migrateToFirestore.js
```

This imports all your historical data to Firestore.

### Step 3: Validate Migration

```bash
node validateMigration.js
```

This compares migrated data to ensure integrity.

---

## Phase 7: Update AskElephant Webhook

### Get Your Function URL

```bash
firebase functions:config:get
```

Or check the Firebase Console → Functions tab.

Your webhook URL will be:
```
https://us-central1-YOUR-PROJECT-ID.cloudfunctions.net/receiveMeetingRecap
```

### Update AskElephant Configuration

Contact AskElephant support or use their dashboard to update:

- **Webhook URL**: `https://us-central1-YOUR-PROJECT-ID.cloudfunctions.net/receiveMeetingRecap`
- **Authorization Header**: `Bearer YOUR_WEBHOOK_SECRET`
- **Method**: POST
- **Content-Type**: application/json

**Test payload** (for validation):
```json
{
  "meetingInfo": {
    "title": "Test Migration Webhook",
    "startTime": "2026-06-12T14:00:00Z",
    "endTime": "2026-06-12T15:00:00Z",
    "meetingLink": "https://app.askelephant.ai/workspaces/test/engagements/ngmt_TEST123"
  },
  "companyInfo": {
    "companyName": "Test Company"
  },
  "attendees": {
    "actual": ["john.davis@observepoint.com", "test@example.com"],
    "invited": ["john.davis@observepoint.com", "test@example.com"],
    "allNames": ["John Davis", "Test User"]
  },
  "externalAttendees": [
    {
      "Email": "test@example.com",
      "Name": "Test User"
    }
  ],
  "summary": "Test summary for migration",
  "actionItems": {
    "myItems": [
      {
        "actionItemTitle": "Test action item",
        "actionItemDescription": "This is a test",
        "priority": "High"
      }
    ],
    "othersItems": []
  }
}
```

---

## Phase 8: Cutover & Cleanup

### Step 1: Disable Apps Script Triggers

1. Open your Google Sheet
2. Extensions → Apps Script
3. Click the clock icon (Triggers)
4. Delete all triggers for:
   - `syncToFirestore`
   - `importAllCSVs`
   - `importCalendarEvents`
   - `importGmailEmails`

### Step 2: Update Dashboard Environment

Edit `account-dashboard/.env`:

```bash
# Remove old Apps Script webhook URL
# VITE_APPS_SCRIPT_WEBHOOK_URL=...

# Add new Firebase Functions webhook URL (for manual task creation)
VITE_FIREBASE_WEBHOOK_URL=https://us-central1-YOUR-PROJECT-ID.cloudfunctions.net/createTaskFromWebhook
```

### Step 3: Test Everything

1. Trigger a test meeting recap from AskElephant
2. Verify it appears in Firestore within seconds
3. Check that tasks are created from action items
4. Run a manual CSV import to verify scheduled functions work

### Step 4: Archive Google Sheets

Once everything is working:
1. Rename your Google Sheet to "[ARCHIVED] OP Account Dashboard - Historical"
2. Keep it as read-only backup
3. The Apps Script project can be disabled

---

## Troubleshooting

### Functions Won't Deploy

```bash
# Check logs
firebase functions:log

# Redeploy single function
firebase deploy --only functions:receiveMeetingRecap
```

### OAuth Token Expired

If the Gmail/Calendar import stops working:

```bash
# Re-run the refresh token script
node scripts/get-gmail-refresh-token.js

# Update the secret
firebase functions:secrets:set GMAIL_REFRESH_TOKEN
```

### Webhook Not Receiving

1. Check Firebase Functions logs:
   ```bash
   firebase functions:log --only receiveMeetingRecap
   ```

2. Verify the webhook URL in AskElephant dashboard

3. Check that WEBHOOK_SECRET matches

### Data Import Failures

1. Check the `importState` collection in Firestore for error messages
2. Verify your OAuth token has the correct scopes (gmail.readonly, calendar.readonly)
3. Check Firebase Functions logs for import functions

---

## Files Created

```
/Users/johndavis/CascadeProjects/op-account-dashboard/
├── functions/                          # Firebase Functions
│   ├── src/
│   │   ├── index.ts                   # Function exports
│   │   ├── config.ts                  # Environment config
│   │   ├── firestore.ts               # Firestore helpers
│   │   ├── types/index.ts             # TypeScript types
│   │   ├── webhooks/
│   │   │   ├── meetingRecap.ts        # AskElephant webhook
│   │   │   └── taskCreator.ts         # Manual task creation
│   │   └── imports/
│   │       ├── csvImporter.ts         # Domo CSV import
│   │       ├── emailImporter.ts       # Gmail import
│   │       └── calendarImporter.ts    # Calendar import
│   ├── package.json
│   ├── tsconfig.json
│   └── firebase.json
│
├── migration/                          # Data migration
│   ├── exportSheets.js                # Export from Sheets
│   ├── migrateToFirestore.js           # Import to Firestore
│   └── validateMigration.js           # Data validation
│
└── SETUP.md                           # This file
```

---

## Next Steps

1. ✅ Review this SETUP.md
2. ✅ Run Firebase CLI setup (Phase 1)
3. ✅ Enable APIs (Phase 2)
4. ✅ Set up secrets (Phase 3)
5. ✅ Deploy functions (Phase 5)
6. ✅ Export & migrate data (Phase 6)
7. ✅ Update AskElephant webhook (Phase 7)
8. ✅ Cutover (Phase 8)

**Questions?** Check the `FIREBASE_MIGRATION_PLAN.md` for detailed architecture.
