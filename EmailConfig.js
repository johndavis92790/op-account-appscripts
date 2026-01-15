/**
 * Email Import Configuration
 * 
 * Configure multiple CSV imports from Gmail
 * Each config specifies: search query, sheet name, and whether to mark as read
 */

const EMAIL_CONFIGS = [
  {
    id: 'renewal-opportunities',
    name: 'Renewal Opportunities',
    emailSearchQuery: 'subject:"Report - Master - Renewal Opportunities" has:attachment filename:csv newer_than:1d',
    sheetName: 'Renewal Opportunities',
    markAsRead: false
  },
  {
    id: 'opptys-report',
    name: 'Opptys Report',
    emailSearchQuery: 'subject:"Report - John Opptys Report" has:attachment filename:csv newer_than:1d',
    sheetName: 'Opptys Report',
    markAsRead: false
  },
  {
    id: 'accounts-card',
    name: 'Accounts Card Report',
    emailSearchQuery: 'subject:"Report - John Accounts Card Report" has:attachment filename:csv newer_than:1d',
    sheetName: 'Accounts Card Report',
    markAsRead: false
  },
  // Add more configurations here following this pattern:
  // {
  //   id: 'unique-id',
  //   name: 'Display Name',
  //   emailSearchQuery: 'subject:"Your Subject" has:attachment filename:csv newer_than:1d',
  //   sheetName: 'Sheet Name',
  //   markAsRead: false
  // }
];

/**
 * Get all email import configurations
 */
function getEmailConfigs() {
  return EMAIL_CONFIGS;
}

/**
 * Get a specific email config by ID
 */
function getEmailConfig(configId) {
  if (!configId) {
    return EMAIL_CONFIGS[0];
  }
  
  const config = EMAIL_CONFIGS.find(c => c.id === configId);
  if (!config) {
    throw new Error(`Email config not found: ${configId}`);
  }
  
  return config;
}

/**
 * Legacy function for backward compatibility
 */
function getEmailConfigLegacy() {
  return getEmailConfig();
}
