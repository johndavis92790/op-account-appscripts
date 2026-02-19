/**
 * New Customer Detection and Setup Checklist
 * 
 * Detects new customers added to Renewal Opportunities
 * Shows setup checklist for required manual actions
 * Helps ensure new customers are properly configured
 */

const NEW_CUSTOMERS_PROPERTY = 'LAST_KNOWN_CUSTOMERS';

/**
 * Detect new customers in Renewal Opportunities
 */
function detectNewCustomers() {
  const startTime = new Date();
  Logger.log('=== Detecting New Customers ===');
  
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const renewalSheet = spreadsheet.getSheetByName('Renewal Opportunities');
    
    if (!renewalSheet) {
      throw new Error('Renewal Opportunities sheet not found');
    }
    
    const renewalData = renewalSheet.getDataRange().getValues();
    const renewalHeaders = renewalData[0];
    
    // Extract account names from Link to SF Opportunity column
    const linkColIdx = renewalHeaders.indexOf('Link to SF Opportunity');
    
    if (linkColIdx === -1) {
      throw new Error('Link to SF Opportunity column not found');
    }
    
    // Get current accounts
    const currentAccounts = new Set();
    for (let i = 1; i < renewalData.length; i++) {
      const linkCell = renewalData[i][linkColIdx];
      if (linkCell) {
        const accountName = extractAccountNameFromLink(linkCell);
        if (accountName) {
          currentAccounts.add(accountName);
        }
      }
    }
    
    Logger.log(`Current accounts in Renewal Opportunities: ${currentAccounts.size}`);
    
    // Get previously known accounts
    const lastKnownJson = PropertiesService.getScriptProperties().getProperty(NEW_CUSTOMERS_PROPERTY);
    const lastKnownAccounts = lastKnownJson ? new Set(JSON.parse(lastKnownJson)) : new Set();
    
    Logger.log(`Previously known accounts: ${lastKnownAccounts.size}`);
    
    // Find new accounts
    const newAccounts = [];
    for (const account of currentAccounts) {
      if (!lastKnownAccounts.has(account)) {
        newAccounts.push(account);
      }
    }
    
    // Find removed accounts
    const removedAccounts = [];
    for (const account of lastKnownAccounts) {
      if (!currentAccounts.has(account)) {
        removedAccounts.push(account);
      }
    }
    
    // Update stored accounts
    PropertiesService.getScriptProperties().setProperty(
      NEW_CUSTOMERS_PROPERTY,
      JSON.stringify(Array.from(currentAccounts))
    );
    
    const duration = (new Date() - startTime) / 1000;
    Logger.log(`=== Detection Complete in ${duration}s ===`);
    Logger.log(`New customers: ${newAccounts.length}`);
    Logger.log(`Removed customers: ${removedAccounts.length}`);
    
    if (newAccounts.length > 0) {
      Logger.log('New customers:');
      newAccounts.forEach(name => Logger.log(`  + ${name}`));
    }
    
    if (removedAccounts.length > 0) {
      Logger.log('Removed customers:');
      removedAccounts.forEach(name => Logger.log(`  - ${name}`));
    }
    
    return {
      success: true,
      newAccounts: newAccounts,
      removedAccounts: removedAccounts,
      totalAccounts: currentAccounts.size,
      duration: duration
    };
    
  } catch (error) {
    Logger.log('ERROR: ' + error.message);
    Logger.log(error.stack);
    throw error;
  }
}

/**
 * Extract account name from opportunity link
 */
function extractAccountNameFromLink(linkCell) {
  if (!linkCell) return null;
  
  // Extract from HYPERLINK formula
  if (typeof linkCell === 'string' && linkCell.includes('HYPERLINK')) {
    const match = linkCell.match(/HYPERLINK\s*\(\s*"[^"]+"\s*,\s*"([^"]+)"\s*\)/i);
    if (match) {
      const oppName = match[1];
      // Extract account name from opportunity name (e.g., "2026 - REN - Amica" -> "Amica")
      const parts = oppName.split(' - ');
      if (parts.length >= 3) {
        return parts.slice(2).join(' - ').trim();
      }
      return oppName;
    }
  }
  
  return linkCell;
}

/**
 * Show new customer setup checklist
 */
function showNewCustomerChecklist() {
  try {
    const result = detectNewCustomers();
    
    const ui = SpreadsheetApp.getUi();
    
    if (result.newAccounts.length === 0 && result.removedAccounts.length === 0) {
      ui.alert(
        'No Changes Detected',
        `No new or removed customers since last check.\n\n` +
        `Total active customers: ${result.totalAccounts}`,
        ui.ButtonSet.OK
      );
      return;
    }
    
    let message = '';
    
    if (result.newAccounts.length > 0) {
      message += `🆕 NEW CUSTOMERS (${result.newAccounts.length}):\n\n`;
      
      for (const accountName of result.newAccounts) {
        message += `• ${accountName}\n`;
      }
      
      message += '\n📋 SETUP CHECKLIST:\n\n';
      message += '1. ✅ Add Email Domain Mapping (REQUIRED)\n';
      message += '   → Accounts to Email Domains Mapping sheet\n';
      message += '   → Format: Account ID, Name, domains\n\n';
      message += '2. ✅ Create Google Doc Tab\n';
      message += '   → Run "Create Account Tabs in Doc"\n';
      message += '   → Or create manually\n\n';
      message += '3. ⚪ Add GitHub Label (Optional)\n';
      message += '   → Create label: "account: Name"\n\n';
    }
    
    if (result.removedAccounts.length > 0) {
      if (message) message += '\n';
      message += `📤 REMOVED CUSTOMERS (${result.removedAccounts.length}):\n\n`;
      
      for (const accountName of result.removedAccounts) {
        message += `• ${accountName}\n`;
      }
      
      message += '\n✅ Historical data preserved in:\n';
      message += '• Email Communications\n';
      message += '• Calendar Events\n';
      message += '• GitHub Tasks\n';
      message += '• Meeting Recaps\n';
      message += '• Account Notes\n';
      message += '• Google Doc tabs\n';
    }
    
    ui.alert(
      'Customer Changes Detected',
      message,
      ui.ButtonSet.OK
    );
    
  } catch (error) {
    Logger.log('ERROR: ' + error.message);
    SpreadsheetApp.getUi().alert(
      'Detection Failed',
      error.message,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}

/**
 * Check for new customers and create doc tabs automatically
 */
function autoCheckAndSetupNewCustomers() {
  const startTime = new Date();
  Logger.log('=== Auto Check and Setup New Customers ===');
  
  try {
    // Detect new customers
    const result = detectNewCustomers();
    
    if (result.newAccounts.length === 0) {
      Logger.log('No new customers detected');
      return {
        success: true,
        newCustomers: 0,
        tabsCreated: 0
      };
    }
    
    Logger.log(`Detected ${result.newAccounts.length} new customers`);
    
    // Auto-create Google Doc tabs for new customers
    let tabsCreated = 0;
    try {
      const docId = PropertiesService.getScriptProperties().getProperty('NOTES_DOC_ID');
      if (docId) {
        Logger.log('Creating Google Doc tabs for new customers...');
        const tabResult = createAccountTabsInDoc();
        tabsCreated = tabResult.created;
        Logger.log(`Created ${tabsCreated} new tabs`);
      } else {
        Logger.log('Notes document not configured, skipping tab creation');
      }
    } catch (error) {
      Logger.log('Could not auto-create tabs: ' + error.message);
    }
    
    const duration = (new Date() - startTime) / 1000;
    Logger.log(`=== Auto Setup Complete in ${duration}s ===`);
    
    return {
      success: true,
      newCustomers: result.newAccounts.length,
      tabsCreated: tabsCreated,
      newAccountNames: result.newAccounts
    };
    
  } catch (error) {
    Logger.log('ERROR: ' + error.message);
    Logger.log(error.stack);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Setup daily automation for new customer detection
 */
function setupNewCustomerAutoDetection() {
  // Delete any existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'autoCheckAndSetupNewCustomers') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Create new trigger - runs daily at 3am (after CSV imports at 2am)
  ScriptApp.newTrigger('autoCheckAndSetupNewCustomers')
    .timeBased()
    .atHour(3)
    .everyDays(1)
    .inTimezone('America/Denver')
    .create();
  
  Logger.log('Auto-detection trigger created (runs daily at 3am MST)');
  
  SpreadsheetApp.getUi().alert(
    'Auto-Detection Enabled',
    'New customer detection will now run automatically every day at 3am MST.\n\n' +
    'When new customers are detected:\n' +
    '• Google Doc tabs will be auto-created\n' +
    '• You will see them in the next manual check\n\n' +
    'You still need to manually add email domain mappings.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * Remove auto-detection trigger
 */
function removeNewCustomerAutoDetection() {
  const triggers = ScriptApp.getProjectTriggers();
  let removedCount = 0;
  
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'autoCheckAndSetupNewCustomers') {
      ScriptApp.deleteTrigger(trigger);
      removedCount++;
    }
  });
  
  Logger.log(`Removed ${removedCount} auto-detection trigger(s)`);
  
  SpreadsheetApp.getUi().alert(
    'Auto-Detection Disabled',
    'Automatic new customer detection has been disabled.\n\n' +
    'You can still manually check for new customers from the menu.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * Get setup status for a specific account
 */
function getAccountSetupStatus(accountName) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  
  const status = {
    accountName: accountName,
    emailDomainMapped: false,
    googleDocTabExists: false,
    hasEmails: false,
    hasCalendarEvents: false,
    hasMeetingRecaps: false,
    hasNotes: false
  };
  
  // Check email domain mapping
  const mappingSheet = spreadsheet.getSheetByName('Accounts to Email Domains Mapping');
  if (mappingSheet) {
    const mappingData = mappingSheet.getDataRange().getValues();
    const mappingHeaders = mappingData[0];
    const nameIdx = mappingHeaders.indexOf('Account Name');
    
    for (let i = 1; i < mappingData.length; i++) {
      if (mappingData[i][nameIdx] === accountName) {
        status.emailDomainMapped = true;
        break;
      }
    }
  }
  
  // Check Google Doc tab
  try {
    const docId = PropertiesService.getScriptProperties().getProperty('NOTES_DOC_ID');
    if (docId) {
      const doc = DocumentApp.openById(docId);
      const namedRanges = doc.getNamedRanges();
      for (const range of namedRanges) {
        if (range.getName() === accountName) {
          status.googleDocTabExists = true;
          break;
        }
      }
    }
  } catch (error) {
    // Doc not configured or not accessible
  }
  
  // Check if account has data
  const emailSheet = spreadsheet.getSheetByName('Email Communications');
  if (emailSheet) {
    const emailData = emailSheet.getDataRange().getValues();
    const emailHeaders = emailData[0];
    const accountNameIdx = emailHeaders.indexOf('Account Name');
    
    for (let i = 1; i < emailData.length; i++) {
      if (emailData[i][accountNameIdx] === accountName) {
        status.hasEmails = true;
        break;
      }
    }
  }
  
  const calendarSheet = spreadsheet.getSheetByName('Calendar Events');
  if (calendarSheet) {
    const calendarData = calendarSheet.getDataRange().getValues();
    const calendarHeaders = calendarData[0];
    const accountNameIdx = calendarHeaders.indexOf('Account Name');
    
    for (let i = 1; i < calendarData.length; i++) {
      if (calendarData[i][accountNameIdx] === accountName) {
        status.hasCalendarEvents = true;
        break;
      }
    }
  }
  
  const recapSheet = spreadsheet.getSheetByName('Webhook Meeting Recaps');
  if (recapSheet) {
    const recapData = recapSheet.getDataRange().getValues();
    const recapHeaders = recapData[0];
    const accountNameIdx = recapHeaders.indexOf('Account Name');
    
    for (let i = 1; i < recapData.length; i++) {
      if (recapData[i][accountNameIdx] === accountName) {
        status.hasMeetingRecaps = true;
        break;
      }
    }
  }
  
  const notesSheet = spreadsheet.getSheetByName('Account Notes');
  if (notesSheet) {
    const notesData = notesSheet.getDataRange().getValues();
    const notesHeaders = notesData[0];
    const accountNameIdx = notesHeaders.indexOf('Account Name');
    
    for (let i = 1; i < notesData.length; i++) {
      if (notesData[i][accountNameIdx] === accountName) {
        status.hasNotes = true;
        break;
      }
    }
  }
  
  return status;
}
