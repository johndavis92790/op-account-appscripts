/**
 * Fix Email Communications - Account ID Column
 * 
 * Problem: The "Account ID" column in Email Communications contains Account Names
 * instead of Account IDs, breaking the reference to Accounts Card Report.
 * 
 * This script:
 * 1. Migrates existing email records to use proper Account IDs
 * 2. Keeps Account Names in the "Account Name" column for readability
 */

/**
 * Main function to fix email account references
 */
function fixEmailAccountReferences() {
  const startTime = new Date();
  Logger.log('=== Starting Email Account Reference Fix ===');
  
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const emailSheet = spreadsheet.getSheetByName('Email Communications');
    const accountsSheet = spreadsheet.getSheetByName('Accounts Card Report');
    
    if (!emailSheet) {
      throw new Error('Email Communications sheet not found');
    }
    
    if (!accountsSheet) {
      throw new Error('Accounts Card Report sheet not found');
    }
    
    const emailData = emailSheet.getDataRange().getValues();
    const emailHeaders = emailData[0];
    const accountData = accountsSheet.getDataRange().getValues();
    const accountHeaders = accountData[0];
    
    // Get column indices
    const accountIdIdx = emailHeaders.indexOf('Account ID');
    const accountNameIdx = emailHeaders.indexOf('Account Name');
    
    if (accountIdIdx === -1) {
      throw new Error('Account ID column not found in Email Communications');
    }
    
    if (accountNameIdx === -1) {
      throw new Error('Account Name column not found in Email Communications');
    }
    
    // Build Account Name -> Account ID map
    const nameToIdMap = new Map();
    const accountIdColIdx = accountHeaders.indexOf('Id');
    const accountNameColIdx = accountHeaders.indexOf('Name');
    
    for (let i = 1; i < accountData.length; i++) {
      const accountId = accountData[i][accountIdColIdx];
      const accountName = accountData[i][accountNameColIdx];
      
      if (accountId && accountName) {
        nameToIdMap.set(accountName, accountId);
      }
    }
    
    Logger.log(`Built name-to-ID map with ${nameToIdMap.size} accounts`);
    
    // Check and fix email records
    let fixedCount = 0;
    let alreadyCorrectCount = 0;
    let unmappedCount = 0;
    const unmappedNames = new Set();
    
    for (let i = 1; i < emailData.length; i++) {
      const currentAccountId = emailData[i][accountIdIdx];
      const currentAccountName = emailData[i][accountNameIdx];
      
      if (!currentAccountId) {
        // Empty, skip
        continue;
      }
      
      // Check if it's already an ID (starts with 001, 006, etc.)
      if (typeof currentAccountId === 'string' && 
          (currentAccountId.startsWith('001') || currentAccountId.startsWith('006') || 
           currentAccountId.startsWith('0010') || currentAccountId.startsWith('0016'))) {
        alreadyCorrectCount++;
        continue;
      }
      
      // It's a name, need to convert to ID
      const accountId = nameToIdMap.get(currentAccountId);
      
      if (accountId) {
        // Update the Account ID column with the actual ID
        emailSheet.getRange(i + 1, accountIdIdx + 1).setValue(accountId);
        
        // Ensure Account Name column has the name
        if (!currentAccountName || currentAccountName !== currentAccountId) {
          emailSheet.getRange(i + 1, accountNameIdx + 1).setValue(currentAccountId);
        }
        
        fixedCount++;
        
        if (fixedCount % 50 === 0) {
          Logger.log(`Fixed ${fixedCount} records...`);
        }
      } else {
        unmappedCount++;
        unmappedNames.add(currentAccountId);
        Logger.log(`⚠️ Could not map account name: "${currentAccountId}"`);
      }
    }
    
    const duration = (new Date() - startTime) / 1000;
    Logger.log('\n=== Fix Complete ===');
    Logger.log(`Duration: ${duration}s`);
    Logger.log(`Already correct: ${alreadyCorrectCount}`);
    Logger.log(`Fixed: ${fixedCount}`);
    Logger.log(`Unmapped: ${unmappedCount}`);
    
    if (unmappedNames.size > 0) {
      Logger.log('\nUnmapped account names:');
      unmappedNames.forEach(name => Logger.log(`  - ${name}`));
    }
    
    return {
      success: true,
      alreadyCorrect: alreadyCorrectCount,
      fixed: fixedCount,
      unmapped: unmappedCount,
      unmappedNames: Array.from(unmappedNames),
      duration: duration
    };
    
  } catch (error) {
    Logger.log('ERROR: ' + error.message);
    Logger.log(error.stack);
    throw error;
  }
}

/**
 * Manual function with UI
 */
function fixEmailAccountReferencesManual() {
  try {
    const ui = SpreadsheetApp.getUi();
    
    const response = ui.alert(
      'Fix Email Account References',
      'This will update the "Account ID" column in Email Communications to use actual Account IDs instead of Account Names.\n\n' +
      'This is a one-time migration that will:\n' +
      '• Convert Account Names to Account IDs\n' +
      '• Preserve Account Names in the "Account Name" column\n' +
      '• Fix the broken reference to Accounts Card Report\n\n' +
      'This may take a few minutes for 794 email records.\n\n' +
      'Continue?',
      ui.ButtonSet.YES_NO
    );
    
    if (response !== ui.Button.YES) {
      return;
    }
    
    const result = fixEmailAccountReferences();
    
    let message = 'Email Account Reference Fix Complete!\n\n';
    message += `Already correct: ${result.alreadyCorrect}\n`;
    message += `Fixed: ${result.fixed}\n`;
    message += `Unmapped: ${result.unmapped}\n`;
    message += `Duration: ${result.duration.toFixed(1)}s\n\n`;
    
    if (result.unmapped > 0) {
      message += 'Some emails could not be mapped. Check the logs for details.';
    } else {
      message += 'All email records now have proper Account IDs!';
    }
    
    ui.alert(
      'Fix Complete',
      message,
      ui.ButtonSet.OK
    );
    
  } catch (error) {
    Logger.log('ERROR: ' + error.message);
    SpreadsheetApp.getUi().alert(
      'Fix Failed',
      'Error: ' + error.message,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}
