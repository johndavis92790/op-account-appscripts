# Meeting Recaps & Action Items Update

## Summary of Changes

This update adds two new columns to the Account Data Raw sheet and improves the account matching logic for meeting recaps.

### 1. New Columns in Account Data Raw

**Meeting Recaps** - An array of Meeting Recap IDs associated with each account
- Format: `["ngmt_01KFXKBAV0R7S2VBVK3QSBHMR3", "ngmt_01KFXKBAV0R7S2VBVK3QSBHMR4"]`
- Matches using Account ID from the Webhook Meeting Recaps table

**Meeting Action Items** - An array of concatenated IDs (Meeting Recap ID + Action Item Index)
- Format: `["ngmt_01KFXKBAV0R7S2VBVK3QSBHMR3_0", "ngmt_01KFXKBAV0R7S2VBVK3QSBHMR3_1"]`
- Each ID is: `{Meeting Recap ID}_{Action Item Index}`
- Matches using Account ID from the Meeting Action Items table (via Meeting Recap ID lookup)

### 2. Improved Account Matching Logic

**Problem Identified:**
Meeting recaps were missing Account IDs because the webhook handler only checked `actualAttendees` (people who actually attended) and stopped at the first match attempt.

**Root Causes:**
1. Only checked actual attendees, not invited attendees
2. If external attendee domains weren't in the mapping sheet, no account was assigned
3. Limited logging made debugging difficult

**Solutions Implemented:**

#### A. Enhanced Webhook Handler (`WebhookHandler.js`)
- Now checks **BOTH** actual and invited attendees
- Tries all external email domains until a match is found
- Added comprehensive logging to track:
  - Number of external emails being checked
  - Which email/domain successfully matched
  - Which domains were tried but not found in mapping
  - When no external attendees exist

#### B. Fix Script for Existing Data (`FixMissingAccounts.js`)
Created a new script to retroactively fix meeting recaps with missing accounts:

**Functions:**
- `fixMissingAccountsInMeetingRecapsManual()` - Main function with UI
- `analyzeMissingDomainsManual()` - Analyze which domains are unmapped

**What it does:**
1. Scans all meeting recaps for missing Account IDs
2. Checks both actual and invited attendees
3. Filters out observepoint.com emails
4. Attempts to match external domains to accounts
5. Updates Account ID, Account Name, Opportunity ID, Opportunity Name, and Mapped Domain
6. Logs detailed information about matches and failures

## How to Use

### Running the Fix Script

1. **Ensure Mapping Sheet is Updated**
   - Go to "Accounts to Email Domains Mapping" sheet
   - Make sure all relevant customer domains are mapped to accounts
   - Format: `company.com, example.org` (comma-separated)

2. **Run the Fix Script**
   - In Google Apps Script editor, open `FixMissingAccounts.js`
   - Run function: `fixMissingAccountsInMeetingRecapsManual()`
   - Review the results in the UI dialog
   - Check execution logs for detailed information

3. **Analyze Unmapped Domains** (Optional)
   - Run function: `analyzeMissingDomainsManual()`
   - This shows which domains are causing failures
   - Add these domains to the mapping sheet
   - Re-run the fix script

### Regenerating Account Data Raw

After fixing missing accounts:
1. Go to the spreadsheet
2. Run: `generateAccountDataRawManual()`
3. The new columns will be populated automatically

## Technical Details

### Account Matching Flow

```
Webhook Received
    ↓
Extract Attendees (actual + invited)
    ↓
Filter External Emails (exclude observepoint.com)
    ↓
For each external email:
    Extract domain → Check mapping sheet → Match to Account
    ↓
    If match found: Assign Account ID + Details
    ↓
    If no match: Log domain and continue
    ↓
Store in Webhook Meeting Recaps sheet
```

### Data Relationships

```
Webhook Meeting Recaps
    ├── Account ID (matched via email domains)
    ├── Meeting Recap ID (unique identifier)
    └── Attendees (actual + invited)

Meeting Action Items
    ├── Meeting Recap ID (foreign key)
    ├── Action Item Index (0, 1, 2, ...)
    └── Account Name (copied from recap)

Account Data Raw
    ├── Account ID (primary key)
    ├── Meeting Recaps: [recap_id_1, recap_id_2, ...]
    └── Meeting Action Items: [recap_id_1_0, recap_id_1_1, ...]
```

### Concatenated Action Item ID Format

Action Item IDs use the format: `{Meeting Recap ID}_{Action Item Index}`

**Example:**
- Meeting Recap ID: `ngmt_01KFXKBAV0R7S2VBVK3QSBHMR3`
- Action Item Index: `0` (first action item)
- Concatenated ID: `ngmt_01KFXKBAV0R7S2VBVK3QSBHMR3_0`

This allows unique identification of each action item across all meetings.

## Troubleshooting

### Meeting Recaps Still Missing Accounts

**Check:**
1. Are the attendee email domains in the "Accounts to Email Domains Mapping" sheet?
2. Run `analyzeMissingDomainsManual()` to see which domains are unmapped
3. Add missing domains to the mapping sheet
4. Re-run `fixMissingAccountsInMeetingRecapsManual()`

### Empty Arrays in Account Data Raw

**Possible causes:**
1. No meeting recaps exist for that account
2. Meeting recaps exist but have no Account ID assigned
3. Fix the Account IDs first, then regenerate Account Data Raw

### Action Items Not Showing Up

**Check:**
1. Do the meeting recaps have Account IDs?
2. Are the action items in the "Meeting Action Items" sheet?
3. Do the Meeting Recap IDs match between the two sheets?

## Best Practices

1. **Keep Mapping Sheet Updated**
   - Add new customer domains as soon as you learn about them
   - Review unmapped domains regularly

2. **Run Fix Script Periodically**
   - After adding new domains to the mapping
   - When you notice missing accounts in reports

3. **Monitor Webhook Logs**
   - Check execution logs after webhook receives data
   - Look for "⚠️ No account match found" warnings
   - Add those domains to the mapping sheet

4. **Regenerate Account Data Raw**
   - After fixing missing accounts
   - After significant data changes
   - Before important reports

## Files Modified

1. **AccountDataRaw.js** - Added Meeting Recaps and Meeting Action Items columns
2. **WebhookHandler.js** - Enhanced account matching logic with better logging
3. **FixMissingAccounts.js** - New script to fix existing data

## Future Improvements

Potential enhancements for consideration:
- Automatic domain extraction and suggestion for unmapped domains
- Fuzzy matching for similar account names
- Bulk domain import from CSV
- Scheduled automatic fixing of missing accounts
- Email notifications when unmapped domains are detected
