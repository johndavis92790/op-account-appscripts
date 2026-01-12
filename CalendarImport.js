/**
 * Calendar Import - Efficient Calendar Data Collection
 * 
 * Imports calendar events from past year and future year
 * Optimized for minimal API calls and fast sheet operations
 */

/**
 * Main function - Import calendar events
 */
function importCalendarEvents() {
  const startTime = new Date();
  Logger.log('=== Starting Calendar Import ===');
  
  try {
    const config = getCalendarImportConfig();
    
    Logger.log('Step 1: Fetching calendar events...');
    const events = fetchCalendarEvents(config);
    Logger.log(`Retrieved ${events.length} events`);
    
    Logger.log('Step 2: Processing event data...');
    const processedData = processCalendarEvents(events);
    
    Logger.log('Step 3: Writing to sheet...');
    writeCalendarToSheet(processedData, config.sheetName);
    
    const duration = (new Date() - startTime) / 1000;
    Logger.log(`=== Import Complete in ${duration}s ===`);
    
    return {
      success: true,
      eventCount: events.length,
      duration: duration
    };
    
  } catch (error) {
    Logger.log('ERROR: ' + error.message);
    Logger.log(error.stack);
    throw error;
  }
}

/**
 * Fetch calendar events efficiently (single API call per calendar)
 */
function fetchCalendarEvents(config) {
  const calendar = CalendarApp.getCalendarById(config.calendarId);
  
  if (!calendar) {
    throw new Error(`Calendar not found: ${config.calendarId}`);
  }
  
  const now = new Date();
  const startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const endDate = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
  
  Logger.log(`Fetching events from ${startDate.toISOString()} to ${endDate.toISOString()}`);
  
  const events = calendar.getEvents(startDate, endDate);
  
  return events.map(event => {
    const guests = event.getGuestList();
    
    return {
      id: event.getId(),
      title: event.getTitle(),
      startTime: event.getStartTime(),
      endTime: event.getEndTime(),
      location: event.getLocation() || '',
      description: event.getDescription() || '',
      isAllDay: event.isAllDayEvent(),
      attendees: guests.map(guest => {
        const guestStatus = guest.getGuestStatus();
        return {
          email: guest.getEmail() || '',
          name: guest.getName() || '',
          status: guestStatus ? guestStatus.toString() : 'UNKNOWN'
        };
      }),
      myStatus: event.getMyStatus() ? event.getMyStatus().toString() : 'UNKNOWN',
      creator: event.getCreators()[0] || '',
      isRecurring: event.isRecurringEvent()
    };
  });
}

/**
 * Process events into flat structure for sheet storage
 */
function processCalendarEvents(events) {
  const headers = [
    'Event ID',
    'Title',
    'Start Time',
    'End Time',
    'Duration (hours)',
    'Location',
    'Description',
    'Is All Day',
    'My Status',
    'Creator',
    'Is Recurring',
    'Attendee Count',
    'Attendee Emails',
    'Attendee Names',
    'Attendee Statuses',
    'Accepted Count',
    'Declined Count',
    'Tentative Count',
    'No Response Count'
  ];
  
  const rows = events.map(event => {
    const duration = (event.endTime - event.startTime) / (1000 * 60 * 60);
    
    const attendeeEmails = event.attendees.map(a => a.email).join(', ');
    const attendeeNames = event.attendees.map(a => a.name || a.email).join(', ');
    const attendeeStatuses = event.attendees.map(a => a.status).join(', ');
    
    const acceptedCount = event.attendees.filter(a => a.status === 'YES').length;
    const declinedCount = event.attendees.filter(a => a.status === 'NO').length;
    const tentativeCount = event.attendees.filter(a => a.status === 'MAYBE').length;
    const noResponseCount = event.attendees.filter(a => a.status === 'INVITED' || a.status === 'AWAITING').length;
    
    return [
      event.id,
      event.title,
      event.startTime,
      event.endTime,
      duration,
      event.location || '',
      event.description || '',
      event.isAllDay ? 'Yes' : 'No',
      event.myStatus,
      event.creator,
      event.isRecurring ? 'Yes' : 'No',
      event.attendees.length,
      attendeeEmails,
      attendeeNames,
      attendeeStatuses,
      acceptedCount,
      declinedCount,
      tentativeCount,
      noResponseCount
    ];
  });
  
  return [headers, ...rows];
}

/**
 * Write calendar data to sheet (optimized for speed)
 */
function writeCalendarToSheet(data, sheetName) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }
  
  sheet.clear();
  
  if (data.length > 0) {
    sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
    
    sheet.getRange(1, 1, 1, data[0].length)
      .setFontWeight('bold')
      .setBackground('#34a853')
      .setFontColor('#ffffff');
    
    const startTimeCol = 3;
    const endTimeCol = 4;
    if (data.length > 1) {
      sheet.getRange(2, startTimeCol, data.length - 1, 1)
        .setNumberFormat('yyyy-mm-dd hh:mm');
      sheet.getRange(2, endTimeCol, data.length - 1, 1)
        .setNumberFormat('yyyy-mm-dd hh:mm');
    }
    
    const durationCol = 5;
    if (data.length > 1) {
      sheet.getRange(2, durationCol, data.length - 1, 1)
        .setNumberFormat('0.00');
    }
    
    for (let i = 1; i <= data[0].length; i++) {
      sheet.autoResizeColumn(i);
    }
    
    sheet.setFrozenRows(1);
    sheet.setFrozenColumns(2);
  }
  
  const timestamp = new Date();
  sheet.getRange(1, data[0].length + 2).setValue('Last Updated:');
  sheet.getRange(1, data[0].length + 3).setValue(timestamp);
  
  Logger.log(`Wrote ${data.length} rows to sheet "${sheetName}"`);
}

/**
 * Setup automatic import trigger (every 15 minutes)
 */
function setupCalendarAutoImport() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'importCalendarEvents') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  ScriptApp.newTrigger('importCalendarEvents')
    .timeBased()
    .everyMinutes(15)
    .create();
  
  Logger.log('Calendar auto-import trigger created (runs every 15 minutes)');
  
  SpreadsheetApp.getUi().alert(
    'Calendar Auto-Import Enabled',
    'Calendar events will now be imported automatically every 15 minutes.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * Test calendar import
 */
function testCalendarImport() {
  try {
    const result = importCalendarEvents();
    
    SpreadsheetApp.getUi().alert(
      'Calendar Import Test',
      `✅ Success!\n\nImported ${result.eventCount} events.\nDuration: ${result.duration}s`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    
  } catch (error) {
    Logger.log('Calendar import failed: ' + error.message);
    SpreadsheetApp.getUi().alert(
      'Calendar Import Test',
      `❌ Failed\n\nError: ${error.message}\n\nCheck logs for details.`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}
