/**
 * Comprehensive Table Remapping Script
 * 
 * Verifies and fixes all table references and relationships across the entire system:
 * 1. Email Communications → Accounts Card Report
 * 2. Calendar Events → Accounts Card Report
 * 3. GitHub Tasks → Accounts Card Report
 * 4. Webhook Meeting Recaps → Accounts Card Report
 * 5. Meeting Action Items → Webhook Meeting Recaps
 * 6. Accounts Card Report → Opptys Report
 * 7. Orphaned record cleanup
 */

/**
 * Main comprehensive remapping function
 */
function comprehensiveRemapping() {
  const startTime = new Date();
  Logger.log('=== Starting Comprehensive Table Remapping ===\n');
  
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    
    // Load all sheets
    const sheets = {
      accounts: spreadsheet.getSheetByName('Accounts Card Report'),
      opptys: spreadsheet.getSheetByName('Opptys Report'),
      emails: spreadsheet.getSheetByName('Email Communications'),
      calendar: spreadsheet.getSheetByName('Calendar Events'),
      github: spreadsheet.getSheetByName('GitHub Tasks'),
      meetingRecaps: spreadsheet.getSheetByName('Webhook Meeting Recaps'),
      actionItems: spreadsheet.getSheetByName('Meeting Action Items')
    };
    
    // Verify all sheets exist
    for (const [name, sheet] of Object.entries(sheets)) {
      if (!sheet) {
        Logger.log(`⚠️ Warning: ${name} sheet not found, skipping...`);
      }
    }
    
    const results = {
      emailReferences: null,
      calendarReferences: null,
      githubReferences: null,
      meetingRecapReferences: null,
      actionItemReferences: null,
      accountOpportunityReferences: null,
      orphanedRecords: null
    };
    
    // 1. Fix Email Communications references
    if (sheets.emails && sheets.accounts) {
      Logger.log('--- Step 1: Verifying Email Communications → Accounts ---');
      results.emailReferences = verifyAndFixEmailReferences(sheets.emails, sheets.accounts);
    }
    
    // 2. Verify Calendar Events references
    if (sheets.calendar && sheets.accounts) {
      Logger.log('\n--- Step 2: Verifying Calendar Events → Accounts ---');
      results.calendarReferences = verifyReferences(
        sheets.calendar, 
        sheets.accounts, 
        'Calendar Events', 
        'Account ID', 
        'Id'
      );
    }
    
    // 3. Verify GitHub Tasks references
    if (sheets.github && sheets.accounts) {
      Logger.log('\n--- Step 3: Verifying GitHub Tasks → Accounts ---');
      results.githubReferences = verifyReferences(
        sheets.github, 
        sheets.accounts, 
        'GitHub Tasks', 
        'Account ID', 
        'Id'
      );
    }
    
    // 4. Verify Webhook Meeting Recaps references
    if (sheets.meetingRecaps && sheets.accounts) {
      Logger.log('\n--- Step 4: Verifying Webhook Meeting Recaps → Accounts ---');
      results.meetingRecapReferences = verifyReferences(
        sheets.meetingRecaps, 
        sheets.accounts, 
        'Webhook Meeting Recaps', 
        'Account ID', 
        'Id'
      );
    }
    
    // 5. Verify Meeting Action Items references
    if (sheets.actionItems && sheets.meetingRecaps) {
      Logger.log('\n--- Step 5: Verifying Meeting Action Items → Meeting Recaps ---');
      results.actionItemReferences = verifyReferences(
        sheets.actionItems, 
        sheets.meetingRecaps, 
        'Meeting Action Items', 
        'Meeting Recap ID', 
        'Meeting Recap ID'
      );
    }
    
    // 6. Verify Accounts → Opportunities references
    if (sheets.accounts && sheets.opptys) {
      Logger.log('\n--- Step 6: Verifying Accounts → Opportunities ---');
      results.accountOpportunityReferences = verifyAccountOpportunityReferences(
        sheets.accounts, 
        sheets.opptys
      );
    }
    
    // 7. Find orphaned records
    Logger.log('\n--- Step 7: Finding Orphaned Records ---');
    results.orphanedRecords = findOrphanedRecords(sheets);
    
    const duration = (new Date() - startTime) / 1000;
    Logger.log(`\n=== Remapping Complete in ${duration}s ===`);
    
    // Summary
    printSummary(results);
    
    return {
      success: true,
      results: results,
      duration: duration
    };
    
  } catch (error) {
    Logger.log('ERROR: ' + error.message);
    Logger.log(error.stack);
    throw error;
  }
}

/**
 * Verify and fix email references (special case - converts names to IDs)
 */
function verifyAndFixEmailReferences(emailSheet, accountsSheet) {
  const emailData = emailSheet.getDataRange().getValues();
  const emailHeaders = emailData[0];
  const accountData = accountsSheet.getDataRange().getValues();
  const accountHeaders = accountData[0];
  
  const accountIdIdx = emailHeaders.indexOf('Account ID');
  const accountNameIdx = emailHeaders.indexOf('Account Name');
  
  // Build maps
  const accountIds = new Set();
  const nameToIdMap = new Map();
  const accountIdColIdx = accountHeaders.indexOf('Id');
  const accountNameColIdx = accountHeaders.indexOf('Name');
  
  for (let i = 1; i < accountData.length; i++) {
    const accountId = accountData[i][accountIdColIdx];
    const accountName = accountData[i][accountNameColIdx];
    
    if (accountId) {
      accountIds.add(accountId);
      if (accountName) {
        nameToIdMap.set(accountName, accountId);
      }
    }
  }
  
  let validCount = 0;
  let fixedCount = 0;
  let invalidCount = 0;
  const invalidRefs = [];
  
  for (let i = 1; i < emailData.length; i++) {
    const accountIdValue = emailData[i][accountIdIdx];
    
    if (!accountIdValue) {
      continue;
    }
    
    // Check if it's already a valid ID
    if (accountIds.has(accountIdValue)) {
      validCount++;
      continue;
    }
    
    // Try to convert name to ID
    const accountId = nameToIdMap.get(accountIdValue);
    if (accountId) {
      emailSheet.getRange(i + 1, accountIdIdx + 1).setValue(accountId);
      if (!emailData[i][accountNameIdx]) {
        emailSheet.getRange(i + 1, accountNameIdx + 1).setValue(accountIdValue);
      }
      fixedCount++;
    } else {
      invalidCount++;
      invalidRefs.push({
        row: i + 1,
        value: accountIdValue
      });
    }
  }
  
  Logger.log(`✓ Valid references: ${validCount}`);
  Logger.log(`✓ Fixed references: ${fixedCount}`);
  Logger.log(`✗ Invalid references: ${invalidCount}`);
  
  if (invalidRefs.length > 0 && invalidRefs.length <= 10) {
    Logger.log('Invalid references:');
    invalidRefs.forEach(ref => {
      Logger.log(`  Row ${ref.row}: "${ref.value}"`);
    });
  }
  
  return {
    valid: validCount,
    fixed: fixedCount,
    invalid: invalidCount,
    invalidRefs: invalidRefs
  };
}

/**
 * Generic function to verify references between tables
 */
function verifyReferences(sourceSheet, targetSheet, sourceName, sourceColumn, targetColumn) {
  const sourceData = sourceSheet.getDataRange().getValues();
  const sourceHeaders = sourceData[0];
  const targetData = targetSheet.getDataRange().getValues();
  const targetHeaders = targetData[0];
  
  const sourceColIdx = sourceHeaders.indexOf(sourceColumn);
  const targetColIdx = targetHeaders.indexOf(targetColumn);
  
  if (sourceColIdx === -1) {
    Logger.log(`⚠️ Column "${sourceColumn}" not found in ${sourceName}`);
    return null;
  }
  
  if (targetColIdx === -1) {
    Logger.log(`⚠️ Column "${targetColumn}" not found in target sheet`);
    return null;
  }
  
  // Build target ID set
  const targetIds = new Set();
  for (let i = 1; i < targetData.length; i++) {
    const id = targetData[i][targetColIdx];
    if (id) {
      targetIds.add(id);
    }
  }
  
  let validCount = 0;
  let invalidCount = 0;
  let emptyCount = 0;
  const invalidRefs = [];
  
  for (let i = 1; i < sourceData.length; i++) {
    const refValue = sourceData[i][sourceColIdx];
    
    if (!refValue || refValue === '') {
      emptyCount++;
      continue;
    }
    
    if (targetIds.has(refValue)) {
      validCount++;
    } else {
      invalidCount++;
      if (invalidRefs.length < 10) {
        invalidRefs.push({
          row: i + 1,
          value: refValue
        });
      }
    }
  }
  
  Logger.log(`✓ Valid references: ${validCount}`);
  Logger.log(`○ Empty references: ${emptyCount}`);
  Logger.log(`✗ Invalid references: ${invalidCount}`);
  
  if (invalidRefs.length > 0) {
    Logger.log('Sample invalid references:');
    invalidRefs.forEach(ref => {
      Logger.log(`  Row ${ref.row}: "${ref.value}"`);
    });
  }
  
  return {
    valid: validCount,
    empty: emptyCount,
    invalid: invalidCount,
    invalidRefs: invalidRefs
  };
}

/**
 * Verify Account → Opportunity references
 */
function verifyAccountOpportunityReferences(accountsSheet, opptysSheet) {
  const accountData = accountsSheet.getDataRange().getValues();
  const accountHeaders = accountData[0];
  const opptyData = opptysSheet.getDataRange().getValues();
  const opptyHeaders = opptyData[0];
  
  const nextRenewalOppIdIdx = accountHeaders.indexOf('next_renewal_opportunity_id');
  const oppIdIdx = opptyHeaders.indexOf('Id');
  
  if (nextRenewalOppIdIdx === -1) {
    Logger.log('⚠️ next_renewal_opportunity_id column not found');
    return null;
  }
  
  // Build opportunity ID set
  const oppIds = new Set();
  for (let i = 1; i < opptyData.length; i++) {
    const oppId = opptyData[i][oppIdIdx];
    if (oppId) {
      oppIds.add(oppId);
    }
  }
  
  let validCount = 0;
  let invalidCount = 0;
  let emptyCount = 0;
  const invalidRefs = [];
  
  for (let i = 1; i < accountData.length; i++) {
    const oppId = accountData[i][nextRenewalOppIdIdx];
    
    if (!oppId || oppId === '' || oppId === 'nan') {
      emptyCount++;
      continue;
    }
    
    if (oppIds.has(oppId)) {
      validCount++;
    } else {
      invalidCount++;
      if (invalidRefs.length < 10) {
        const accountName = accountData[i][accountHeaders.indexOf('Name')];
        invalidRefs.push({
          row: i + 1,
          account: accountName,
          oppId: oppId
        });
      }
    }
  }
  
  Logger.log(`✓ Valid references: ${validCount}`);
  Logger.log(`○ Empty references: ${emptyCount}`);
  Logger.log(`✗ Invalid references: ${invalidCount}`);
  
  if (invalidRefs.length > 0) {
    Logger.log('Sample invalid opportunity references:');
    invalidRefs.forEach(ref => {
      Logger.log(`  Row ${ref.row} (${ref.account}): Opp ID "${ref.oppId}"`);
    });
  }
  
  return {
    valid: validCount,
    empty: emptyCount,
    invalid: invalidCount,
    invalidRefs: invalidRefs
  };
}

/**
 * Find orphaned records (records that reference deleted entities)
 */
function findOrphanedRecords(sheets) {
  const orphans = {
    emails: [],
    calendar: [],
    github: [],
    meetingRecaps: [],
    actionItems: []
  };
  
  // Build valid account IDs
  const validAccountIds = new Set();
  if (sheets.accounts) {
    const accountData = sheets.accounts.getDataRange().getValues();
    const accountHeaders = accountData[0];
    const idIdx = accountHeaders.indexOf('Id');
    
    for (let i = 1; i < accountData.length; i++) {
      const id = accountData[i][idIdx];
      if (id) validAccountIds.add(id);
    }
  }
  
  // Check emails
  if (sheets.emails && validAccountIds.size > 0) {
    const emailData = sheets.emails.getDataRange().getValues();
    const emailHeaders = emailData[0];
    const accountIdIdx = emailHeaders.indexOf('Account ID');
    
    for (let i = 1; i < emailData.length; i++) {
      const accountId = emailData[i][accountIdIdx];
      if (accountId && !validAccountIds.has(accountId)) {
        orphans.emails.push(i + 1);
      }
    }
  }
  
  // Check calendar
  if (sheets.calendar && validAccountIds.size > 0) {
    const calendarData = sheets.calendar.getDataRange().getValues();
    const calendarHeaders = calendarData[0];
    const accountIdIdx = calendarHeaders.indexOf('Account ID');
    
    for (let i = 1; i < calendarData.length; i++) {
      const accountId = calendarData[i][accountIdIdx];
      if (accountId && !validAccountIds.has(accountId)) {
        orphans.calendar.push(i + 1);
      }
    }
  }
  
  // Check GitHub
  if (sheets.github && validAccountIds.size > 0) {
    const githubData = sheets.github.getDataRange().getValues();
    const githubHeaders = githubData[0];
    const accountIdIdx = githubHeaders.indexOf('Account ID');
    
    for (let i = 1; i < githubData.length; i++) {
      const accountId = githubData[i][accountIdIdx];
      if (accountId && !validAccountIds.has(accountId)) {
        orphans.github.push(i + 1);
      }
    }
  }
  
  // Check meeting recaps
  if (sheets.meetingRecaps && validAccountIds.size > 0) {
    const recapData = sheets.meetingRecaps.getDataRange().getValues();
    const recapHeaders = recapData[0];
    const accountIdIdx = recapHeaders.indexOf('Account ID');
    
    for (let i = 1; i < recapData.length; i++) {
      const accountId = recapData[i][accountIdIdx];
      if (accountId && !validAccountIds.has(accountId)) {
        orphans.meetingRecaps.push(i + 1);
      }
    }
  }
  
  // Check action items (orphaned from meeting recaps)
  if (sheets.actionItems && sheets.meetingRecaps) {
    const validRecapIds = new Set();
    const recapData = sheets.meetingRecaps.getDataRange().getValues();
    const recapHeaders = recapData[0];
    const recapIdIdx = recapHeaders.indexOf('Meeting Recap ID');
    
    for (let i = 1; i < recapData.length; i++) {
      const recapId = recapData[i][recapIdIdx];
      if (recapId) validRecapIds.add(recapId);
    }
    
    const actionData = sheets.actionItems.getDataRange().getValues();
    const actionHeaders = actionData[0];
    const actionRecapIdIdx = actionHeaders.indexOf('Meeting Recap ID');
    
    for (let i = 1; i < actionData.length; i++) {
      const recapId = actionData[i][actionRecapIdIdx];
      if (recapId && !validRecapIds.has(recapId)) {
        orphans.actionItems.push(i + 1);
      }
    }
  }
  
  Logger.log(`Orphaned emails: ${orphans.emails.length}`);
  Logger.log(`Orphaned calendar events: ${orphans.calendar.length}`);
  Logger.log(`Orphaned GitHub tasks: ${orphans.github.length}`);
  Logger.log(`Orphaned meeting recaps: ${orphans.meetingRecaps.length}`);
  Logger.log(`Orphaned action items: ${orphans.actionItems.length}`);
  
  return orphans;
}

/**
 * Print summary of all results
 */
function printSummary(results) {
  Logger.log('\n' + '='.repeat(80));
  Logger.log('SUMMARY');
  Logger.log('='.repeat(80));
  
  let totalIssues = 0;
  
  if (results.emailReferences) {
    Logger.log('\nEmail Communications → Accounts:');
    Logger.log(`  ✓ Valid: ${results.emailReferences.valid}`);
    Logger.log(`  ✓ Fixed: ${results.emailReferences.fixed}`);
    Logger.log(`  ✗ Invalid: ${results.emailReferences.invalid}`);
    totalIssues += results.emailReferences.invalid;
  }
  
  if (results.calendarReferences) {
    Logger.log('\nCalendar Events → Accounts:');
    Logger.log(`  ✓ Valid: ${results.calendarReferences.valid}`);
    Logger.log(`  ○ Empty: ${results.calendarReferences.empty}`);
    Logger.log(`  ✗ Invalid: ${results.calendarReferences.invalid}`);
    totalIssues += results.calendarReferences.invalid;
  }
  
  if (results.githubReferences) {
    Logger.log('\nGitHub Tasks → Accounts:');
    Logger.log(`  ✓ Valid: ${results.githubReferences.valid}`);
    Logger.log(`  ○ Empty: ${results.githubReferences.empty}`);
    Logger.log(`  ✗ Invalid: ${results.githubReferences.invalid}`);
    totalIssues += results.githubReferences.invalid;
  }
  
  if (results.meetingRecapReferences) {
    Logger.log('\nWebhook Meeting Recaps → Accounts:');
    Logger.log(`  ✓ Valid: ${results.meetingRecapReferences.valid}`);
    Logger.log(`  ○ Empty: ${results.meetingRecapReferences.empty}`);
    Logger.log(`  ✗ Invalid: ${results.meetingRecapReferences.invalid}`);
    totalIssues += results.meetingRecapReferences.invalid;
  }
  
  if (results.actionItemReferences) {
    Logger.log('\nMeeting Action Items → Meeting Recaps:');
    Logger.log(`  ✓ Valid: ${results.actionItemReferences.valid}`);
    Logger.log(`  ○ Empty: ${results.actionItemReferences.empty}`);
    Logger.log(`  ✗ Invalid: ${results.actionItemReferences.invalid}`);
    totalIssues += results.actionItemReferences.invalid;
  }
  
  if (results.accountOpportunityReferences) {
    Logger.log('\nAccounts → Opportunities:');
    Logger.log(`  ✓ Valid: ${results.accountOpportunityReferences.valid}`);
    Logger.log(`  ○ Empty: ${results.accountOpportunityReferences.empty}`);
    Logger.log(`  ✗ Invalid: ${results.accountOpportunityReferences.invalid}`);
    totalIssues += results.accountOpportunityReferences.invalid;
  }
  
  if (results.orphanedRecords) {
    const totalOrphans = 
      results.orphanedRecords.emails.length +
      results.orphanedRecords.calendar.length +
      results.orphanedRecords.github.length +
      results.orphanedRecords.meetingRecaps.length +
      results.orphanedRecords.actionItems.length;
    
    Logger.log(`\nOrphaned Records: ${totalOrphans}`);
    totalIssues += totalOrphans;
  }
  
  Logger.log('\n' + '='.repeat(80));
  if (totalIssues === 0) {
    Logger.log('✅ ALL REFERENCES ARE VALID!');
  } else {
    Logger.log(`⚠️ TOTAL ISSUES FOUND: ${totalIssues}`);
  }
  Logger.log('='.repeat(80));
}

/**
 * Manual function with UI
 */
function comprehensiveRemappingManual() {
  try {
    const ui = SpreadsheetApp.getUi();
    
    const response = ui.alert(
      'Comprehensive Table Remapping',
      'This will verify and fix all table references across the entire system:\n\n' +
      '• Email Communications → Accounts\n' +
      '• Calendar Events → Accounts\n' +
      '• GitHub Tasks → Accounts\n' +
      '• Webhook Meeting Recaps → Accounts\n' +
      '• Meeting Action Items → Meeting Recaps\n' +
      '• Accounts → Opportunities\n' +
      '• Find orphaned records\n\n' +
      'This may take a few minutes.\n\n' +
      'Continue?',
      ui.ButtonSet.YES_NO
    );
    
    if (response !== ui.Button.YES) {
      return;
    }
    
    const result = comprehensiveRemapping();
    
    ui.alert(
      'Remapping Complete',
      'All table references have been verified and fixed.\n\n' +
      'Check the execution logs (View > Logs) for detailed results.',
      ui.ButtonSet.OK
    );
    
  } catch (error) {
    Logger.log('ERROR: ' + error.message);
    SpreadsheetApp.getUi().alert(
      'Remapping Failed',
      'Error: ' + error.message,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}
