# Simple Email CSV Import to Google Sheets

This is a simplified solution that imports CSV files from your scheduled Domo emails directly into Google Sheets.

## What It Does

1. Searches your Gmail for emails with CSV attachments
2. Extracts the latest CSV file
3. Parses and imports it into a Google Sheet
4. Can run automatically on a schedule

## Setup (5 Minutes)

### 1. Create Apps Script Project

1. Open a new Google Sheet
2. Go to **Extensions** → **Apps Script**
3. Delete the default `Code.gs` file
4. Create 2 new files:
   - `EmailToSheet.js` (copy from the file)
   - `EmailConfig.js` (copy from the file)

### 2. Configure Email Search

Edit `EmailConfig.js` and customize the search query:

```javascript
emailSearchQuery: 'subject:"YOUR SUBJECT" has:attachment filename:csv newer_than:7d'
```

**Common search patterns:**
- `subject:"Renewal Opportunities"` - Match email subject
- `from:noreply@domo.com` - Match sender
- `has:attachment filename:csv` - Must have CSV attachment
- `newer_than:7d` - Only emails from last 7 days
- Combine with spaces: `subject:"Report" from:domo.com has:attachment`

**For your Domo export:**
```javascript
emailSearchQuery: 'from:noreply@domo.com subject:"Master - Renewal Opportunities" has:attachment filename:csv newer_than:3d'
```

### 3. Set Sheet Name

Edit `EmailConfig.js`:
```javascript
sheetName: 'Renewal Opportunities'  // Name of sheet to write data
```

### 4. Test It

1. Save both files
2. Refresh your Google Sheet
3. You'll see a new menu: **Email Import**
4. Click **Email Import** → **Test Email Search**
   - This shows what emails match your search
5. Click **Email Import** → **Import Latest CSV**
   - Authorize the script when prompted
   - Data will be imported to your sheet

### 5. Enable Auto-Import (Optional)

Click **Email Import** → **Setup Auto-Import**
- Imports CSV automatically every hour
- Customize frequency in `setupAutoImport()` function

## How to Customize

### Change Import Frequency

Edit `EmailToSheet.js` → `setupAutoImport()`:

```javascript
// Every hour
.everyHours(1)

// Every 6 hours
.everyHours(6)

// Daily at 8 AM
.timeBased().atHour(8).everyDays(1)

// Every 30 minutes
.everyMinutes(30)
```

### Mark Emails as Read After Import

Edit `EmailConfig.js`:
```javascript
markAsRead: true
```

### Multiple CSV Sources

To import from different email sources to different sheets, create multiple functions:

```javascript
function importRenewalOpportunities() {
  const csvData = findAndExtractLatestCSV({
    emailSearchQuery: 'subject:"Renewal Opportunities" has:attachment',
    sheetName: 'Renewals',
    markAsRead: false
  });
  // ... rest of import logic
}

function importAccountHealth() {
  const csvData = findAndExtractLatestCSV({
    emailSearchQuery: 'subject:"Account Health" has:attachment',
    sheetName: 'Health Scores',
    markAsRead: false
  });
  // ... rest of import logic
}
```

## Troubleshooting

### No CSV Found
- Run **Test Email Search** to verify emails are found
- Check that emails have CSV attachments
- Adjust `newer_than:7d` if emails are older
- Verify subject line matches exactly

### Authorization Error
- Re-authorize: **Extensions** → **Apps Script** → Run any function
- Grant Gmail and Sheets permissions

### Wrong Data Imported
- Check that the latest email has the correct CSV
- Emails are searched newest first
- Adjust search query to be more specific

### Script Timeout
- Large CSV files may timeout
- Reduce `newer_than` to search fewer emails
- Process in smaller batches

## Gmail Search Query Examples

```javascript
// Exact subject match
'subject:"Master - Renewal Opportunities"'

// Subject contains text
'subject:renewal opportunities'

// From specific sender
'from:noreply@domo.com'

// Combine multiple criteria
'from:domo.com subject:renewal has:attachment filename:csv'

// Date ranges
'after:2026/01/01 before:2026/01/31'

// Recent emails only
'newer_than:1d'  // Last 24 hours
'newer_than:7d'  // Last 7 days
```

## Next Steps

Once CSV import is working:
1. Add calendar integration (match accounts to meetings)
2. Add calculated columns (days until renewal, health trends)
3. Create dashboards and charts
4. Set up email alerts for at-risk accounts

## Files

- **EmailToSheet.js** - Main import logic
- **EmailConfig.js** - Configuration settings
- **SIMPLE-SETUP.md** - This file

## Advantages Over Domo API

✅ **Simpler** - No API credentials needed  
✅ **Faster** - 5 minute setup vs 30+ minutes  
✅ **Reliable** - Uses your existing scheduled export  
✅ **No maintenance** - No API key rotation  
✅ **Works immediately** - No waiting for Domo admin approval
