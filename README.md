# OP Account AppScripts - Email CSV Import

Simple Google Apps Script that imports CSV files from scheduled Domo emails into Google Sheets.

## Quick Start

1. Open the [Google Sheet](https://docs.google.com/spreadsheets/d/1-cEjGfOMnQMObzwvqLgos19VIOhGxW8TE6NwMVf749c/edit)
2. Go to **Extensions** → **Apps Script**
3. Files are automatically synced via clasp
4. Customize `EmailConfig.js` for your email search
5. Run **Email Import** → **Import Latest CSV**

## Files

- **EmailToSheet.js** - Main import logic
- **EmailConfig.js** - Configuration (customize email search here)
- **appsscript.json** - Apps Script manifest
- **SIMPLE-SETUP.md** - Detailed setup instructions

## Development

### Push to Apps Script
```bash
clasp push
```

### Pull from Apps Script
```bash
clasp pull
```

### Open in Apps Script Editor
```bash
clasp open
```

## Configuration

Edit `EmailConfig.js` to customize:
- Email search query
- Sheet name
- Mark as read behavior

Example search query:
```javascript
emailSearchQuery: 'from:noreply@domo.com subject:"Renewal Opportunities" has:attachment filename:csv newer_than:3d'
```

## Features

- ✅ Automatic CSV import from Gmail
- ✅ Scheduled auto-import (hourly)
- ✅ Formatted output with headers
- ✅ Test functions for debugging
- ✅ Custom menu in Google Sheets

## Links

- [Google Sheet](https://docs.google.com/spreadsheets/d/1-cEjGfOMnQMObzwvqLgos19VIOhGxW8TE6NwMVf749c/edit)
- [GitHub Repo](https://github.com/johndavis92790/op-account-appscripts)
