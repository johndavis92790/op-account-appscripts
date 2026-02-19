/**
 * Account Notes - Rich Text Notes Editor for Accounts
 * 
 * Provides a web-based rich text editor (Quill.js) for managing notes per account.
 * Notes are stored in a "Notes Storage" sheet within the spreadsheet.
 */

const NOTES_STORAGE_SHEET = 'Notes Storage';

/**
 * Get or create the Notes Storage sheet
 */
function getNotesStorageSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(NOTES_STORAGE_SHEET);
  
  if (!sheet) {
    sheet = ss.insertSheet(NOTES_STORAGE_SHEET);
    
    // Set up headers
    const headers = ['Account ID', 'Account Name', 'Notes Content', 'Last Saved'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground('#1a1a2e')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
    
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 200);
    sheet.setColumnWidth(2, 200);
    sheet.setColumnWidth(3, 500);
    sheet.setColumnWidth(4, 180);
    
    // Hide the sheet since it's just storage
    sheet.hideSheet();
    
    Logger.log('Created Notes Storage sheet');
  }
  
  return sheet;
}

/**
 * Load notes for a specific account
 * Called from the web app
 */
function loadAccountNotes(accountId) {
  if (!accountId) {
    throw new Error('Account ID is required');
  }
  
  const sheet = getNotesStorageSheet();
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === accountId) {
      return {
        content: data[i][2] || '',
        lastSaved: data[i][3] ? Utilities.formatDate(new Date(data[i][3]), 'America/Denver', 'MMM d, yyyy h:mm a') : ''
      };
    }
  }
  
  return { content: '', lastSaved: '' };
}

/**
 * Save notes for a specific account
 * Called from the web app
 */
function saveAccountNotes(accountId, accountName, content) {
  if (!accountId) {
    throw new Error('Account ID is required');
  }
  
  const sheet = getNotesStorageSheet();
  const data = sheet.getDataRange().getValues();
  const now = new Date();
  const formattedDate = Utilities.formatDate(now, 'America/Denver', 'MMM d, yyyy h:mm a');
  
  // Check if account already has notes
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === accountId) {
      // Update existing row
      sheet.getRange(i + 1, 2).setValue(accountName);
      sheet.getRange(i + 1, 3).setValue(content);
      sheet.getRange(i + 1, 4).setValue(now);
      
      Logger.log(`Updated notes for ${accountName} (${accountId})`);
      return { success: true, lastSaved: formattedDate };
    }
  }
  
  // Add new row
  sheet.appendRow([accountId, accountName, content, now]);
  
  Logger.log(`Created notes for ${accountName} (${accountId})`);
  return { success: true, lastSaved: formattedDate };
}

/**
 * Get list of all active accounts with notes status
 * Called from the sidebar
 * Uses same filtering logic as AccountDataRaw.js
 */
function getAccountListForNotes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const accountsSheet = ss.getSheetByName('Accounts Card Report');
  const renewalsSheet = ss.getSheetByName('Renewal Opportunities');
  const opptysSheet = ss.getSheetByName('Opptys Report');
  
  if (!accountsSheet || !renewalsSheet || !opptysSheet) {
    throw new Error('Required sheets not found: Accounts Card Report, Renewal Opportunities, Opptys Report');
  }
  
  // Step 1: Build set of active opp names from Renewal Opportunities
  // Uses extractOpportunityNameFromLink from AccountMapping.js
  const renewalsData = renewalsSheet.getDataRange().getValues();
  const renewalsHeaders = renewalsData[0];
  const renewalLinkIdx = renewalsHeaders.indexOf('Link to SF Opportunity');
  
  const activeOppNames = new Set();
  for (let i = 1; i < renewalsData.length; i++) {
    const linkCell = renewalsData[i][renewalLinkIdx];
    const oppName = extractOpportunityNameFromLink(linkCell);
    if (oppName) {
      activeOppNames.add(oppName);
    }
  }
  Logger.log(`Active opp names from Renewals: ${activeOppNames.size}`);
  
  // Step 2: Build map of opp ID -> opp name from Opptys Report
  const opptysData = opptysSheet.getDataRange().getValues();
  const opptysHeaders = opptysData[0];
  const oppIdIdx = opptysHeaders.indexOf('Id');
  const oppNameIdx = opptysHeaders.indexOf('Name');
  
  const oppIdToName = new Map();
  for (let i = 1; i < opptysData.length; i++) {
    const oppId = opptysData[i][oppIdIdx];
    const oppName = opptysData[i][oppNameIdx];
    if (oppId && oppName) {
      oppIdToName.set(oppId.toString(), oppName.toString());
    }
  }
  Logger.log(`Opp ID to name map: ${oppIdToName.size}`);
  
  // Step 3: Get accounts and filter to active only
  const accountsData = accountsSheet.getDataRange().getValues();
  const accountsHeaders = accountsData[0];
  const accountIdIdx = accountsHeaders.indexOf('Id');
  const accountNameIdx = accountsHeaders.indexOf('Name');
  const nextRenewalOppIdIdx = accountsHeaders.indexOf('next_renewal_opportunity_id');
  
  // Step 4: Get existing notes status
  const notesSheet = getNotesStorageSheet();
  const notesData = notesSheet.getDataRange().getValues();
  const accountsWithNotes = new Set();
  for (let i = 1; i < notesData.length; i++) {
    if (notesData[i][2] && notesData[i][2].toString().trim() !== '' && 
        notesData[i][2] !== '<p><br></p>') {
      accountsWithNotes.add(notesData[i][0].toString());
    }
  }
  
  // Step 5: Build active accounts list (same logic as AccountDataRaw.js)
  const accounts = [];
  for (let i = 1; i < accountsData.length; i++) {
    const accountId = accountsData[i][accountIdIdx];
    const accountName = accountsData[i][accountNameIdx];
    const nextRenewalOppId = accountsData[i][nextRenewalOppIdIdx];
    
    if (!accountId || !accountName) continue;
    
    // Match through Opptys Report (same as AccountDataRaw)
    const oppName = oppIdToName.get(nextRenewalOppId ? nextRenewalOppId.toString() : '');
    if (!oppName || !activeOppNames.has(oppName)) continue;
    
    accounts.push({
      id: accountId.toString().trim(),
      name: accountName.toString().trim(),
      hasNotes: accountsWithNotes.has(accountId.toString().trim())
    });
  }
  
  // Sort by name
  accounts.sort((a, b) => a.name.localeCompare(b.name));
  
  Logger.log(`Found ${accounts.length} active accounts for notes`);
  return accounts;
}

/**
 * Open the notes editor sidebar
 */
function openNotesSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('NotesEditor')
    .setTitle('Account Notes');
  SpreadsheetApp.getUi().showSidebar(html);
}
