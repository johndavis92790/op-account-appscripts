/**
 * Fix Missing Accounts in Meeting Recaps
 * 
 * This script scans the Webhook Meeting Recaps sheet for entries with missing Account IDs
 * and attempts to populate them by checking email domains of attendees.
 */

/**
 * Main function to fix missing accounts in meeting recaps
 */
function fixMissingAccountsInMeetingRecaps() {
  const startTime = new Date();
  Logger.log('=== Starting Fix Missing Accounts ===');
  
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const recapsSheet = spreadsheet.getSheetByName('Webhook Meeting Recaps');
    
    if (!recapsSheet) {
      throw new Error('Webhook Meeting Recaps sheet not found');
    }
    
    const data = recapsSheet.getDataRange().getValues();
    if (data.length <= 1) {
      Logger.log('No meeting recaps found');
      return { success: true, fixed: 0, total: 0 };
    }
    
    const headers = data[0];
    const accountIdIdx = headers.indexOf('Account ID');
    const accountNameIdx = headers.indexOf('Account Name');
    const opportunityIdIdx = headers.indexOf('Opportunity ID');
    const opportunityNameIdx = headers.indexOf('Opportunity Name');
    const mappedDomainIdx = headers.indexOf('Mapped Domain');
    const actualAttendeesIdx = headers.indexOf('Actual Attendees');
    const invitedAttendeesIdx = headers.indexOf('Invited Attendees');
    const externalAttendeesIdx = headers.indexOf('External Attendees');
    const recapIdIdx = headers.indexOf('Meeting Recap ID');
    
    if (accountIdIdx === -1 || actualAttendeesIdx === -1) {
      throw new Error('Required columns not found in Webhook Meeting Recaps sheet');
    }
    
    // Build domain and account maps once for efficiency
    const domainToAccountMap = buildDomainToAccountMap();
    const accountMap = buildAccountMap();
    
    Logger.log(`Domain map has ${domainToAccountMap.size} domains`);
    Logger.log(`Account map has ${accountMap.size} accounts`);
    
    let fixed = 0;
    let total = 0;
    
    // Process each row
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const accountId = row[accountIdIdx];
      const recapId = row[recapIdIdx];
      
      // Skip if already has an account ID
      if (accountId && accountId.toString().trim() !== '') {
        continue;
      }
      
      total++;
      Logger.log(`\nProcessing recap ${recapId} (row ${i + 1})...`);
      
      // Get all attendee emails
      const actualAttendees = row[actualAttendeesIdx] ? row[actualAttendeesIdx].toString().split(',').map(e => e.trim()) : [];
      const invitedAttendees = row[invitedAttendeesIdx] ? row[invitedAttendeesIdx].toString().split(',').map(e => e.trim()) : [];
      
      // Combine and deduplicate
      const allAttendees = [...new Set([...actualAttendees, ...invitedAttendees])];
      
      Logger.log(`  All attendees: ${allAttendees.join(', ')}`);
      
      // Filter out observepoint.com emails
      const externalEmails = allAttendees.filter(email => 
        email && !email.toLowerCase().includes('observepoint.com')
      );
      
      Logger.log(`  External emails: ${externalEmails.join(', ')}`);
      
      // Try to find account by checking each external email
      let accountInfo = null;
      let mappedDomain = '';
      
      for (const email of externalEmails) {
        accountInfo = findAccountByEmailCached(email, domainToAccountMap, accountMap);
        if (accountInfo) {
          mappedDomain = getEmailDomainForAccount(email);
          Logger.log(`  ✓ Found account: ${accountInfo.accountName} (${accountInfo.accountId}) via ${email}`);
          break;
        }
      }
      
      if (accountInfo) {
        // Update the row with account information
        const rowNum = i + 1;
        recapsSheet.getRange(rowNum, accountIdIdx + 1).setValue(accountInfo.accountId);
        recapsSheet.getRange(rowNum, accountNameIdx + 1).setValue(accountInfo.accountName);
        recapsSheet.getRange(rowNum, opportunityIdIdx + 1).setValue(accountInfo.opportunityId || '');
        recapsSheet.getRange(rowNum, opportunityNameIdx + 1).setValue(accountInfo.opportunityName || '');
        recapsSheet.getRange(rowNum, mappedDomainIdx + 1).setValue(mappedDomain);
        
        // Update external attendees if needed
        if (externalAttendeesIdx !== -1) {
          recapsSheet.getRange(rowNum, externalAttendeesIdx + 1).setValue(externalEmails.join(', '));
        }
        
        fixed++;
        Logger.log(`  ✓ Fixed row ${rowNum}`);
      } else {
        Logger.log(`  ❌ No account found for external emails: ${externalEmails.join(', ')}`);
        
        // Log the domains we tried
        for (const email of externalEmails) {
          const domain = getEmailDomainForAccount(email);
          if (domain) {
            Logger.log(`    - Domain "${domain}" not in mapping`);
          }
        }
      }
    }
    
    const duration = (new Date() - startTime) / 1000;
    Logger.log(`\n=== Fix Complete in ${duration}s ===`);
    Logger.log(`Fixed: ${fixed} / ${total} missing accounts`);
    
    return {
      success: true,
      fixed: fixed,
      total: total,
      duration: duration
    };
    
  } catch (error) {
    Logger.log('ERROR: ' + error.message);
    Logger.log(error.stack);
    throw error;
  }
}

/**
 * Manual function with UI feedback
 */
function fixMissingAccountsInMeetingRecapsManual() {
  try {
    const ui = SpreadsheetApp.getUi();
    
    const response = ui.alert(
      'Fix Missing Accounts',
      'This will scan all meeting recaps and attempt to populate missing Account IDs by checking attendee email domains.\n\n' +
      'Make sure the "Accounts to Email Domains Mapping" sheet is up to date.\n\n' +
      'Continue?',
      ui.ButtonSet.YES_NO
    );
    
    if (response !== ui.Button.YES) {
      return;
    }
    
    const result = fixMissingAccountsInMeetingRecaps();
    
    if (result.success) {
      const message = result.total === 0
        ? 'No meeting recaps with missing accounts found.'
        : `Fixed ${result.fixed} out of ${result.total} meeting recaps with missing accounts.\n\n` +
          `Duration: ${result.duration.toFixed(1)}s\n\n` +
          (result.fixed < result.total 
            ? `${result.total - result.fixed} could not be matched. Check the logs for details and ensure their domains are in the mapping sheet.`
            : 'All missing accounts have been fixed!');
      
      ui.alert(
        'Fix Complete',
        message,
        ui.ButtonSet.OK
      );
    }
    
  } catch (error) {
    Logger.log('Error in manual fix: ' + error.message);
    SpreadsheetApp.getUi().alert(
      'Fix Failed',
      'Error: ' + error.message,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}

/**
 * Analyze which domains are missing from the mapping
 */
function analyzeMissingDomains() {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const recapsSheet = spreadsheet.getSheetByName('Webhook Meeting Recaps');
    
    if (!recapsSheet) {
      throw new Error('Webhook Meeting Recaps sheet not found');
    }
    
    const data = recapsSheet.getDataRange().getValues();
    const headers = data[0];
    const accountIdIdx = headers.indexOf('Account ID');
    const actualAttendeesIdx = headers.indexOf('Actual Attendees');
    const invitedAttendeesIdx = headers.indexOf('Invited Attendees');
    
    const domainToAccountMap = buildDomainToAccountMap();
    const unmappedDomains = new Map(); // domain -> count
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const accountId = row[accountIdIdx];
      
      // Only check rows without account IDs
      if (accountId && accountId.toString().trim() !== '') {
        continue;
      }
      
      const actualAttendees = row[actualAttendeesIdx] ? row[actualAttendeesIdx].toString().split(',').map(e => e.trim()) : [];
      const invitedAttendees = row[invitedAttendeesIdx] ? row[invitedAttendeesIdx].toString().split(',').map(e => e.trim()) : [];
      const allAttendees = [...new Set([...actualAttendees, ...invitedAttendees])];
      
      const externalEmails = allAttendees.filter(email => 
        email && !email.toLowerCase().includes('observepoint.com')
      );
      
      for (const email of externalEmails) {
        const domain = getEmailDomainForAccount(email);
        if (domain && !domainToAccountMap.has(domain)) {
          unmappedDomains.set(domain, (unmappedDomains.get(domain) || 0) + 1);
        }
      }
    }
    
    Logger.log('\n=== Unmapped Domains Analysis ===');
    Logger.log(`Found ${unmappedDomains.size} unmapped domains:\n`);
    
    const sortedDomains = Array.from(unmappedDomains.entries())
      .sort((a, b) => b[1] - a[1]);
    
    for (const [domain, count] of sortedDomains) {
      Logger.log(`  ${domain} (${count} occurrences)`);
    }
    
    return {
      unmappedDomains: sortedDomains,
      totalUnmapped: unmappedDomains.size
    };
    
  } catch (error) {
    Logger.log('ERROR: ' + error.message);
    throw error;
  }
}

/**
 * Manual function to analyze unmapped domains
 */
function analyzeMissingDomainsManual() {
  try {
    const result = analyzeMissingDomains();
    
    let message = `Found ${result.totalUnmapped} unmapped domains.\n\n`;
    
    if (result.totalUnmapped > 0) {
      message += 'Top unmapped domains:\n';
      const top10 = result.unmappedDomains.slice(0, 10);
      for (const [domain, count] of top10) {
        message += `• ${domain} (${count})\n`;
      }
      
      if (result.totalUnmapped > 10) {
        message += `\n... and ${result.totalUnmapped - 10} more.\n`;
      }
      
      message += '\nCheck the execution log for the full list.';
    } else {
      message += 'All domains are mapped!';
    }
    
    SpreadsheetApp.getUi().alert(
      'Unmapped Domains Analysis',
      message,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    
  } catch (error) {
    Logger.log('Error in analysis: ' + error.message);
    SpreadsheetApp.getUi().alert(
      'Analysis Failed',
      'Error: ' + error.message,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}
