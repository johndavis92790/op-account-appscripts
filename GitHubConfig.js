/**
 * GitHub Projects Configuration
 * 
 * Configure GitHub Projects API access and sheet settings
 */

function getGitHubConfig() {
  const scriptProperties = PropertiesService.getScriptProperties();
  const githubToken = scriptProperties.getProperty('GITHUB_TOKEN');
  
  return {
    // GitHub Personal Access Token stored in Script Properties
    // Set using: setGitHubToken('your_token_here')
    githubToken: githubToken,
    
    // Your GitHub username
    githubUsername: 'johndavis92790',
    
    // Project number from URL: https://github.com/users/johndavis92790/projects/2/views/1
    projectNumber: 2,
    
    // Sheet name where GitHub tasks will be written
    sheetName: 'GitHub Tasks',
    
    // Status column mapping (customize if your project uses different status names)
    statusColumns: {
      'Backlog': 'Backlog',
      'Blocked': 'Blocked',
      'Ready': 'Ready',
      'In progress': 'In Progress',
      'Done': 'Done'
    }
  };
}

/**
 * Set GitHub Personal Access Token in Script Properties
 * Run this once to securely store your token
 */
function setGitHubToken(token) {
  if (!token) {
    throw new Error('Token is required. Usage: setGitHubToken("your_token_here")');
  }
  
  const scriptProperties = PropertiesService.getScriptProperties();
  scriptProperties.setProperty('GITHUB_TOKEN', token);
  
  Logger.log('GitHub token saved successfully to Script Properties');
  
  SpreadsheetApp.getUi().alert(
    'GitHub Token Saved',
    '✅ Your GitHub token has been securely saved.\n\nYou can now run testGitHubImport() to test the connection.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * Remove GitHub token from Script Properties
 */
function removeGitHubToken() {
  const scriptProperties = PropertiesService.getScriptProperties();
  scriptProperties.deleteProperty('GITHUB_TOKEN');
  
  Logger.log('GitHub token removed from Script Properties');
  
  SpreadsheetApp.getUi().alert(
    'GitHub Token Removed',
    'Your GitHub token has been removed from Script Properties.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * Validate GitHub configuration
 */
function validateGitHubConfig() {
  const config = getGitHubConfig();
  const errors = [];
  
  if (!config.githubToken) {
    errors.push('GitHub token not configured. Please run: setGitHubToken("your_token_here")');
  }
  
  if (!config.githubUsername) {
    errors.push('GitHub username not configured.');
  }
  
  if (!config.projectNumber) {
    errors.push('Project number not configured.');
  }
  
  if (errors.length > 0) {
    throw new Error('Configuration errors:\n' + errors.join('\n'));
  }
  
  return config;
}
