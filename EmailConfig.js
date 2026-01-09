/**
 * Email Import Configuration
 * 
 * Configure how to find and import CSV files from Gmail
 */

const EMAIL_CONFIG = {
  emailSearchQuery: 'subject:"Renewal Opportunities" has:attachment filename:csv newer_than:7d',
  
  sheetName: 'Renewal Opportunities',
  
  markAsRead: false,
};

function getEmailConfig() {
  const props = PropertiesService.getScriptProperties();
  
  if (props.getProperty('EMAIL_SEARCH_QUERY')) {
    EMAIL_CONFIG.emailSearchQuery = props.getProperty('EMAIL_SEARCH_QUERY');
  }
  if (props.getProperty('SHEET_NAME')) {
    EMAIL_CONFIG.sheetName = props.getProperty('SHEET_NAME');
  }
  
  return EMAIL_CONFIG;
}
