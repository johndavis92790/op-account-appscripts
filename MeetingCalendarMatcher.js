/**
 * Meeting Recap to Calendar Event Matcher
 * 
 * Bidirectional matching between Meeting Recaps and Calendar Events
 * Updates both sheets with cross-references
 */

/**
 * Match meeting recaps to calendar events and update both sheets
 * This function reads both sheets, finds matches, and updates the mapping columns
 */
function matchMeetingRecapsToCalendarEvents() {
  const startTime = new Date();
  Logger.log('=== Starting Meeting Recap <-> Calendar Event Matching ===');
  
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    
    // Get both sheets
    const recapSheet = spreadsheet.getSheetByName('Webhook Meeting Recaps');
    const calendarSheet = spreadsheet.getSheetByName('Calendar Events');
    
    if (!recapSheet) {
      Logger.log('Meeting Recaps sheet not found - skipping matching');
      return { success: false, message: 'Meeting Recaps sheet not found' };
    }
    
    if (!calendarSheet) {
      Logger.log('Calendar Events sheet not found - skipping matching');
      return { success: false, message: 'Calendar Events sheet not found' };
    }
    
    // Read Meeting Recaps data
    const recapData = recapSheet.getDataRange().getValues();
    if (recapData.length <= 1) {
      Logger.log('No meeting recaps found');
      return { success: true, matches: 0, message: 'No meeting recaps to match' };
    }
    
    // Read Calendar Events data
    const calendarData = calendarSheet.getDataRange().getValues();
    if (calendarData.length <= 1) {
      Logger.log('No calendar events found');
      return { success: true, matches: 0, message: 'No calendar events to match' };
    }
    
    // Parse headers
    const recapHeaders = recapData[0];
    const calendarHeaders = calendarData[0];
    
    // Meeting Recap columns
    const recapIdIndex = recapHeaders.indexOf('Meeting Recap ID');
    const recapTitleIndex = recapHeaders.indexOf('Meeting Title');
    const recapStartIndex = recapHeaders.indexOf('Meeting Date');
    const recapEndIndex = recapHeaders.indexOf('Meeting End Time');
    const recapCalEventIdIndex = recapHeaders.indexOf('Calendar Event ID');
    
    // Calendar Event columns
    const eventIdIndex = calendarHeaders.indexOf('Event ID');
    const eventTitleIndex = calendarHeaders.indexOf('Title');
    const eventStartIndex = calendarHeaders.indexOf('Start Time');
    const eventEndIndex = calendarHeaders.indexOf('End Time');
    const eventRecapIdIndex = calendarHeaders.indexOf('Meeting Recap ID');
    
    // Validate required columns exist
    if (recapIdIndex === -1 || recapTitleIndex === -1 || recapStartIndex === -1 || recapEndIndex === -1) {
      Logger.log('Meeting Recaps sheet missing required columns');
      return { success: false, message: 'Meeting Recaps sheet missing required columns' };
    }
    
    if (eventIdIndex === -1 || eventTitleIndex === -1 || eventStartIndex === -1 || eventEndIndex === -1) {
      Logger.log('Calendar Events sheet missing required columns');
      return { success: false, message: 'Calendar Events sheet missing required columns' };
    }
    
    // Build lookup structures
    // Get Account ID column indices
    const recapAccountIdIndex = recapHeaders.indexOf('Account ID');
    const eventAccountIdIndex = calendarHeaders.indexOf('Account ID');
    
    const recaps = [];
    for (let i = 1; i < recapData.length; i++) {
      const row = recapData[i];
      recaps.push({
        rowIndex: i + 1, // 1-indexed for sheet
        recapId: row[recapIdIndex],
        title: row[recapTitleIndex],
        startTime: new Date(row[recapStartIndex]),
        endTime: new Date(row[recapEndIndex]),
        accountId: row[recapAccountIdIndex] || ''
      });
    }
    
    const events = [];
    for (let i = 1; i < calendarData.length; i++) {
      const row = calendarData[i];
      events.push({
        rowIndex: i + 1, // 1-indexed for sheet
        eventId: row[eventIdIndex],
        title: row[eventTitleIndex],
        startTime: new Date(row[eventStartIndex]),
        endTime: new Date(row[eventEndIndex]),
        accountId: row[eventAccountIdIndex] || ''
      });
    }
    
    Logger.log(`Matching ${recaps.length} recaps against ${events.length} calendar events`);
    
    // Build index: normalized title -> array of events (O(1) lookup instead of scanning all events)
    const eventsByTitle = new Map();
    for (const event of events) {
      const key = event.title.trim();
      if (!eventsByTitle.has(key)) eventsByTitle.set(key, []);
      eventsByTitle.get(key).push(event);
    }
    
    // Perform matching
    const matches = [];
    let noMatchCount = 0;
    
    for (const recap of recaps) {
      const recapDateStr = `${recap.startTime.getUTCFullYear()}-${String(recap.startTime.getUTCMonth() + 1).padStart(2, '0')}-${String(recap.startTime.getUTCDate()).padStart(2, '0')}`;
      
      // O(1) title lookup instead of scanning all events
      const titleMatches = eventsByTitle.get(recap.title.trim()) || [];
      
      // Filter by date and account (only iterates events with matching title)
      const candidates = [];
      for (const event of titleMatches) {
        const eventDateStr = `${event.startTime.getUTCFullYear()}-${String(event.startTime.getUTCMonth() + 1).padStart(2, '0')}-${String(event.startTime.getUTCDate()).padStart(2, '0')}`;
        if (eventDateStr !== recapDateStr) continue;
        
        // If both have Account IDs, they must match
        if (recap.accountId && event.accountId && recap.accountId !== event.accountId) continue;
        
        candidates.push(event);
      }
      
      if (candidates.length === 0) {
        Logger.log(`  ❌ No match for: "${recap.title}" on ${recapDateStr}`);
        noMatchCount++;
        continue;
      }
      
      // Find best match using START TIME proximity only
      let bestMatch = candidates[0];
      let smallestStartDiff = Math.abs(recap.startTime - candidates[0].startTime);
      
      for (let i = 1; i < candidates.length; i++) {
        const startDiff = Math.abs(recap.startTime - candidates[i].startTime);
        if (startDiff < smallestStartDiff) {
          smallestStartDiff = startDiff;
          bestMatch = candidates[i];
        }
      }
      
      matches.push({
        recapId: recap.recapId,
        recapRowIndex: recap.rowIndex,
        eventId: bestMatch.eventId,
        eventRowIndex: bestMatch.rowIndex,
        timeDiff: smallestStartDiff
      });
      
      const diffMinutes = Math.round(smallestStartDiff / 60000);
      const matchType = candidates.length > 1 ? `${candidates.length} candidates` : 'unique';
      Logger.log(`  ✓ "${recap.title}" on ${recapDateStr} (${matchType}, Δ${diffMinutes}min)`);
    }
    
    Logger.log(`Found ${matches.length} matches, ${noMatchCount} unmatched`);
    
    // Batch-write matches to both sheets (2 API calls instead of N individual ones)
    // setValues covers all rows - unmatched rows get empty strings, replacing any stale data
    if (matches.length > 0) {
      Logger.log(`Writing ${matches.length} matches to sheets...`);
      
      // Update Meeting Recaps sheet with Calendar Event IDs
      if (recapCalEventIdIndex !== -1) {
        const recapColValues = new Array(recapData.length - 1).fill(['']);
        for (const match of matches) {
          recapColValues[match.recapRowIndex - 2] = [match.eventId];
        }
        recapSheet.getRange(2, recapCalEventIdIndex + 1, recapColValues.length, 1).setValues(recapColValues);
      } else {
        Logger.log('  WARNING: Calendar Event ID column not found in Meeting Recaps sheet');
      }
      
      // Update Calendar Events sheet with Meeting Recap IDs
      if (eventRecapIdIndex !== -1) {
        const eventColValues = new Array(calendarData.length - 1).fill(['']);
        for (const match of matches) {
          eventColValues[match.eventRowIndex - 2] = [match.recapId];
        }
        calendarSheet.getRange(2, eventRecapIdIndex + 1, eventColValues.length, 1).setValues(eventColValues);
      } else {
        Logger.log('  WARNING: Meeting Recap ID column not found in Calendar Events sheet');
      }
    }
    
    const duration = (new Date() - startTime) / 1000;
    Logger.log(`=== Matching Complete in ${duration}s ===`);
    Logger.log(`Matched ${matches.length} meeting recaps to calendar events`);
    
    return {
      success: true,
      matches: matches.length,
      totalRecaps: recaps.length,
      totalEvents: events.length,
      duration: duration
    };
    
  } catch (error) {
    Logger.log('ERROR: ' + error.message);
    Logger.log(error.stack);
    throw error;
  }
}

/**
 * Manual function to run matching with UI feedback
 */
function matchMeetingRecapsToCalendarEventsManual() {
  try {
    const ui = SpreadsheetApp.getUi();
    
    const response = ui.alert(
      'Match Meeting Recaps to Calendar Events',
      'This will match meeting recaps to calendar events and update both sheets.\n\nContinue?',
      ui.ButtonSet.YES_NO
    );
    
    if (response !== ui.Button.YES) {
      return;
    }
    
    const result = matchMeetingRecapsToCalendarEvents();
    
    if (result.success) {
      ui.alert(
        'Matching Complete',
        `Matched ${result.matches} meeting recaps to calendar events.\n\n` +
        `Total Recaps: ${result.totalRecaps}\n` +
        `Total Events: ${result.totalEvents}\n` +
        `Duration: ${result.duration.toFixed(1)}s`,
        ui.ButtonSet.OK
      );
    } else {
      ui.alert(
        'Matching Failed',
        result.message,
        ui.ButtonSet.OK
      );
    }
    
  } catch (error) {
    Logger.log('Error in manual matching: ' + error.message);
    SpreadsheetApp.getUi().alert(
      'Matching Failed',
      'Error: ' + error.message,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}
