/**
 * Gmail Import - Efficient Email Collection by Domain
 * 
 * Imports emails filtered by domains from the Opportunity Mapping sheet
 * Uses incremental sync to avoid re-importing emails
 * Optimized for minimal API calls and efficient data storage
 */

const EMAIL_SHEET_NAME = 'Email Communications';
const EMAIL_SYNC_STATE_SHEET = 'Email Sync State';

/**
 * Main function - Import emails filtered by opportunity domains
 */
function importEmailsByDomain() {
  const startTime = new Date();
  Logger.log('=== Starting Email Import by Domain ===');
  
  try {
    const domains = getOpportunityDomains();
    
    if (domains.length === 0) {
      Logger.log('No domains found in mapping sheet');
      return {
        success: false,
        message: 'No domains configured in Opportunity Mapping sheet'
      };
    }
    
    Logger.log(`Found ${domains.length} unique domains to search`);
    
    const lastSyncDate = getLastSyncDate();
    Logger.log(`Last sync: ${lastSyncDate ? lastSyncDate.toISOString() : 'Never'}`);
    
    const emails = fetchEmailsByDomains(domains, lastSyncDate);
    Logger.log(`Retrieved ${emails.length} new emails`);
    
    if (emails.length > 0) {
      writeEmailsToSheet(emails);
      updateLastSyncDate(new Date());
    }
    
    const duration = (new Date() - startTime) / 1000;
    Logger.log(`=== Import Complete in ${duration}s ===`);
    
    return {
      success: true,
      emailCount: emails.length,
      duration: duration
    };
    
  } catch (error) {
    Logger.log('ERROR: ' + error.message);
    Logger.log(error.stack);
    throw error;
  }
}

/**
 * Get all unique domains from the Opportunity Mapping sheet
 */
function getOpportunityDomains() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const mappingSheet = spreadsheet.getSheetByName('Opportunities to Email Domains Mapping');
  
  if (!mappingSheet) {
    Logger.log('Mapping sheet not found');
    return [];
  }
  
  const data = mappingSheet.getDataRange().getValues();
  const domains = new Set();
  
  for (let i = 1; i < data.length; i++) {
    const domainCell = data[i][1];
    if (domainCell && typeof domainCell === 'string') {
      const domainList = domainCell.split(',').map(d => d.trim().toLowerCase());
      domainList.forEach(domain => {
        if (domain) domains.add(domain);
      });
    }
  }
  
  return Array.from(domains);
}

/**
 * Get the last sync date from the sync state sheet
 */
function getLastSyncDate() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let syncSheet = spreadsheet.getSheetByName(EMAIL_SYNC_STATE_SHEET);
  
  if (!syncSheet) {
    syncSheet = spreadsheet.insertSheet(EMAIL_SYNC_STATE_SHEET);
    syncSheet.getRange(1, 1, 1, 2).setValues([['Last Sync Date', 'Email Count']]);
    syncSheet.hideSheet();
    return null;
  }
  
  const data = syncSheet.getDataRange().getValues();
  if (data.length > 1 && data[1][0]) {
    return new Date(data[1][0]);
  }
  
  return null;
}

/**
 * Update the last sync date
 */
function updateLastSyncDate(date) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let syncSheet = spreadsheet.getSheetByName(EMAIL_SYNC_STATE_SHEET);
  
  if (!syncSheet) {
    syncSheet = spreadsheet.insertSheet(EMAIL_SYNC_STATE_SHEET);
    syncSheet.getRange(1, 1, 1, 2).setValues([['Last Sync Date', 'Email Count']]);
    syncSheet.hideSheet();
  }
  
  const emailSheet = spreadsheet.getSheetByName(EMAIL_SHEET_NAME);
  const emailCount = emailSheet ? emailSheet.getLastRow() - 1 : 0;
  
  syncSheet.getRange(2, 1, 1, 2).setValues([[date, emailCount]]);
}

/**
 * Fetch emails filtered by domains using efficient Gmail search
 * Uses incremental sync based on last sync date
 */
function fetchEmailsByDomains(domains, lastSyncDate) {
  const emails = [];
  const processedIds = new Set();
  
  const batchSize = 5;
  
  for (let i = 0; i < domains.length; i += batchSize) {
    const domainBatch = domains.slice(i, i + batchSize);
    
    const searchQuery = buildGmailSearchQuery(domainBatch, lastSyncDate);
    Logger.log(`Searching batch ${Math.floor(i / batchSize) + 1}: ${searchQuery}`);
    
    const threads = GmailApp.search(searchQuery, 0, 500);
    Logger.log(`Found ${threads.length} threads for batch`);
    
    threads.forEach(thread => {
      const messages = thread.getMessages();
      
      messages.forEach(message => {
        const messageId = message.getId();
        
        if (!processedIds.has(messageId)) {
          processedIds.add(messageId);
          
          const emailData = extractEmailData(message);
          
          const hasMatchingDomain = domains.some(domain => {
            return emailData.from.includes(domain) ||
                   emailData.to.includes(domain) ||
                   emailData.cc.includes(domain);
          });
          
          if (hasMatchingDomain) {
            emails.push(emailData);
          }
        }
      });
    });
    
    Utilities.sleep(100);
  }
  
  return emails;
}

/**
 * Build efficient Gmail search query
 */
function buildGmailSearchQuery(domains, lastSyncDate) {
  const domainQueries = domains.map(domain => {
    return `(from:*@${domain} OR to:*@${domain} OR cc:*@${domain})`;
  }).join(' OR ');
  
  let query = `(${domainQueries})`;
  
  if (lastSyncDate) {
    const afterDate = Utilities.formatDate(lastSyncDate, Session.getScriptTimeZone(), 'yyyy/MM/dd');
    query += ` after:${afterDate}`;
  } else {
    query += ` newer_than:1y`;
  }
  
  return query;
}

/**
 * Get email domain from an email address
 * Handles formats like: "Name <email@domain.com>", "email@domain.com", etc.
 */
function getEmailDomain(email) {
  if (!email || typeof email !== 'string') return '';
  
  // Extract email from angle brackets or standalone
  const emailMatch = email.match(/<([^>]+@[^>]+)>|([^\s<>"]+@[^\s<>",]+)/);
  if (!emailMatch) return '';
  
  const emailAddress = emailMatch[1] || emailMatch[2];
  
  // Extract domain, excluding quotes and other special chars
  const domainMatch = emailAddress.match(/@([a-zA-Z0-9.-]+)/);
  
  return domainMatch ? domainMatch[1].toLowerCase().trim() : '';
}

/**
 * Extract relevant data from email message
 */
function extractEmailData(message) {
  const from = message.getFrom();
  const to = message.getTo();
  const cc = message.getCc();
  const subject = message.getSubject();
  const date = message.getDate();
  const body = message.getPlainBody();
  const messageId = message.getId();
  
  const fromDomain = getEmailDomain(from);
  
  // Extract and deduplicate To domains
  const toDomainsArray = to.split(',').map(e => getEmailDomain(e.trim())).filter(d => d);
  const uniqueToDomains = [...new Set(toDomainsArray)];
  const toDomains = uniqueToDomains.join(', ');
  
  // Extract and deduplicate CC domains
  const ccDomainsArray = cc ? cc.split(',').map(e => getEmailDomain(e.trim())).filter(d => d) : [];
  const uniqueCcDomains = [...new Set(ccDomainsArray)];
  const ccDomains = uniqueCcDomains.join(', ');
  
  // Find opportunity by checking from, then all to addresses, then all cc addresses
  let opportunity = findOpportunityByEmail(from);
  
  if (!opportunity && to) {
    const toEmails = to.split(',').map(e => e.trim());
    for (const email of toEmails) {
      opportunity = findOpportunityByEmail(email);
      if (opportunity) break;
    }
  }
  
  if (!opportunity && cc) {
    const ccEmails = cc.split(',').map(e => e.trim());
    for (const email of ccEmails) {
      opportunity = findOpportunityByEmail(email);
      if (opportunity) break;
    }
  }
  
  return {
    messageId: messageId,
    date: date,
    from: from,
    fromDomain: fromDomain,
    to: to,
    toDomains: toDomains,
    cc: cc || '',
    ccDomains: ccDomains,
    subject: subject,
    bodyPreview: body.substring(0, 500),
    opportunity: opportunity || '',
    threadId: message.getThread().getId()
  };
}

/**
 * Write emails to sheet with efficient batch operations
 */
function writeEmailsToSheet(emails) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(EMAIL_SHEET_NAME);
  
  if (!sheet) {
    sheet = spreadsheet.insertSheet(EMAIL_SHEET_NAME);
    
    const headers = [
      'Message ID',
      'Date',
      'From',
      'From Domain',
      'To',
      'To Domains',
      'CC',
      'CC Domains',
      'Subject',
      'Body Preview',
      'Opportunity',
      'Thread ID'
    ];
    
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#ea4335')
      .setFontColor('#ffffff');
    
    sheet.setFrozenRows(1);
    sheet.setFrozenColumns(2);
  }
  
  const existingIds = getExistingMessageIds(sheet);
  
  const newEmails = emails.filter(email => !existingIds.has(email.messageId));
  
  if (newEmails.length === 0) {
    Logger.log('No new emails to add (all already exist)');
    return;
  }
  
  const rows = newEmails.map(email => [
    email.messageId,
    email.date,
    email.from,
    email.fromDomain,
    email.to,
    email.toDomains,
    email.cc,
    email.ccDomains,
    email.subject,
    email.bodyPreview,
    email.opportunity,
    email.threadId
  ]);
  
  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow + 1, 1, rows.length, rows[0].length).setValues(rows);
  
  const dateCol = 2;
  sheet.getRange(lastRow + 1, dateCol, rows.length, 1)
    .setNumberFormat('yyyy-mm-dd hh:mm:ss');
  
  for (let i = 1; i <= 12; i++) {
    sheet.autoResizeColumn(i);
  }
  
  Logger.log(`Added ${newEmails.length} new emails to sheet`);
}

/**
 * Get existing message IDs to avoid duplicates
 */
function getExistingMessageIds(sheet) {
  const data = sheet.getDataRange().getValues();
  const ids = new Set();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) {
      ids.add(data[i][0]);
    }
  }
  
  return ids;
}

/**
 * Manual function to import emails with UI feedback
 */
function importEmailsByDomainManual() {
  try {
    const result = importEmailsByDomain();
    
    if (result.success) {
      SpreadsheetApp.getUi().alert(
        'Email Import Complete',
        `Successfully imported ${result.emailCount} new emails.\n\nDuration: ${result.duration}s`,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    } else {
      SpreadsheetApp.getUi().alert(
        'Email Import',
        result.message,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    }
    
  } catch (error) {
    Logger.log('Email import failed: ' + error.message);
    SpreadsheetApp.getUi().alert(
      'Email Import Failed',
      `Error: ${error.message}\n\nCheck the logs for details.`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}

/**
 * Setup automatic email import trigger (every 15 minutes)
 */
function setupEmailAutoImport() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'importEmailsByDomain') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  ScriptApp.newTrigger('importEmailsByDomain')
    .timeBased()
    .everyMinutes(15)
    .create();
  
  Logger.log('Email auto-import trigger created (runs every 15 minutes)');
  
  SpreadsheetApp.getUi().alert(
    'Email Auto-Import Enabled',
    'Emails will now be imported automatically every 15 minutes.\n\nOnly new emails since the last sync will be imported.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * Reset sync state to re-import all emails
 */
function resetEmailSyncState() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'Reset Email Sync',
    'This will reset the sync state and re-import all emails from the past year.\n\nAre you sure?',
    ui.ButtonSet.YES_NO
  );
  
  if (response === ui.Button.YES) {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const syncSheet = spreadsheet.getSheetByName(EMAIL_SYNC_STATE_SHEET);
    
    if (syncSheet) {
      syncSheet.clear();
      syncSheet.getRange(1, 1, 1, 2).setValues([['Last Sync Date', 'Email Count']]);
    }
    
    ui.alert('Sync State Reset', 'Email sync state has been reset. Run import to fetch all emails.', ui.ButtonSet.OK);
  }
}
