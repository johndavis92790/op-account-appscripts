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

/**
 * Handle POST requests (webhooks)
 * @param {Object} e - Event object from Google Apps Script
 * @returns {TextOutput} JSON response
 */
function doPost(e) {
  const startTime = new Date();
  
  try {
    // Parse URL parameters
    const params = e.parameter || {};
    const webhookType = params.type || '';
    
    Logger.log(`=== Webhook Received: type=${webhookType} ===`);
    
    // Parse JSON body
    let payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (parseError) {
      Logger.log('ERROR: Failed to parse JSON body: ' + parseError.message);
      return createJsonResponse({
        success: false,
        error: 'Invalid JSON payload',
        message: parseError.message
      }, 400);
    }
    
    // Route based on webhook type
    let result;
    switch (webhookType) {
      case 'meeting_recap':
        result = processMeetingRecapWebhook(payload);
        break;
      
      // Add more webhook types here in the future
      // case 'other_type':
      //   result = processOtherWebhook(payload);
      //   break;
      
      default:
        Logger.log(`ERROR: Unknown webhook type: ${webhookType}`);
        return createJsonResponse({
          success: false,
          error: 'Unknown webhook type',
          message: `Type '${webhookType}' is not supported. Use ?type=meeting_recap`
        }, 400);
    }
    
    const duration = (new Date() - startTime) / 1000;
    Logger.log(`=== Webhook Complete in ${duration}s ===`);
    
    return createJsonResponse({
      success: true,
      ...result,
      duration: duration
    });
    
  } catch (error) {
    Logger.log('ERROR in doPost: ' + error.message);
    Logger.log(error.stack);
    
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
 * Process a meeting recap webhook from AskElephant
 * @param {Object} payload - The meeting recap JSON data
 * @returns {Object} Processing result
 */
function processMeetingRecapWebhook(payload) {
  Logger.log('Processing meeting recap webhook...');
  
  // Validate payload structure
  if (!payload.meetingInfo) {
    throw new Error('Invalid payload: missing meetingInfo object');
  }
  
  // Extract meeting recap ID from meetingLink
  const meetingRecapId = extractMeetingRecapId(payload.meetingInfo.meetingLink);
  if (!meetingRecapId) {
    throw new Error('Could not extract meeting recap ID from meetingLink');
  }
  
  Logger.log(`Meeting Recap ID: ${meetingRecapId}`);
  Logger.log(`Meeting Title: ${payload.meetingInfo.title}`);
  
  // Check for duplicate meeting recap
  if (isMeetingRecapDuplicate(meetingRecapId)) {
    Logger.log(`⏭️ Duplicate meeting recap: ${meetingRecapId}`);
    return {
      action: 'skipped',
      reason: 'duplicate',
      meetingRecapId: meetingRecapId
    };
  }
  
  // Step 1: Flatten and store the meeting recap
  const recap = flattenWebhookMeetingRecap(payload, meetingRecapId);
  const recapWritten = writeMeetingRecapToSheet(recap);
  
  // Step 2: Store action items in separate tables
  const myActionItemsResult = writeMyActionItemsToSheet(
    payload.actionItems?.myItems || [],
    meetingRecapId,
    recap
  );
  
  const othersActionItemsResult = writeOthersActionItemsToSheet(
    payload.actionItems?.othersItems || [],
    meetingRecapId
  );
  
  // Step 3: Match to calendar events
  Logger.log('Step 3: Matching to calendar events...');
  try {
    matchMeetingRecapsToCalendarEvents();
  } catch (matchError) {
    Logger.log('Warning: Calendar matching failed: ' + matchError.message);
  }
  
  // Step 4: Import existing GitHub tasks for duplicate detection
  Logger.log('Step 4: Importing GitHub tasks for duplicate detection...');
  try {
    importGitHubTasks();
  } catch (githubImportError) {
    Logger.log('Warning: GitHub task import failed: ' + githubImportError.message);
  }
  
  // Step 5: Create GitHub issues from my action items
  Logger.log('Step 5: Creating GitHub issues from action items...');
  let githubResult = { created: 0, skipped: 0, errors: 0 };
  try {
    githubResult = createGitHubIssuesFromActionItems(meetingRecapId, recap);
  } catch (githubError) {
    Logger.log('Warning: GitHub issue creation failed: ' + githubError.message);
  }
  
  return {
    action: 'created',
    meetingRecapId: meetingRecapId,
    meetingTitle: recap.meetingTitle,
    myActionItems: myActionItemsResult.count,
    othersActionItems: othersActionItemsResult.count,
    githubIssuesCreated: githubResult.created,
    githubIssuesSkipped: githubResult.skipped
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
  }
  
  // Create rows for each action item
  const rows = actionItems.map((item, index) => [
    meetingRecapId,
    index, // 0-indexed
    item.actionItemTitle || '',
    item.actionItemDescription || '',
    item.priority || '',
    '', // GitHub Issue ID - populated after creation
    '', // GitHub Issue Number - populated after creation
    recap.meetingTitle || '',
    recap.accountName || '',
    new Date()
  ]);
  
  // Append rows
  const nextRow = sheet.getLastRow() + 1;
  sheet.getRange(nextRow, 1, rows.length, headers.length).setValues(rows);
  
  // Format description column to wrap text
  const descIndex = headers.indexOf('Description') + 1;
  if (descIndex > 0) {
    sheet.getRange(nextRow, descIndex, rows.length, 1).setWrap(true);
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

/**
 * Manual function to reprocess action items and create missing GitHub issues
 */
function createMissingGitHubIssuesFromActionItems() {
  const ui = SpreadsheetApp.getUi();
  
  const response = ui.alert(
    'Create Missing GitHub Issues',
    'This will scan all action items and create GitHub issues for any that are missing.\n\n' +
    'Continue?',
    ui.ButtonSet.YES_NO
  );
  
  if (response !== ui.Button.YES) {
    return;
  }
  
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const actionItemsSheet = spreadsheet.getSheetByName(MEETING_ACTION_ITEMS_SHEET);
    const recapsSheet = spreadsheet.getSheetByName(WEBHOOK_MEETING_RECAPS_SHEET);
    
    if (!actionItemsSheet || actionItemsSheet.getLastRow() < 2) {
      ui.alert('No Data', 'No action items found.', ui.ButtonSet.OK);
      return;
    }
    
    // Build a map of meeting recap IDs to recap data
    const recapMap = new Map();
    if (recapsSheet && recapsSheet.getLastRow() > 1) {
      const recapData = recapsSheet.getDataRange().getValues();
      const recapHeaders = recapData[0];
      
      for (let i = 1; i < recapData.length; i++) {
        const recap = {};
        for (let j = 0; j < recapHeaders.length; j++) {
          const key = recapHeaders[j].replace(/\s+/g, '');
          recap[key] = recapData[i][j];
        }
        recap.meetingTitle = recapData[i][recapHeaders.indexOf('Meeting Title')];
        recap.meetingDate = recapData[i][recapHeaders.indexOf('Meeting Date')];
        recap.accountName = recapData[i][recapHeaders.indexOf('Account Name')];
        recap.externalAttendees = recapData[i][recapHeaders.indexOf('External Attendees')];
        recap.meetingLink = recapData[i][recapHeaders.indexOf('Meeting Link')];
        recap.summary = recapData[i][recapHeaders.indexOf('Summary')];
        
        recapMap.set(recapData[i][recapHeaders.indexOf('Meeting Recap ID')], recap);
      }
    }
    
    // Get action items
    const actionData = actionItemsSheet.getDataRange().getValues();
    const actionHeaders = actionData[0];
    
    const config = validateGitHubConfig();
    ensureAutoGeneratedLabel(config.githubToken);
    const projectInfo = getProjectFieldInfo(config);
    
    const idIndex = actionHeaders.indexOf('Meeting Recap ID');
    const indexCol = actionHeaders.indexOf('Action Item Index');
    const titleIndex = actionHeaders.indexOf('Title');
    const descIndex = actionHeaders.indexOf('Description');
    const priorityIndex = actionHeaders.indexOf('Priority');
    const githubIdIndex = actionHeaders.indexOf('GitHub Issue ID');
    const githubNumIndex = actionHeaders.indexOf('GitHub Issue Number');
    
    let created = 0;
    let skipped = 0;
    let errors = 0;
    
    for (let i = 1; i < actionData.length; i++) {
      const row = actionData[i];
      
      // Skip if already has a GitHub Issue ID
      if (row[githubIdIndex] && row[githubIdIndex].toString().trim()) {
        skipped++;
        continue;
      }
      
      const meetingRecapId = row[idIndex];
      const recap = recapMap.get(meetingRecapId) || {
        meetingTitle: row[actionHeaders.indexOf('Meeting Title')],
        accountName: row[actionHeaders.indexOf('Account Name')]
      };
      
      const actionItem = {
        actionItemTitle: row[titleIndex],
        actionItemDescription: row[descIndex],
        priority: row[priorityIndex]
      };
      
      try {
        const issueResult = createIssueFromActionItemWebhook(actionItem, recap, config, projectInfo);
        
        if (issueResult.created) {
          created++;
          
          const rowNum = i + 1;
          actionItemsSheet.getRange(rowNum, githubIdIndex + 1).setValue(issueResult.issueNodeId);
          actionItemsSheet.getRange(rowNum, githubNumIndex + 1).setValue(issueResult.issueNumber);
          
          Logger.log(`  ✓ Created issue #${issueResult.issueNumber}: ${actionItem.actionItemTitle}`);
        } else {
          skipped++;
        }
      } catch (error) {
        errors++;
        Logger.log(`  ❌ Error: ${error.message}`);
      }
      
      Utilities.sleep(200);
    }
    
    ui.alert(
      'Complete',
      `Created: ${created}\nSkipped: ${skipped}\nErrors: ${errors}`,
      ui.ButtonSet.OK
    );
    
  } catch (error) {
    Logger.log('ERROR: ' + error.message);
    Logger.log(error.stack);
    ui.alert('Error', error.message, ui.ButtonSet.OK);
  }
}
