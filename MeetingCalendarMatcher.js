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
    
    // Perform matching
    const matches = [];
    
    for (const recap of recaps) {
      // Normalize to UTC date for comparison (ignores timezone differences)
      const recapDateStr = `${recap.startTime.getUTCFullYear()}-${String(recap.startTime.getUTCMonth() + 1).padStart(2, '0')}-${String(recap.startTime.getUTCDate()).padStart(2, '0')}`;
      
      Logger.log(`\nProcessing recap: "${recap.title}"`);
      Logger.log(`  Recap date: ${recapDateStr}, Account: ${recap.accountId}`);
      
      // Find all calendar events with EXACT title match, same day, and same Account ID
      const candidates = events.filter(event => {
        // Must have exact title match (trim whitespace to handle leading/trailing spaces)
        if (event.title.trim() !== recap.title.trim()) return false;
        
        // Must be on the same day (compare UTC dates to handle timezone differences)
        const eventDateStr = `${event.startTime.getUTCFullYear()}-${String(event.startTime.getUTCMonth() + 1).padStart(2, '0')}-${String(event.startTime.getUTCDate()).padStart(2, '0')}`;
        if (eventDateStr !== recapDateStr) {
          Logger.log(`  Skipping event "${event.title}" - date mismatch: ${eventDateStr} vs ${recapDateStr}`);
          return false;
        }
        
        // If both have Account IDs, they must match
        // This prevents matching meetings with same title but different accounts
        if (recap.accountId && event.accountId) {
          if (recap.accountId !== event.accountId) {
            Logger.log(`  Skipping event "${event.title}" - account mismatch: ${event.accountId} vs ${recap.accountId}`);
            return false;
          }
        }
        
        Logger.log(`  Found candidate: "${event.title}" at ${event.startTime.toISOString()}`);
        return true;
      });
      
      if (candidates.length === 0) {
        Logger.log(`  ❌ No match for: "${recap.title}" on ${recapDateStr}`);
        continue;
      }
      
      // Find best match using START TIME proximity only (not duration)
      let bestMatch = null;
      let smallestStartDiff = Infinity;
      
      for (const event of candidates) {
        // Only compare start times - duration doesn't matter
        const startDiff = Math.abs(recap.startTime - event.startTime);
        
        if (startDiff < smallestStartDiff) {
          smallestStartDiff = startDiff;
          bestMatch = event;
        }
      }
      
      if (bestMatch) {
        matches.push({
          recapId: recap.recapId,
          recapRowIndex: recap.rowIndex,
          eventId: bestMatch.eventId,
          eventRowIndex: bestMatch.rowIndex,
          timeDiff: smallestStartDiff
        });
        
        const diffMinutes = Math.round(smallestStartDiff / 60000);
        const matchType = candidates.length > 1 ? `${candidates.length} candidates` : 'unique';
        Logger.log(`  ✓ Matched "${recap.title}" (${matchType}, start time diff: ${diffMinutes} min)`);
      }
    }
    
    Logger.log(`Found ${matches.length} matches`);
    
    // Clear existing mappings in both sheets
    if (recapCalEventIdIndex !== -1) {
      Logger.log('Clearing existing Calendar Event IDs in Meeting Recaps...');
      if (recapData.length > 1) {
        recapSheet.getRange(2, recapCalEventIdIndex + 1, recapData.length - 1, 1).clearContent();
      }
    }
    
    if (eventRecapIdIndex !== -1) {
      Logger.log('Clearing existing Meeting Recap IDs in Calendar Events...');
      if (calendarData.length > 1) {
        calendarSheet.getRange(2, eventRecapIdIndex + 1, calendarData.length - 1, 1).clearContent();
      }
    }
    
    // Update both sheets with matches
    if (matches.length > 0) {
      Logger.log('Writing matches to sheets...');
      
      // Update Meeting Recaps sheet with Calendar Event IDs
      if (recapCalEventIdIndex !== -1) {
        for (const match of matches) {
          Logger.log(`  Writing to Meeting Recaps row ${match.recapRowIndex}, col ${recapCalEventIdIndex + 1}: ${match.eventId}`);
          recapSheet.getRange(match.recapRowIndex, recapCalEventIdIndex + 1).setValue(match.eventId);
        }
      } else {
        Logger.log('  WARNING: Calendar Event ID column not found in Meeting Recaps sheet');
      }
      
      // Update Calendar Events sheet with Meeting Recap IDs
      if (eventRecapIdIndex !== -1) {
        for (const match of matches) {
          Logger.log(`  Writing to Calendar Events row ${match.eventRowIndex}, col ${eventRecapIdIndex + 1}: ${match.recapId}`);
          calendarSheet.getRange(match.eventRowIndex, eventRecapIdIndex + 1).setValue(match.recapId);
        }
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
