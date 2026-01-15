# Multiple CSV Import Setup

This guide explains how to configure multiple CSV file imports from Gmail, each going to a different sheet.

## Overview

The system now supports importing multiple CSV files from different email sources, each with its own:
- Email search query
- Destination sheet name
- Configuration settings

## How It Works

1. **Configuration Array**: All CSV imports are defined in `EmailConfig.js`
2. **Dynamic Menu**: Menu items are automatically generated for each config
3. **Import Options**:
   - Import all CSVs at once
   - Import individual CSVs
   - Automatic scheduled imports (all configs)

## Adding a New CSV Import

### Step 1: Edit EmailConfig.js

Open `EmailConfig.js` and add a new configuration object to the `EMAIL_CONFIGS` array:

```javascript
const EMAIL_CONFIGS = [
  {
    id: 'renewal-opportunities',
    name: 'Renewal Opportunities',
    emailSearchQuery: 'subject:"Report - Master - Renewal Opportunities" has:attachment filename:csv newer_than:1d',
    sheetName: 'Renewal Opportunities',
    markAsRead: false
  },
  // Add your new config here:
  {
    id: 'customer-health',  // Unique ID (use lowercase with hyphens)
    name: 'Customer Health Report',  // Display name in menu
    emailSearchQuery: 'subject:"Customer Health Report" has:attachment filename:csv newer_than:1d',
    sheetName: 'Customer Health',  // Sheet name in Google Sheets
    markAsRead: false  // Whether to mark emails as read after import
  }
];
```

### Step 2: Create Menu Handler Function

In `EmailToSheet.js`, add a menu handler function for your new config:

```javascript
/**
 * Dynamic menu handlers for each CSV config
 */
function importCSV_renewalOpportunities() {
  return importLatestCSVManual('renewal-opportunities');
}

// Add your new handler:
function importCSV_customerHealth() {
  return importLatestCSVManual('customer-health');
}
```

**Note**: The function name must be `importCSV_` + your config ID (with hyphens converted to camelCase).

### Step 3: Push Changes

```bash
clasp push
git add -A
git commit -m "Add new CSV import config"
git push
```

### Step 4: Reload Your Sheet

Close and reopen your Google Sheet (or refresh the page) to see the new menu item.

## Configuration Fields Explained

| Field | Description | Example |
|-------|-------------|---------|
| `id` | Unique identifier (lowercase, hyphens) | `'customer-health'` |
| `name` | Display name in menu | `'Customer Health Report'` |
| `emailSearchQuery` | Gmail search query to find emails | `'subject:"Report" has:attachment filename:csv'` |
| `sheetName` | Destination sheet name | `'Customer Health'` |
| `markAsRead` | Mark emails as read after import | `false` |

## Gmail Search Query Tips

Common search patterns:

```javascript
// By subject line
'subject:"Exact Subject" has:attachment filename:csv newer_than:1d'

// By sender
'from:reports@company.com has:attachment filename:csv newer_than:1d'

// By label
'label:reports has:attachment filename:csv newer_than:1d'

// Multiple conditions
'subject:"Report" from:noreply@company.com has:attachment filename:csv newer_than:2d'

// Specific filename
'subject:"Report" has:attachment filename:"specific-file.csv" newer_than:1d'
```

**Time filters:**
- `newer_than:1d` - Last 24 hours
- `newer_than:2d` - Last 2 days
- `newer_than:7d` - Last week

## Menu Structure

After adding configs, your menu will look like:

```
OP Account Tools
└── Email Import
    ├── 📥 Import All CSVs
    ├── ─────────────────
    ├── Import: Renewal Opportunities
    ├── Import: Customer Health Report
    ├── Import: [Your Config Name]
    ├── ─────────────────
    ├── Setup Auto-Import
    └── Test Email Search
```

## Using the Import Functions

### Import All CSVs
Click **"📥 Import All CSVs"** to import all configured CSV files in one operation.

### Import Individual CSV
Click **"Import: [Config Name]"** to import just that specific CSV file.

### Automatic Import
Click **"Setup Auto-Import"** to schedule automatic imports. This will import ALL configured CSVs on the schedule.

## Example Configurations

### Sales Report
```javascript
{
  id: 'sales-report',
  name: 'Daily Sales Report',
  emailSearchQuery: 'subject:"Daily Sales Report" has:attachment filename:csv newer_than:1d',
  sheetName: 'Sales Data',
  markAsRead: false
}
```

### Support Tickets
```javascript
{
  id: 'support-tickets',
  name: 'Support Tickets Export',
  emailSearchQuery: 'from:support@company.com subject:"Ticket Export" has:attachment filename:csv newer_than:1d',
  sheetName: 'Support Tickets',
  markAsRead: true
}
```

### Marketing Metrics
```javascript
{
  id: 'marketing-metrics',
  name: 'Marketing Campaign Metrics',
  emailSearchQuery: 'label:marketing-reports has:attachment filename:"campaign-metrics.csv" newer_than:1d',
  sheetName: 'Marketing Data',
  markAsRead: false
}
```

## Troubleshooting

### Menu item not appearing
1. Make sure you added the menu handler function in `EmailToSheet.js`
2. Function name must match pattern: `importCSV_` + config ID (camelCase)
3. Reload your Google Sheet

### "Config not found" error
- Check that the `id` in your config matches the ID used in the menu handler
- IDs are case-sensitive

### No CSV found
- Test your Gmail search query directly in Gmail
- Adjust the `newer_than` time window
- Check that emails have CSV attachments

### Wrong sheet name
- The sheet will be created automatically if it doesn't exist
- Sheet name is case-sensitive

## Advanced: Programmatic Import

You can also import specific configs programmatically:

```javascript
// Import specific config
importLatestCSV('renewal-opportunities');

// Import all configs
importAllCSVs();
```

## Best Practices

1. **Unique IDs**: Use descriptive, unique IDs for each config
2. **Descriptive Names**: Use clear display names for the menu
3. **Specific Queries**: Make search queries as specific as possible to avoid wrong files
4. **Time Windows**: Use appropriate `newer_than` values (1d is usually good)
5. **Sheet Names**: Use clear, descriptive sheet names
6. **Test First**: Test each new config manually before setting up auto-import

## Next Steps

1. Add your CSV import configurations to `EmailConfig.js`
2. Add corresponding menu handlers to `EmailToSheet.js`
3. Push changes with `clasp push`
4. Reload your sheet and test each import
5. Set up auto-import once everything works
