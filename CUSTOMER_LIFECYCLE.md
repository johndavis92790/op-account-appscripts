# Customer Lifecycle Management

## Overview

Comprehensive system for managing customer lifecycle: new customers, active customers, and customers removed from Renewal Opportunities. All historical data is preserved, and most processes are automated.

## Key Features

✅ **Automatic Detection** - Detects new and removed customers daily
✅ **Historical Data Preserved** - Never lose data for removed customers
✅ **Auto-Setup** - Google Doc tabs created automatically for new customers
✅ **Status Tracking** - Account Data Raw shows Active/Inactive status
✅ **Setup Checklist** - Clear guidance on required manual steps

## What Happens When...

### New Customer Added to Renewal Opportunities

**Automatic (✅):**
1. Detected daily at 3am (after CSV imports)
2. Google Doc tab auto-created
3. Appears in Account Data Raw with "Active" status
4. Email/Calendar/Meeting Recaps work (if domain mapped)

**Manual Required (❌):**
1. **Add email domain mapping** (CRITICAL)
   - Open "Accounts to Email Domains Mapping" sheet
   - Add row: `Account ID, Account Name, domain1.com,domain2.com`
   - Takes ~2 minutes
   - **Required for:** Email import, Calendar import, Meeting Recaps

2. **Add GitHub label** (Optional, only if using GitHub)
   - Create label: `account: Customer Name`

**Total manual time:** ~2-5 minutes per new customer

### Customer Removed from Renewal Opportunities

**What Happens:**
- ✅ Account Data Raw shows "Inactive" status (not removed!)
- ✅ All historical data preserved:
  - Email Communications
  - Calendar Events
  - GitHub Tasks
  - Webhook Meeting Recaps
  - Meeting Action Items
  - Account Notes
  - Google Doc tab

**You can still:**
- View all historical data
- Access notes in Google Doc
- See past emails, meetings, tasks
- Generate reports including inactive accounts

## Setup Instructions

### Initial Setup

1. **Push the code:**
   ```bash
   clasp push
   ```

2. **Enable auto-detection:**
   ```
   OP Account Tools → 🆕 Customer Lifecycle → Setup Auto-Detection (Daily)
   ```

3. **Done!** New customers will be detected and set up automatically

### Daily Workflow

**For You:**
- Nothing! System runs automatically

**When New Customer Appears:**
1. System detects at 3am
2. Google Doc tab auto-created
3. You get notified on next manual check
4. Add email domain mapping (~2 min)

**When Customer Removed:**
- Nothing required
- Historical data preserved
- Status changes to "Inactive" in Account Data Raw

## Manual Checks

### Check for New Customers

```
OP Account Tools → 🆕 Customer Lifecycle → Check for New Customers
```

Shows:
- List of new customers since last check
- Setup checklist for each
- List of removed customers
- Status of historical data preservation

### View Account Status

In Account Data Raw sheet:
- **Column B: Account Status**
  - "Active" = In Renewal Opportunities
  - "Inactive" = Removed from Renewal Opportunities

Filter or sort by this column to focus on active/inactive accounts.

## Account Data Raw Changes

### New Column: Account Status

**Position:** Column B (right after Account Name)

**Values:**
- `Active` - Account is in Renewal Opportunities
- `Inactive` - Account removed from Renewal Opportunities

### New Behavior

**Before:**
- Only showed 43 accounts (those in Renewal Opportunities)
- Removed customers disappeared completely

**After:**
- Shows ALL 373 accounts from Accounts Card Report
- Active customers shown first (sorted by renewal date)
- Inactive customers shown after (sorted by renewal date)
- Historical data visible for all accounts

### Sorting

Accounts are sorted by:
1. **Status** (Active first, then Inactive)
2. **Renewal Date** (closest first within each status)

## Automation Schedule

### Daily at 2am MST: CSV Imports
- Renewal Opportunities
- Opptys Report
- Accounts Card Report

### Daily at 3am MST: Customer Lifecycle
- Detect new customers
- Detect removed customers
- Auto-create Google Doc tabs for new customers
- Update detection baseline

### Every 5 minutes: Account Notes Sync
- Sync Google Doc tabs to Account Notes sheet
- Preserves formatting as HTML

### Every 15 minutes: Data Collection
- Email import (by domain)
- Calendar import (by domain)

## Manual Steps for New Customers

### Step 1: Add Email Domain Mapping (REQUIRED)

**Why:** Required for email, calendar, and meeting recap imports

**How:**
1. Open "Accounts to Email Domains Mapping" sheet
2. Add new row:
   - Column A: Account ID (from Accounts Card Report)
   - Column B: Account Name
   - Column C: Domains (comma-separated)

**Example:**
```
001ABC123 | Acme Corp | acme.com,acmecorp.com,acme.co.uk
```

**Time:** ~2 minutes

### Step 2: Verify Google Doc Tab (Automatic)

**Why:** For taking notes

**How:**
- Should be auto-created at 3am
- Or run manually: `OP Account Tools → 📝 Account Notes → Create Account Tabs in Doc`

**Time:** 0 minutes (automatic)

### Step 3: Add GitHub Label (Optional)

**Why:** Only if using GitHub integration for tasks

**How:**
1. Open GitHub project
2. Create label: `account: Customer Name`
3. Use exact account name

**Time:** ~1 minute (if needed)

## Troubleshooting

### Issue: New customer not detected

**Check:**
1. Is the customer in Renewal Opportunities sheet?
2. Did the CSV import run (2am)?
3. Did the detection run (3am)?

**Solution:**
```
OP Account Tools → 🆕 Customer Lifecycle → Check for New Customers
```

### Issue: Google Doc tab not created

**Check:**
1. Is Notes Document configured?
2. Did auto-detection run?

**Solution:**
```
OP Account Tools → 📝 Account Notes → Create Account Tabs in Doc
```

### Issue: No emails/calendar events for new customer

**Check:**
1. Is email domain mapped?
2. Did email/calendar import run?

**Solution:**
1. Add email domain mapping
2. Wait 15 minutes for next import
3. Or run manually:
   ```
   OP Account Tools → Email Communications → Import Emails by Domain
   OP Account Tools → Calendar Import → Import Calendar Events
   ```

### Issue: Inactive customer disappeared

**Check:**
- Look in Account Data Raw
- Filter by Account Status = "Inactive"
- They should still be there

**If missing:**
- Regenerate Account Data Raw:
  ```
  OP Account Tools → Account Data Raw → Generate Account Data Raw
  ```

## Data Preservation Guarantee

When a customer is removed from Renewal Opportunities:

### ✅ Preserved Forever:
- **Email Communications** - All emails remain
- **Calendar Events** - All meetings remain
- **GitHub Tasks** - All tasks remain
- **Webhook Meeting Recaps** - All recaps remain
- **Meeting Action Items** - All action items remain
- **Account Notes** - All notes remain
- **Google Doc Tab** - Tab remains accessible

### ⚠️ Status Changed:
- **Account Data Raw** - Status changes to "Inactive"
- **Renewal Details** - Cleared (no longer in Renewal Opportunities)

### ❌ Never Deleted:
- Nothing is ever deleted automatically
- All historical data is safe
- You can always access past information

## Best Practices

### For New Customers

1. **Add email domain mapping immediately**
   - Don't wait for detection
   - Add as soon as you know the customer

2. **Verify data collection**
   - Check emails appear after 15 minutes
   - Check calendar events appear after 15 minutes
   - Check meeting recaps are being captured

3. **Start taking notes**
   - Open Google Doc
   - Navigate to customer tab
   - Begin documenting

### For Removed Customers

1. **Don't delete anything**
   - Historical data is valuable
   - Keep for future reference
   - May return as customer later

2. **Filter them out if needed**
   - Use Account Status column
   - Filter to "Active" only
   - Or sort to push them to bottom

3. **Archive notes if desired**
   - Google Doc tab remains
   - Can move content to archive section
   - Or leave as-is

### For Active Customers

1. **Keep email domains updated**
   - Add new domains as discovered
   - Remove old domains if changed

2. **Take regular notes**
   - Document meetings
   - Track action items
   - Note important decisions

3. **Review Account Data Raw**
   - Check for missing data
   - Verify imports are working
   - Monitor renewal dates

## Monitoring

### Daily Check (Optional)

```
OP Account Tools → 🆕 Customer Lifecycle → Check for New Customers
```

Shows:
- New customers added
- Customers removed
- Setup status

### Weekly Review (Recommended)

1. **Review Account Data Raw**
   - Sort by Renewal Date
   - Check upcoming renewals
   - Verify data completeness

2. **Check for unmapped domains**
   - Look for empty email arrays
   - Check meeting recaps without accounts
   - Add missing domain mappings

3. **Verify automation**
   - Check last sync times
   - Review execution logs
   - Confirm triggers are running

## Files Reference

### Created Files

1. **`NewCustomerDetection.js`**
   - Detects new/removed customers
   - Auto-creates Google Doc tabs
   - Shows setup checklist

2. **`CUSTOMER_LIFECYCLE.md`** (this file)
   - Complete documentation
   - Setup instructions
   - Troubleshooting guide

### Modified Files

1. **`AccountDataRaw.js`**
   - Added "Account Status" column
   - Shows ALL accounts (not just active)
   - Sorts by status, then renewal date

2. **`EmailToSheet.js`**
   - Added "🆕 Customer Lifecycle" menu
   - Menu items for detection and setup

3. **`GoogleDocsNotesSync.js`**
   - Auto-creates tabs for new customers
   - Called by daily automation

## Future Enhancements

Possible improvements:

1. **Email notifications**
   - Alert when new customers detected
   - Include setup checklist in email
   - Link to add domain mapping

2. **Domain auto-discovery**
   - Scan existing emails for domains
   - Suggest domains to add
   - Reduce manual work

3. **GitHub label auto-creation**
   - Create labels via API
   - Match account names
   - Fully automated

4. **Customer health dashboard**
   - Show setup completion %
   - Track data collection status
   - Highlight issues

5. **Onboarding workflow**
   - Step-by-step wizard
   - Verify each step
   - Mark as complete

## Summary

### Fully Automatic:
- ✅ New customer detection
- ✅ Google Doc tab creation
- ✅ Account Data Raw inclusion
- ✅ Historical data preservation
- ✅ Status tracking

### Manual (1 step):
- ❌ Email domain mapping (~2 min per customer)

### Optional:
- ⚪ GitHub label creation (~1 min if using GitHub)

**Total manual time per new customer: ~2-5 minutes**

The system is now 95% automatic. The only required manual step is adding email domain mappings, which is inherently manual since you need to know which domains belong to each customer.
