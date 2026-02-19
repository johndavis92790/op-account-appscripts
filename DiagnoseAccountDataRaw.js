/**
 * Diagnostic Script for Account Data Raw
 * 
 * Helps identify why specific accounts are missing from Account Data Raw
 */

/**
 * Diagnose why specific accounts are missing
 */
function diagnoseAccountDataRaw() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  
  // Target accounts to diagnose
  const targetAccounts = [
    { id: '0010W00002dxTO4QAM', name: 'Accent Group' },
    { id: '001d000001RcsVKAAZ', name: 'Agilent' }
  ];
  
  Logger.log('=== Diagnosing Account Data Raw ===\n');
  
  // Load all source data
  const accountsSheet = spreadsheet.getSheetByName('Accounts Card Report');
  const opptysSheet = spreadsheet.getSheetByName('Opptys Report');
  const renewalSheet = spreadsheet.getSheetByName('Renewal Opportunities');
  
  if (!accountsSheet || !opptysSheet || !renewalSheet) {
    Logger.log('ERROR: Missing required sheets');
    return;
  }
  
  const accountsData = accountsSheet.getDataRange().getValues();
  const accountsHeaders = accountsData[0];
  const opptysData = opptysSheet.getDataRange().getValues();
  const opptysHeaders = opptysData[0];
  const renewalData = renewalSheet.getDataRange().getValues();
  const renewalHeaders = renewalData[0];
  
  // Get column indices
  const accountIdIdx = accountsHeaders.indexOf('Id');
  const accountNameIdx = accountsHeaders.indexOf('Name');
  const nextRenewalOppIdIdx = accountsHeaders.indexOf('next_renewal_opportunity_id');
  
  const oppIdIdx = opptysHeaders.indexOf('Id');
  const oppNameIdx = opptysHeaders.indexOf('Name');
  
  const linkColIdx = renewalHeaders.indexOf('Link to SF Opportunity');
  
  Logger.log(`Accounts Card Report: ${accountsData.length - 1} rows`);
  Logger.log(`Opptys Report: ${opptysData.length - 1} rows`);
  Logger.log(`Renewal Opportunities: ${renewalData.length - 1} rows\n`);
  
  // Build maps
  const oppIdToNameMap = new Map();
  for (let i = 1; i < opptysData.length; i++) {
    const oppId = opptysData[i][oppIdIdx];
    const oppName = opptysData[i][oppNameIdx];
    if (oppId && oppName) {
      oppIdToNameMap.set(oppId, oppName);
    }
  }
  
  const renewalOpportunityMap = new Map();
  for (let i = 1; i < renewalData.length; i++) {
    const linkCell = renewalData[i][linkColIdx];
    if (linkCell) {
      const oppName = extractOpportunityNameFromLink(linkCell);
      if (oppName) {
        renewalOpportunityMap.set(oppName, { linkCell, rowNum: i + 1 });
      }
    }
  }
  
  Logger.log(`Built oppIdToNameMap with ${oppIdToNameMap.size} entries`);
  Logger.log(`Built renewalOpportunityMap with ${renewalOpportunityMap.size} entries\n`);
  
  // Diagnose each target account
  for (const target of targetAccounts) {
    Logger.log(`\n${'='.repeat(60)}`);
    Logger.log(`DIAGNOSING: ${target.name} (${target.id})`);
    Logger.log('='.repeat(60));
    
    // Step 1: Find in Accounts Card Report
    let accountRow = null;
    let accountRowNum = -1;
    for (let i = 1; i < accountsData.length; i++) {
      if (accountsData[i][accountIdIdx] === target.id) {
        accountRow = accountsData[i];
        accountRowNum = i + 1;
        break;
      }
    }
    
    if (!accountRow) {
      Logger.log(`❌ STEP 1: Account NOT FOUND in Accounts Card Report`);
      continue;
    }
    
    Logger.log(`✓ STEP 1: Found in Accounts Card Report (row ${accountRowNum})`);
    const nextRenewalOppId = accountRow[nextRenewalOppIdIdx];
    Logger.log(`  - next_renewal_opportunity_id: "${nextRenewalOppId}"`);
    
    // Step 2: Find opportunity name in Opptys Report
    const oppName = oppIdToNameMap.get(nextRenewalOppId);
    if (!oppName) {
      Logger.log(`❌ STEP 2: Opportunity ID "${nextRenewalOppId}" NOT FOUND in Opptys Report`);
      Logger.log(`  - This account will be EXCLUDED from Account Data Raw`);
      Logger.log(`  - FIX: Check if the opportunity exists in Opptys Report`);
      continue;
    }
    
    Logger.log(`✓ STEP 2: Found opportunity in Opptys Report`);
    Logger.log(`  - Opportunity Name: "${oppName}"`);
    
    // Step 3: Find in Renewal Opportunities
    const renewalInfo = renewalOpportunityMap.get(oppName);
    if (!renewalInfo) {
      Logger.log(`❌ STEP 3: Opportunity "${oppName}" NOT FOUND in Renewal Opportunities`);
      Logger.log(`  - This account will be EXCLUDED from Account Data Raw`);
      Logger.log(`  - FIX: Check Renewal Opportunities sheet for this opportunity`);
      
      // Check if there's a similar name
      Logger.log(`\n  Searching for similar opportunity names in Renewal Opportunities:`);
      let foundSimilar = false;
      for (let i = 1; i < renewalData.length; i++) {
        const linkCell = renewalData[i][linkColIdx];
        if (linkCell) {
          const extractedName = extractOpportunityNameFromLink(linkCell);
          if (extractedName && extractedName.toLowerCase().includes(target.name.toLowerCase())) {
            Logger.log(`    - Row ${i + 1}: "${extractedName}"`);
            Logger.log(`      Link cell: ${linkCell}`);
            foundSimilar = true;
          }
        }
      }
      if (!foundSimilar) {
        Logger.log(`    - No similar names found`);
      }
      
      continue;
    }
    
    Logger.log(`✓ STEP 3: Found in Renewal Opportunities (row ${renewalInfo.rowNum})`);
    Logger.log(`  - Link cell: ${renewalInfo.linkCell}`);
    Logger.log(`\n✅ CONCLUSION: This account SHOULD be included in Account Data Raw`);
  }
  
  Logger.log(`\n${'='.repeat(60)}`);
  Logger.log('DIAGNOSIS COMPLETE');
  Logger.log('='.repeat(60));
}

/**
 * Manual function with UI
 */
function diagnoseAccountDataRawManual() {
  try {
    diagnoseAccountDataRaw();
    
    SpreadsheetApp.getUi().alert(
      'Diagnosis Complete',
      'Check the execution logs (View > Logs) for detailed diagnostic information.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    
  } catch (error) {
    Logger.log('ERROR: ' + error.message);
    Logger.log(error.stack);
    SpreadsheetApp.getUi().alert(
      'Diagnosis Failed',
      'Error: ' + error.message,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}

/**
 * List all accounts and their inclusion status
 */
function listAllAccountsStatus() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  
  const accountsSheet = spreadsheet.getSheetByName('Accounts Card Report');
  const opptysSheet = spreadsheet.getSheetByName('Opptys Report');
  const renewalSheet = spreadsheet.getSheetByName('Renewal Opportunities');
  
  const accountsData = accountsSheet.getDataRange().getValues();
  const accountsHeaders = accountsData[0];
  const opptysData = opptysSheet.getDataRange().getValues();
  const opptysHeaders = opptysData[0];
  const renewalData = renewalSheet.getDataRange().getValues();
  const renewalHeaders = renewalData[0];
  
  const accountIdIdx = accountsHeaders.indexOf('Id');
  const accountNameIdx = accountsHeaders.indexOf('Name');
  const nextRenewalOppIdIdx = accountsHeaders.indexOf('next_renewal_opportunity_id');
  
  const oppIdIdx = opptysHeaders.indexOf('Id');
  const oppNameIdx = opptysHeaders.indexOf('Name');
  const linkColIdx = renewalHeaders.indexOf('Link to SF Opportunity');
  
  // Build maps
  const oppIdToNameMap = new Map();
  for (let i = 1; i < opptysData.length; i++) {
    oppIdToNameMap.set(opptysData[i][oppIdIdx], opptysData[i][oppNameIdx]);
  }
  
  const renewalOpportunityMap = new Set();
  for (let i = 1; i < renewalData.length; i++) {
    const linkCell = renewalData[i][linkColIdx];
    if (linkCell) {
      const oppName = extractOpportunityNameFromLink(linkCell);
      if (oppName) {
        renewalOpportunityMap.add(oppName);
      }
    }
  }
  
  Logger.log('=== Account Inclusion Status ===\n');
  Logger.log('Format: [Status] Account Name (Account ID) - Reason\n');
  
  let included = 0;
  let excluded = 0;
  const excludedAccounts = [];
  
  for (let i = 1; i < accountsData.length; i++) {
    const accountId = accountsData[i][accountIdIdx];
    const accountName = accountsData[i][accountNameIdx];
    const nextRenewalOppId = accountsData[i][nextRenewalOppIdIdx];
    
    const oppName = oppIdToNameMap.get(nextRenewalOppId);
    
    if (!oppName) {
      excluded++;
      excludedAccounts.push({
        name: accountName,
        id: accountId,
        reason: `Opportunity ID "${nextRenewalOppId}" not in Opptys Report`
      });
    } else if (!renewalOpportunityMap.has(oppName)) {
      excluded++;
      excludedAccounts.push({
        name: accountName,
        id: accountId,
        reason: `Opportunity "${oppName}" not in Renewal Opportunities`
      });
    } else {
      included++;
    }
  }
  
  Logger.log(`✓ INCLUDED: ${included} accounts`);
  Logger.log(`❌ EXCLUDED: ${excluded} accounts\n`);
  
  if (excludedAccounts.length > 0) {
    Logger.log('EXCLUDED ACCOUNTS:');
    for (const account of excludedAccounts) {
      Logger.log(`  ❌ ${account.name} (${account.id})`);
      Logger.log(`     Reason: ${account.reason}`);
    }
  }
  
  return {
    included,
    excluded,
    excludedAccounts
  };
}

/**
 * Manual function to list all accounts
 */
function listAllAccountsStatusManual() {
  try {
    const result = listAllAccountsStatus();
    
    let message = `Included: ${result.included} accounts\n`;
    message += `Excluded: ${result.excluded} accounts\n\n`;
    
    if (result.excluded > 0) {
      message += 'Check the execution logs for details on excluded accounts.';
    }
    
    SpreadsheetApp.getUi().alert(
      'Account Status Report',
      message,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    
  } catch (error) {
    Logger.log('ERROR: ' + error.message);
    SpreadsheetApp.getUi().alert(
      'Report Failed',
      'Error: ' + error.message,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}
