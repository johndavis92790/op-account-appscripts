/**
 * Account to Email Domain Mapping
 * 
 * Core functions for account-centric data model.
 * Maps email domains to accounts (not opportunities).
 * Accounts are the persistent entity; opportunities are transient renewals.
 */

const ACCOUNT_MAPPING_SHEET_NAME = 'Accounts to Email Domains Mapping';
const ACCOUNTS_CARD_SHEET_NAME = 'Accounts Card Report';
const OPPTYS_REPORT_SHEET_NAME = 'Opptys Report';
const RENEWAL_OPPORTUNITIES_SHEET_NAME = 'Renewal Opportunities';

/**
 * Build a lookup map of Opportunity ID -> Account info
 * Only includes accounts that have active opportunities in Renewal Opportunities
 */
function buildOpportunityToAccountMap() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  
  // Get Renewal Opportunities to find active opportunity names
  const renewalSheet = spreadsheet.getSheetByName(RENEWAL_OPPORTUNITIES_SHEET_NAME);
  if (!renewalSheet) {
    Logger.log('Renewal Opportunities sheet not found');
    return new Map();
  }
  
  const renewalData = renewalSheet.getDataRange().getValues();
  const renewalHeaders = renewalData[0];
  const linkColIndex = renewalHeaders.indexOf('Link to SF Opportunity');
  
  // Extract active opportunity IDs from the Renewal Opportunities link column.
  // Handles both plain URLs and =HYPERLINK() formulas.
  const activeOpportunityIds = new Set();
  for (let i = 1; i < renewalData.length; i++) {
    const linkCell = renewalData[i][linkColIndex];
    if (linkCell) {
      const oppId = extractOpportunityIdFromLink(linkCell);
      if (oppId) {
        activeOpportunityIds.add(oppId);
      }
    }
  }
  
  Logger.log(`Found ${activeOpportunityIds.size} active opportunity IDs in Renewal Opportunities`);
  
  // Get Opptys Report to map Opportunity ID -> Opportunity Name
  const opptysSheet = spreadsheet.getSheetByName(OPPTYS_REPORT_SHEET_NAME);
  if (!opptysSheet) {
    Logger.log('Opptys Report sheet not found');
    return new Map();
  }
  
  const opptysData = opptysSheet.getDataRange().getValues();
  const opptysHeaders = opptysData[0];
  const oppIdIndex = opptysHeaders.indexOf('Id');
  const oppNameIndex = opptysHeaders.indexOf('Name');
  
  const oppIdToName = new Map();
  for (let i = 1; i < opptysData.length; i++) {
    const oppId = opptysData[i][oppIdIndex];
    const oppName = opptysData[i][oppNameIndex];
    if (oppId && oppName) {
      oppIdToName.set(oppId, oppName);
    }
  }
  
  // Get Accounts Card Report to map Opportunity ID -> Account
  const accountsSheet = spreadsheet.getSheetByName(ACCOUNTS_CARD_SHEET_NAME);
  if (!accountsSheet) {
    Logger.log('Accounts Card Report sheet not found');
    return new Map();
  }
  
  const accountsData = accountsSheet.getDataRange().getValues();
  const accountsHeaders = accountsData[0];
  const accountIdIndex = accountsHeaders.indexOf('Id');
  const accountNameIndex = accountsHeaders.indexOf('Name');
  const nextRenewalOppIdIndex = accountsHeaders.indexOf('next_renewal_opportunity_id');
  
  // Build Opportunity ID -> Account info map
  const oppIdToAccount = new Map();
  for (let i = 1; i < accountsData.length; i++) {
    const accountId = accountsData[i][accountIdIndex];
    const accountName = accountsData[i][accountNameIndex];
    const nextRenewalOppId = accountsData[i][nextRenewalOppIdIndex];
    
    if (accountId && nextRenewalOppId) {
      oppIdToAccount.set(nextRenewalOppId, {
        accountId: accountId,
        accountName: accountName,
        opportunityId: nextRenewalOppId
      });
    }
  }
  
  // Now build the final map: only include accounts with active opportunities
  const result = new Map();
  for (const oppId of activeOpportunityIds) {
    if (oppIdToAccount.has(oppId)) {
      const accountInfo = oppIdToAccount.get(oppId);
      accountInfo.opportunityName = oppIdToName.get(oppId) || '';
      result.set(oppId, accountInfo);
    }
  }
  
  Logger.log(`Built opportunity-to-account map with ${result.size} active accounts`);
  return result;
}

/**
 * Build a lookup map of Account ID -> Account info (with opportunity details)
 * Only includes accounts that have active opportunities in Renewal Opportunities
 */
function buildAccountMap() {
  const oppToAccountMap = buildOpportunityToAccountMap();
  const accountMap = new Map();
  
  for (const [oppId, accountInfo] of oppToAccountMap) {
    accountMap.set(accountInfo.accountId, accountInfo);
  }
  
  return accountMap;
}

/**
 * Extract opportunity name from hyperlink formula or plain text
 * e.g., =HYPERLINK("...", "2026 - REN - Torrid") -> "2026 - REN - Torrid"
 */
function extractOpportunityNameFromLink(linkCell) {
  if (!linkCell) return null;
  
  if (typeof linkCell === 'string') {
    // Check if it's a HYPERLINK formula
    const match = linkCell.match(/=HYPERLINK\s*\(\s*"[^"]+"\s*,\s*"([^"]+)"\s*\)/i);
    if (match) {
      return match[1];
    }
    // Plain text
    return linkCell;
  }
  
  return null;
}

/**
 * Extract Salesforce opportunity ID from a link cell.
 * Handles both plain URLs and =HYPERLINK() formulas.
 * e.g., "https://...salesforce.com/006VH00000hSNozYAG" -> "006VH00000hSNozYAG"
 * e.g., =HYPERLINK("https://...salesforce.com/006VH00000hSNozYAG", "2027 - REN - Acme") -> "006VH00000hSNozYAG"
 */
function extractOpportunityIdFromLink(linkCell) {
  if (!linkCell) return null;
  
  let url = null;
  
  if (typeof linkCell === 'string') {
    // Check if it's a HYPERLINK formula — extract the URL from the first argument
    const hyperlinkMatch = linkCell.match(/=HYPERLINK\s*\(\s*"([^"]+)"/i);
    if (hyperlinkMatch) {
      url = hyperlinkMatch[1];
    } else {
      // Plain URL
      url = linkCell;
    }
  }
  
  if (!url) return null;
  
  // Extract the Salesforce ID (15 or 18 char alphanumeric) from the end of the URL path
  const idMatch = url.match(/\/([a-zA-Z0-9]{15,18})(?:[\/\?#]|$)/);
  return idMatch ? idMatch[1] : null;
}

/**
 * Extract clean account name from opportunity name
 * e.g., "2026 - REN - Torrid" -> "Torrid"
 * But we prefer using the Account Name from Accounts Card Report
 */
function extractAccountNameFromOpportunity(oppName) {
  if (!oppName) return null;
  
  // Pattern: YYYY - REN - Account Name or similar
  const match = oppName.match(/^\d{4}\s*-\s*\w+\s*-\s*(.+)$/);
  if (match) {
    return match[1].trim();
  }
  
  return oppName;
}

/**
 * Get email domain from an email address
 * Handles formats like: "Name <email@domain.com>", "email@domain.com", etc.
 */
function getEmailDomainForAccount(email) {
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
 * Find account by email domain
 * Returns { accountId, accountName, opportunityId, opportunityName } or null
 */
function findAccountByEmail(email) {
  const domain = getEmailDomainForAccount(email);
  if (!domain) return null;
  
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const mappingSheet = spreadsheet.getSheetByName(ACCOUNT_MAPPING_SHEET_NAME);
  
  if (!mappingSheet) {
    Logger.log('Account mapping sheet not found');
    return null;
  }
  
  const data = mappingSheet.getDataRange().getValues();
  const headers = data[0];
  const accountIdIndex = headers.indexOf('Account ID');
  const accountNameIndex = headers.indexOf('Account Name');
  const domainsIndex = headers.indexOf('Email Domains');
  
  for (let i = 1; i < data.length; i++) {
    const accountId = data[i][accountIdIndex];
    const accountName = data[i][accountNameIndex];
    const domains = data[i][domainsIndex];
    
    if (domains && typeof domains === 'string') {
      const domainList = domains.split(',').map(d => d.trim().toLowerCase());
      if (domainList.includes(domain)) {
        // Look up opportunity info for this account
        const accountMap = buildAccountMap();
        const accountInfo = accountMap.get(accountId);
        
        return {
          accountId: accountId,
          accountName: accountName,
          opportunityId: accountInfo ? accountInfo.opportunityId : null,
          opportunityName: accountInfo ? accountInfo.opportunityName : null
        };
      }
    }
  }
  
  return null;
}

/**
 * Find account by email - cached version for batch operations
 * Pass in pre-built maps for efficiency
 */
function findAccountByEmailCached(email, domainToAccountMap, accountMap) {
  const domain = getEmailDomainForAccount(email);
  if (!domain) return null;
  
  const accountInfo = domainToAccountMap.get(domain);
  if (!accountInfo) return null;
  
  // Enrich with opportunity info if available
  const fullAccountInfo = accountMap.get(accountInfo.accountId);
  
  return {
    accountId: accountInfo.accountId,
    accountName: accountInfo.accountName,
    opportunityId: fullAccountInfo ? fullAccountInfo.opportunityId : null,
    opportunityName: fullAccountInfo ? fullAccountInfo.opportunityName : null
  };
}

/**
 * Build a domain -> account lookup map for batch operations
 */
function buildDomainToAccountMap() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const mappingSheet = spreadsheet.getSheetByName(ACCOUNT_MAPPING_SHEET_NAME);
  
  if (!mappingSheet) {
    Logger.log('Account mapping sheet not found');
    return new Map();
  }
  
  const data = mappingSheet.getDataRange().getValues();
  const headers = data[0];
  const accountIdIndex = headers.indexOf('Account ID');
  const accountNameIndex = headers.indexOf('Account Name');
  const domainsIndex = headers.indexOf('Email Domains');
  
  const domainToAccount = new Map();
  
  for (let i = 1; i < data.length; i++) {
    const accountId = data[i][accountIdIndex];
    const accountName = data[i][accountNameIndex];
    const domains = data[i][domainsIndex];
    
    if (domains && typeof domains === 'string') {
      const domainList = domains.split(',').map(d => d.trim().toLowerCase());
      for (const domain of domainList) {
        if (domain) {
          domainToAccount.set(domain, {
            accountId: accountId,
            accountName: accountName
          });
        }
      }
    }
  }
  
  Logger.log(`Built domain-to-account map with ${domainToAccount.size} domains`);
  return domainToAccount;
}

/**
 * Update the account mapping sheet with accounts from Accounts Card Report.
 * IMPORTANT: NEVER clears or removes existing rows. Only APPENDS new accounts
 * that don't already exist in the sheet. Existing rows (including inactive
 * accounts and manually maintained email domains) are always preserved.
 */
function updateAccountMapping() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let mappingSheet = spreadsheet.getSheetByName(ACCOUNT_MAPPING_SHEET_NAME);
  
  if (!mappingSheet) {
    mappingSheet = spreadsheet.insertSheet(ACCOUNT_MAPPING_SHEET_NAME);
    mappingSheet.getRange(1, 1, 1, 3).setValues([['Account ID', 'Account Name', 'Email Domains']]);
    mappingSheet.getRange(1, 1, 1, 3)
      .setFontWeight('bold')
      .setBackground('#f4b400')
      .setFontColor('#ffffff');
    mappingSheet.setColumnWidth(1, 200);
    mappingSheet.setColumnWidth(2, 250);
    mappingSheet.setColumnWidth(3, 300);
    mappingSheet.setFrozenRows(1);
    Logger.log('Created new account mapping sheet');
  }
  
  // Build set of existing account IDs (NEVER remove these)
  const existingData = mappingSheet.getDataRange().getValues();
  const existingAccountIds = new Set();
  
  for (let i = 1; i < existingData.length; i++) {
    const accountId = String(existingData[i][0] || '').trim();
    if (accountId) {
      existingAccountIds.add(accountId);
    }
  }
  
  Logger.log(`Existing mapping sheet has ${existingAccountIds.size} accounts`);
  
  // Get active accounts from Accounts Card Report
  const accountMap = buildAccountMap();
  
  // Find new accounts that need to be added (append only)
  const newRows = [];
  for (const [accountId, accountInfo] of accountMap) {
    if (!existingAccountIds.has(accountId)) {
      newRows.push([accountId, accountInfo.accountName, '']);
    }
  }
  
  // Sort new rows by account name
  newRows.sort((a, b) => (a[1] || '').localeCompare(b[1] || ''));
  
  // Append new rows (NEVER clear or overwrite existing data)
  if (newRows.length > 0) {
    const nextRow = mappingSheet.getLastRow() + 1;
    mappingSheet.getRange(nextRow, 1, newRows.length, 3).setValues(newRows);
    
    // Add helper note to new empty domain cells
    const domainsRange = mappingSheet.getRange(nextRow, 3, newRows.length, 1);
    domainsRange.setNote('Enter email domains (e.g., company.com, example.org) separated by commas');
    
    Logger.log(`Appended ${newRows.length} new accounts to mapping sheet`);
  } else {
    Logger.log('No new accounts to add to mapping sheet');
  }
}

/**
 * Manual function to initialize or refresh the account mapping sheet
 */
function initializeAccountMapping() {
  try {
    updateAccountMapping();
    
    SpreadsheetApp.getUi().alert(
      'Account Mapping Sheet Updated',
      'Accounts to Email Domains Mapping sheet has been updated.\n\nPlease fill in the Email Domains column with domains (e.g., company.com) for each account.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    
  } catch (error) {
    Logger.log('Error initializing account mapping: ' + error.message);
    SpreadsheetApp.getUi().alert(
      'Error',
      'Failed to initialize account mapping sheet: ' + error.message,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}

/**
 * Get all active accounts with their opportunity info
 * Returns array of { accountId, accountName, opportunityId, opportunityName }
 */
function getActiveAccounts() {
  const accountMap = buildAccountMap();
  return Array.from(accountMap.values());
}

/**
 * Get account info by account ID
 */
function getAccountById(accountId) {
  const accountMap = buildAccountMap();
  return accountMap.get(accountId) || null;
}

/**
 * Get account info by opportunity name
 */
function getAccountByOpportunityName(opportunityName) {
  const oppToAccountMap = buildOpportunityToAccountMap();
  
  for (const [oppId, accountInfo] of oppToAccountMap) {
    if (accountInfo.opportunityName === opportunityName) {
      return accountInfo;
    }
  }
  
  return null;
}
