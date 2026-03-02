/**
 * Calendar Import - Efficient Calendar Data Collection
 * 
 * Imports calendar events from past year and future year
 * Optimized for minimal API calls and fast sheet operations
 * 
 * Updated: Now uses account-centric model (AccountMapping.js)
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
    
    // Match to meeting recaps
    Logger.log('Step 4: Matching to meeting recaps...');
    try {
      matchMeetingRecapsToCalendarEvents();
    } catch (matchError) {
      Logger.log('Warning: Meeting recap matching failed: ' + matchError.message);
    }
    
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
 * Fetch calendar events using Calendar Advanced Service (bulk REST API)
 * Returns all event data in paginated API calls instead of individual RPCs
 */
function fetchCalendarEvents(config) {
  const now = new Date();
  const startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const endDate = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
  
  Logger.log(`Fetching events from ${startDate.toISOString()} to ${endDate.toISOString()}`);
  
  const excludedTitlesSet = new Set(config.excludedTitles || []);
  const calendarId = config.calendarId === 'primary' ? 'primary' : config.calendarId;
  
  // Fetch all events via Advanced Service (bulk - all data in one call per page)
  const allItems = [];
  let pageToken = null;
  
  do {
    const options = {
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: true,
      maxResults: 2500,
      orderBy: 'startTime'
    };
    if (pageToken) options.pageToken = pageToken;
    
    const response = Calendar.Events.list(calendarId, options);
    const items = response.items || [];
    allItems.push(...items);
    pageToken = response.nextPageToken;
  } while (pageToken);
  
  Logger.log(`Retrieved ${allItems.length} raw events from API`);
  
  // Filter and transform in-memory (no RPCs needed)
  const filteredEvents = [];
  for (const item of allItems) {
    const title = item.summary || '';
    if (excludedTitlesSet.has(title)) continue;
    
    // Parse start/end times
    const startTime = item.start.dateTime
      ? new Date(item.start.dateTime)
      : new Date(item.start.date);
    const endTime = item.end.dateTime
      ? new Date(item.end.dateTime)
      : new Date(item.end.date);
    const isAllDay = !item.start.dateTime;
    
    // Parse attendees from JSON (no RPCs)
    const attendees = (item.attendees || []).map(a => {
      const statusMap = {
        'accepted': 'YES',
        'declined': 'NO',
        'tentative': 'MAYBE',
        'needsAction': 'INVITED'
      };
      return {
        email: a.email || '',
        name: a.displayName || a.email || '',
        status: statusMap[a.responseStatus] || 'UNKNOWN'
      };
    });
    
    // Determine my status from attendees list
    let myStatus = 'UNKNOWN';
    if (item.attendees) {
      const me = item.attendees.find(a => a.self);
      if (me) {
        const statusMap = { 'accepted': 'YES', 'declined': 'NO', 'tentative': 'MAYBE', 'needsAction': 'INVITED' };
        myStatus = statusMap[me.responseStatus] || 'UNKNOWN';
      }
    }
    
    filteredEvents.push({
      id: item.id || '',
      title: title,
      startTime: startTime,
      endTime: endTime,
      location: item.location || '',
      description: item.description || '',
      isAllDay: isAllDay,
      attendees: attendees,
      myStatus: myStatus,
      creator: (item.creator && item.creator.email) || '',
      isRecurring: !!item.recurringEventId
    });
  }
  
  Logger.log(`Filtered to ${filteredEvents.length} events (excluded ${allItems.length - filteredEvents.length})`);
  
  return filteredEvents;
}

/**
 * Process events into flat structure for sheet storage
 * Optimized: builds lookup maps once instead of per-event
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
    'No Response Count',
    'Account ID',
    'Account Name',
    'Meeting Recap ID'
  ];
  
  // Build lookup maps ONCE for all events (major performance optimization)
  const domainToAccountMap = buildDomainToAccountMap();
  const accountMap = buildAccountMap();
  
  Logger.log(`Processing ${events.length} events with ${domainToAccountMap.size} domain mappings`);
  
  const rows = events.map(event => {
    const duration = (event.endTime - event.startTime) / (1000 * 60 * 60);
    
    const attendeeEmails = event.attendees.map(a => a.email).join(', ');
    const attendeeNames = event.attendees.map(a => a.name || a.email).join(', ');
    const attendeeStatuses = event.attendees.map(a => a.status).join(', ');
    
    const acceptedCount = event.attendees.filter(a => a.status === 'YES').length;
    const declinedCount = event.attendees.filter(a => a.status === 'NO').length;
    const tentativeCount = event.attendees.filter(a => a.status === 'MAYBE').length;
    const noResponseCount = event.attendees.filter(a => a.status === 'INVITED' || a.status === 'AWAITING').length;
    
    // Find account by checking external attendee emails
    let accountId = '';
    let accountName = '';
    const externalAttendees = event.attendees.filter(a => a.email && !a.email.toLowerCase().includes('@observepoint.com'));
    
    // Check external attendees first (using cached lookup)
    for (const attendee of externalAttendees) {
      const accountInfo = findAccountByEmailCached(attendee.email, domainToAccountMap, accountMap);
      if (accountInfo) {
        accountId = accountInfo.accountId || '';
        accountName = accountInfo.accountName || '';
        break;
      }
    }
    
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
      noResponseCount,
      accountId || '',
      accountName || '',
      '' // Meeting Recap ID - populated by matcher
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
