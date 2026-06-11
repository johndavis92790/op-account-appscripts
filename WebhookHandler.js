/**
 * Webhook Handler for Google Apps Script
 * 
 * Receives webhooks from external services and routes them based on URL parameters.
 * Deploy as web app: Publish > Deploy as web app
 * - Execute as: Me
 * - Who has access: Anyone (for webhooks)
 * 
 * URL format: https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec?type=meeting_recap
 */

const WEBHOOK_MEETING_RECAPS_SHEET = 'Webhook Meeting Recaps';
const MEETING_ACTION_ITEMS_SHEET = 'Meeting Action Items';
const OTHERS_ACTION_ITEMS_SHEET = 'Others Action Items';
const ACCOUNT_CONTACTS_SHEET = 'Account Contacts';
const WEBHOOK_LOGS_SHEET = 'Webhook Logs';

/**
 * Handle POST requests (webhooks)
 * @param {Object} e - Event object from Google Apps Script
 * @returns {TextOutput} JSON response
 */
function doPost(e) {
  const startTime = new Date();
  const logEntries = [];
  
  const log = (msg) => {
    Logger.log(msg);
    logEntries.push(msg);
  };
  
  try {
    // Parse URL parameters
    const params = e.parameter || {};
    const webhookType = params.type || '';
    
    log(`=== Webhook Received: type=${webhookType} ===`);
    log(`Raw body length: ${(e.postData && e.postData.contents) ? e.postData.contents.length : 0} chars`);
    
    // Parse JSON body
    let payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (parseError) {
      log('ERROR: Failed to parse JSON body: ' + parseError.message);
      logToSheet(webhookType, 'ERROR', 'Parse failed: ' + parseError.message, logEntries);
      return createJsonResponse({
        success: false,
        error: 'Invalid JSON payload',
        message: parseError.message
      }, 400);
    }
    
    log(`Payload keys: ${Object.keys(payload).join(', ')}`);
    if (payload.meetingInfo) log(`Meeting title: ${payload.meetingInfo.title}`);
    if (payload.externalAttendees) log(`externalAttendees count: ${payload.externalAttendees.length}`);
    if (payload.internalAttendees) log(`internalAttendees count: ${payload.internalAttendees.length}`);
    if (payload.title) log(`Task title: ${payload.title}`);
    
    // Route based on webhook type
    let result;
    switch (webhookType) {
      case 'meeting_recap':
        result = processMeetingRecapWebhook(payload, log);
        break;
      
      case 'create_task':
        result = processCreateTaskWebhook(payload);
        log(`Task result: ${JSON.stringify(result)}`);
        break;
      
      case 'close_task':
        result = processCloseTaskWebhook(payload);
        log(`Close task result: ${JSON.stringify(result)}`);
        break;
      
      default:
        log(`ERROR: Unknown webhook type: ${webhookType}`);
        logToSheet(webhookType, 'ERROR', 'Unknown type', logEntries);
        return createJsonResponse({
          success: false,
          error: 'Unknown webhook type',
          message: `Type '${webhookType}' is not supported. Use ?type=meeting_recap`
        }, 400);
    }
    
    const duration = (new Date() - startTime) / 1000;
    log(`=== Webhook Complete in ${duration}s ===`);
    
    logToSheet(webhookType, result.action || 'success', JSON.stringify(result).substring(0, 500), logEntries);
    
    return createJsonResponse({
      success: true,
      ...result,
      duration: duration
    });
    
  } catch (error) {
    const msg = 'ERROR in doPost: ' + error.message;
    log(msg);
    log(error.stack || '');
    logToSheet('unknown', 'FATAL_ERROR', error.message, logEntries);
    
    return createJsonResponse({
      success: false,
      error: 'Internal server error',
      message: error.message
    }, 500);
  }
}

/**
 * Handle GET requests (for testing/health check)
 */
function doGet(e) {
  const params = e.parameter || {};
  
  return createJsonResponse({
    status: 'ok',
    message: 'Webhook endpoint is running',
    supportedTypes: ['meeting_recap'],
    usage: 'POST to this URL with ?type=meeting_recap and JSON body'
  });
}

/**
 * Create a JSON response
 */
function createJsonResponse(data, statusCode) {
  const output = ContentService.createTextOutput(JSON.stringify(data, null, 2));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

/**
 * Write webhook execution log to a dedicated sheet for debugging
 */
function logToSheet(webhookType, status, resultSummary, logEntries) {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = spreadsheet.getSheetByName(WEBHOOK_LOGS_SHEET);
    
    if (!sheet) {
      sheet = spreadsheet.insertSheet(WEBHOOK_LOGS_SHEET);
      const headers = ['Timestamp', 'Type', 'Status', 'Result Summary', 'Full Log'];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length)
        .setFontWeight('bold')
        .setBackground('#6366f1')
        .setFontColor('#ffffff');
      sheet.setFrozenRows(1);
      sheet.setColumnWidth(4, 400);
      sheet.setColumnWidth(5, 600);
    }
    
    const fullLog = (logEntries || []).join('\n');
    const row = [
      new Date(),
      webhookType || '',
      status || '',
      (resultSummary || '').substring(0, 1000),
      fullLog.substring(0, 5000)
    ];
    
    sheet.insertRowAfter(1);
    sheet.getRange(2, 1, 1, row.length).setValues([row]);
    sheet.getRange(2, 1).setNumberFormat('yyyy-mm-dd hh:mm:ss');
    sheet.getRange(2, 5).setWrap(true);
    
  } catch (logError) {
    Logger.log('WARNING: Failed to write to webhook log sheet: ' + logError.message);
  }
}

/**
 * Process a meeting recap webhook from AskElephant
 * @param {Object} payload - The meeting recap JSON data
 * @returns {Object} Processing result
 */
function processMeetingRecapWebhook(payload, log) {
  if (!log) log = Logger.log.bind(Logger);
  
  log('Processing meeting recap webhook...');
  
  // Validate payload structure
  if (!payload.meetingInfo) {
    throw new Error('Invalid payload: missing meetingInfo object');
  }
  
  // Extract meeting recap ID from meetingLink
  const meetingRecapId = extractMeetingRecapId(payload.meetingInfo.meetingLink);
  if (!meetingRecapId) {
    throw new Error('Could not extract meeting recap ID from meetingLink');
  }
  
  log(`Meeting Recap ID: ${meetingRecapId}`);
  log(`Meeting Title: ${payload.meetingInfo.title}`);
  
  // Always process contacts and attendee details, even on duplicate recaps
  // We need to flatten first to get account mapping for contacts
  const recap = flattenWebhookMeetingRecap(payload, meetingRecapId);
  log(`Account mapping: ${recap.accountName} (${recap.accountId})`);
  
  // Process external contacts (always runs, upserts by email)
  log('Processing external contacts...');
  let contactsResult = { updated: 0, created: 0 };
  try {
    contactsResult = processExternalContacts(payload, recap);
    log(`Contacts: ${contactsResult.created} created, ${contactsResult.updated} updated`);
  } catch (contactsError) {
    log('WARNING: Contacts processing failed: ' + contactsError.message);
  }
  
  // Check for duplicate meeting recap — skip the rest if duplicate
  const isDuplicate = isMeetingRecapDuplicate(meetingRecapId);
  if (isDuplicate) {
    // Still store attendee details on duplicate recaps (row already exists)
    log('Storing attendee details on existing recap row...');
    try {
      storeAttendeeDetailsOnRecap(meetingRecapId, payload);
      log('Attendee details stored successfully');
    } catch (attendeeError) {
      log('WARNING: Attendee details storage failed: ' + attendeeError.message);
    }
    log(`⏭️ Duplicate meeting recap — skipping recap/action items/GitHub steps`);
    return {
      action: 'skipped_duplicate',
      reason: 'duplicate',
      meetingRecapId: meetingRecapId,
      contactsCreated: contactsResult.created,
      contactsUpdated: contactsResult.updated
    };
  }
  
  // Step 1: Write the meeting recap to sheet
  log('Step 1: Writing meeting recap to sheet...');
  writeMeetingRecapToSheet(recap);
  
  // Step 1.5: Store attendee details on the recap row (AFTER row is written)
  log('Storing attendee details on recap row...');
  try {
    storeAttendeeDetailsOnRecap(meetingRecapId, payload);
    log('Attendee details stored successfully');
  } catch (attendeeError) {
    log('WARNING: Attendee details storage failed: ' + attendeeError.message);
  }
  
  // Step 2: Store action items in separate tables
  log('Step 2: Writing action items...');
  const myActionItemsResult = writeMyActionItemsToSheet(
    payload.actionItems?.myItems || [],
    meetingRecapId,
    recap
  );
  log(`  My action items: ${myActionItemsResult.count}`);
  
  const othersActionItemsResult = writeOthersActionItemsToSheet(
    payload.actionItems?.othersItems || [],
    meetingRecapId
  );
  log(`  Others action items: ${othersActionItemsResult.count}`);
  
  // Step 3: Match to calendar events
  log('Step 3: Matching to calendar events...');
  try {
    matchMeetingRecapsToCalendarEvents();
    log('  Calendar matching complete');
  } catch (matchError) {
    log('WARNING: Calendar matching failed: ' + matchError.message);
  }
  
  // Step 4: (deprecated) GitHub task import — kept off after Phase 3 cutover.
  // The legacy `importGitHubTasks()` populated a separate sheet used for
  // duplicate detection against GitHub Project items. The new system writes
  // straight to Firestore and tracks idempotency via the "Firestore Task ID"
  // column on Meeting Action Items, so this step is no longer needed.
  // (Kept as a comment so the call graph is documented; deleted in Phase 6.)

  // Step 5: Create Firestore tasks from my action items (HARD CUTOVER — Phase 3)
  log('Step 5: Creating Firestore tasks from action items...');
  let taskResult = { created: 0, skipped: 0, errors: 0 };
  try {
    taskResult = createFirestoreTasksFromActionItems(meetingRecapId, recap);
    log(`  Firestore tasks: ${taskResult.created} created, ${taskResult.skipped} skipped, ${taskResult.errors} errors`);
  } catch (taskError) {
    log('WARNING: Firestore task creation failed: ' + taskError.message);
  }
  
  // Step 6: Handle follow-up email draft
  let followUpEmailResult = { drafted: false };
  if (payload.followUpEmail) {
    log('Step 6: Processing follow-up email...');
    try {
      followUpEmailResult = processFollowUpEmail(payload.followUpEmail, meetingRecapId, log);
      log(`  Follow-up email draft: ${followUpEmailResult.drafted ? 'created' : 'skipped'}`);
    } catch (emailError) {
      log('WARNING: Follow-up email processing failed: ' + emailError.message);
    }
  }
  
  return {
    action: 'created',
    meetingRecapId: meetingRecapId,
    meetingTitle: recap.meetingTitle,
    myActionItems: myActionItemsResult.count,
    othersActionItems: othersActionItemsResult.count,
    firestoreTasksCreated: taskResult.created,
    firestoreTasksSkipped: taskResult.skipped,
    firestoreTasksErrors: taskResult.errors,
    contactsCreated: contactsResult.created,
    contactsUpdated: contactsResult.updated,
    followUpEmailDrafted: followUpEmailResult.drafted
  };
}

/**
 * Extract meeting recap ID from the meetingLink URL
 * e.g., "https://app.askelephant.ai/.../engagements/ngmt_01KFXKBAV0R7S2VBVK3QSBHMR3"
 * returns "ngmt_01KFXKBAV0R7S2VBVK3QSBHMR3"
 */
function extractMeetingRecapId(meetingLink) {
  if (!meetingLink || typeof meetingLink !== 'string') {
    return null;
  }
  
  // Extract the last path segment after /engagements/
  const match = meetingLink.match(/\/engagements\/([^\/\?#]+)/);
  if (match) {
    return match[1];
  }
  
  // Fallback: get last path segment
  const parts = meetingLink.split('/').filter(p => p);
  if (parts.length > 0) {
    return parts[parts.length - 1];
  }
  
  return null;
}

/**
 * Check if a meeting recap already exists in the sheet
 */
function isMeetingRecapDuplicate(meetingRecapId) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(WEBHOOK_MEETING_RECAPS_SHEET);
  
  if (!sheet || sheet.getLastRow() < 2) {
    return false;
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIndex = headers.indexOf('Meeting Recap ID');
  
  if (idIndex === -1) {
    return false;
  }
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][idIndex] === meetingRecapId) {
      return true;
    }
  }
  
  return false;
}

/**
 * Flatten webhook meeting recap JSON into a row structure
 */
function flattenWebhookMeetingRecap(payload, meetingRecapId) {
  const meetingInfo = payload.meetingInfo || {};
  const companyInfo = payload.companyInfo || {};
  const attendees = payload.attendees || {};
  const actionItems = payload.actionItems || {};
  
  // Extract attendee emails
  const actualAttendees = attendees.actual || [];
  const invitedAttendees = attendees.invited || [];
  const allNames = attendees.allNames || [];
  
  // Find account by checking attendee domains (excluding observepoint.com)
  // Check BOTH actual and invited attendees for more robust matching
  const allAttendees = [...new Set([...actualAttendees, ...invitedAttendees])]; // Deduplicate
  const externalEmails = allAttendees.filter(email => 
    email && !email.toLowerCase().includes('observepoint.com')
  );
  
  let accountInfo = null;
  let mappedDomain = '';
  
  // Try to map to account using any external email
  if (externalEmails.length > 0) {
    const domainToAccountMap = buildDomainToAccountMap();
    const accountMap = buildAccountMap();
    
    Logger.log(`Checking ${externalEmails.length} external emails for account match...`);
    
    for (const email of externalEmails) {
      accountInfo = findAccountByEmailCached(email, domainToAccountMap, accountMap);
      if (accountInfo) {
        mappedDomain = getEmailDomainForAccount(email);
        Logger.log(`✓ Matched to account: ${accountInfo.accountName} (${accountInfo.accountId}) via ${email}`);
        break;
      }
    }
    
    if (!accountInfo) {
      Logger.log(`⚠️ No account match found for external emails: ${externalEmails.join(', ')}`);
      // Log the domains we tried for debugging
      for (const email of externalEmails) {
        const domain = getEmailDomainForAccount(email);
        if (domain) {
          Logger.log(`  - Tried domain: ${domain}`);
        }
      }
    }
  } else {
    Logger.log('⚠️ No external attendees found (all are observepoint.com)');
  }
  
  // Count action items
  const myActionItemsCount = (actionItems.myItems || []).length;
  const othersActionItemsCount = (actionItems.othersItems || []).length;
  const totalActionItemsCount = myActionItemsCount + othersActionItemsCount;
  
  // Calculate duration
  let duration = '';
  if (meetingInfo.startTime && meetingInfo.endTime) {
    try {
      const start = new Date(meetingInfo.startTime);
      const end = new Date(meetingInfo.endTime);
      const minutes = Math.round((end - start) / 60000);
      duration = `${minutes} minutes`;
    } catch (e) {
      duration = '';
    }
  }
  
  return {
    // Unique identifier (parsed from meetingLink)
    meetingRecapId: meetingRecapId,
    
    // Received timestamp
    receivedDate: new Date(),
    
    // Meeting info
    meetingTitle: meetingInfo.title || '',
    meetingCompany: companyInfo.companyName || '',
    meetingDate: meetingInfo.startTime || '',
    meetingEndTime: meetingInfo.endTime || '',
    meetingDuration: duration,
    meetingLink: meetingInfo.meetingLink || '',
    zoomLink: meetingInfo.meetingUrl || '',
    
    // Slack messages (stored as JSON string)
    slackMessages: JSON.stringify(companyInfo.slackMessages || null),
    
    // Summary (full, not truncated)
    summary: payload.summary || '',
    
    // Attendees
    actualAttendees: actualAttendees.join(', '),
    invitedAttendees: invitedAttendees.join(', '),
    allNames: allNames.join(', '),
    externalAttendees: externalEmails.join(', '),
    
    // Action items summary
    myActionItemsCount: myActionItemsCount,
    othersActionItemsCount: othersActionItemsCount,
    totalActionItemsCount: totalActionItemsCount,
    
    // Account mapping
    accountId: accountInfo ? accountInfo.accountId : '',
    accountName: accountInfo ? accountInfo.accountName : '',
    opportunityId: accountInfo ? accountInfo.opportunityId : '',
    opportunityName: accountInfo ? accountInfo.opportunityName : '',
    mappedDomain: mappedDomain
  };
}

/**
 * Write meeting recap to the Webhook Meeting Recaps sheet
 */
function writeMeetingRecapToSheet(recap) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(WEBHOOK_MEETING_RECAPS_SHEET);
  
  // Create sheet if it doesn't exist
  if (!sheet) {
    sheet = spreadsheet.insertSheet(WEBHOOK_MEETING_RECAPS_SHEET);
    Logger.log(`Created new ${WEBHOOK_MEETING_RECAPS_SHEET} sheet`);
  }
  
  // Define headers
  const headers = [
    'Meeting Recap ID',
    'Received Date',
    'Meeting Title',
    'Meeting Company',
    'Meeting Date',
    'Meeting End Time',
    'Duration',
    'Summary',
    'Actual Attendees',
    'Invited Attendees',
    'All Names',
    'External Attendees',
    'My Action Items Count',
    'Others Action Items Count',
    'Total Action Items',
    'Account ID',
    'Account Name',
    'Opportunity ID',
    'Opportunity Name',
    'Mapped Domain',
    'Calendar Event ID',
    'Meeting Link',
    'Zoom Link',
    'Slack Messages'
  ];
  
  // Check if headers exist
  let hasHeaders = false;
  if (sheet.getLastRow() > 0) {
    const firstCell = sheet.getRange(1, 1).getValue();
    hasHeaders = (firstCell === 'Meeting Recap ID');
  }
  
  if (!hasHeaders) {
    sheet.clear();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // Format headers
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#1a73e8')
      .setFontColor('#ffffff');
    
    sheet.setFrozenRows(1);
  }
  
  // Create row data
  const row = [
    recap.meetingRecapId,
    recap.receivedDate,
    recap.meetingTitle,
    recap.meetingCompany,
    recap.meetingDate,
    recap.meetingEndTime,
    recap.meetingDuration,
    recap.summary,
    recap.actualAttendees,
    recap.invitedAttendees,
    recap.allNames,
    recap.externalAttendees,
    recap.myActionItemsCount,
    recap.othersActionItemsCount,
    recap.totalActionItemsCount,
    recap.accountId,
    recap.accountName,
    recap.opportunityId,
    recap.opportunityName,
    recap.mappedDomain,
    '', // Calendar Event ID - populated by matcher
    recap.meetingLink,
    recap.zoomLink,
    recap.slackMessages
  ];
  
  // Append row
  const nextRow = sheet.getLastRow() + 1;
  sheet.getRange(nextRow, 1, 1, row.length).setValues([row]);
  
  // Format the new row
  formatWebhookRecapRow(sheet, nextRow, headers);
  
  Logger.log(`Wrote meeting recap to row ${nextRow}: ${recap.meetingTitle}`);
  
  return true;
}

/**
 * Format a single row in the webhook recap sheet
 */
function formatWebhookRecapRow(sheet, rowNum, headers) {
  // Format date columns
  const receivedDateIndex = headers.indexOf('Received Date') + 1;
  const meetingDateIndex = headers.indexOf('Meeting Date') + 1;
  
  if (receivedDateIndex > 0) {
    sheet.getRange(rowNum, receivedDateIndex).setNumberFormat('yyyy-mm-dd hh:mm');
  }
  
  if (meetingDateIndex > 0) {
    sheet.getRange(rowNum, meetingDateIndex).setNumberFormat('yyyy-mm-dd hh:mm');
  }
  
  // Add hyperlink to meeting link
  const meetingLinkIndex = headers.indexOf('Meeting Link') + 1;
  if (meetingLinkIndex > 0) {
    const link = sheet.getRange(rowNum, meetingLinkIndex).getValue();
    if (link && typeof link === 'string' && link.startsWith('http')) {
      sheet.getRange(rowNum, meetingLinkIndex).setFormula(`=HYPERLINK("${link}", "View Meeting")`);
    }
  }
  
  // Add hyperlink to zoom link
  const zoomLinkIndex = headers.indexOf('Zoom Link') + 1;
  if (zoomLinkIndex > 0) {
    const link = sheet.getRange(rowNum, zoomLinkIndex).getValue();
    if (link && typeof link === 'string' && link.startsWith('http')) {
      sheet.getRange(rowNum, zoomLinkIndex).setFormula(`=HYPERLINK("${link}", "Join Zoom")`);
    }
  }
  
  // Wrap text in summary column
  const summaryIndex = headers.indexOf('Summary') + 1;
  if (summaryIndex > 0) {
    sheet.getRange(rowNum, summaryIndex).setWrap(true);
  }
}

/**
 * Write my action items to the Meeting Action Items sheet
 */
function writeMyActionItemsToSheet(actionItems, meetingRecapId, recap) {
  if (!actionItems || actionItems.length === 0) {
    Logger.log('No action items to write');
    return { count: 0 };
  }
  
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(MEETING_ACTION_ITEMS_SHEET);
  
  // Create sheet if it doesn't exist
  if (!sheet) {
    sheet = spreadsheet.insertSheet(MEETING_ACTION_ITEMS_SHEET);
    Logger.log(`Created new ${MEETING_ACTION_ITEMS_SHEET} sheet`);
  }
  
  // Define headers
  const headers = [
    'Meeting Recap ID',
    'Action Item Index',
    'Title',
    'Description',
    'Priority',
    'GitHub Issue ID',
    'GitHub Issue Number',
    'Meeting Title',
    'Account ID',
    'Account Name',
    'Created Date'
  ];
  
  // Check if headers exist
  let hasHeaders = false;
  if (sheet.getLastRow() > 0) {
    const firstCell = sheet.getRange(1, 1).getValue();
    hasHeaders = (firstCell === 'Meeting Recap ID');
  }
  
  if (!hasHeaders) {
    sheet.clear();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // Format headers
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#34a853')
      .setFontColor('#ffffff');
    
    sheet.setFrozenRows(1);
  } else {
    // Ensure Account ID column exists (backfill header for existing sheets)
    const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (existingHeaders.indexOf('Account ID') === -1) {
      const accountNameColIdx = existingHeaders.indexOf('Account Name');
      if (accountNameColIdx !== -1) {
        sheet.insertColumnBefore(accountNameColIdx + 1);
        sheet.getRange(1, accountNameColIdx + 1).setValue('Account ID');
        sheet.getRange(1, accountNameColIdx + 1)
          .setFontWeight('bold')
          .setBackground('#34a853')
          .setFontColor('#ffffff');
        Logger.log('Added Account ID column to Meeting Action Items sheet');
      }
    }
  }

  // Build rows by looking up the live column positions on the sheet — never
  // assume the in-code `headers` order matches the physical sheet order. The
  // sheet has had columns inserted/swapped historically (e.g. by
  // backfillActionItemAccountIds) and writing positionally caused
  // accountId/accountName to be transposed for months.
  const liveHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const colCount = liveHeaders.length;
  const colByName = {};
  for (let h = 0; h < liveHeaders.length; h++) {
    colByName[String(liveHeaders[h])] = h; // 0-based
  }

  // Helper: given a row-array of length colCount, set the cell for `name`.
  function setCell(rowArr, name, value) {
    const c = colByName[name];
    if (c !== undefined && c < colCount) rowArr[c] = value;
  }

  const now = new Date();
  const rows = actionItems.map((item, index) => {
    const r = new Array(colCount).fill('');
    setCell(r, 'Meeting Recap ID', meetingRecapId);
    setCell(r, 'Action Item Index', index);
    setCell(r, 'Title', item.actionItemTitle || '');
    setCell(r, 'Description', item.actionItemDescription || '');
    setCell(r, 'Priority', item.priority || '');
    setCell(r, 'GitHub Issue ID', '');
    setCell(r, 'GitHub Issue Number', '');
    setCell(r, 'Meeting Title', (recap && recap.meetingTitle) || '');
    setCell(r, 'Account ID', (recap && recap.accountId) || '');
    setCell(r, 'Account Name', (recap && recap.accountName) || '');
    setCell(r, 'Created Date', now);
    // Note: 'Firestore Task ID' (if present) is intentionally left blank;
    // TaskFromRecap.js fills it in after the doc is written.
    return r;
  });

  // Append rows
  const nextRow = sheet.getLastRow() + 1;
  sheet.getRange(nextRow, 1, rows.length, colCount).setValues(rows);

  // Format description column to wrap text
  const descColZero = colByName['Description'];
  if (descColZero !== undefined) {
    sheet.getRange(nextRow, descColZero + 1, rows.length, 1).setWrap(true);
  }

  Logger.log(`Wrote ${rows.length} action items to ${MEETING_ACTION_ITEMS_SHEET}`);

  return { count: rows.length };
}

/**
 * Write others' action items to the Others Action Items sheet
 */
function writeOthersActionItemsToSheet(actionItems, meetingRecapId) {
  if (!actionItems || actionItems.length === 0) {
    Logger.log('No others action items to write');
    return { count: 0 };
  }
  
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(OTHERS_ACTION_ITEMS_SHEET);
  
  // Create sheet if it doesn't exist
  if (!sheet) {
    sheet = spreadsheet.insertSheet(OTHERS_ACTION_ITEMS_SHEET);
    Logger.log(`Created new ${OTHERS_ACTION_ITEMS_SHEET} sheet`);
  }
  
  // Define headers
  const headers = [
    'Meeting Recap ID',
    'Action Item Index',
    'Title',
    'Description',
    'Assignee',
    'Created Date'
  ];
  
  // Check if headers exist
  let hasHeaders = false;
  if (sheet.getLastRow() > 0) {
    const firstCell = sheet.getRange(1, 1).getValue();
    hasHeaders = (firstCell === 'Meeting Recap ID');
  }
  
  if (!hasHeaders) {
    sheet.clear();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // Format headers
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#fbbc04')
      .setFontColor('#000000');
    
    sheet.setFrozenRows(1);
  }
  
  // Create rows for each action item
  // Extract assignee from description if present
  const rows = actionItems.map((item, index) => {
    let assignee = '';
    const desc = item.actionItemDescription || '';
    const assigneeMatch = desc.match(/Assignee:\s*([^\n]+)/);
    if (assigneeMatch) {
      assignee = assigneeMatch[1].trim();
    }
    
    return [
      meetingRecapId,
      index,
      item.actionItemTitle || '',
      desc,
      assignee,
      new Date()
    ];
  });
  
  // Append rows
  const nextRow = sheet.getLastRow() + 1;
  sheet.getRange(nextRow, 1, rows.length, headers.length).setValues(rows);
  
  // Format description column to wrap text
  const descIndex = headers.indexOf('Description') + 1;
  if (descIndex > 0) {
    sheet.getRange(nextRow, descIndex, rows.length, 1).setWrap(true);
  }
  
  Logger.log(`Wrote ${rows.length} others action items to ${OTHERS_ACTION_ITEMS_SHEET}`);
  
  return { count: rows.length };
}

/**
 * Create GitHub issues from action items in the Meeting Action Items sheet
 * and update the sheet with the issue IDs
 */
function createGitHubIssuesFromActionItems(meetingRecapId, recap) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(MEETING_ACTION_ITEMS_SHEET);
  
  if (!sheet || sheet.getLastRow() < 2) {
    Logger.log('No action items to process for GitHub issues');
    return { created: 0, skipped: 0, errors: 0 };
  }
  
  try {
    const config = validateGitHubConfig();
    
    // Ensure the auto-generated label exists
    ensureAutoGeneratedLabel(config.githubToken);
    
    // Get project field IDs (status, priority)
    const projectInfo = getProjectFieldInfo(config);
    if (!projectInfo) {
      Logger.log('ERROR: Could not retrieve project field info');
      return { created: 0, skipped: 0, errors: 0 };
    }
    
    // Get all action items for this meeting recap
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    const idIndex = headers.indexOf('Meeting Recap ID');
    const indexCol = headers.indexOf('Action Item Index');
    const titleIndex = headers.indexOf('Title');
    const descIndex = headers.indexOf('Description');
    const priorityIndex = headers.indexOf('Priority');
    const githubIdIndex = headers.indexOf('GitHub Issue ID');
    const githubNumIndex = headers.indexOf('GitHub Issue Number');
    
    let created = 0;
    let skipped = 0;
    let errors = 0;
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      // Only process action items for this meeting recap
      if (row[idIndex] !== meetingRecapId) {
        continue;
      }
      
      // Skip if already has a GitHub Issue ID
      if (row[githubIdIndex] && row[githubIdIndex].toString().trim()) {
        Logger.log(`  ⏭️ Skipping action item ${row[indexCol]}: already has GitHub Issue ID`);
        skipped++;
        continue;
      }
      
      const actionItem = {
        actionItemTitle: row[titleIndex],
        actionItemDescription: row[descIndex],
        priority: row[priorityIndex]
      };
      
      try {
        const issueResult = createIssueFromActionItemWebhook(actionItem, recap, config, projectInfo);
        
        if (issueResult.created) {
          created++;
          
          // Update the sheet with the GitHub Issue ID and Number
          const rowNum = i + 1;
          sheet.getRange(rowNum, githubIdIndex + 1).setValue(issueResult.issueNodeId);
          sheet.getRange(rowNum, githubNumIndex + 1).setValue(issueResult.issueNumber);
          
          Logger.log(`  ✓ Created issue #${issueResult.issueNumber}: ${actionItem.actionItemTitle}`);
        } else {
          skipped++;
        }
      } catch (error) {
        errors++;
        Logger.log(`  ❌ Error creating issue for "${actionItem.actionItemTitle}": ${error.message}`);
      }
      
      // Rate limiting
      Utilities.sleep(200);
    }
    
    Logger.log(`GitHub issue creation: ${created} created, ${skipped} skipped, ${errors} errors`);
    
    return { created, skipped, errors };
    
  } catch (error) {
    Logger.log('ERROR in createGitHubIssuesFromActionItems: ' + error.message);
    return { created: 0, skipped: 0, errors: 1 };
  }
}

/**
 * Create a single GitHub issue from an action item (webhook version)
 * Uses full summary instead of truncated
 */
function createIssueFromActionItemWebhook(actionItem, recap, config, projectInfo) {
  const title = actionItem.actionItemTitle;
  const priority = actionItem.priority || '';
  
  // Build issue body with full meeting context
  const body = buildIssueBodyWebhook(actionItem, recap);
  
  // Build labels array
  const labels = ['auto-generated'];
  if (recap.accountName) {
    labels.push(ACCOUNT_LABEL_PREFIX + recap.accountName);
  }
  
  // Step 1: Create the issue via REST API
  const issueData = createGitHubIssue(
    config.githubToken,
    GITHUB_ISSUE_REPO_OWNER,
    GITHUB_ISSUE_REPO_NAME,
    title,
    body,
    labels
  );
  
  if (!issueData) {
    return { created: false, skipped: false };
  }
  
  const issueNodeId = issueData.node_id;
  const issueNumber = issueData.number;
  
  // Step 2: Add issue to project
  const projectItemId = addIssueToProject(config.githubToken, projectInfo.projectId, issueNodeId);
  
  if (!projectItemId) {
    Logger.log(`  ⚠️ Issue #${issueNumber} created but failed to add to project`);
    return { created: true, issueNodeId: issueNodeId, issueNumber: issueNumber };
  }
  
  // Step 3: Set status to "Generated"
  if (projectInfo.statusFieldId && projectInfo.generatedOptionId) {
    setProjectItemField(
      config.githubToken,
      projectInfo.projectId,
      projectItemId,
      projectInfo.statusFieldId,
      projectInfo.generatedOptionId
    );
  }
  
  // Step 4: Set priority if available
  if (priority && projectInfo.priorityFieldId && projectInfo.priorityOptions) {
    const priorityOptionId = projectInfo.priorityOptions[priority];
    if (priorityOptionId) {
      setProjectItemField(
        config.githubToken,
        projectInfo.projectId,
        projectItemId,
        projectInfo.priorityFieldId,
        priorityOptionId
      );
    }
  }
  
  return { created: true, issueNodeId: issueNodeId, issueNumber: issueNumber };
}

/**
 * Build the issue body with FULL summary (webhook version)
 */
function buildIssueBodyWebhook(actionItem, recap) {
  const description = actionItem.actionItemDescription || '';
  
  // Format meeting date nicely
  let meetingDateStr = '';
  if (recap.meetingDate) {
    try {
      const meetingDate = new Date(recap.meetingDate);
      meetingDateStr = meetingDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (e) {
      meetingDateStr = recap.meetingDate;
    }
  }
  
  let body = description;
  
  // Add meeting context section
  body += '\n\n---\n\n';
  body += '## Meeting Context\n\n';
  body += `**Meeting:** ${recap.meetingTitle || 'Unknown'}\n`;
  if (meetingDateStr) {
    body += `**Date:** ${meetingDateStr}\n`;
  }
  if (recap.accountName) {
    body += `**Account:** ${recap.accountName}\n`;
  }
  if (recap.externalAttendees) {
    body += `**External Attendees:** ${recap.externalAttendees}\n`;
  }
  if (recap.meetingLink) {
    body += `**Meeting Recap:** [View Recap](${recap.meetingLink})\n`;
  }
  
  // Add FULL summary (not truncated)
  if (recap.summary) {
    body += `\n### Meeting Summary\n${recap.summary}\n`;
  }
  
  body += `\n---\n*Auto-generated from meeting recap on ${new Date().toISOString().split('T')[0]}*`;
  
  return body;
}

/**
 * Check if an action item already has a GitHub issue created
 * Uses meeting recap ID + action item index for uniqueness
 */
function isActionItemDuplicate(meetingRecapId, actionItemIndex) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(MEETING_ACTION_ITEMS_SHEET);
  
  if (!sheet || sheet.getLastRow() < 2) {
    return false;
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const idIndex = headers.indexOf('Meeting Recap ID');
  const indexCol = headers.indexOf('Action Item Index');
  const githubIdIndex = headers.indexOf('GitHub Issue ID');
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][idIndex] === meetingRecapId && data[i][indexCol] === actionItemIndex) {
      // Check if GitHub Issue ID is populated
      const githubId = data[i][githubIdIndex];
      return githubId && githubId.toString().trim() !== '';
    }
  }
  
  return false;
}

/**
 * Process external contacts from the new externalAttendees array in the webhook payload.
 * Creates/updates rows in the Account Contacts sheet keyed by email.
 */
function processExternalContacts(payload, recap) {
  const externalAttendees = payload.externalAttendees || [];
  if (externalAttendees.length === 0) {
    Logger.log('No externalAttendees in payload');
    return { created: 0, updated: 0 };
  }
  
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(ACCOUNT_CONTACTS_SHEET);
  
  const headers = [
    'Email',
    'Name',
    'Title',
    'Roles',
    'LinkedIn URL',
    'Contact ID',
    'Account ID',
    'Account Name',
    'Notes',
    'Last Updated',
    'Last Meeting Recap ID'
  ];
  
  // Create sheet if it doesn't exist
  if (!sheet) {
    sheet = spreadsheet.insertSheet(ACCOUNT_CONTACTS_SHEET);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#0d9488')
      .setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    Logger.log(`Created new ${ACCOUNT_CONTACTS_SHEET} sheet`);
  }
  
  // Ensure headers exist
  let hasHeaders = false;
  if (sheet.getLastRow() > 0) {
    hasHeaders = (sheet.getRange(1, 1).getValue() === 'Email');
  }
  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  
  // Build existing contacts map: email -> rowIndex
  const existingContacts = new Map();
  if (sheet.getLastRow() > 1) {
    const data = sheet.getDataRange().getValues();
    const emailIdx = data[0].indexOf('Email');
    for (let i = 1; i < data.length; i++) {
      const email = String(data[i][emailIdx] || '').toLowerCase().trim();
      if (email) existingContacts.set(email, i + 1); // 1-indexed row
    }
  }
  
  let created = 0;
  let updated = 0;
  
  for (const attendee of externalAttendees) {
    const email = (attendee.Email || '').toLowerCase().trim();
    if (!email) continue;
    
    const name = attendee.Name || '';
    const title = attendee.Title || '';
    const roles = Array.isArray(attendee.Roles) ? attendee.Roles.join(', ') : (attendee.Roles || '');
    const linkedInUrl = attendee['LinkedIn URL'] || '';
    const contactId = attendee['Contact ID'] || '';
    const accountId = recap.accountId || '';
    const accountName = recap.accountName || '';
    
    if (existingContacts.has(email)) {
      // Update existing contact (but preserve Notes)
      const rowNum = existingContacts.get(email);
      const notesIdx = headers.indexOf('Notes') + 1;
      const existingNotes = sheet.getRange(rowNum, notesIdx).getValue();
      
      const updatedRow = [
        email, name, title, roles, linkedInUrl, contactId,
        accountId, accountName, existingNotes || '', new Date(), recap.meetingRecapId || ''
      ];
      sheet.getRange(rowNum, 1, 1, updatedRow.length).setValues([updatedRow]);
      updated++;
      Logger.log(`  ✓ Updated contact: ${name} (${email})`);
    } else {
      // Create new contact
      const newRow = [
        email, name, title, roles, linkedInUrl, contactId,
        accountId, accountName, '', new Date(), recap.meetingRecapId || ''
      ];
      sheet.appendRow(newRow);
      created++;
      Logger.log(`  + Created contact: ${name} (${email})`);
    }
  }
  
  Logger.log(`Contacts: ${created} created, ${updated} updated`);
  return { created, updated };
}

/**
 * Store detailed attendee info (internalAttendees/externalAttendees) as JSON
 * on additional columns of the Webhook Meeting Recaps sheet row.
 */
function storeAttendeeDetailsOnRecap(meetingRecapId, payload) {
  const internalAttendees = payload.internalAttendees || [];
  const externalAttendees = payload.externalAttendees || [];
  
  if (internalAttendees.length === 0 && externalAttendees.length === 0) return;
  
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(WEBHOOK_MEETING_RECAPS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return;
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIdx = headers.indexOf('Meeting Recap ID');
  
  // Ensure columns exist
  let intAttendeesIdx = headers.indexOf('Internal Attendees JSON');
  let extAttendeesIdx = headers.indexOf('External Attendees JSON');
  
  if (intAttendeesIdx === -1) {
    intAttendeesIdx = headers.length;
    sheet.getRange(1, intAttendeesIdx + 1).setValue('Internal Attendees JSON');
  }
  if (extAttendeesIdx === -1) {
    extAttendeesIdx = intAttendeesIdx + 1;
    if (headers.indexOf('External Attendees JSON') === -1) {
      sheet.getRange(1, extAttendeesIdx + 1).setValue('External Attendees JSON');
    }
  }
  
  // Find the recap row and update
  for (let i = 1; i < data.length; i++) {
    if (data[i][idIdx] === meetingRecapId) {
      sheet.getRange(i + 1, intAttendeesIdx + 1).setValue(JSON.stringify(internalAttendees));
      sheet.getRange(i + 1, extAttendeesIdx + 1).setValue(JSON.stringify(externalAttendees));
      Logger.log(`Stored attendee details on recap row ${i + 1}`);
      break;
    }
  }
}

/**
 * Process a create_task webhook — creates a Firestore task (Phase 3 hard
 * cutover). Previously this hit the GitHub Issues API; the legacy TaskPanel
 * still POSTs here, so we keep the endpoint live but redirect the write to
 * Firestore so both UIs converge on the same data source.
 */
function processCreateTaskWebhook(payload) {
  Logger.log('Processing create_task webhook (Firestore cutover)...');

  const title = payload.title;
  const description = payload.description || '';
  const rawPriority = payload.priority || '';
  const accountName = payload.accountName || '';
  const accountId = payload.accountId || '';

  if (!title) {
    throw new Error('Missing required field: title');
  }

  try {
    const nowIso = new Date().toISOString();
    const taskId = Utilities.getUuid();
    const priority = normalizeTaskPriority(rawPriority);

    const task = {
      title: String(title).trim().substring(0, 200),
      description: description,
      status: 'backlog',
      priority: priority,
      targetDate: null,
      accountId: accountId || null,
      accountName: accountName || null,
      parentTaskId: null,
      assigneeIds: [],
      source: 'manual',
      sourceRef: {
        manuallyCreatedBy: payload.createdBy || 'webhook',
      },
      createdAt: nowIso,
      updatedAt: nowIso,
      closedAt: null,
      createdBy: payload.createdBy || 'webhook',
    };

    writeFirestoreDocument('tasks', taskId, task);

    // Activity log entry
    const activityId = Utilities.getUuid();
    writeFirestoreDocument('tasks/' + taskId + '/activity', activityId, {
      type: 'created',
      actorId: payload.createdBy || 'webhook',
      timestamp: nowIso,
      detail: { note: 'Created via legacy create_task webhook' },
    });

    Logger.log('✓ Created Firestore task ' + taskId + ': ' + title);

    return {
      action: 'created',
      taskId: taskId,
      // Legacy callers expect issue identifiers; return placeholders so the
      // old TaskPanel's success path still parses cleanly.
      issueNodeId: taskId,
      issueNumber: 0,
      issueUrl: '',
    };
  } catch (error) {
    Logger.log('ERROR in processCreateTaskWebhook: ' + error.message);
    throw error;
  }
}

/**
 * Process a close_task webhook - closes a GitHub issue.
 * Expects payload: { issueNumber: number }
 */
function processCloseTaskWebhook(payload) {
  Logger.log('Processing close_task webhook...');
  
  const issueNumber = payload.issueNumber;
  if (!issueNumber) {
    throw new Error('Missing required field: issueNumber');
  }
  
  try {
    const config = validateGitHubConfig();
    
    const url = `https://api.github.com/repos/${GITHUB_ISSUE_REPO_OWNER}/${GITHUB_ISSUE_REPO_NAME}/issues/${issueNumber}`;
    const response = UrlFetchApp.fetch(url, {
      method: 'patch',
      contentType: 'application/json',
      headers: {
        'Authorization': 'token ' + config.githubToken,
        'Accept': 'application/vnd.github.v3+json',
      },
      payload: JSON.stringify({ state: 'closed' }),
      muteHttpExceptions: true,
    });
    
    const code = response.getResponseCode();
    if (code !== 200) {
      throw new Error(`GitHub API returned ${code}: ${response.getContentText().substring(0, 200)}`);
    }
    
    // Also set project status to "Done" if possible
    try {
      const projectInfo = getProjectFieldInfo(config);
      if (projectInfo && projectInfo.statusFieldId && projectInfo.doneOptionId) {
        const issueData = JSON.parse(response.getContentText());
        const issueNodeId = issueData.node_id;
        const projectItemId = addIssueToProject(config.githubToken, projectInfo.projectId, issueNodeId);
        if (projectItemId) {
          setProjectItemField(
            config.githubToken,
            projectInfo.projectId,
            projectItemId,
            projectInfo.statusFieldId,
            projectInfo.doneOptionId
          );
        }
      }
    } catch (projErr) {
      Logger.log('Warning: Could not update project status to Done: ' + projErr.message);
    }
    
    Logger.log(`✓ Closed issue #${issueNumber}`);
    return { action: 'closed', issueNumber: issueNumber };
    
  } catch (error) {
    Logger.log('ERROR in processCloseTaskWebhook: ' + error.message);
    throw error;
  }
}

/**
 * Process the followUpEmail object from the webhook payload.
 * Saves email metadata to the recap sheet and creates a Gmail draft.
 * Does NOT send the email - only creates a draft for manual review.
 * 
 * @param {Object} followUpEmail - { subject, htmlBody, toEmails }
 * @param {string} meetingRecapId - The meeting recap ID for reference
 * @param {Function} log - Logging function
 * @returns {Object} Result with drafted flag and draftId
 */
function processFollowUpEmail(followUpEmail, meetingRecapId, log) {
  if (!log) log = Logger.log.bind(Logger);
  
  const subject = followUpEmail.subject || '';
  const htmlBody = followUpEmail.htmlBody || '';
  const toEmails = followUpEmail.toEmails || [];
  
  if (!subject || !htmlBody || toEmails.length === 0) {
    log('Follow-up email missing required fields (subject, htmlBody, or toEmails)');
    return { drafted: false, reason: 'missing_fields' };
  }
  
  // Step 1: Save follow-up email data to the recap sheet
  try {
    saveFollowUpEmailToSheet(meetingRecapId, followUpEmail);
    log('  Saved follow-up email data to recap sheet');
  } catch (sheetErr) {
    log('  WARNING: Failed to save follow-up email to sheet: ' + sheetErr.message);
  }
  
  // Step 2: Create a Gmail draft (NOT send)
  try {
    const toField = toEmails.join(', ');
    
    const draft = GmailApp.createDraft(
      toField,
      subject,
      '', // plain text body (empty since we use HTML)
      {
        htmlBody: htmlBody,
        name: 'John Davis'
      }
    );
    
    const draftId = draft.getId();
    log(`  Created Gmail draft: ${draftId}`);
    log(`  To: ${toField}`);
    log(`  Subject: ${subject}`);
    
    return { drafted: true, draftId: draftId };
    
  } catch (draftErr) {
    log('ERROR: Failed to create Gmail draft: ' + draftErr.message);
    return { drafted: false, reason: draftErr.message };
  }
}

/**
 * Save follow-up email metadata to additional columns on the Webhook Meeting Recaps sheet.
 */
function saveFollowUpEmailToSheet(meetingRecapId, followUpEmail) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(WEBHOOK_MEETING_RECAPS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return;
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIdx = headers.indexOf('Meeting Recap ID');
  
  // Ensure columns exist
  let subjectIdx = headers.indexOf('Follow-Up Email Subject');
  let toIdx = headers.indexOf('Follow-Up Email To');
  let draftStatusIdx = headers.indexOf('Follow-Up Email Draft Status');
  
  const lastCol = sheet.getLastColumn();
  
  if (subjectIdx === -1) {
    subjectIdx = lastCol;
    sheet.getRange(1, subjectIdx + 1).setValue('Follow-Up Email Subject');
    sheet.getRange(1, subjectIdx + 1)
      .setFontWeight('bold')
      .setBackground('#1a73e8')
      .setFontColor('#ffffff');
  }
  if (toIdx === -1) {
    toIdx = subjectIdx + 1;
    if (headers.indexOf('Follow-Up Email To') === -1) {
      sheet.getRange(1, toIdx + 1).setValue('Follow-Up Email To');
      sheet.getRange(1, toIdx + 1)
        .setFontWeight('bold')
        .setBackground('#1a73e8')
        .setFontColor('#ffffff');
    }
  }
  if (draftStatusIdx === -1) {
    draftStatusIdx = toIdx + 1;
    if (headers.indexOf('Follow-Up Email Draft Status') === -1) {
      sheet.getRange(1, draftStatusIdx + 1).setValue('Follow-Up Email Draft Status');
      sheet.getRange(1, draftStatusIdx + 1)
        .setFontWeight('bold')
        .setBackground('#1a73e8')
        .setFontColor('#ffffff');
    }
  }
  
  // Find the recap row and update
  for (let i = 1; i < data.length; i++) {
    if (data[i][idIdx] === meetingRecapId) {
      sheet.getRange(i + 1, subjectIdx + 1).setValue(followUpEmail.subject || '');
      sheet.getRange(i + 1, toIdx + 1).setValue((followUpEmail.toEmails || []).join(', '));
      sheet.getRange(i + 1, draftStatusIdx + 1).setValue('Draft Created');
      Logger.log(`Saved follow-up email data on recap row ${i + 1}`);
      break;
    }
  }
}

/**
 * Test function to simulate a webhook with sample data
 */
function testMeetingRecapWebhook() {
  const samplePayload = {
    "meetingInfo": {
      "title": "Test Meeting - Webhook Integration",
      "startTime": new Date().toISOString(),
      "endTime": new Date(Date.now() + 30 * 60000).toISOString(),
      "meetingLink": "https://app.askelephant.ai/workspaces/test/engagements/ngmt_TEST123456789",
      "meetingUrl": "https://zoom.us/j/123456789"
    },
    "companyInfo": {
      "companyName": "Test Company",
      "slackMessages": 0
    },
    "attendees": {
      "actual": ["john.davis@observepoint.com", "test@testcompany.com"],
      "invited": ["john.davis@observepoint.com", "test@testcompany.com"],
      "allNames": ["John Davis", "Test User"]
    },
    "summary": "This is a test meeting summary to verify the webhook integration is working correctly. It includes multiple sentences to ensure the full summary is displayed in GitHub issues without truncation.",
    "actionItems": {
      "myItems": [
        {
          "actionItemTitle": "Test Action Item 1",
          "actionItemDescription": "This is a test action item description for the first item.",
          "priority": "High"
        },
        {
          "actionItemTitle": "Test Action Item 2",
          "actionItemDescription": "This is a test action item description for the second item.",
          "priority": "Medium"
        }
      ],
      "othersItems": [
        {
          "actionItemTitle": "Test Others Action Item",
          "actionItemDescription": "Assignee: test@testcompany.com\n\nThis is assigned to someone else."
        }
      ]
    }
  };
  
  const ui = SpreadsheetApp.getUi();
  
  const response = ui.alert(
    'Test Webhook',
    'This will simulate receiving a meeting recap webhook with test data.\n\n' +
    'It will create test entries in the new sheets.\n\n' +
    'Continue?',
    ui.ButtonSet.YES_NO
  );
  
  if (response !== ui.Button.YES) {
    return;
  }
  
  try {
    const result = processMeetingRecapWebhook(samplePayload);
    
    ui.alert(
      'Test Complete',
      `Result: ${result.action}\n` +
      `Meeting Recap ID: ${result.meetingRecapId}\n` +
      `My Action Items: ${result.myActionItems}\n` +
      `Others Action Items: ${result.othersActionItems}\n` +
      `GitHub Issues Created: ${result.githubIssuesCreated || 0}`,
      ui.ButtonSet.OK
    );
    
  } catch (error) {
    Logger.log('Test failed: ' + error.message);
    Logger.log(error.stack);
    ui.alert('Test Failed', 'Error: ' + error.message, ui.ButtonSet.OK);
  }
}

