# Calendar Import Setup

Efficiently imports calendar events from the past year and future year into Google Sheets.

## Features

- ✅ **2-year window**: Past year + future year of events
- ✅ **Complete attendee data**: Emails, names, response status
- ✅ **Efficient API usage**: Single API call per import
- ✅ **Fast sheet operations**: Optimized for quick read/write
- ✅ **Auto-refresh**: Updates every 15 minutes
- ✅ **Rich metadata**: Duration, location, description, recurring status

## Data Collected

### Event Details
- Event ID (unique identifier)
- Title
- Start Time
- End Time
- Duration (in hours)
- Location
- Description
- Is All Day event
- My Status (accepted/declined/etc)
- Creator email
- Is Recurring event

### Attendee Information
- Attendee Count
- Attendee Emails (comma-separated)
- Attendee Names (comma-separated)
- Attendee Statuses (comma-separated)
- Accepted Count
- Declined Count
- Tentative Count
- No Response Count

## Setup Instructions

### 1. Add Files to Apps Script

The calendar import files should already be in your Apps Script project:
- `CalendarImport.js` - Main import logic
- `CalendarConfig.js` - Configuration

### 2. Test the Import

1. Refresh your Google Sheet
2. You'll see a new menu: **Calendar Import**
3. Click **Calendar Import** → **Test Calendar Import**
4. Authorize the script when prompted
5. Check the new "Calendar Events" sheet

### 3. Enable Auto-Import

Click **Calendar Import** → **Setup Auto-Import (15 min)**

This creates a trigger that runs every 15 minutes.

## Rate Limits

### Google Calendar API Quotas
- **CalendarApp service**: 5,000 calls/day (built-in service, higher quota)
- **Per-user limit**: 1,000,000 events/day

### Our Usage
- **1 API call per import** (fetches all events in date range at once)
- **96 imports per day** (every 15 minutes)
- **Well within limits** ✅

### Optimization Strategies
1. **Single batch fetch**: Gets all events in one call
2. **Efficient date range**: Only 2 years of data
3. **Flat data structure**: Fast sheet writes
4. **Frozen headers**: Quick navigation

## Sheet Structure

The "Calendar Events" sheet has these columns:

| Column | Type | Description |
|--------|------|-------------|
| Event ID | Text | Unique event identifier |
| Title | Text | Event name |
| Start Time | DateTime | Event start |
| End Time | DateTime | Event end |
| Duration (hours) | Number | Calculated duration |
| Location | Text | Event location |
| Description | Text | Event description |
| Is All Day | Yes/No | All-day event flag |
| My Status | Text | Your response status |
| Creator | Email | Event creator |
| Is Recurring | Yes/No | Recurring event flag |
| Attendee Count | Number | Total attendees |
| Attendee Emails | Text | Comma-separated emails |
| Attendee Names | Text | Comma-separated names |
| Attendee Statuses | Text | Comma-separated statuses |
| Accepted Count | Number | Accepted responses |
| Declined Count | Number | Declined responses |
| Tentative Count | Number | Tentative responses |
| No Response Count | Number | No response yet |

## Configuration

### Change Calendar Source

Edit `CalendarConfig.js`:
```javascript
calendarId: 'primary'  // Your primary calendar
// OR
calendarId: 'your-calendar-id@group.calendar.google.com'  // Specific calendar
```

### Change Sheet Name

Edit `CalendarConfig.js`:
```javascript
sheetName: 'Calendar Events'  // Default name
```

### Change Update Frequency

Edit `CalendarImport.js` → `setupCalendarAutoImport()`:
```javascript
// Every 15 minutes (default)
.everyMinutes(15)

// Every 30 minutes
.everyMinutes(30)

// Every hour
.everyHours(1)
```

## Performance

### Expected Performance
- **~1,000 events**: ~3-5 seconds
- **~5,000 events**: ~10-15 seconds
- **Sheet write**: ~1-2 seconds

### If You Have Many Events
The script is optimized for speed, but if you have 10,000+ events:
1. Consider reducing the date range (e.g., 6 months instead of 2 years)
2. Increase update frequency to 30 minutes instead of 15

## Using the Data

### Example: Find meetings with specific person
```javascript
function findMeetingsWithPerson(email) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Calendar Events');
  const data = sheet.getDataRange().getValues();
  
  const meetings = [];
  for (let i = 1; i < data.length; i++) {
    const attendeeEmails = data[i][12]; // Attendee Emails column
    if (attendeeEmails.includes(email)) {
      meetings.push({
        title: data[i][1],
        startTime: data[i][2],
        status: data[i][14] // Attendee Statuses
      });
    }
  }
  return meetings;
}
```

### Example: Count meetings per month
```javascript
function countMeetingsPerMonth() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Calendar Events');
  const data = sheet.getDataRange().getValues();
  
  const counts = {};
  for (let i = 1; i < data.length; i++) {
    const date = new Date(data[i][2]); // Start Time
    const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
    counts[monthKey] = (counts[monthKey] || 0) + 1;
  }
  return counts;
}
```

## Troubleshooting

### No events imported
- Check that you have calendar access
- Verify the calendar ID is correct
- Check date range (past year + future year)

### Missing attendees
- Some events may not have attendee information
- Private events may hide attendee details

### Script timeout
- Reduce date range in `fetchCalendarEvents()`
- Increase trigger frequency to reduce events per run

## Next Steps

Once calendar data is importing:
1. Match calendar events to accounts (from Domo data)
2. Calculate meeting frequency per account
3. Identify accounts without upcoming meetings
4. Build engagement dashboards
