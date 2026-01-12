/**
 * Opportunity to Email Domain Mapping
 * 
 * Maintains a mapping sheet that syncs opportunities from Renewal Opportunities
 * and allows manual entry of associated email domains for matching
 */

const MAPPING_SHEET_NAME = 'Opportunities to Email Domains Mapping';

/**
 * Update the mapping sheet with opportunities from Renewal Opportunities sheet
 * Called automatically after CSV import
 */
function updateOpportunityMapping() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const renewalSheet = spreadsheet.getSheetByName('Renewal Opportunities');
  
  if (!renewalSheet) {
    Logger.log('Renewal Opportunities sheet not found');
    return;
  }
  
  const renewalData = renewalSheet.getDataRange().getValues();
  
  if (renewalData.length === 0) {
    Logger.log('No data in Renewal Opportunities sheet');
    return;
  }
  
  const headers = renewalData[0];
  const linkColumnIndex = headers.indexOf('Link to SF Opportunity');
  
  if (linkColumnIndex === -1) {
    Logger.log('Link to SF Opportunity column not found');
    return;
  }
  
  const opportunities = [];
  for (let i = 1; i < renewalData.length; i++) {
    const linkCell = renewalData[i][linkColumnIndex];
    if (linkCell) {
      opportunities.push(linkCell);
    }
  }
  
  let mappingSheet = spreadsheet.getSheetByName(MAPPING_SHEET_NAME);
  
  if (!mappingSheet) {
    mappingSheet = spreadsheet.insertSheet(MAPPING_SHEET_NAME);
    
    mappingSheet.getRange(1, 1, 1, 2).setValues([['Link to SF Opportunity', 'Email Domains']]);
    mappingSheet.getRange(1, 1, 1, 2)
      .setFontWeight('bold')
      .setBackground('#f4b400')
      .setFontColor('#ffffff');
    
    mappingSheet.setColumnWidth(1, 400);
    mappingSheet.setColumnWidth(2, 300);
    mappingSheet.setFrozenRows(1);
    
    Logger.log('Created new mapping sheet');
  }
  
  const existingData = mappingSheet.getDataRange().getValues();
  const existingOpportunities = new Map();
  
  for (let i = 1; i < existingData.length; i++) {
    const link = existingData[i][0];
    const domains = existingData[i][1];
    if (link) {
      existingOpportunities.set(link, domains || '');
    }
  }
  
  const newMappingData = [['Link to SF Opportunity', 'Email Domains']];
  
  for (const opportunity of opportunities) {
    const existingDomains = existingOpportunities.get(opportunity) || '';
    newMappingData.push([opportunity, existingDomains]);
  }
  
  mappingSheet.clear();
  
  if (newMappingData.length > 0) {
    mappingSheet.getRange(1, 1, newMappingData.length, 2).setValues(newMappingData);
    
    const linkColumnRange = mappingSheet.getRange(2, 1, newMappingData.length - 1, 1);
    for (let i = 2; i <= newMappingData.length; i++) {
      const cellValue = newMappingData[i - 1][0];
      const cell = mappingSheet.getRange(i, 1);
      
      if (cellValue && typeof cellValue === 'string' && cellValue.startsWith('=HYPERLINK')) {
        cell.setFormula(cellValue);
      } else {
        cell.setValue(cellValue);
      }
    }
    
    mappingSheet.getRange(1, 1, 1, 2)
      .setFontWeight('bold')
      .setBackground('#f4b400')
      .setFontColor('#ffffff');
    
    mappingSheet.setFrozenRows(1);
    
    const domainsRange = mappingSheet.getRange(2, 2, newMappingData.length - 1, 1);
    domainsRange.setNote('Enter email domains (e.g., company.com, example.org) separated by commas');
  }
  
  Logger.log(`Updated mapping sheet with ${opportunities.length} opportunities`);
}

/**
 * Get email domain from an email address
 */
function getEmailDomain(email) {
  if (!email || typeof email !== 'string') return '';
  const match = email.match(/@(.+)$/);
  return match ? match[1].toLowerCase() : '';
}

/**
 * Find opportunity by email domain
 * Returns the Link to SF Opportunity for a given email or domain
 */
function findOpportunityByEmail(email) {
  const domain = getEmailDomain(email);
  if (!domain) return null;
  
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const mappingSheet = spreadsheet.getSheetByName(MAPPING_SHEET_NAME);
  
  if (!mappingSheet) {
    Logger.log('Mapping sheet not found');
    return null;
  }
  
  const data = mappingSheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    const opportunity = data[i][0];
    const domains = data[i][1];
    
    if (domains && typeof domains === 'string') {
      const domainList = domains.split(',').map(d => d.trim().toLowerCase());
      if (domainList.includes(domain)) {
        return opportunity;
      }
    }
  }
  
  return null;
}

/**
 * Manual function to initialize or refresh the mapping sheet
 */
function initializeOpportunityMapping() {
  try {
    updateOpportunityMapping();
    
    SpreadsheetApp.getUi().alert(
      'Mapping Sheet Updated',
      'Opportunities to Email Domains Mapping sheet has been updated.\n\nPlease fill in the Email Domains column with domains (e.g., company.com) for each opportunity.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    
  } catch (error) {
    Logger.log('Error initializing mapping: ' + error.message);
    SpreadsheetApp.getUi().alert(
      'Error',
      'Failed to initialize mapping sheet: ' + error.message,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}
